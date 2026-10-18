import path from 'node:path'
import fs from 'node:fs'

export interface DatabaseConfig {
  url: string
  authToken?: string
  isRemote: boolean
}

/**
 * Resolves database connection configuration.
 * Prioritizes remote serverless database URLs (Turso LibSQL, Supabase, Neon),
 * and falls back to a persistent local SQLite file in ./data/law_firm.db
 * to prevent data loss across restarts or cold starts.
 */
export function getDatabaseConfig(): DatabaseConfig {
  const env = (globalThis as any).process?.env || {}

  // 1. Check for remote serverless database URLs (Turso LibSQL / Neon / Supabase)
  const remoteUrl = env.TURSO_DATABASE_URL || env.DATABASE_URL || env.LIBSQL_URL
  if (remoteUrl && !remoteUrl.startsWith('file:')) {
    return {
      url: remoteUrl,
      authToken: env.TURSO_AUTH_TOKEN || env.DATABASE_AUTH_TOKEN,
      isRemote: true
    }
  }

  // 2. Local persistent database file fallback
  // Can be customized via SQLITE_PATH or DATABASE_PATH
  const localPath = env.SQLITE_PATH || env.DATABASE_PATH || './data/law_firm.db'
  const isMemory = localPath === ':memory:' || localPath === 'file::memory:'

  let url = localPath
  if (!url.startsWith('file:') && !isMemory) {
    url = `file:${localPath}`
  }

  // Auto-create local directory if missing to avoid SQLite open errors
  if (url.startsWith('file:') && !isMemory) {
    try {
      const cleanPath = url.replace(/^file:/, '')
      const resolved = path.resolve(cleanPath)
      const dir = path.dirname(resolved)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    } catch {
      // Best-effort directory creation
    }
  }

  return {
    url,
    isRemote: false
  }
}
