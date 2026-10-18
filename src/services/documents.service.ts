import {
  ALLOWED_POA_STATUSES,
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_NOTE_LENGTH
} from '../config/constants'
import { isAllowed, cleanString, escapeLike } from '../utils/validation'
import { logActivity } from '../utils/logger'
import {
  parsePaginationParams,
  createPaginationEnvelope,
  PaginationParams,
  PaginatedResponse
} from '../utils/pagination'
import { SqlQueryBuilder } from '../utils/query-builder'

export interface DocumentFilterParams extends PaginationParams {
  doc_type?: string
  category?: string
  case_id?: number | string
  client_id?: number | string
}

export interface CreateDocumentDTO {
  case_id?: number | null
  client_id?: number | null
  title: string
  doc_type?: string | null
  ref_no?: string | null
  date_issued?: string | null
  pages?: number | null
  notes?: string | null
  file_url?: string | null
  file_name?: string | null
  file_size?: number | null
  mime_type?: string | null
  storage_key?: string | null
}

export interface CreatePoaDTO {
  poa_no: string
  client_id: number
  case_id?: number | null
  lawyer_id?: number | null
  type?: string
  notary_office?: string | null
  issue_date?: string | null
  expiry_date?: string | null
  status?: string
  scope?: string | null
  notes?: string | null
  file_url?: string | null
  file_name?: string | null
  file_size?: number | null
  mime_type?: string | null
  storage_key?: string | null
}

export interface UpdatePoaDTO {
  poa_no?: string
  client_id?: number
  case_id?: number | null
  lawyer_id?: number | null
  type?: string
  notary_office?: string | null
  issue_date?: string | null
  expiry_date?: string | null
  status?: string
  scope?: string | null
  notes?: string | null
  file_url?: string | null
  file_name?: string | null
  file_size?: number | null
  mime_type?: string | null
  storage_key?: string | null
}

export interface CreateNoteDTO {
  case_id?: number | null
  client_id?: number | null
  content: string
  pinned?: boolean | number
}

export class DocumentsService {
  /**
   * Returns a paginated list of electronic files and documents using SqlQueryBuilder
   */
  static async getPaginatedDocuments(db: D1Database, params: PaginationParams = {}): Promise<PaginatedResponse<any>> {
    const { page, limit, offset, search } = parsePaginationParams(params)
    const { doc_type, category, case_id, client_id } = params

    const qb = new SqlQueryBuilder()
      .whereSearch([
        'd.title',
        'd.ref_no',
        'd.file_name',
        'cs.title',
        'cs.case_no',
        'cl.name'
      ], search)

    const docTypeFilter = doc_type || category
    if (docTypeFilter) {
      qb.where('d.doc_type = ?', cleanString(docTypeFilter, 50))
    }
    if (case_id) {
      qb.where('d.case_id = ?', Number(case_id))
    }
    if (client_id) {
      qb.where('COALESCE(d.client_id, cs.client_id) = ?', Number(client_id))
    }

    return SqlQueryBuilder.executePaginated(db, {
      fromClause: `documents d
        LEFT JOIN cases cs ON cs.id=d.case_id
        LEFT JOIN clients cl ON cl.id=COALESCE(d.client_id, cs.client_id)
        LEFT JOIN users u ON u.id=d.uploaded_by`,
      selectColumns: 'd.*, cs.title AS case_title, cs.case_no, cs.year, cl.name AS client_name, u.name AS uploader',
      whereBuilder: qb,
      orderBy: 'd.created_at DESC',
      page,
      limit,
      offset
    })
  }

  /**
   * Lists electronic files and documents (backward compatible array return)
   */
  static async getDocuments(db: D1Database, filters: any = {}): Promise<any[]> {
    const res = await this.getPaginatedDocuments(db, { ...filters, limit: filters?.limit || 150 })
    return res.data
  }

  /**
   * Fetches a single document by ID
   */
  static async getDocumentById(db: D1Database, id: number | string): Promise<any | null> {
    const doc = await db.prepare(
      `SELECT d.*, cs.title AS case_title, cs.case_no, cs.year, cl.name AS client_name, u.name AS uploader
       FROM documents d
       LEFT JOIN cases cs ON cs.id=d.case_id
       LEFT JOIN clients cl ON cl.id=COALESCE(d.client_id, cs.client_id)
       LEFT JOIN users u ON u.id=d.uploaded_by
       WHERE d.id = ?`
    ).bind(id).first<any>()
    return doc || null
  }

