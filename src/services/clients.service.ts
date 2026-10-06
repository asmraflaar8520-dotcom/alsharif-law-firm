import {
  ALLOWED_CLIENT_STATUSES,
  ALLOWED_CLIENT_TYPES,
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_NOTE_LENGTH
} from '../config/constants'
import { escapeLike, isAllowed, cleanString } from '../utils/validation'
import { logActivity } from '../utils/logger'

export interface ClientFilterParams {
  q?: string
  status?: string
}

export interface CreateClientDTO {
  type?: string
  name: string
  national_id?: string | null
  tax_id?: string | null
  commercial_reg?: string | null
  nationality?: string | null
  phone?: string | null
  phone2?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  occupation?: string | null
  company_rep?: string | null
  notes?: string | null
  status?: string
  assigned_lawyer_id?: number | null
}

export interface UpdateClientDTO {
  type?: string
  name?: string
  national_id?: string | null
  tax_id?: string | null
  commercial_reg?: string | null
  nationality?: string | null
  phone?: string | null
  phone2?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  occupation?: string | null
  company_rep?: string | null
  notes?: string | null
  status?: string
  assigned_lawyer_id?: number | null
}

export class ClientsService {
  /**
   * Lists clients with keyword and status filtering, including case counts and balance
   */
  static async getClients(db: D1Database, filters: ClientFilterParams = {}): Promise<any[]> {
    const { q, status } = filters
    let sql = `SELECT cl.*, u.name AS lawyer_name,
      (SELECT COUNT(*) FROM cases WHERE client_id = cl.id) AS cases_count,
      (SELECT COALESCE(SUM(total-paid),0) FROM invoices WHERE client_id = cl.id AND status NOT IN ('ملغاة','مسددة')) AS balance
      FROM clients cl LEFT JOIN users u ON u.id = cl.assigned_lawyer_id WHERE 1=1`
    const binds: any[] = []

    if (q) {
      sql += ` AND (cl.name LIKE ? ESCAPE '\\' OR cl.phone LIKE ? ESCAPE '\\' OR cl.national_id LIKE ? ESCAPE '\\' OR cl.tax_id LIKE ? ESCAPE '\\')`
      const like = `%${escapeLike(q)}%`
      binds.push(like, like, like, like)
    }
    if (status && isAllowed(status, [...ALLOWED_CLIENT_STATUSES])) {
      sql += ` AND cl.status = ?`
      binds.push(status)
    }

    sql += ` ORDER BY CASE cl.status WHEN 'vip' THEN 0 ELSE 1 END, cl.name LIMIT 100`
    const { results } = await db.prepare(sql).bind(...binds).all()
    return results || []
  }

  /**
   * Fetches single client details including linked cases, invoices, POAs, and notes
   */
  static async getClientById(db: D1Database, id: number | string): Promise<any | null> {
    const client = await db.prepare(
      `SELECT cl.*, u.name AS lawyer_name FROM clients cl LEFT JOIN users u ON u.id = cl.assigned_lawyer_id WHERE cl.id = ?`
    ).bind(id).first()

    if (!client) return null

    const [cases, invoices, poas, notes] = await Promise.all([
      db.prepare(
        `SELECT c.*, ct.name AS type_name, co.name AS court_name, u.name AS lawyer_name
         FROM cases c
         LEFT JOIN case_types ct ON ct.id=c.case_type_id
         LEFT JOIN courts co ON co.id=c.court_id
         LEFT JOIN users u ON u.id=c.lead_lawyer_id
         WHERE c.client_id=? ORDER BY c.created_at DESC`
      ).bind(id).all(),
      db.prepare(`SELECT * FROM invoices WHERE client_id=? ORDER BY issue_date DESC LIMIT 50`).bind(id).all(),
      db.prepare(
        `SELECT p.*, u.name AS lawyer_name FROM powers_of_attorney p LEFT JOIN users u ON u.id=p.lawyer_id WHERE p.client_id=? ORDER BY p.issue_date DESC`
      ).bind(id).all(),
      db.prepare(
        `SELECT n.*, u.name AS user_name FROM notes n LEFT JOIN users u ON u.id=n.user_id WHERE n.client_id=? ORDER BY n.pinned DESC, n.created_at DESC LIMIT 50`
      ).bind(id).all()
    ])

    return {
      ...client,
      cases: cases.results || [],
      invoices: invoices.results || [],
      poas: poas.results || [],
      notes: notes.results || []
    }
  }

