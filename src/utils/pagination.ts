export interface PaginationParams {
  page?: number | string
  limit?: number | string
  search?: string
  q?: string
  status?: string
  category?: string
  type?: string | number
  priority?: string
  lawyer?: string | number
  from?: string
  to?: string
  case_id?: string | number
  client_id?: string | number
  court_id?: string | number
  all?: string | boolean
  [key: string]: any
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

/**
 * Parses and sanitizes pagination query parameters with safe defaults and clamps.
 */
export function parsePaginationParams(query: Record<string, any> = {}): {
  page: number
  limit: number
  offset: number
  search: string
  isRawAll: boolean
} {
  const isRawAll = query.all === 'true' || query.all === '1'

  let page = parseInt(String(query.page || 1), 10)
  if (isNaN(page) || page < 1) page = 1

  let limit = parseInt(String(query.limit || 20), 10)
  if (isNaN(limit) || limit < 1) limit = 20
  if (limit > 100) limit = 100 // clamped to maximum 100 items per page

  const offset = (page - 1) * limit
  const search = String(query.search || query.q || '').trim()

  return { page, limit, offset, search, isRawAll }
}

/**
 * Formats data and total count into the standard paginated response envelope.
 */
export function createPaginationEnvelope<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalSafe = Math.max(0, total || 0)
  const totalPages = limit > 0 ? Math.ceil(totalSafe / limit) : 0
  const hasMore = page < totalPages

  return {
    data: data || [],
    pagination: {
      total: totalSafe,
      page,
      limit,
      totalPages,
      hasMore
    }
  }
}
