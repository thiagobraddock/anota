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
const EXPLICIT_TRANSACTION_PATTERN = /\b(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)\b/i

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

// Migrations with no tracking table got re-run on every single server boot
// (there was nothing to record "already applied"). A pair of them adds a
// column and a later one drops it - each add/drop cycle permanently burns
// one of Postgres's max 1600 columns per table, since a dropped column's
// slot is never reclaimed. Months of restarts eventually exhausted that
// budget on `notes`, hard-failing ANY further ALTER TABLE ADD COLUMN
// (error 54011) - which is what silently broke every migration after it.
// These are already fully reflected in schema.sql, so they're seeded as
// applied instead of re-run.
const LEGACY_NOOP_MIGRATIONS = [
  '001_private_by_default.sql',
  '002_add_yjs_state.sql',
  '003_device_ownership.sql',
  '004_remove_yjs_state.sql',
  '005_add_automerge_state.sql',
  '006_remove_automerge_state.sql',
]

async function runSchemaAndMigrations(client) {
  // First run schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
  await runSQL(client, schema)
  console.log('Database schema initialized')

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  const appliedResult = await client.query('SELECT name FROM schema_migrations')
  const applied = new Set(appliedResult.rows.map((row) => row.name))

  for (const name of LEGACY_NOOP_MIGRATIONS) {
    if (!applied.has(name)) {
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name])
      applied.add(name)
    }
  }

  // A missing migrations directory is fine (nothing to run); any other
  // error - e.g. a real SQL failure in one of the files - must NOT be
  // swallowed, or later migrations silently never get applied and the
  // schema silently drifts from what the code expects.
  const migrationsDir = join(__dirname, 'migrations')
  let files
  try {
    files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('No migrations directory found, skipping')
      return
    }
    throw err
  }

  for (const file of files) {
    if (applied.has(file)) continue
    const migration = readFileSync(join(migrationsDir, file), 'utf-8')
    await runSQL(client, migration)
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    console.log(`Migration ${file} applied`)
  }
}

function shouldUseTransaction(statements) {
  return statements.every((statement) => {
    return (
      !EXPLICIT_TRANSACTION_PATTERN.test(statement) &&
      !/\b(CREATE|DROP)\s+INDEX\s+CONCURRENTLY\b|\bREINDEX\b|\bVACUUM\b|\bCLUSTER\b|\bREFRESH\s+MATERIALIZED\s+VIEW\s+CONCURRENTLY\b/iu.test(statement)
    )
  })
}

function splitSQLStatements(sql) {
  const statements = []
  let current = ''
  let quote = null
  let dollarQuote = null
  let lineComment = false
  let blockComment = false

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const next = sql[index + 1]

    if (lineComment) {
      if (char === '\n') {
        lineComment = false
      }
      continue
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        index += 1
        blockComment = false
      }
      continue
    }

    if (dollarQuote) {
      current += char
      if (sql.startsWith(dollarQuote, index)) {
        current += dollarQuote.slice(1)
        index += dollarQuote.length - 1
        dollarQuote = null
      }
      continue
    }

    if (quote) {
      current += char
      if (char === quote && next === quote) {
        current += next
        index += 1
      } else if (char === quote && sql[index - 1] !== '\\') {
        quote = null
      }
      continue
    }

    if (char === '-' && next === '-') {
      current += char + next
      index += 1
      lineComment = true
      continue
    }

    if (char === '/' && next === '*') {
      current += char + next
      index += 1
      blockComment = true
      continue
    }

    if (char === '\'' || char === '"') {
      quote = char
      current += char
      continue
    }

    if (char === '$') {
      const match = sql.slice(index).match(/^\$[A-Za-z0-9_]*\$/)
      if (match) {
        dollarQuote = match[0]
        current += dollarQuote
        index += dollarQuote.length - 1
        continue
      }
    }

    if (char === ';') {
      const statement = current.trim()
      if (statement) {
        statements.push(statement)
      }
      current = ''
      continue
    }

    current += char
  }

  const finalStatement = current.trim()
  if (finalStatement) {
    statements.push(finalStatement)
  }

  return statements
}

async function runSQL(client, sql) {
  const statements = splitSQLStatements(sql)

  if (statements.length === 0) {
    return
  }

  if (!shouldUseTransaction(statements)) {
    for (const statement of statements) {
      await client.query(statement)
    }
    return
  }

  await client.query('BEGIN')
  try {
    for (const statement of statements) {
      await client.query(statement)
    }
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

const DEFAULT_QUERY_RETRIES = 2
const DEFAULT_QUERY_RETRY_DELAY_MS = 300

// Runs a query and retries on transient connection errors (e.g. the managed
// Postgres instance restarting for maintenance), so a brief blip doesn't
// surface as a 500 to the user on their next click.
export async function query(text, params) {
  const maxRetries = Math.max(1, getNumberEnv('DB_QUERY_MAX_RETRIES', DEFAULT_QUERY_RETRIES))

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await pool.query(text, params)
      if (attempt > 1) {
        recordDBReachable()
      }
      return result
    } catch (error) {
      const transient = isTransientConnectionError(error)
      recordDBError(error, { context: 'query', attempt, transient })

      if (!transient || attempt === maxRetries) {
        throw error
      }

      const delay = getNumberEnv('DB_QUERY_RETRY_DELAY_MS', DEFAULT_QUERY_RETRY_DELAY_MS)
      console.warn('Query retry scheduled after transient DB error', {
        attempt,
        maxRetries,
        delayMs: delay,
        error: dbState.lastError,
      })
      await sleep(delay)
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
    try {
      await dbState.healthCheckPromise
    } catch (error) {
      console.warn('Shared PostgreSQL healthcheck failed', serializeError(error))
    }
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

  try {
    await dbState.healthCheckPromise
  } catch (error) {
    console.warn('PostgreSQL healthcheck execution failed', serializeError(error))
  }

  return getDBStatus()
}

export default pool