  /**
   * Registers a new client
   */
  static async createClient(db: D1Database, data: CreateClientDTO, currentUserId: number): Promise<number> {
    const name = cleanString(data.name, MAX_NAME_LENGTH)
    if (!name) {
      throw new Error('اسم الموكل مطلوب')
    }

    const clientType = data.type && isAllowed(data.type, [...ALLOWED_CLIENT_TYPES]) ? data.type : 'individual'
    const status = data.status && isAllowed(data.status, [...ALLOWED_CLIENT_STATUSES]) ? data.status : 'active'

    const result = await db.prepare(
      `INSERT INTO clients (type,name,national_id,tax_id,commercial_reg,nationality,phone,phone2,email,address,city,occupation,company_rep,notes,status,assigned_lawyer_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      clientType,
      name,
      cleanString(data.national_id, 30),
      cleanString(data.tax_id, 30),
      cleanString(data.commercial_reg, 30),
      cleanString(data.nationality, 50) || 'مصري',
      cleanString(data.phone, 30),
      cleanString(data.phone2, 30),
      cleanString(data.email, 254),
      cleanString(data.address, MAX_TEXT_LENGTH),
      cleanString(data.city, 100),
      cleanString(data.occupation, 100),
      cleanString(data.company_rep, MAX_NAME_LENGTH),
      cleanString(data.notes, MAX_NOTE_LENGTH),
      status,
      data.assigned_lawyer_id ? Number(data.assigned_lawyer_id) : null
    ).run()

    const id = result.meta.last_row_id as number
    await logActivity(db, currentUserId, 'client', id, 'إنشاء', `موكل جديد: ${name}`)
    return id
  }

  /**
   * Updates client profile safely without overriding missing attributes
   */
  static async updateClient(db: D1Database, id: number | string, data: UpdateClientDTO, currentUserId: number): Promise<boolean> {
    const existing = await db.prepare(`SELECT * FROM clients WHERE id = ?`).bind(id).first<any>()
    if (!existing) {
      throw new Error('الموكل غير موجود')
    }

    const type = data.type !== undefined && isAllowed(data.type, [...ALLOWED_CLIENT_TYPES]) ? data.type : existing.type
    const name = data.name !== undefined ? (cleanString(data.name, MAX_NAME_LENGTH) || existing.name) : existing.name
    const national_id = data.national_id !== undefined ? cleanString(data.national_id, 30) : existing.national_id
    const tax_id = data.tax_id !== undefined ? cleanString(data.tax_id, 30) : existing.tax_id
    const commercial_reg = data.commercial_reg !== undefined ? cleanString(data.commercial_reg, 30) : existing.commercial_reg
    const nationality = data.nationality !== undefined ? cleanString(data.nationality, 50) : existing.nationality
    const phone = data.phone !== undefined ? cleanString(data.phone, 30) : existing.phone
    const phone2 = data.phone2 !== undefined ? cleanString(data.phone2, 30) : existing.phone2
    const email = data.email !== undefined ? cleanString(data.email, 254) : existing.email
    const address = data.address !== undefined ? cleanString(data.address, MAX_TEXT_LENGTH) : existing.address
    const city = data.city !== undefined ? cleanString(data.city, 100) : existing.city
    const occupation = data.occupation !== undefined ? cleanString(data.occupation, 100) : existing.occupation
    const company_rep = data.company_rep !== undefined ? cleanString(data.company_rep, MAX_NAME_LENGTH) : existing.company_rep
    const notes = data.notes !== undefined ? cleanString(data.notes, MAX_NOTE_LENGTH) : existing.notes
    const status = data.status !== undefined && isAllowed(data.status, [...ALLOWED_CLIENT_STATUSES]) ? data.status : existing.status
    const assigned_lawyer_id = data.assigned_lawyer_id !== undefined ? (data.assigned_lawyer_id ? Number(data.assigned_lawyer_id) : null) : existing.assigned_lawyer_id

    await db.prepare(
      `UPDATE clients SET type=?, name=?, national_id=?, tax_id=?, commercial_reg=?, nationality=?, phone=?, phone2=?, email=?, address=?, city=?, occupation=?, company_rep=?, notes=?, status=?, assigned_lawyer_id=? WHERE id=?`
    ).bind(type, name, national_id, tax_id, commercial_reg, nationality, phone, phone2, email, address, city, occupation, company_rep, notes, status, assigned_lawyer_id, id).run()

    await logActivity(db, currentUserId, 'client', Number(id), 'تحديث', `تحديث بيانات الموكل ${name}`)
    return true
  }
}
