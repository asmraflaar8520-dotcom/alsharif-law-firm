import {
  ALLOWED_CASE_STATUSES,
  ALLOWED_CASE_PRIORITIES,
  ALLOWED_CASE_DEGREES,
  ALLOWED_HEARING_STATUSES,
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_NOTE_LENGTH
} from '../config/constants'
import { escapeLike, isAllowed, cleanString } from '../utils/validation'
import { logActivity } from '../utils/logger'
import {
  parsePaginationParams,
  createPaginationEnvelope,
  PaginationParams,
  PaginatedResponse
} from '../utils/pagination'
import { SqlQueryBuilder } from '../utils/query-builder'
import {
  HearingsService,
  HearingFilterParams,
  ScheduleHearingDTO,
  UpdateHearingDTO
} from './hearings.service'

export interface CaseFilterParams extends PaginationParams {
  q?: string
  status?: string
  lawyer?: string | number
  type?: string | number
  priority?: string
  category?: string
}

export interface CreateCaseDTO {
  case_no: string
  year: number
  title: string
  case_type_id?: number | null
  court_id?: number | null
  circuit?: string | null
  degree?: string
  status?: string
  priority?: string
  client_id: number
  opposing_name?: string | null
  opposing_lawyer?: string | null
  lead_lawyer_id?: number | null
  subject?: string | null
  claim_value?: number
  currency?: string
  filing_date?: string | null
  next_action?: string | null
}

export interface UpdateCaseDTO {
  case_no?: string
  year?: number
  title?: string
  case_type_id?: number | null
  court_id?: number | null
  circuit?: string | null
  degree?: string
  status?: string
  priority?: string
  client_id?: number
  opposing_name?: string | null
  opposing_lawyer?: string | null
  lead_lawyer_id?: number | null
  subject?: string | null
  claim_value?: number
  currency?: string
  filing_date?: string | null
  next_action?: string | null
  outcome?: string | null
  closed_at?: string | null
}

export type { HearingFilterParams, ScheduleHearingDTO, UpdateHearingDTO } from './hearings.service'

export class CasesService {
  /**
   * Returns a paginated list of cases with total counts and metadata using SqlQueryBuilder
   */
  static async getPaginatedCases(db: D1Database, params: PaginationParams = {}): Promise<PaginatedResponse<any>> {
    const { page, limit, offset, search } = parsePaginationParams(params)
    const { status, lawyer, type, priority, category, client_id } = params

    const qb = new SqlQueryBuilder()
      .whereSearch(['c.title', 'c.case_no', 'cl.name', 'c.opposing_name', 'c.subject'], search)
      .whereIf('c.status = ?', status && isAllowed(status, [...ALLOWED_CASE_STATUSES]), status)
      .whereIf('c.lead_lawyer_id = ?', lawyer, Number(lawyer))
      .whereIf('c.case_type_id = ?', type, Number(type))
      .whereIf('ct.category = ?', category, cleanString(category, 50))
      .whereIf('c.priority = ?', priority && isAllowed(priority, [...ALLOWED_CASE_PRIORITIES]), priority)
      .whereIf('c.client_id = ?', client_id, Number(client_id))

    return SqlQueryBuilder.executePaginated(db, {
      fromClause: `cases c
        JOIN clients cl ON cl.id=c.client_id
        LEFT JOIN case_types ct ON ct.id=c.case_type_id
        LEFT JOIN courts co ON co.id=c.court_id
        LEFT JOIN users u ON u.id=c.lead_lawyer_id`,
      selectColumns: `c.*, cl.name AS client_name, cl.type AS client_type, ct.name AS type_name, ct.category,
        co.name AS court_name, u.name AS lawyer_name, u.initials AS lawyer_initials, u.color AS lawyer_color,
        (SELECT MIN(hearing_date) FROM hearings h WHERE h.case_id=c.id AND h.hearing_date>=date('now') AND h.status IN ('قادمة','حجز للحكم')) AS next_hearing`,
      whereBuilder: qb,
      orderBy: "CASE c.priority WHEN 'عاجلة' THEN 0 WHEN 'عالية' THEN 1 WHEN 'عادية' THEN 2 ELSE 3 END, c.updated_at DESC",
      page,
      limit,
      offset
    })
  }

  /**
   * Searches and lists cases (backward compatible array return)
   */
  static async getCases(db: D1Database, filters: CaseFilterParams = {}): Promise<any[]> {
    const res = await this.getPaginatedCases(db, { ...filters, limit: filters.limit || 150 })
    return res.data
  }

