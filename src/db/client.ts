import { createClient, type Client } from '@libsql/client'
import { getDatabaseConfig, type DatabaseConfig } from './config'
import { LibSqlD1Adapter } from './adapter'
import { runMigrations } from './migrations'
import { seedDatabase } from './seed'

let cachedClient: Client | null = null
let cachedAdapter: LibSqlD1Adapter | null = null
let initPromise: Promise<void> | null = null

/**
 * Initializes and caches the singleton LibSQL client connection.
 * Supports remote serverless Turso database connections as well as
 * persistent local storage to prevent data loss on cold starts.
 */
export function getLibSqlClient(options?: Partial<DatabaseConfig>): Client {
  if (cachedClient && !options) {
    return cachedClient
  }

  const config = options ? { ...getDatabaseConfig(), ...options } : getDatabaseConfig()

  const client = createClient({
    url: config.url,
    authToken: config.authToken
  })

  if (!options) {
    cachedClient = client
  }

  return client
}

/**
 * Ensures that idempotent migrations and reference seed data
 * are applied to the database before processing requests.
 */
export async function ensureDatabaseInitialized(client?: Client): Promise<void> {
  const targetClient = client || getLibSqlClient()

  if (!initPromise) {
    initPromise = (async () => {
      try {
        // Check if essential tables exist
        const check = await targetClient.execute(
          `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='clients';`
        )
        const exists = Number(check.rows[0]?.count || 0) > 0

        if (!exists) {
          // Fresh database: apply schema migrations and seeds
          await runMigrations(targetClient)
          await seedDatabase(targetClient)
        }
      } catch (err) {
        initPromise = null // Allow retry on failure
        throw err
      }
    })()
  }

  await initPromise
}

/**
 * Returns a Cloudflare D1-compatible database adapter wrapping LibSQL.
 * Ensures that domain services and existing routes function transparently.
 */
export function getD1Database(options?: Partial<DatabaseConfig>): LibSqlD1Adapter {
  if (cachedAdapter && !options) {
    return cachedAdapter
  }

  const client = getLibSqlClient(options)
  const adapter = new LibSqlD1Adapter(client)

  if (!options) {
    cachedAdapter = adapter
  }

  return adapter
}

/**
 * Helper to create an isolated database instance for unit testing.
 */
export async function createTestDatabase(url: string = 'file::memory:', seed: boolean = true): Promise<{
  client: Client
  db: LibSqlD1Adapter
}> {
  const client = createClient({ url })
  const adapter = new LibSqlD1Adapter(client)

  await runMigrations(client)
  if (seed) {
    await seedDatabase(client)
  }

  return { client, db: adapter }
}

/**
 * Closes all active database connections and resets singletons.
 */
export function closeDatabase(): void {
  if (cachedClient) {
    try {
      cachedClient.close()
    } catch {}
    cachedClient = null
    cachedAdapter = null
    initPromise = null
  }
}
