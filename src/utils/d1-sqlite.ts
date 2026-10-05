/**
 * Fallback SQLite Database Adapter
 * Implements Cloudflare D1 interface on Node.js / Vercel using built-in node:sqlite
 */
import { SCHEMA_SQL, SEED_SQL } from './embedded-data'

let cachedAdapter: any = null

export function getFallbackD1(): any {
  if (cachedAdapter) return cachedAdapter

  try {
    // Dynamic native require to avoid bundler issues in Cloudflare workers
    const req = typeof (globalThis as any).require !== 'undefined' ? (globalThis as any).require : null
    if (!req) return null
    
    let DatabaseSync: any = null
    try {
      const sqlite = req('node:sqlite')
      DatabaseSync = sqlite?.DatabaseSync
    } catch {
      return null
    }
    if (!DatabaseSync) return null

    const dbPath = (globalThis as any).process?.env?.SQLITE_PATH || ':memory:'
    const rawDb = new DatabaseSync(dbPath)

    if (SCHEMA_SQL) rawDb.exec(SCHEMA_SQL)
    if (SEED_SQL) rawDb.exec(SEED_SQL)

    class PreparedStatement {
      private db: any
      private sql: string
      private binds: any[] = []

      constructor(db: any, sql: string) {
        this.db = db
        this.sql = sql
      }

      bind(...args: any[]) {
        const stmt = new PreparedStatement(this.db, this.sql)
        stmt.binds = args.map((a) => (a === undefined ? null : a))
        return stmt
      }

      async first<T = any>(): Promise<T | null> {
        const stmt = this.db.prepare(this.sql)
        const row = stmt.get(...this.binds)
        return (row as T) || null
      }

      async all<T = any>(): Promise<{ results: T[]; success: boolean; meta: any }> {
        const stmt = this.db.prepare(this.sql)
        const results = stmt.all(...this.binds) as T[]
        return { results, success: true, meta: {} }
      }

      async run(): Promise<{ success: boolean; meta: { last_row_id: number; changes: number } }> {
        const stmt = this.db.prepare(this.sql)
        const res = stmt.run(...this.binds)
        return {
          success: true,
          meta: {
            last_row_id: Number(res.lastInsertRowid || 0),
            changes: Number(res.changes || 0)
          }
        }
      }
    }

    cachedAdapter = {
      prepare(sql: string) {
        return new PreparedStatement(rawDb, sql)
      },
      async batch(statements: any[]) {
        return Promise.all(statements.map((s) => s.run()))
      }
    }

    return cachedAdapter
  } catch (err) {
    console.error('Fallback SQLite error:', err)
    return null
  }
}