  /**
   * Fetches complete case dossier with all linked records
   */
  static async getCaseById(db: D1Database, id: number | string): Promise<any | null> {
    const caseRecord = await db.prepare(
      `SELECT c.*, cl.name AS client_name, cl.phone AS client_phone, cl.type AS client_type, cl.email AS client_email,
        ct.name AS type_name, ct.category, co.name AS court_name, u.name AS lawyer_name, u.initials AS lawyer_initials, u.color AS lawyer_color
       FROM cases c
       JOIN clients cl ON cl.id=c.client_id
       LEFT JOIN case_types ct ON ct.id=c.case_type_id
       LEFT JOIN courts co ON co.id=c.court_id
       LEFT JOIN users u ON u.id=c.lead_lawyer_id
       WHERE c.id=?`
    ).bind(id).first()

    if (!caseRecord) return null

    const [hearings, docs, notes, lawyers, invoices, expenses, times, tasks, poas] = await Promise.all([
      db.prepare(`SELECT h.*, u.name AS lawyer_name, co.name AS court_name FROM hearings h LEFT JOIN users u ON u.id=h.lawyer_id LEFT JOIN courts co ON co.id=h.court_id WHERE h.case_id=? ORDER BY h.hearing_date DESC LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT d.*, u.name AS uploader FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by WHERE d.case_id=? ORDER BY d.created_at DESC LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT n.*, u.name AS user_name, u.initials, u.color FROM notes n LEFT JOIN users u ON u.id=n.user_id WHERE n.case_id=? ORDER BY n.pinned DESC, n.created_at DESC LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT u.id, u.name, u.title, u.initials, u.color, clw.role FROM case_lawyers clw JOIN users u ON u.id=clw.user_id WHERE clw.case_id=?`).bind(id).all(),
      db.prepare(`SELECT * FROM invoices WHERE case_id=? ORDER BY issue_date DESC LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT * FROM expenses WHERE case_id=? ORDER BY expense_date DESC LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT t.*, u.name AS user_name FROM time_entries t JOIN users u ON u.id=t.user_id WHERE t.case_id=? ORDER BY t.work_date DESC LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.case_id=? ORDER BY t.due_date LIMIT 50`).bind(id).all(),
      db.prepare(`SELECT p.*, u.name AS lawyer_name FROM powers_of_attorney p LEFT JOIN users u ON u.id=p.lawyer_id WHERE p.case_id=? OR (p.case_id IS NULL AND p.client_id=?) LIMIT 50`).bind(id, (caseRecord as any).client_id).all()
    ])

    return {
      ...caseRecord,
      hearings: hearings.results || [],
      documents: docs.results || [],
      notes: notes.results || [],
      lawyers: lawyers.results || [],
      invoices: invoices.results || [],
      expenses: expenses.results || [],
      time_entries: times.results || [],
      tasks: tasks.results || [],
      poas: poas.results || []
    }
  }

