import { Hono } from 'hono'
import { ALLOWED_INVOICE_STATUSES, MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_NOTE_LENGTH } from '../config/constants'
import { requireUser } from '../middleware/auth'
import { logActivity } from '../utils/logger'
import { isAllowed, cleanString } from '../utils/validation'
import { AppContext, User } from '../types'

export const financeRoutes = new Hono<AppContext>()

/**
 * GET /api/invoices
 * Lists invoices with status filtering and linked client/case metadata
 */
financeRoutes.get('/invoices', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const status = c.req.query('status')
  let sql = `SELECT i.*, cl.name AS client_name, cs.title AS case_title, cs.case_no, cs.year
    FROM invoices i JOIN clients cl ON cl.id=i.client_id LEFT JOIN cases cs ON cs.id=i.case_id WHERE 1=1`
  const binds: any[] = []

  if (status && isAllowed(status, [...ALLOWED_INVOICE_STATUSES])) {
    sql += ` AND i.status = ?`
    binds.push(status)
  }

  sql += ` ORDER BY i.issue_date DESC LIMIT 150`
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json(results || [])
})

/**
 * GET /api/invoices/:id
 * Fetches single invoice details with line items and historical payments
 */
financeRoutes.get('/invoices/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const id = c.req.param('id')
  const inv = await c.env.DB.prepare(
    `SELECT i.*, cl.name AS client_name, cl.address, cl.tax_id, cl.phone, cl.email, cs.title AS case_title, cs.case_no, cs.year
     FROM invoices i JOIN clients cl ON cl.id=i.client_id LEFT JOIN cases cs ON cs.id=i.case_id WHERE i.id=?`
  ).bind(id).first()

  if (!inv) return c.json({ error: 'الفاتورة غير موجودة' }, 404)

  const [items, pays] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM invoice_items WHERE invoice_id=?`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM payments WHERE invoice_id=? ORDER BY paid_at`).bind(id).all()
  ])

  return c.json({
    ...inv,
    items: items.results || [],
    payments: pays.results || []
  })
})

/**
 * POST /api/invoices
 * Issues a new legal fee invoice with sequential numbering and line items
 */
