import path from 'node:path'
import fs from 'node:fs'
import { config } from '../config/env'

export interface DatabaseConfig {
  url: string
  authToken?: string
  isRemote: boolean
}

/**
 * Resolves database connection configuration using centralized environment config.
 * Prioritizes remote serverless database URLs (Turso LibSQL, Supabase, Neon),
 * and falls back to a persistent local SQLite file in ./data/law_firm.db
 * to prevent data loss across restarts or cold starts.
 */
export function getDatabaseConfig(): DatabaseConfig {
  // 1. Check for remote serverless database URLs (Turso LibSQL / Neon / Supabase)
  const remoteUrl = config.database.url
  if (remoteUrl && !remoteUrl.startsWith('file:')) {
    return {
      url: remoteUrl,
      authToken: config.database.authToken,
      isRemote: true
    }
  }

  // 2. Local persistent database file fallback
  // Can be customized via SQLITE_PATH or DATABASE_PATH
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  )

  let localPath = config.database.localPath
  // If running in serverless and pointing to read-only ./data, redirect to /tmp
  if (isServerless && (localPath.startsWith('./data') || localPath.startsWith('data/'))) {
    localPath = '/tmp/law_firm.db'
  }

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
      // In serverless / read-only filesystem, fallback to /tmp
      try {
        const tmpDir = path.resolve('/tmp')
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true })
        }
        url = 'file:/tmp/law_firm.db'
      } catch {
        url = 'file::memory:'
      }
    }
  }

  return {
    url,
    isRemote: false
  }
}
