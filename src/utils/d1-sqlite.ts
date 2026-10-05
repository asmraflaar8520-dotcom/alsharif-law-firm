/**
 * Fallback SQLite Database Adapter
 * Implements Cloudflare D1 interface on Node.js / Vercel using built-in node:sqlite
 */
import fs from 'node:fs'
import path from 'node:path'

let cachedAdapter: any = null

export function getFallbackD1(): any {
  if (cachedAdapter) return cachedAdapter

  try {
    // Dynamic native require to avoid bundler issues in Cloudflare workers
    const req = typeof require !== 'undefined' ? require : null
    if (!req) return null
    
    const { DatabaseSync } = req('node:sqlite')
    if (!DatabaseSync) return null

    const dbPath = process.env.SQLITE_PATH || (process.platform === 'win32' ? path.join(process.cwd(), '.local.db') : '/tmp/sharif_law.db')
    const isNew = !fs.existsSync(dbPath)
    const rawDb = new DatabaseSync(dbPath)

    if (isNew) {
      const baseDir = process.cwd()
      const m1Path = path.join(baseDir, 'migrations', '0001_initial_schema.sql')
      const m2Path = path.join(baseDir, 'migrations', '0002_performance_indexes.sql')
      const seedPath = path.join(baseDir, 'seed.sql')

      if (fs.existsSync(m1Path)) rawDb.exec(fs.readFileSync(m1Path, 'utf8'))
      if (fs.existsSync(m2Path)) rawDb.exec(fs.readFileSync(m2Path, 'utf8'))
      if (fs.existsSync(seedPath)) rawDb.exec(fs.readFileSync(seedPath, 'utf8'))
    }

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