financeRoutes.post('/invoices', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  if (!b.client_id) return c.json({ error: 'الموكل مطلوب لإصدار الفاتورة' }, 400)
  const issueDate = b.issue_date || new Date().toISOString().slice(0, 10)

  const year = new Date(issueDate).getFullYear() || new Date().getFullYear()
  const last = await c.env.DB.prepare(
    `SELECT invoice_no FROM invoices WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1`
  ).bind(`INV-${year}-%`).first<{ invoice_no: string }>()

  let seq = 1
  if (last?.invoice_no) {
    seq = parseInt(String(last.invoice_no).split('-').pop() || '0', 10) + 1
  }
  const no = `INV-${year}-${String(seq).padStart(3, '0')}`

  const items = Array.isArray(b.items) && b.items.length
    ? b.items
    : [{ description: 'أتعاب مهنية', qty: 1, unit_price: Number(b.amount || 0), amount: Number(b.amount || 0) }]

  const subtotal = items.reduce((s: number, it: any) => s + Number(it.amount || (it.qty || 1) * (it.unit_price || 0)), 0)
  const tax = b.tax !== undefined ? Number(b.tax) : Math.round(subtotal * 0.14 * 100) / 100
  const discount = Number(b.discount || 0)
  const total = Math.max(0, subtotal + tax - discount)

  const invoiceStatus = b.status && isAllowed(b.status, [...ALLOWED_INVOICE_STATUSES]) ? b.status : 'صادرة'

  const result = await c.env.DB.prepare(
    `INSERT INTO invoices (invoice_no, client_id, case_id, issue_date, due_date, subtotal, tax, discount, total, paid, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(
    no,
    Number(b.client_id),
    b.case_id ? Number(b.case_id) : null,
    issueDate,
    b.due_date || null,
    subtotal,
    tax,
    discount,
    total,
    invoiceStatus,
    cleanString(b.notes, MAX_NOTE_LENGTH),
    (user as User).id
  ).run()

  const id = result.meta.last_row_id as number
  if (items.length) {
    const itemStatements = items.map((it: any) => {
      const qty = Number(it.qty || 1)
      const amount = Number(it.amount || qty * Number(it.unit_price || 0))
      const unit_price = Number(it.unit_price !== undefined ? it.unit_price : (qty ? amount / qty : amount))
      return c.env.DB.prepare(
        `INSERT INTO invoice_items (invoice_id, description, qty, unit_price, amount) VALUES (?, ?, ?, ?, ?)`
      ).bind(id, cleanString(it.description, MAX_TEXT_LENGTH) || 'بند أتعاب', qty, unit_price, amount)
    })
    await c.env.DB.batch(itemStatements)
  }

  await logActivity(c.env.DB, (user as User).id, 'invoice', id, 'إصدار', `فاتورة ${no}`)
  return c.json({ id, invoice_no: no })
})

/**
 * PUT /api/invoices/:id
 * Updates invoice status, notes, or due date
 */
financeRoutes.put('/invoices/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(`SELECT * FROM invoices WHERE id = ?`).bind(id).first()
  if (!existing) return c.json({ error: 'الفاتورة غير موجودة' }, 404)

  const b = await c.req.json()
  const status = b.status !== undefined && isAllowed(b.status, [...ALLOWED_INVOICE_STATUSES]) ? b.status : (existing as any).status
  const notes = b.notes !== undefined ? cleanString(b.notes, MAX_NOTE_LENGTH) : (existing as any).notes
  const due_date = b.due_date !== undefined ? b.due_date : (existing as any).due_date

  await c.env.DB.prepare(`UPDATE invoices SET status=?, notes=?, due_date=? WHERE id=?`).bind(status, notes, due_date, id).run()
  return c.json({ ok: true })
})

/**
 * GET /api/payments
 * Lists fee collections and payment vouchers
 */
financeRoutes.get('/payments', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const { results } = await c.env.DB.prepare(
    `SELECT p.*, cl.name AS client_name, i.invoice_no
     FROM payments p JOIN clients cl ON cl.id=p.client_id LEFT JOIN invoices i ON i.id=p.invoice_id
     ORDER BY p.paid_at DESC LIMIT 100`
  ).all()

  return c.json(results || [])
})

/**
 * POST /api/payments
 * Records fee collection payment and updates invoice paid balance & status
 */
financeRoutes.post('/payments', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  const amount = Number(b.amount)
  if (isNaN(amount) || amount <= 0) {
    return c.json({ error: 'مبلغ التحصيل يجب أن يكون رقماً موجباً' }, 400)
  }

  let clientId = b.client_id ? Number(b.client_id) : null
  let invoice: any = null
  if (b.invoice_id) {
    invoice = await c.env.DB.prepare(`SELECT * FROM invoices WHERE id=?`).bind(b.invoice_id).first()
    if (invoice && !clientId) {
      clientId = invoice.client_id
    }
  }

  if (!clientId) {
    return c.json({ error: 'الموكل مطلوب لقيد التحصيل' }, 400)
  }

  const paidAt = b.paid_at || new Date().toISOString().slice(0, 10)
  const result = await c.env.DB.prepare(
    `INSERT INTO payments (invoice_id, client_id, amount, method, paid_at, reference, notes, received_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    b.invoice_id ? Number(b.invoice_id) : null,
    clientId,
    amount,
    cleanString(b.method, 30) || 'تحويل',
    paidAt,
    cleanString(b.reference, 100),
    cleanString(b.notes, MAX_NOTE_LENGTH),
    (user as User).id
  ).run()

  if (invoice) {
    const paid = Number(invoice.paid || 0) + amount
    const status = paid >= Number(invoice.total) - 0.5 ? 'مسددة' : 'جزئي'
    await c.env.DB.prepare(`UPDATE invoices SET paid=?, status=? WHERE id=?`).bind(paid, status, b.invoice_id).run()
  }

  await logActivity(c.env.DB, (user as User).id, 'payment', result.meta.last_row_id as number, 'تحصيل', `تحصيل مبلغ ${amount} ج.م`)
  return c.json({ id: result.meta.last_row_id })
})

/**
 * GET /api/expenses
 * Lists case judicial expenses, court fees, and office outlays
 */
financeRoutes.get('/expenses', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const { results } = await c.env.DB.prepare(
    `SELECT e.*, cs.title AS case_title, cs.case_no, cs.year
     FROM expenses e LEFT JOIN cases cs ON cs.id=e.case_id ORDER BY e.expense_date DESC LIMIT 100`
  ).all()

  return c.json(results || [])
})

/**
 * POST /api/expenses
 * Records a new case expense or court deposit
 */
