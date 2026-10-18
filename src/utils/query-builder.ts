import { escapeLike } from './validation'
import { createPaginationEnvelope, PaginatedResponse } from './pagination'

export interface PaginatedExecutionOptions {
  fromClause: string
  selectColumns: string
  whereBuilder: SqlQueryBuilder
  orderBy?: string
  page: number
  limit: number
  offset: number
}

/**
 * Reusable SQL Query Builder for sanitized dynamic WHERE clauses,
 * multi-column ILIKE/LIKE substring searching, and automated count & data execution.
 */
export class SqlQueryBuilder {
  private conditions: string[] = ['1=1']
  private binds: any[] = []

  /**
   * Adds an unconditional WHERE clause and binds.
   */
  where(condition: string, ...binds: any[]): this {
    this.conditions.push(condition)
    this.binds.push(...binds)
    return this
  }

  /**
   * Conditionally appends a WHERE clause if the condition evaluated is truthy.
   */
  whereIf(condition: string, shouldAdd: any, ...binds: any[]): this {
    if (Boolean(shouldAdd)) {
      this.conditions.push(condition)
      this.binds.push(...binds)
    }
    return this
  }

  /**
   * Appends multi-column substring search with wildcard escaping.
   * Format: AND (col1 LIKE ? ESCAPE '\' OR col2 LIKE ? ESCAPE '\' ...)
   */
  whereSearch(columns: string[], search?: string | null): this {
    if (!search || !search.trim() || columns.length === 0) return this

    const escapedTerm = `%${escapeLike(search.trim())}%`
    const clauses = columns.map((col) => `${col} LIKE ? ESCAPE '\\'`)
    this.conditions.push(`(${clauses.join(' OR ')})`)

    for (let i = 0; i < columns.length; i++) {
      this.binds.push(escapedTerm)
    }
    return this
  }

  /**
   * Builds the formatted WHERE clause string and parameter bindings.
   */
  buildWhere(): { whereSql: string; binds: any[] } {
    return {
      whereSql: `WHERE ${this.conditions.join(' AND ')}`,
      binds: [...this.binds]
    }
  }

  /**
   * Executes both count and paginated data queries using the builder,
   * returning the standardized PaginatedResponse envelope.
   */
  static async executePaginated<T = any>(
    db: D1Database,
    opts: PaginatedExecutionOptions
  ): Promise<PaginatedResponse<T>> {
    const { whereSql, binds } = opts.whereBuilder.buildWhere()

    // 1. Efficient total count query matching active filters
    const countSql = `SELECT COUNT(*) AS total FROM ${opts.fromClause} ${whereSql}`
    const countRow = await db.prepare(countSql).bind(...binds).first<{ total: number }>()
    const total = Number(countRow?.total || 0)

    // 2. Paginated data query
    const orderClause = opts.orderBy ? `ORDER BY ${opts.orderBy}` : ''
    const dataSql = `SELECT ${opts.selectColumns} FROM ${opts.fromClause} ${whereSql} ${orderClause} LIMIT ? OFFSET ?`
    const dataBinds = [...binds, opts.limit, opts.offset]
    const { results } = await db.prepare(dataSql).bind(...dataBinds).all<T>()

    return createPaginationEnvelope(results || [], total, opts.page, opts.limit)
  }
}