  /**
   * Creates a new case record
   */
  static async createCase(db: D1Database, data: CreateCaseDTO, currentUserId: number): Promise<number> {
    const case_no = cleanString(data.case_no, 50)
    const title = cleanString(data.title, MAX_NAME_LENGTH)
    if (!case_no || !data.year || !title || !data.client_id) {
      throw new Error('رقم الدعوى والسنة وعنوان الدعوى والموكل حقول إجبارية')
    }

    const status = data.status && isAllowed(data.status, [...ALLOWED_CASE_STATUSES]) ? data.status : 'متداولة'
    const priority = data.priority && isAllowed(data.priority, [...ALLOWED_CASE_PRIORITIES]) ? data.priority : 'عادية'
    const degree = data.degree && isAllowed(data.degree, [...ALLOWED_CASE_DEGREES]) ? data.degree : 'ابتدائي'

    const result = await db.prepare(
      `INSERT INTO cases (case_no, year, title, case_type_id, court_id, circuit, degree, status, priority, client_id, opposing_name, opposing_lawyer, lead_lawyer_id, subject, claim_value, currency, filing_date, next_action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      case_no,
      Number(data.year),
      title,
      data.case_type_id ? Number(data.case_type_id) : null,
      data.court_id ? Number(data.court_id) : null,
      cleanString(data.circuit, 100),
      degree,
      status,
      priority,
      Number(data.client_id),
      cleanString(data.opposing_name, MAX_NAME_LENGTH),
      cleanString(data.opposing_lawyer, MAX_NAME_LENGTH),
      data.lead_lawyer_id ? Number(data.lead_lawyer_id) : null,
      cleanString(data.subject, MAX_TEXT_LENGTH),
      Number(data.claim_value || 0),
      data.currency || 'EGP',
      data.filing_date || null,
      cleanString(data.next_action, MAX_TEXT_LENGTH)
    ).run()

    const id = result.meta.last_row_id as number
    if (data.lead_lawyer_id) {
      await db.prepare(`INSERT OR IGNORE INTO case_lawyers (case_id, user_id, role) VALUES (?, ?, 'رئيس')`).bind(id, data.lead_lawyer_id).run()
    }
    await logActivity(db, currentUserId, 'case', id, 'إنشاء', `قضية جديدة ${case_no} لسنة ${data.year}`)
    return id
  }

  /**
   * Updates case details
   */
  static async updateCase(db: D1Database, id: number | string, data: UpdateCaseDTO, currentUserId: number): Promise<boolean> {
    const existing = await db.prepare(`SELECT * FROM cases WHERE id = ?`).bind(id).first<any>()
    if (!existing) {
      throw new Error('القضية غير موجودة')
    }

    const case_no = data.case_no !== undefined ? (cleanString(data.case_no, 50) || existing.case_no) : existing.case_no
    const year = data.year !== undefined ? Number(data.year) : existing.year
    const title = data.title !== undefined ? (cleanString(data.title, MAX_NAME_LENGTH) || existing.title) : existing.title
    const case_type_id = data.case_type_id !== undefined ? (data.case_type_id ? Number(data.case_type_id) : null) : existing.case_type_id
    const court_id = data.court_id !== undefined ? (data.court_id ? Number(data.court_id) : null) : existing.court_id
    const circuit = data.circuit !== undefined ? cleanString(data.circuit, 100) : existing.circuit
    const degree = data.degree !== undefined && isAllowed(data.degree, [...ALLOWED_CASE_DEGREES]) ? data.degree : existing.degree
    const status = data.status !== undefined && isAllowed(data.status, [...ALLOWED_CASE_STATUSES]) ? data.status : existing.status
    const priority = data.priority !== undefined && isAllowed(data.priority, [...ALLOWED_CASE_PRIORITIES]) ? data.priority : existing.priority
    const client_id = data.client_id !== undefined ? Number(data.client_id) : existing.client_id
    const opposing_name = data.opposing_name !== undefined ? cleanString(data.opposing_name, MAX_NAME_LENGTH) : existing.opposing_name
    const opposing_lawyer = data.opposing_lawyer !== undefined ? cleanString(data.opposing_lawyer, MAX_NAME_LENGTH) : existing.opposing_lawyer
    const lead_lawyer_id = data.lead_lawyer_id !== undefined ? (data.lead_lawyer_id ? Number(data.lead_lawyer_id) : null) : existing.lead_lawyer_id
    const subject = data.subject !== undefined ? cleanString(data.subject, MAX_TEXT_LENGTH) : existing.subject
    const claim_value = data.claim_value !== undefined ? Number(data.claim_value || 0) : existing.claim_value
    const currency = data.currency !== undefined ? (data.currency || 'EGP') : (existing.currency || 'EGP')
    const filing_date = data.filing_date !== undefined ? data.filing_date : existing.filing_date
    const next_action = data.next_action !== undefined ? cleanString(data.next_action, MAX_TEXT_LENGTH) : existing.next_action
    const outcome = data.outcome !== undefined ? cleanString(data.outcome, MAX_TEXT_LENGTH) : existing.outcome
    const closed_at = data.closed_at !== undefined ? data.closed_at : existing.closed_at

    await db.prepare(
      `UPDATE cases SET case_no=?, year=?, title=?, case_type_id=?, court_id=?, circuit=?, degree=?, status=?, priority=?, client_id=?, opposing_name=?, opposing_lawyer=?, lead_lawyer_id=?, subject=?, claim_value=?, currency=?, filing_date=?, next_action=?, outcome=?, closed_at=?, updated_at=datetime('now') WHERE id=?`
    ).bind(case_no, year, title, case_type_id, court_id, circuit, degree, status, priority, client_id, opposing_name, opposing_lawyer, lead_lawyer_id, subject, claim_value, currency, filing_date, next_action, outcome, closed_at, id).run()

    await logActivity(db, currentUserId, 'case', Number(id), 'تحديث', `تحديث القضية ${case_no}`)
    return true
  }

  /**
   * Assigns a lawyer to a case
   */
  static async assignLawyer(db: D1Database, caseId: number | string, lawyerId: number, role: string = 'مساعد'): Promise<void> {
    await db.prepare(`INSERT OR REPLACE INTO case_lawyers (case_id, user_id, role) VALUES (?, ?, ?)`).bind(caseId, lawyerId, cleanString(role, 50) || 'مساعد').run()
  }

  /**
   * Returns a paginated list of hearings with count and metadata
   */
  static async getPaginatedHearings(db: D1Database, params: PaginationParams = {}): Promise<PaginatedResponse<any>> {
    return HearingsService.getPaginatedHearings(db, params)
  }

  /**
   * Lists court session hearings (backward compatible array return)
   */
  static async getHearings(db: D1Database, filters: HearingFilterParams = {}): Promise<any[]> {
    return HearingsService.getHearings(db, filters)
  }

  /**
   * Schedules a court hearing
   */
  static async scheduleHearing(db: D1Database, data: ScheduleHearingDTO, currentUserId: number): Promise<number> {
    return HearingsService.scheduleHearing(db, data, currentUserId)
  }

  /**
   * Updates hearing outcome or details
   */
  static async updateHearing(db: D1Database, id: number | string, data: UpdateHearingDTO): Promise<boolean> {
    return HearingsService.updateHearing(db, id, data)
  }
}
