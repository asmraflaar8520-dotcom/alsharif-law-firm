import {
  ALLOWED_INVOICE_STATUSES,
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_NOTE_LENGTH
} from '../config/constants'
import { isAllowed, cleanString } from '../utils/validation'
import { logActivity } from '../utils/logger'
import { User } from '../types'

export interface InvoiceItemDTO {
  description: string
  qty?: number
  unit_price?: number
  amount?: number
}

export interface CreateInvoiceDTO {
  client_id: number
  case_id?: number | null
  issue_date?: string
  due_date?: string | null
  amount?: number
  desc?: string
  items?: InvoiceItemDTO[]
  tax?: number
  discount?: number
  status?: string
  notes?: string | null
}

export interface UpdateInvoiceDTO {
  status?: string
  notes?: string | null
  due_date?: string | null
}

export interface RecordPaymentDTO {
  invoice_id?: number | null
  client_id?: number | null
  amount: number
  method?: string
  paid_at?: string
  reference?: string | null
  notes?: string | null
}

export interface CreateExpenseDTO {
  case_id?: number | null
  title: string
  category?: string
  amount: number
  expense_date?: string
  billable?: boolean | number
  vendor?: string | null
  notes?: string | null
}

export interface LogTimeDTO {
  user_id?: number
  case_id?: number | null
  work_date?: string
  hours: number
  description?: string | null
  billable?: number
  rate?: number
}

export interface CreateContractDTO {
  title: string
  client_id: number
  type?: string
  start_date?: string | null
  end_date?: string | null
  value?: number
  status?: string
  notes?: string | null
}

export class FinanceService {
  /**
   * Lists invoices with optional status filtering
   */
  static async getInvoices(db: D1Database, status?: string): Promise<any[]> {
    let sql = `SELECT i.*, cl.name AS client_name, cs.title AS case_title, cs.case_no, cs.year
      FROM invoices i JOIN clients cl ON cl.id=i.client_id LEFT JOIN cases cs ON cs.id=i.case_id WHERE 1=1`
    const binds: any[] = []

    if (status && isAllowed(status, [...ALLOWED_INVOICE_STATUSES])) {
      sql += ` AND i.status = ?`
      binds.push(status)
    }

    sql += ` ORDER BY i.issue_date DESC LIMIT 150`
    const { results } = await db.prepare(sql).bind(...binds).all()
    return results || []
  }

  /**
   * Fetches single invoice details with line items and historical payments
   */
  static async getInvoiceById(db: D1Database, id: number | string): Promise<any | null> {
    const inv = await db.prepare(
      `SELECT i.*, cl.name AS client_name, cl.address, cl.tax_id, cl.phone, cl.email, cs.title AS case_title, cs.case_no, cs.year
       FROM invoices i JOIN clients cl ON cl.id=i.client_id LEFT JOIN cases cs ON cs.id=i.case_id WHERE i.id=?`
    ).bind(id).first()

    if (!inv) return null

    const [items, pays] = await Promise.all([
      db.prepare(`SELECT * FROM invoice_items WHERE invoice_id=?`).bind(id).all(),
      db.prepare(`SELECT * FROM payments WHERE invoice_id=? ORDER BY paid_at`).bind(id).all()
    ])

    return {
      ...inv,
      items: items.results || [],
      payments: pays.results || []
    }
  }

  /**
   * Generates sequential invoice number for a given year (e.g. INV-2026-001)
   */
  static async generateInvoiceNumber(db: D1Database, year: number): Promise<string> {
    const last = await db.prepare(
      `SELECT invoice_no FROM invoices WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1`
    ).bind(`INV-${year}-%`).first<{ invoice_no: string }>()

    let seq = 1
    if (last?.invoice_no) {
      const parts = String(last.invoice_no).split('-')
      const parsed = parseInt(parts[parts.length - 1] || '0', 10)
      if (!isNaN(parsed) && parsed > 0) {
        seq = parsed + 1
      }
    }
    return `INV-${year}-${String(seq).padStart(3, '0')}`
  }