financeRoutes.post('/expenses', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  const amount = Number(b.amount)
  const title = cleanString(b.title, MAX_NAME_LENGTH)
  if (!title || isNaN(amount) || amount <= 0) {
    return c.json({ error: 'بيان المصروف وقيمة صالحة مطلوبان' }, 400)
  }

  const expenseDate = b.expense_date || new Date().toISOString().slice(0, 10)
  const result = await c.env.DB.prepare(
    `INSERT INTO expenses (case_id, title, category, amount, expense_date, billable, billed, vendor, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    b.case_id ? Number(b.case_id) : null,
    title,
    cleanString(b.category, 50) || 'أخرى',
    amount,
    expenseDate,
    b.billable ? 1 : 0,
    0,
    cleanString(b.vendor, MAX_NAME_LENGTH),
    cleanString(b.notes, MAX_NOTE_LENGTH),
    (user as User).id
  ).run()

  return c.json({ id: result.meta.last_row_id })
})

/**
 * GET /api/time
 * Lists lawyer billable time entries
 */
financeRoutes.get('/time', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const { results } = await c.env.DB.prepare(
    `SELECT t.*, u.name AS user_name, cs.title AS case_title, cs.case_no, cs.year
     FROM time_entries t JOIN users u ON u.id=t.user_id LEFT JOIN cases cs ON cs.id=t.case_id
     ORDER BY t.work_date DESC LIMIT 150`
  ).all()

  return c.json(results || [])
})

/**
 * POST /api/time
 * Records time spent by a lawyer on a client case.
 * Users can only log time for themselves (no impersonation).
 * Admins/Partners can log time for other users.
 */
financeRoutes.post('/time', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  const hours = Number(b.hours)
  if (isNaN(hours) || hours <= 0) {
    return c.json({ error: 'عدد الساعات يجب أن يكون رقماً موجباً' }, 400)
  }

  const currentUser = user as User
  // Restrict time logging: only admins/partners can log time for other users
  let targetUserId = currentUser.id
  if (b.user_id && Number(b.user_id) !== currentUser.id) {
    const isPrivileged = ['managing_partner', 'partner', 'admin'].includes(currentUser.role)
    if (!isPrivileged) {
      return c.json({ error: 'غير مصرح — لا يمكنك تسجيل ساعات لمستخدم آخر' }, 403)
    }
    targetUserId = Number(b.user_id)
  }

  const rate = b.rate !== undefined ? Number(b.rate) : (currentUser.hourly_rate || 0)
  const workDate = b.work_date || new Date().toISOString().slice(0, 10)
  const result = await c.env.DB.prepare(
    `INSERT INTO time_entries (user_id, case_id, work_date, hours, description, billable, billed, rate)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).bind(
    targetUserId,
    b.case_id ? Number(b.case_id) : null,
    workDate,
    hours,
    cleanString(b.description, MAX_TEXT_LENGTH),
    b.billable === 0 ? 0 : 1,
    rate
  ).run()

  return c.json({ id: result.meta.last_row_id })
})

/**
 * GET /api/contracts
 * Lists annual retainers and legal service agreements
 */
financeRoutes.get('/contracts', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const { results } = await c.env.DB.prepare(
    `SELECT co.*, cl.name AS client_name FROM contracts co JOIN clients cl ON cl.id=co.client_id ORDER BY co.start_date DESC LIMIT 100`
  ).all()

  return c.json(results || [])
})

/**
 * POST /api/contracts
 * Registers a new legal retainer agreement
 */
financeRoutes.post('/contracts', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  const title = cleanString(b.title, MAX_NAME_LENGTH)
  if (!title || !b.client_id) {
    return c.json({ error: 'عنوان العقد والموكل مطلوبان' }, 400)
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO contracts (title, client_id, type, start_date, end_date, value, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    title,
    Number(b.client_id),
    cleanString(b.type, 50) || 'أتعاب',
    b.start_date || null,
    b.end_date || null,
    Number(b.value || 0),
    b.status || 'ساري',
    cleanString(b.notes, MAX_NOTE_LENGTH)
  ).run()

  return c.json({ id: result.meta.last_row_id })
})

/**
 * GET /api/reports/finance
 * Computes financial performance: monthly billing vs collections, outstanding balances, unbilled time
 */
financeRoutes.get('/reports/finance', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const months = await c.env.DB.prepare(`
    SELECT strftime('%Y-%m', issue_date) AS m,
      SUM(total) AS invoiced,
      SUM(paid) AS paid
    FROM invoices WHERE status != 'ملغاة' AND issue_date >= date('now','-11 months','start of month')
    GROUP BY m ORDER BY m
  `).all()

  const byClient = await c.env.DB.prepare(`
    SELECT cl.name, SUM(i.total) AS invoiced, SUM(i.paid) AS paid, SUM(i.total-i.paid) AS due
    FROM invoices i JOIN clients cl ON cl.id=i.client_id WHERE i.status != 'ملغاة'
    GROUP BY cl.id ORDER BY due DESC LIMIT 8
  `).all()

  const unbilled = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(hours*rate),0) AS time_value,
      (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE billable=1 AND billed=0) AS exp_value
    FROM time_entries WHERE billable=1 AND billed=0
  `).first()

  return c.json({
    months: months.results || [],
    by_client: byClient.results || [],
    unbilled
  })
})
