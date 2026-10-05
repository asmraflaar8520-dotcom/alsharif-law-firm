import { Hono } from 'hono'
import { ALLOWED_CLIENT_STATUSES, ALLOWED_CLIENT_TYPES, MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_NOTE_LENGTH } from '../config/constants'
import { requireUser } from '../middleware/auth'
import { logActivity } from '../utils/logger'
import { escapeLike, isAllowed, cleanString } from '../utils/validation'
import { AppContext, User } from '../types'

export const clientRoutes = new Hono<AppContext>()

/**
 * GET /api/clients
 * Lists clients with optional keyword and status filtering, plus case counts and balances
 */
clientRoutes.get('/', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const q = c.req.query('q')
  const status = c.req.query('status')
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
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json(results || [])
})

/**
 * GET /api/clients/:id
 * Fetches single client details including linked cases, invoices, POAs, and notes
 */
clientRoutes.get('/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const id = c.req.param('id')
  const client = await c.env.DB.prepare(
    `SELECT cl.*, u.name AS lawyer_name FROM clients cl LEFT JOIN users u ON u.id = cl.assigned_lawyer_id WHERE cl.id = ?`
  ).bind(id).first()

  if (!client) return c.json({ error: 'الموكل غير موجود' }, 404)

  const [cases, invoices, poas, notes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT c.*, ct.name AS type_name, co.name AS court_name, u.name AS lawyer_name
       FROM cases c
       LEFT JOIN case_types ct ON ct.id=c.case_type_id
       LEFT JOIN courts co ON co.id=c.court_id
       LEFT JOIN users u ON u.id=c.lead_lawyer_id
       WHERE c.client_id=? ORDER BY c.created_at DESC`
    ).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM invoices WHERE client_id=? ORDER BY issue_date DESC LIMIT 50`).bind(id).all(),
    c.env.DB.prepare(
      `SELECT p.*, u.name AS lawyer_name FROM powers_of_attorney p LEFT JOIN users u ON u.id=p.lawyer_id WHERE p.client_id=? ORDER BY p.issue_date DESC`
    ).bind(id).all(),
    c.env.DB.prepare(
      `SELECT n.*, u.name AS user_name FROM notes n LEFT JOIN users u ON u.id=n.user_id WHERE n.client_id=? ORDER BY n.pinned DESC, n.created_at DESC LIMIT 50`
    ).bind(id).all()
  ])

  return c.json({
    ...client,
    cases: cases.results || [],
    invoices: invoices.results || [],
    poas: poas.results || [],
    notes: notes.results || []
  })
})

/**
 * POST /api/clients
 * Registers a new client
 */
clientRoutes.post('/', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  const name = cleanString(b.name, MAX_NAME_LENGTH)
  if (!name) return c.json({ error: 'اسم الموكل مطلوب' }, 400)

  const clientType = b.type && isAllowed(b.type, [...ALLOWED_CLIENT_TYPES]) ? b.type : 'individual'
  const status = b.status && isAllowed(b.status, [...ALLOWED_CLIENT_STATUSES]) ? b.status : 'active'

  const result = await c.env.DB.prepare(
    `INSERT INTO clients (type,name,national_id,tax_id,commercial_reg,nationality,phone,phone2,email,address,city,occupation,company_rep,notes,status,assigned_lawyer_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    clientType,
    name,
    cleanString(b.national_id, 30),
    cleanString(b.tax_id, 30),
    cleanString(b.commercial_reg, 30),
    cleanString(b.nationality, 50) || 'مصري',
    cleanString(b.phone, 30),
    cleanString(b.phone2, 30),
    cleanString(b.email, 254),
    cleanString(b.address, MAX_TEXT_LENGTH),
    cleanString(b.city, 100),
    cleanString(b.occupation, 100),
    cleanString(b.company_rep, MAX_NAME_LENGTH),
    cleanString(b.notes, MAX_NOTE_LENGTH),
    status,
    b.assigned_lawyer_id ? Number(b.assigned_lawyer_id) : null
  ).run()

  const id = result.meta.last_row_id as number
  await logActivity(c.env.DB, (user as User).id, 'client', id, 'إنشاء', `موكل جديد: ${name}`)
  return c.json({ id })
})

/**
 * PUT /api/clients/:id
 * Updates client profile safely without overriding missing attributes
 */
clientRoutes.put('/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(`SELECT * FROM clients WHERE id = ?`).bind(id).first<any>()
  if (!existing) return c.json({ error: 'الموكل غير موجود' }, 404)

  const b = await c.req.json()
  const type = b.type !== undefined && isAllowed(b.type, [...ALLOWED_CLIENT_TYPES]) ? b.type : existing.type
  const name = b.name !== undefined ? (cleanString(b.name, MAX_NAME_LENGTH) || existing.name) : existing.name
  const national_id = b.national_id !== undefined ? cleanString(b.national_id, 30) : existing.national_id
  const tax_id = b.tax_id !== undefined ? cleanString(b.tax_id, 30) : existing.tax_id
  const commercial_reg = b.commercial_reg !== undefined ? cleanString(b.commercial_reg, 30) : existing.commercial_reg
  const nationality = b.nationality !== undefined ? cleanString(b.nationality, 50) : existing.nationality
  const phone = b.phone !== undefined ? cleanString(b.phone, 30) : existing.phone
  const phone2 = b.phone2 !== undefined ? cleanString(b.phone2, 30) : existing.phone2
  const email = b.email !== undefined ? cleanString(b.email, 254) : existing.email
  const address = b.address !== undefined ? cleanString(b.address, MAX_TEXT_LENGTH) : existing.address
  const city = b.city !== undefined ? cleanString(b.city, 100) : existing.city
  const occupation = b.occupation !== undefined ? cleanString(b.occupation, 100) : existing.occupation
  const company_rep = b.company_rep !== undefined ? cleanString(b.company_rep, MAX_NAME_LENGTH) : existing.company_rep
  const notes = b.notes !== undefined ? cleanString(b.notes, MAX_NOTE_LENGTH) : existing.notes
  const status = b.status !== undefined && isAllowed(b.status, [...ALLOWED_CLIENT_STATUSES]) ? b.status : existing.status
  const assigned_lawyer_id = b.assigned_lawyer_id !== undefined ? (b.assigned_lawyer_id ? Number(b.assigned_lawyer_id) : null) : existing.assigned_lawyer_id

  await c.env.DB.prepare(
    `UPDATE clients SET type=?, name=?, national_id=?, tax_id=?, commercial_reg=?, nationality=?, phone=?, phone2=?, email=?, address=?, city=?, occupation=?, company_rep=?, notes=?, status=?, assigned_lawyer_id=? WHERE id=?`
  ).bind(type, name, national_id, tax_id, commercial_reg, nationality, phone, phone2, email, address, city, occupation, company_rep, notes, status, assigned_lawyer_id, id).run()

  await logActivity(c.env.DB, (user as User).id, 'client', Number(id), 'تحديث', `تحديث بيانات الموكل ${name}`)
  return c.json({ ok: true })
})
