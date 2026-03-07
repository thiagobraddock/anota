import pg from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export async function initDB() {
  // First run schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
  await pool.query(schema)
  console.log('Database schema initialized')
  
  // Then run migrations
  const migrationsDir = join(__dirname, 'migrations')
  try {
    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
    for (const file of files) {
      const migration = readFileSync(join(migrationsDir, file), 'utf-8')
      await pool.query(migration)
      console.log(`Migration ${file} applied`)
    }
  } catch (err) {
    console.log('No migrations to run or migrations dir missing')
  }
}

export default pool