  /**
   * Issues a new legal fee invoice with sequential numbering and line items
   */
  static async createInvoice(db: D1Database, data: CreateInvoiceDTO, currentUserId: number): Promise<{ id: number; invoice_no: string }> {
    if (!data.client_id) {
      throw new Error('الموكل مطلوب لإصدار الفاتورة')
    }

    const issueDate = data.issue_date || new Date().toISOString().slice(0, 10)
    const year = new Date(issueDate).getFullYear() || new Date().getFullYear()
    const invoiceNo = await this.generateInvoiceNumber(db, year)

    const items = Array.isArray(data.items) && data.items.length
      ? data.items
      : [{ description: data.desc || 'أتعاب مهنية', qty: 1, unit_price: Number(data.amount || 0), amount: Number(data.amount || 0) }]

    const subtotal = items.reduce((s: number, it: any) => s + Number(it.amount || (it.qty || 1) * (it.unit_price || 0)), 0)
    const tax = data.tax !== undefined ? Number(data.tax) : Math.round(subtotal * 0.14 * 100) / 100
    const discount = Number(data.discount || 0)
    const total = Math.max(0, subtotal + tax - discount)

    const invoiceStatus = data.status && isAllowed(data.status, [...ALLOWED_INVOICE_STATUSES]) ? data.status : 'صادرة'

    const result = await db.prepare(
      `INSERT INTO invoices (invoice_no, client_id, case_id, issue_date, due_date, subtotal, tax, discount, total, paid, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).bind(
      invoiceNo,
      Number(data.client_id),
      data.case_id ? Number(data.case_id) : null,
      issueDate,
      data.due_date || null,
      subtotal,
      tax,
      discount,
      total,
      invoiceStatus,
      cleanString(data.notes, MAX_NOTE_LENGTH),
      currentUserId
    ).run()

    const id = result.meta.last_row_id as number

    if (items.length) {
      const itemStatements = items.map((it: any) => {
        const qty = Number(it.qty || 1)
        const amount = Number(it.amount || qty * Number(it.unit_price || 0))
        const unit_price = Number(it.unit_price !== undefined ? it.unit_price : (qty ? amount / qty : amount))
        return db.prepare(
          `INSERT INTO invoice_items (invoice_id, description, qty, unit_price, amount) VALUES (?, ?, ?, ?, ?)`
        ).bind(id, cleanString(it.description, MAX_TEXT_LENGTH) || 'بند أتعاب', qty, unit_price, amount)
      })
      await db.batch(itemStatements)
    }

    await logActivity(db, currentUserId, 'invoice', id, 'إصدار', `فاتورة ${invoiceNo}`)
    return { id, invoice_no: invoiceNo }
  }

  /**
   * Updates invoice status, notes, or due date
   */
  static async updateInvoice(db: D1Database, id: number | string, data: UpdateInvoiceDTO): Promise<boolean> {
    const existing = await db.prepare(`SELECT * FROM invoices WHERE id = ?`).bind(id).first()
    if (!existing) {
      throw new Error('الفاتورة غير موجودة')
    }

    const status = data.status !== undefined && isAllowed(data.status, [...ALLOWED_INVOICE_STATUSES]) ? data.status : (existing as any).status
    const notes = data.notes !== undefined ? cleanString(data.notes, MAX_NOTE_LENGTH) : (existing as any).notes
    const due_date = data.due_date !== undefined ? data.due_date : (existing as any).due_date

    await db.prepare(`UPDATE invoices SET status=?, notes=?, due_date=? WHERE id=?`).bind(status, notes, due_date, id).run()
    return true
  }

  /**
   * Lists payments
   */
  static async getPayments(db: D1Database): Promise<any[]> {
    const { results } = await db.prepare(
      `SELECT p.*, cl.name AS client_name, i.invoice_no
       FROM payments p JOIN clients cl ON cl.id=p.client_id LEFT JOIN invoices i ON i.id=p.invoice_id
       ORDER BY p.paid_at DESC LIMIT 100`
    ).all()
    return results || []
  }

  /**
   * Records payment and reconciles invoice status
   */
  static async recordPayment(db: D1Database, data: RecordPaymentDTO, currentUserId: number): Promise<number> {
    const amount = Number(data.amount)
    if (isNaN(amount) || amount <= 0) {
      throw new Error('مبلغ التحصيل يجب أن يكون رقماً موجباً')
    }

    let clientId = data.client_id ? Number(data.client_id) : null
    let invoice: any = null
    if (data.invoice_id) {
      invoice = await db.prepare(`SELECT * FROM invoices WHERE id=?`).bind(data.invoice_id).first()
      if (!invoice) {
        throw new Error('الفاتورة المحددة غير موجودة')
      }
      if (!clientId) {
        clientId = invoice.client_id
      }
    }

    if (!clientId) {
      throw new Error('الموكل مطلوب لقيد التحصيل')
    }

    const paidAt = data.paid_at || new Date().toISOString().slice(0, 10)
    const result = await db.prepare(
      `INSERT INTO payments (invoice_id, client_id, amount, method, paid_at, reference, notes, received_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.invoice_id ? Number(data.invoice_id) : null,
      clientId,
      amount,
      cleanString(data.method, 30) || 'تحويل',
      paidAt,
      cleanString(data.reference, 100),
      cleanString(data.notes, MAX_NOTE_LENGTH),
      currentUserId
    ).run()

    if (invoice) {
      const paid = Math.round((Number(invoice.paid || 0) + amount) * 100) / 100
      const status = paid >= Number(invoice.total) - 0.5 ? 'مسددة' : 'جزئي'
      await db.prepare(`UPDATE invoices SET paid=?, status=? WHERE id=?`).bind(paid, status, data.invoice_id).run()
    }

    await logActivity(db, currentUserId, 'payment', result.meta.last_row_id as number, 'تحصيل', `تحصيل مبلغ ${amount} ج.م`)
    return result.meta.last_row_id as number
  }

  /**
   * Lists expenses
   */
  static async getExpenses(db: D1Database): Promise<any[]> {
    const { results } = await db.prepare(
      `SELECT e.*, cs.title AS case_title, cs.case_no, cs.year
       FROM expenses e LEFT JOIN cases cs ON cs.id=e.case_id ORDER BY e.expense_date DESC LIMIT 100`
    ).all()
    return results || []
  }

  /**
   * Records a new expense
   */
  static async createExpense(db: D1Database, data: CreateExpenseDTO, currentUserId: number): Promise<number> {
    const amount = Number(data.amount)
    const title = cleanString(data.title, MAX_NAME_LENGTH)
    if (!title || isNaN(amount) || amount <= 0) {
      throw new Error('بيان المصروف وقيمة صالحة مطلوبان')
    }

    const expenseDate = data.expense_date || new Date().toISOString().slice(0, 10)
    const result = await db.prepare(
      `INSERT INTO expenses (case_id, title, category, amount, expense_date, billable, billed, vendor, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.case_id ? Number(data.case_id) : null,
      title,
      cleanString(data.category, 50) || 'أخرى',
      amount,
      expenseDate,
      data.billable ? 1 : 0,
      0,
      cleanString(data.vendor, MAX_NAME_LENGTH),
      cleanString(data.notes, MAX_NOTE_LENGTH),
      currentUserId
    ).run()

    return result.meta.last_row_id as number
  }

  /**
   * Lists time entries
   */
  static async getTimeEntries(db: D1Database): Promise<any[]> {
    const { results } = await db.prepare(
      `SELECT t.*, u.name AS user_name, cs.title AS case_title, cs.case_no, cs.year
       FROM time_entries t JOIN users u ON u.id=t.user_id LEFT JOIN cases cs ON cs.id=t.case_id
       ORDER BY t.work_date DESC LIMIT 150`
    ).all()
    return results || []
  }

  /**
   * Records billable time with RBAC authorization
   */
  static async logTime(db: D1Database, data: LogTimeDTO, currentUser: User): Promise<number> {
    const hours = Number(data.hours)
    if (isNaN(hours) || hours <= 0) {
      throw new Error('عدد الساعات يجب أن يكون رقماً موجباً')
    }

    let targetUserId = currentUser.id
    if (data.user_id && Number(data.user_id) !== currentUser.id) {
      const isPrivileged = ['managing_partner', 'partner', 'admin'].includes(currentUser.role)
      if (!isPrivileged) {
        throw new Error('غير مصرح — لا يمكنك تسجيل ساعات لمستخدم آخر')
      }
      targetUserId = Number(data.user_id)
    }

    const rate = data.rate !== undefined ? Number(data.rate) : (currentUser.hourly_rate || 0)
    const workDate = data.work_date || new Date().toISOString().slice(0, 10)

    const result = await db.prepare(
      `INSERT INTO time_entries (user_id, case_id, work_date, hours, description, billable, billed, rate)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    ).bind(
      targetUserId,
      data.case_id ? Number(data.case_id) : null,
      workDate,
      hours,
      cleanString(data.description, MAX_TEXT_LENGTH),
      data.billable === 0 ? 0 : 1,
      rate
    ).run()

    return result.meta.last_row_id as number
  }

  /**
   * Lists contracts
   */
  static async getContracts(db: D1Database): Promise<any[]> {
    const { results } = await db.prepare(
      `SELECT co.*, cl.name AS client_name FROM contracts co JOIN clients cl ON cl.id=co.client_id ORDER BY co.start_date DESC LIMIT 100`
    ).all()
    return results || []
  }

  /**
   * Registers a new retainer agreement / contract
   */
  static async createContract(db: D1Database, data: CreateContractDTO): Promise<number> {
    const title = cleanString(data.title, MAX_NAME_LENGTH)
    if (!title || !data.client_id) {
      throw new Error('عنوان العقد والموكل مطلوبان')
    }

    const result = await db.prepare(
      `INSERT INTO contracts (title, client_id, type, start_date, end_date, value, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      title,
      Number(data.client_id),
      cleanString(data.type, 50) || 'أتعاب',
      data.start_date || null,
      data.end_date || null,
      Number(data.value || 0),
      data.status || 'ساري',
      cleanString(data.notes, MAX_NOTE_LENGTH)
    ).run()

    return result.meta.last_row_id as number
  }

  /**
   * Computes financial report metrics
   */
  static async getFinanceReport(db: D1Database): Promise<any> {
    const months = await db.prepare(`
      SELECT strftime('%Y-%m', issue_date) AS m,
        SUM(total) AS invoiced,
        SUM(paid) AS paid
      FROM invoices WHERE status != 'ملغاة' AND issue_date >= date('now','-11 months','start of month')
      GROUP BY m ORDER BY m
    `).all()

    const byClient = await db.prepare(`
      SELECT cl.name, SUM(i.total) AS invoiced, SUM(i.paid) AS paid, SUM(i.total-i.paid) AS due
      FROM invoices i JOIN clients cl ON cl.id=i.client_id WHERE i.status != 'ملغاة'
      GROUP BY cl.id ORDER BY due DESC LIMIT 8
    `).all()

    const unbilled = await db.prepare(`
      SELECT COALESCE(SUM(hours*rate),0) AS time_value,
        (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE billable=1 AND billed=0) AS exp_value
      FROM time_entries WHERE billable=1 AND billed=0
    `).first()

    return {
      months: months.results || [],
      by_client: byClient.results || [],
      unbilled
    }
  }
}
