import { ALLOWED_HEARING_STATUSES } from '../config/constants'
import { isAllowed, cleanString } from '../utils/validation'
import { parsePaginationParams, PaginationParams, PaginatedResponse } from '../utils/pagination'
import { SqlQueryBuilder } from '../utils/query-builder'

export interface HearingFilterParams extends PaginationParams {
  from?: string
  to?: string
  lawyer?: string | number
  status?: string
  case_id?: string | number
  court_id?: string | number
}

export interface ScheduleHearingDTO {
  case_id: number
  hearing_date: string
  hearing_time?: string | null
  court_id?: number | null
  circuit?: string | null
  type?: string
  purpose?: string | null
  lawyer_id?: number | null
  status?: string
  notes?: string | null
}

export interface UpdateHearingDTO {
  hearing_date?: string
  hearing_time?: string | null
  court_id?: number | null
  circuit?: string | null
  type?: string
  purpose?: string | null
  result?: string | null
  next_date?: string | null
  lawyer_id?: number | null
  status?: string
  notes?: string | null
}

export class HearingsService {
  /**
   * Returns a paginated list of hearings with count and metadata using SqlQueryBuilder
   */
  static async getPaginatedHearings(db: D1Database, params: PaginationParams = {}): Promise<PaginatedResponse<any>> {
    const { page, limit, offset, search } = parsePaginationParams(params)
    const from = params.from || '2000-01-01'
    const to = params.to || '2099-12-31'
    const { lawyer, status, case_id, court_id } = params

    const qb = new SqlQueryBuilder()
      .where('h.hearing_date BETWEEN ? AND ?', from, to)
      .whereSearch([
        'cs.title',
        'cs.case_no',
        'cl.name',
        'h.purpose',
        'h.circuit',
        'co.name'
      ], search)
      .whereIf('h.lawyer_id = ?', lawyer, Number(lawyer))
      .whereIf('h.status = ?', status && isAllowed(status, [...ALLOWED_HEARING_STATUSES]), status)
      .whereIf('h.case_id = ?', case_id, Number(case_id))
      .whereIf('h.court_id = ?', court_id, Number(court_id))

    return SqlQueryBuilder.executePaginated(db, {
      fromClause: `hearings h
        JOIN cases cs ON cs.id = h.case_id
        JOIN clients cl ON cl.id = cs.client_id
        LEFT JOIN users u ON u.id = h.lawyer_id
        LEFT JOIN courts co ON co.id = h.court_id`,
      selectColumns: `h.*, cs.case_no, cs.year, cs.title AS case_title, cs.priority, cl.name AS client_name, u.name AS lawyer_name, u.initials, u.color, co.name AS court_name`,
      whereBuilder: qb,
      orderBy: 'h.hearing_date, h.hearing_time',
      page,
      limit,
      offset
    })
  }

  /**
   * Lists court session hearings (backward compatible array return)
   */
  static async getHearings(db: D1Database, filters: HearingFilterParams = {}): Promise<any[]> {
    const res = await this.getPaginatedHearings(db, { ...filters, limit: filters?.limit || 200 })
    return res.data
  }

  /**
   * Schedules a court hearing session
   */
  static async scheduleHearing(db: D1Database, data: ScheduleHearingDTO, currentUserId: number): Promise<number> {
    if (!data.case_id || !data.hearing_date) {
      throw new Error('القضية وتاريخ الجلسة حقول إجبارية')
    }

    const status = data.status && isAllowed(data.status, [...ALLOWED_HEARING_STATUSES]) ? data.status : 'قادمة'
    const result = await db.prepare(
      `INSERT INTO hearings (case_id, hearing_date, hearing_time, court_id, circuit, type, purpose, lawyer_id, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.case_id,
      data.hearing_date,
      cleanString(data.hearing_time, 20),
      data.court_id || null,
      cleanString(data.circuit, 100),
      cleanString(data.type, 50) || 'مرافعة',
      cleanString(data.purpose, 500),
      data.lawyer_id || null,
      status,
      cleanString(data.notes, 2000)
    ).run()

    return Number(result.meta.last_row_id)
  }

  /**
   * Updates hearing decision, attendance lawyer, or roll-over date
   */
  static async updateHearing(db: D1Database, id: number | string, data: UpdateHearingDTO): Promise<boolean> {
    const existing = await db.prepare(`SELECT * FROM hearings WHERE id=?`).bind(id).first<any>()
    if (!existing) throw new Error('الجلسة غير موجودة')

    const status = data.status && isAllowed(data.status, [...ALLOWED_HEARING_STATUSES]) ? data.status : existing.status

    await db.prepare(
      `UPDATE hearings SET hearing_date=?, hearing_time=?, court_id=?, circuit=?, type=?, purpose=?, result=?, next_date=?, lawyer_id=?, status=?, notes=? WHERE id=?`
    ).bind(
      data.hearing_date || existing.hearing_date,
      data.hearing_time !== undefined ? cleanString(data.hearing_time, 20) : existing.hearing_time,
      data.court_id !== undefined ? data.court_id : existing.court_id,
      data.circuit !== undefined ? cleanString(data.circuit, 100) : existing.circuit,
      data.type !== undefined ? cleanString(data.type, 50) : existing.type,
      data.purpose !== undefined ? cleanString(data.purpose, 500) : existing.purpose,
      data.result !== undefined ? cleanString(data.result, 1000) : existing.result,
      data.next_date !== undefined ? data.next_date : existing.next_date,
      data.lawyer_id !== undefined ? data.lawyer_id : existing.lawyer_id,
      status,
      data.notes !== undefined ? cleanString(data.notes, 2000) : existing.notes,
      id
    ).run()

    return true
  }
}
