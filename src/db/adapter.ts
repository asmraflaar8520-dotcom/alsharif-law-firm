import type { Client, InStatement } from '@libsql/client'

/**
 * PreparedStatement implementation for LibSQL (@libsql/client)
 * matching Cloudflare D1 interface specifications.
 */
export class LibSqlPreparedStatement {
  public sql: string
  public binds: any[] = []
  private client: Client

  constructor(client: Client, sql: string, binds: any[] = []) {
    this.client = client
    this.sql = sql
    this.binds = binds
  }

  bind(...args: any[]): LibSqlPreparedStatement {
    const sanitized = args.map((a) => (a === undefined ? null : a))
    return new LibSqlPreparedStatement(this.client, this.sql, sanitized)
  }

  async first<T = any>(colName?: string): Promise<T | null> {
    const res = await this.client.execute({ sql: this.sql, args: this.binds })
    const row = res.rows[0] as any
    if (!row) return null
    if (colName) {
      return (row[colName] as T) ?? null
    }
    return row as T
  }

  async all<T = any>(): Promise<{ results: T[]; success: boolean; meta: any }> {
    const res = await this.client.execute({ sql: this.sql, args: this.binds })
    return {
      results: (res.rows as unknown as T[]) || [],
      success: true,
      meta: {
        changes: Number(res.rowsAffected || 0),
        last_row_id: Number(res.lastInsertRowid !== undefined ? res.lastInsertRowid : 0)
      }
    }
  }

  async run(): Promise<{ success: boolean; meta: { last_row_id: number; changes: number } }> {
    const res = await this.client.execute({ sql: this.sql, args: this.binds })
    return {
      success: true,
      meta: {
        last_row_id: Number(res.lastInsertRowid !== undefined ? res.lastInsertRowid : 0),
        changes: Number(res.rowsAffected || 0)
      }
    }
  }
}

/**
 * Cloudflare D1-compatible Database Adapter over LibSQL.
 * Enables zero-breaking-change migration for all domain services.
 */
export class LibSqlD1Adapter {
  private client: Client

  constructor(client: Client) {
    this.client = client
  }

  prepare(sql: string): LibSqlPreparedStatement {
    return new LibSqlPreparedStatement(this.client, sql)
  }

  async batch(statements: any[]): Promise<any[]> {
    const stmts: InStatement[] = statements.map((s) => ({
      sql: s.sql,
      args: s.binds || []
    }))
    const results = await this.client.batch(stmts, 'write')
    return results.map((r) => ({
      success: true,
      meta: {
        last_row_id: Number(r.lastInsertRowid !== undefined ? r.lastInsertRowid : 0),
        changes: Number(r.rowsAffected || 0)
      },
      results: r.rows
    }))
  }

  async exec(sql: string): Promise<void> {
    await this.client.executeMultiple(sql)
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error('dump is not supported in LibSQL serverless adapter')
  }

  withSession(token?: string): any {
    return this
  }

  get _raw(): Client {
    return this.client
  }
}
