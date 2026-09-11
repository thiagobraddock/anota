import pg from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const TRANSIENT_ERROR_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT'])
const TRANSIENT_ERROR_MESSAGES = [
  'Connection terminated unexpectedly',
  'server closed the connection unexpectedly',
  'terminating connection due to administrator command',
]
const DEFAULT_INIT_RETRIES = 5
const DEFAULT_RETRY_DELAY_MS = 1000
const DEFAULT_MAX_RETRY_DELAY_MS = 10000
const DEFAULT_HEALTHCHECK_CACHE_MS = 5000

const dbState = {
  reachable: false,
  initialized: false,
  initializing: false,
  lastError: null,
  lastReadyAt: null,
  lastHealthCheckAt: null,
  lastHealthCheckResult: null,
  healthCheckPromise: null,
}

function getNumberEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function getErrorList(error) {
  return [error, ...(Array.isArray(error?.errors) ? error.errors : [])].filter(Boolean)
}

function serializeError(error) {
  return {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    errno: error?.errno,
    syscall: error?.syscall,
    address: error?.address,
    port: error?.port,
  }
}

function recordDBReachable() {
  const now = new Date().toISOString()
  dbState.reachable = true
  dbState.initializing = false
  dbState.lastHealthCheckAt = now
  dbState.lastHealthCheckResult = { reachable: true }

  if (dbState.initialized) {
    dbState.lastError = null
  }
}

function recordDBInitialized() {
  const now = new Date().toISOString()
  dbState.initialized = true
  dbState.lastReadyAt = now
  dbState.lastError = null
  recordDBReachable()
}

function recordDBError(error, context = {}) {
  const now = new Date().toISOString()
  dbState.reachable = false
  dbState.initializing = context.context === 'startup'
  if (dbState.initializing) {
    dbState.initialized = false
  }
  dbState.lastError = {
    ...context,
    ...serializeError(error),
    nestedErrors: getErrorList(error).slice(1).map(serializeError),
  }
  dbState.lastHealthCheckAt = now
  dbState.lastHealthCheckResult = { reachable: false }
}

function isTransientConnectionError(error) {
  const errors = getErrorList(error)
  return errors.some((entry) => {
    if (TRANSIENT_ERROR_CODES.has(entry?.code)) {
      return true
    }

    const message = entry?.message || ''
    return TRANSIENT_ERROR_MESSAGES.some((fragment) => message.includes(fragment))
  })
}

function getRetryDelay(attempt) {
  const baseDelay = getNumberEnv('DB_INIT_RETRY_DELAY_MS', DEFAULT_RETRY_DELAY_MS)
  const maxDelay = getNumberEnv('DB_INIT_MAX_BACKOFF_MS', DEFAULT_MAX_RETRY_DELAY_MS)
  return Math.min(baseDelay * 2 ** Math.max(attempt - 1, 0), maxDelay)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: getNumberEnv('PG_POOL_MAX', 10),
  connectionTimeoutMillis: getNumberEnv('PG_CONNECTION_TIMEOUT_MILLIS', 10000),
  idleTimeoutMillis: getNumberEnv('PG_IDLE_TIMEOUT_MILLIS', 30000),
  maxLifetimeSeconds: getNumberEnv('PG_MAX_LIFETIME_SECONDS', 300),
  allowExitOnIdle: process.env.NODE_ENV !== 'production',
})

pool.on('error', (error) => {
  recordDBError(error, { context: 'pool' })
  console.error('PostgreSQL pool error', dbState.lastError)
})

async function runSchemaAndMigrations(client) {
  // First run schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
  await runSQL(client, schema)
  console.log('Database schema initialized')
  
  // Then run migrations
  const migrationsDir = join(__dirname, 'migrations')
  try {
    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
    for (const file of files) {
      const migration = readFileSync(join(migrationsDir, file), 'utf-8')
      await runSQL(client, migration)
      console.log(`Migration ${file} applied`)
    }
  } catch (err) {
    console.log('No migrations to run or migrations dir missing')
  }
}

function shouldUseTransaction(sql) {
  return !/\b(CREATE|DROP)\s+INDEX\s+CONCURRENTLY\b|\bREINDEX\b|\bVACUUM\b|\bCLUSTER\b|\bREFRESH\s+MATERIALIZED\s+VIEW\s+CONCURRENTLY\b/iu.test(sql)
}

async function runSQL(client, sql) {
  if (!shouldUseTransaction(sql)) {
    await client.query(sql)
    return
  }

  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query('COMMIT')
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      console.error('Database initialization rollback failed', serializeError(rollbackError))
    }

    throw error
  }
}

export async function initDB() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured')
  }

  const maxRetries = Math.max(1, getNumberEnv('DB_INIT_MAX_RETRIES', DEFAULT_INIT_RETRIES))
  dbState.initializing = true

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    let client
    let destroyClient = false

    try {
      client = await pool.connect()
      await client.query('SELECT 1')
      await runSchemaAndMigrations(client)
      recordDBInitialized()
      return
    } catch (error) {
      const transient = isTransientConnectionError(error)
      destroyClient = transient
      recordDBError(error, { context: 'startup', attempt, transient })

      if (!transient || attempt === maxRetries) {
        dbState.initializing = false
        throw new Error(`Database initialization failed after ${attempt} attempt(s)`, {
          cause: error,
        })
      }

      const delay = getRetryDelay(attempt)
      console.warn('Database initialization retry scheduled', {
        attempt,
        maxRetries,
        delayMs: delay,
        error: dbState.lastError,
      })
      await sleep(delay)
    } finally {
      if (client) {
        client.release(destroyClient ? new Error('Discarding unhealthy PostgreSQL client') : undefined)
      }
    }
  }
}

export function getDBStatus() {
  return {
    reachable: dbState.reachable,
    initialized: dbState.initialized,
    initializing: dbState.initializing,
    lastReadyAt: dbState.lastReadyAt,
    lastHealthCheckAt: dbState.lastHealthCheckAt,
    lastError: dbState.lastError,
  }
}

export async function checkDBHealth() {
  const cacheMs = getNumberEnv('DB_HEALTHCHECK_CACHE_MS', DEFAULT_HEALTHCHECK_CACHE_MS)

  if (dbState.healthCheckPromise) {
    await dbState.healthCheckPromise
    return getDBStatus()
  }

  if (
    dbState.lastHealthCheckResult &&
    dbState.lastHealthCheckAt &&
    Date.now() - Date.parse(dbState.lastHealthCheckAt) < cacheMs
  ) {
    return getDBStatus()
  }

  dbState.healthCheckPromise = (async () => {
    try {
      await pool.query('SELECT 1')
      recordDBReachable()
    } catch (error) {
      recordDBError(error, { context: 'healthcheck' })
      console.warn('PostgreSQL healthcheck failed', dbState.lastError)
    } finally {
      dbState.healthCheckPromise = null
    }
  })()

  await dbState.healthCheckPromise
  return getDBStatus()
}

export default pool