  /**
   * Creates a new document record
   */
  static async createDocument(db: D1Database, data: CreateDocumentDTO, currentUserId: number): Promise<number> {
    const title = cleanString(data.title, MAX_NAME_LENGTH)
    if (!title) {
      throw new Error('عنوان المستند مطلوب')
    }

    const result = await db.prepare(
      `INSERT INTO documents (
         case_id, client_id, title, doc_type, ref_no, date_issued, pages, notes, uploaded_by,
         file_url, file_name, file_size, mime_type, storage_key
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.case_id ? Number(data.case_id) : null,
      data.client_id ? Number(data.client_id) : null,
      title,
      cleanString(data.doc_type, 50) || 'أخرى',
      cleanString(data.ref_no, 100),
      data.date_issued || null,
      data.pages ? Number(data.pages) : null,
      cleanString(data.notes, MAX_NOTE_LENGTH),
      currentUserId,
      data.file_url ? cleanString(data.file_url, 1000) : null,
      data.file_name ? cleanString(data.file_name, 255) : null,
      data.file_size ? Number(data.file_size) : null,
      data.mime_type ? cleanString(data.mime_type, 100) : null,
      data.storage_key ? cleanString(data.storage_key, 500) : null
    ).run()

    const id = result.meta.last_row_id as number
    await logActivity(db, currentUserId, 'document', id, 'إنشاء', `مستند جديد: ${title}`)
    return id
  }

  /**
   * Lists powers of attorney
   */
  static async getPoas(db: D1Database): Promise<any[]> {
    const { results } = await db.prepare(
      `SELECT p.*, cl.name AS client_name, u.name AS lawyer_name, cs.title AS case_title
       FROM powers_of_attorney p
       JOIN clients cl ON cl.id=p.client_id
       LEFT JOIN users u ON u.id=p.lawyer_id
       LEFT JOIN cases cs ON cs.id=p.case_id
       ORDER BY CASE p.status WHEN 'ساري' THEN 0 WHEN 'منتهٍ' THEN 1 ELSE 2 END, p.expiry_date LIMIT 150`
    ).all()
    return results || []
  }

  /**
   * Fetches a single POA by ID
   */
  static async getPoaById(db: D1Database, id: number | string): Promise<any | null> {
    const poa = await db.prepare(
      `SELECT p.*, cl.name AS client_name, u.name AS lawyer_name, cs.title AS case_title
       FROM powers_of_attorney p
       JOIN clients cl ON cl.id=p.client_id
       LEFT JOIN users u ON u.id=p.lawyer_id
       LEFT JOIN cases cs ON cs.id=p.case_id
       WHERE p.id = ?`
    ).bind(id).first<any>()
    return poa || null
  }

  /**
   * Registers a new Power of Attorney
   */
  static async createPoa(db: D1Database, data: CreatePoaDTO, currentUserId: number): Promise<number> {
    const poa_no = cleanString(data.poa_no, 100)
    if (!poa_no || !data.client_id) {
      throw new Error('رقم التوكيل والموكل حقول إجبارية')
    }

    const status = data.status && isAllowed(data.status, [...ALLOWED_POA_STATUSES]) ? data.status : 'ساري'

    const result = await db.prepare(
      `INSERT INTO powers_of_attorney (
         poa_no, client_id, case_id, lawyer_id, type, notary_office, issue_date, expiry_date,
         status, scope, notes, file_url, file_name, file_size, mime_type, storage_key
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      poa_no,
      Number(data.client_id),
      data.case_id ? Number(data.case_id) : null,
      data.lawyer_id ? Number(data.lawyer_id) : null,
      cleanString(data.type, 50) || 'عام قضايا',
      cleanString(data.notary_office, MAX_TEXT_LENGTH),
      data.issue_date || null,
      data.expiry_date || null,
      status,
      cleanString(data.scope, MAX_TEXT_LENGTH),
      cleanString(data.notes, MAX_NOTE_LENGTH),
      data.file_url ? cleanString(data.file_url, 1000) : null,
      data.file_name ? cleanString(data.file_name, 255) : null,
      data.file_size ? Number(data.file_size) : null,
      data.mime_type ? cleanString(data.mime_type, 100) : null,
      data.storage_key ? cleanString(data.storage_key, 500) : null
    ).run()

    const id = result.meta.last_row_id as number
    await logActivity(db, currentUserId, 'poa', id, 'إنشاء', `توكيل جديد: ${poa_no}`)
    return id
  }

  /**
   * Updates Power of Attorney
   */
  static async updatePoa(db: D1Database, id: number | string, data: UpdatePoaDTO, currentUserId: number): Promise<boolean> {
    const existing = await db.prepare(`SELECT * FROM powers_of_attorney WHERE id = ?`).bind(id).first<any>()
    if (!existing) {
      throw new Error('التوكيل غير موجود')
    }

    const poa_no = data.poa_no !== undefined ? (cleanString(data.poa_no, 100) || existing.poa_no) : existing.poa_no
    const client_id = data.client_id !== undefined ? Number(data.client_id) : existing.client_id
    const case_id = data.case_id !== undefined ? (data.case_id ? Number(data.case_id) : null) : existing.case_id
    const lawyer_id = data.lawyer_id !== undefined ? (data.lawyer_id ? Number(data.lawyer_id) : null) : existing.lawyer_id
    const type = data.type !== undefined ? (cleanString(data.type, 50) || existing.type) : existing.type
    const notary_office = data.notary_office !== undefined ? cleanString(data.notary_office, MAX_TEXT_LENGTH) : existing.notary_office
    const issue_date = data.issue_date !== undefined ? data.issue_date : existing.issue_date
    const expiry_date = data.expiry_date !== undefined ? data.expiry_date : existing.expiry_date
    const status = data.status !== undefined && isAllowed(data.status, [...ALLOWED_POA_STATUSES]) ? data.status : existing.status
    const scope = data.scope !== undefined ? cleanString(data.scope, MAX_TEXT_LENGTH) : existing.scope
    const notes = data.notes !== undefined ? cleanString(data.notes, MAX_NOTE_LENGTH) : existing.notes

    const file_url = data.file_url !== undefined ? data.file_url : existing.file_url
    const file_name = data.file_name !== undefined ? data.file_name : existing.file_name
    const file_size = data.file_size !== undefined ? (data.file_size ? Number(data.file_size) : null) : existing.file_size
    const mime_type = data.mime_type !== undefined ? data.mime_type : existing.mime_type
    const storage_key = data.storage_key !== undefined ? data.storage_key : existing.storage_key

    await db.prepare(
      `UPDATE powers_of_attorney SET
         poa_no=?, client_id=?, case_id=?, lawyer_id=?, type=?, notary_office=?, issue_date=?, expiry_date=?,
         status=?, scope=?, notes=?, file_url=?, file_name=?, file_size=?, mime_type=?, storage_key=?
       WHERE id=?`
    ).bind(
      poa_no, client_id, case_id, lawyer_id, type, notary_office, issue_date, expiry_date,
      status, scope, notes, file_url, file_name, file_size, mime_type, storage_key, id
    ).run()

    await logActivity(db, currentUserId, 'poa', Number(id), 'تحديث', `تحديث التوكيل: ${poa_no}`)
    return true
  }

  /**
   * Appends a memo or quick note
   */
  static async createNote(db: D1Database, data: CreateNoteDTO, currentUserId: number): Promise<number> {
    const content = cleanString(data.content, MAX_NOTE_LENGTH)
    if (!content) {
      throw new Error('محتوى الملاحظة مطلوب')
    }

    const result = await db.prepare(
      `INSERT INTO notes (case_id, client_id, user_id, content, pinned) VALUES (?, ?, ?, ?, ?)`
    ).bind(
      data.case_id ? Number(data.case_id) : null,
      data.client_id ? Number(data.client_id) : null,
      currentUserId,
      content,
      data.pinned ? 1 : 0
    ).run()

    return result.meta.last_row_id as number
  }
}

