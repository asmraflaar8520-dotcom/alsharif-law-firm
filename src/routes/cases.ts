import { Hono } from 'hono'
import { ALLOWED_CASE_STATUSES, ALLOWED_CASE_PRIORITIES, ALLOWED_CASE_DEGREES, ALLOWED_HEARING_STATUSES, MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_NOTE_LENGTH } from '../config/constants'
import { requireUser } from '../middleware/auth'
import { logActivity } from '../utils/logger'
import { escapeLike, isAllowed, cleanString } from '../utils/validation'
import { AppContext, User } from '../types'

export const caseRoutes = new Hono<AppContext>()

/**
 * GET /api/cases
 * Searches and lists cases with filters (q, status, lawyer, type, priority)
 */
caseRoutes.get('/cases', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const { q, status, lawyer, type, priority } = c.req.query()
  let sql = `SELECT c.*, cl.name AS client_name, cl.type AS client_type, ct.name AS type_name, ct.category,
    co.name AS court_name, u.name AS lawyer_name, u.initials AS lawyer_initials, u.color AS lawyer_color,
    (SELECT MIN(hearing_date) FROM hearings h WHERE h.case_id=c.id AND h.hearing_date>=date('now') AND h.status IN ('قادمة','حجز للحكم')) AS next_hearing
    FROM cases c
    JOIN clients cl ON cl.id=c.client_id
    LEFT JOIN case_types ct ON ct.id=c.case_type_id
    LEFT JOIN courts co ON co.id=c.court_id
    LEFT JOIN users u ON u.id=c.lead_lawyer_id
    WHERE 1=1`
  const binds: any[] = []

  if (q) {
    sql += ` AND (c.title LIKE ? ESCAPE '\\' OR c.case_no LIKE ? ESCAPE '\\' OR cl.name LIKE ? ESCAPE '\\' OR c.opposing_name LIKE ? ESCAPE '\\')`
    const like = `%${escapeLike(q)}%`
    binds.push(like, like, like, like)
  }
  if (status && isAllowed(status, [...ALLOWED_CASE_STATUSES])) {
    sql += ` AND c.status = ?`
    binds.push(status)
  }
  if (lawyer) {
    sql += ` AND c.lead_lawyer_id = ?`
    binds.push(lawyer)
  }
  if (type) {
    sql += ` AND c.case_type_id = ?`
    binds.push(type)
  }
  if (priority && isAllowed(priority, [...ALLOWED_CASE_PRIORITIES])) {
    sql += ` AND c.priority = ?`
    binds.push(priority)
  }

  sql += ` ORDER BY CASE c.priority WHEN 'عاجلة' THEN 0 WHEN 'عالية' THEN 1 WHEN 'عادية' THEN 2 ELSE 3 END, c.updated_at DESC LIMIT 150`
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json(results || [])
})

/**
 * GET /api/cases/:id
 * Fetches complete file dossier including hearings, documents, notes, lawyers, billing, and tasks
 */
caseRoutes.get('/cases/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const id = c.req.param('id')
  const caseRecord = await c.env.DB.prepare(
    `SELECT c.*, cl.name AS client_name, cl.phone AS client_phone, cl.type AS client_type, cl.email AS client_email,
      ct.name AS type_name, ct.category, co.name AS court_name, u.name AS lawyer_name, u.initials AS lawyer_initials, u.color AS lawyer_color
     FROM cases c
     JOIN clients cl ON cl.id=c.client_id
     LEFT JOIN case_types ct ON ct.id=c.case_type_id
     LEFT JOIN courts co ON co.id=c.court_id
     LEFT JOIN users u ON u.id=c.lead_lawyer_id
     WHERE c.id=?`
  ).bind(id).first()

  if (!caseRecord) return c.json({ error: 'القضية غير موجودة' }, 404)

  const [hearings, docs, notes, lawyers, invoices, expenses, times, tasks, poas] = await Promise.all([
    c.env.DB.prepare(`SELECT h.*, u.name AS lawyer_name, co.name AS court_name FROM hearings h LEFT JOIN users u ON u.id=h.lawyer_id LEFT JOIN courts co ON co.id=h.court_id WHERE h.case_id=? ORDER BY h.hearing_date DESC LIMIT 50`).bind(id).all(),
    c.env.DB.prepare(`SELECT d.*, u.name AS uploader FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by WHERE d.case_id=? ORDER BY d.created_at DESC LIMIT 50`).bind(id).all(),
    c.env.DB.prepare(`SELECT n.*, u.name AS user_name, u.initials, u.color FROM notes n LEFT JOIN users u ON u.id=n.user_id WHERE n.case_id=? ORDER BY n.pinned DESC, n.created_at DESC LIMIT 50`).bind(id).all(),
    c.env.DB.prepare(`SELECT u.id, u.name, u.title, u.initials, u.color, clw.role FROM case_lawyers clw JOIN users u ON u.id=clw.user_id WHERE clw.case_id=?`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM invoices WHERE case_id=? ORDER BY issue_date DESC LIMIT 50`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM expenses WHERE case_id=? ORDER BY expense_date DESC LIMIT 50`).bind(id).all(),
    c.env.DB.prepare(`SELECT t.*, u.name AS user_name FROM time_entries t JOIN users u ON u.id=t.user_id WHERE t.case_id=? ORDER BY t.work_date DESC LIMIT 50`).bind(id).all(),
    c.env.DB.prepare(`SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.case_id=? ORDER BY t.due_date LIMIT 50`).bind(id).all(),
    c.env.DB.prepare(`SELECT p.*, u.name AS lawyer_name FROM powers_of_attorney p LEFT JOIN users u ON u.id=p.lawyer_id WHERE p.case_id=? OR (p.case_id IS NULL AND p.client_id=?) LIMIT 50`).bind(id, (caseRecord as any).client_id).all()
  ])

  return c.json({
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
  })
})

/**
 * POST /api/cases
 * Creates a new case file
 */
caseRoutes.post('/cases', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  const case_no = cleanString(b.case_no, 50)
  const title = cleanString(b.title, MAX_NAME_LENGTH)
  if (!case_no || !b.year || !title || !b.client_id) {
    return c.json({ error: 'رقم الدعوى والسنة وعنوان الدعوى والموكل حقول إجبارية' }, 400)
  }

  const status = b.status && isAllowed(b.status, [...ALLOWED_CASE_STATUSES]) ? b.status : 'متداولة'
  const priority = b.priority && isAllowed(b.priority, [...ALLOWED_CASE_PRIORITIES]) ? b.priority : 'عادية'
  const degree = b.degree && isAllowed(b.degree, [...ALLOWED_CASE_DEGREES]) ? b.degree : 'ابتدائي'

  const result = await c.env.DB.prepare(
    `INSERT INTO cases (case_no, year, title, case_type_id, court_id, circuit, degree, status, priority, client_id, opposing_name, opposing_lawyer, lead_lawyer_id, subject, claim_value, currency, filing_date, next_action)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    case_no,
    Number(b.year),
    title,
    b.case_type_id ? Number(b.case_type_id) : null,
    b.court_id ? Number(b.court_id) : null,
    cleanString(b.circuit, 100),
    degree,
    status,
    priority,
    Number(b.client_id),
    cleanString(b.opposing_name, MAX_NAME_LENGTH),
    cleanString(b.opposing_lawyer, MAX_NAME_LENGTH),
    b.lead_lawyer_id ? Number(b.lead_lawyer_id) : null,
    cleanString(b.subject, MAX_TEXT_LENGTH),
    Number(b.claim_value || 0),
    b.currency || 'EGP',
    b.filing_date || null,
    cleanString(b.next_action, MAX_TEXT_LENGTH)
  ).run()

  const id = result.meta.last_row_id as number
  if (b.lead_lawyer_id) {
    await c.env.DB.prepare(`INSERT OR IGNORE INTO case_lawyers (case_id, user_id, role) VALUES (?, ?, 'رئيس')`).bind(id, b.lead_lawyer_id).run()
  }
  await logActivity(c.env.DB, (user as User).id, 'case', id, 'إنشاء', `قضية جديدة ${case_no} لسنة ${b.year}`)
  return c.json({ id })
})

/**
 * PUT /api/cases/:id
 * Updates case details safely
 */
caseRoutes.put('/cases/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(`SELECT * FROM cases WHERE id = ?`).bind(id).first<any>()
  if (!existing) return c.json({ error: 'القضية غير موجودة' }, 404)

  const b = await c.req.json()
  const case_no = b.case_no !== undefined ? (cleanString(b.case_no, 50) || existing.case_no) : existing.case_no
  const year = b.year !== undefined ? Number(b.year) : existing.year
  const title = b.title !== undefined ? (cleanString(b.title, MAX_NAME_LENGTH) || existing.title) : existing.title
  const case_type_id = b.case_type_id !== undefined ? (b.case_type_id ? Number(b.case_type_id) : null) : existing.case_type_id
  const court_id = b.court_id !== undefined ? (b.court_id ? Number(b.court_id) : null) : existing.court_id
  const circuit = b.circuit !== undefined ? cleanString(b.circuit, 100) : existing.circuit
  const degree = b.degree !== undefined && isAllowed(b.degree, [...ALLOWED_CASE_DEGREES]) ? b.degree : existing.degree
  const status = b.status !== undefined && isAllowed(b.status, [...ALLOWED_CASE_STATUSES]) ? b.status : existing.status
  const priority = b.priority !== undefined && isAllowed(b.priority, [...ALLOWED_CASE_PRIORITIES]) ? b.priority : existing.priority
  const client_id = b.client_id !== undefined ? Number(b.client_id) : existing.client_id
  const opposing_name = b.opposing_name !== undefined ? cleanString(b.opposing_name, MAX_NAME_LENGTH) : existing.opposing_name
  const opposing_lawyer = b.opposing_lawyer !== undefined ? cleanString(b.opposing_lawyer, MAX_NAME_LENGTH) : existing.opposing_lawyer
  const lead_lawyer_id = b.lead_lawyer_id !== undefined ? (b.lead_lawyer_id ? Number(b.lead_lawyer_id) : null) : existing.lead_lawyer_id
  const subject = b.subject !== undefined ? cleanString(b.subject, MAX_TEXT_LENGTH) : existing.subject
  const claim_value = b.claim_value !== undefined ? Number(b.claim_value || 0) : existing.claim_value
  const currency = b.currency !== undefined ? (b.currency || 'EGP') : (existing.currency || 'EGP')
  const filing_date = b.filing_date !== undefined ? b.filing_date : existing.filing_date
  const next_action = b.next_action !== undefined ? cleanString(b.next_action, MAX_TEXT_LENGTH) : existing.next_action
  const outcome = b.outcome !== undefined ? cleanString(b.outcome, MAX_TEXT_LENGTH) : existing.outcome
  const closed_at = b.closed_at !== undefined ? b.closed_at : existing.closed_at

  await c.env.DB.prepare(
    `UPDATE cases SET case_no=?, year=?, title=?, case_type_id=?, court_id=?, circuit=?, degree=?, status=?, priority=?, client_id=?, opposing_name=?, opposing_lawyer=?, lead_lawyer_id=?, subject=?, claim_value=?, currency=?, filing_date=?, next_action=?, outcome=?, closed_at=?, updated_at=datetime('now') WHERE id=?`
  ).bind(case_no, year, title, case_type_id, court_id, circuit, degree, status, priority, client_id, opposing_name, opposing_lawyer, lead_lawyer_id, subject, claim_value, currency, filing_date, next_action, outcome, closed_at, id).run()

  await logActivity(c.env.DB, (user as User).id, 'case', Number(id), 'تحديث', `تحديث القضية ${case_no}`)
  return c.json({ ok: true })
})

/**
 * POST /api/cases/:id/lawyers
 * Assigns an additional lawyer to a case team
 */
caseRoutes.post('/cases/:id/lawyers', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  if (!b.user_id) return c.json({ error: 'المحامي مطلوب' }, 400)

  await c.env.DB.prepare(`INSERT OR REPLACE INTO case_lawyers (case_id, user_id, role) VALUES (?, ?, ?)`).bind(c.req.param('id'), b.user_id, cleanString(b.role, 50) || 'مساعد').run()
  return c.json({ ok: true })
})

/**
 * GET /api/hearings
 * Lists court session hearings with date range and lawyer filters
 */
caseRoutes.get('/hearings', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const from = c.req.query('from') || '2000-01-01'
  const to = c.req.query('to') || '2099-12-31'
  const lawyer = c.req.query('lawyer')
  const status = c.req.query('status')
  let sql = `SELECT h.*, cs.case_no, cs.year, cs.title AS case_title, cs.priority, cl.name AS client_name, u.name AS lawyer_name, u.initials, u.color, co.name AS court_name
    FROM hearings h
    JOIN cases cs ON cs.id = h.case_id
    JOIN clients cl ON cl.id = cs.client_id
    LEFT JOIN users u ON u.id = h.lawyer_id
    LEFT JOIN courts co ON co.id = h.court_id
    WHERE h.hearing_date BETWEEN ? AND ?`
  const binds: any[] = [from, to]

  if (lawyer) {
    sql += ` AND h.lawyer_id = ?`
    binds.push(lawyer)
  }
  if (status && isAllowed(status, [...ALLOWED_HEARING_STATUSES])) {
    sql += ` AND h.status = ?`
    binds.push(status)
  }

  sql += ` ORDER BY h.hearing_date, h.hearing_time LIMIT 250`
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json(results || [])
})

/**
 * POST /api/hearings
 * Schedules a new court hearing
 */
caseRoutes.post('/hearings', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  if (!b.case_id || !b.hearing_date) {
    return c.json({ error: 'القضية وتاريخ الجلسة مطلوبان' }, 400)
  }

  const status = b.status && isAllowed(b.status, [...ALLOWED_HEARING_STATUSES]) ? b.status : 'قادمة'

  const result = await c.env.DB.prepare(
    `INSERT INTO hearings (case_id, hearing_date, hearing_time, court_id, circuit, type, purpose, lawyer_id, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    Number(b.case_id),
    b.hearing_date,
    b.hearing_time || null,
    b.court_id ? Number(b.court_id) : null,
    cleanString(b.circuit, 100),
    cleanString(b.type, 50) || 'مرافعة',
    cleanString(b.purpose, MAX_TEXT_LENGTH),
    b.lawyer_id ? Number(b.lawyer_id) : null,
    status,
    cleanString(b.notes, MAX_NOTE_LENGTH)
  ).run()

  const id = result.meta.last_row_id as number
  await logActivity(c.env.DB, (user as User).id, 'hearing', id, 'جدولة', `جلسة ${b.hearing_date}`)
  return c.json({ id })
})

/**
 * PUT /api/hearings/:id
 * Updates hearing decision, attendance lawyer, or roll-over next date
 */
caseRoutes.put('/hearings/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(`SELECT * FROM hearings WHERE id = ?`).bind(id).first<any>()
  if (!existing) return c.json({ error: 'الجلسة غير موجودة' }, 404)

  const b = await c.req.json()
  const hearing_date = b.hearing_date !== undefined ? b.hearing_date : existing.hearing_date
  const hearing_time = b.hearing_time !== undefined ? b.hearing_time : existing.hearing_time
  const court_id = b.court_id !== undefined ? (b.court_id ? Number(b.court_id) : null) : existing.court_id
  const circuit = b.circuit !== undefined ? cleanString(b.circuit, 100) : existing.circuit
  const type = b.type !== undefined ? cleanString(b.type, 50) : existing.type
  const purpose = b.purpose !== undefined ? cleanString(b.purpose, MAX_TEXT_LENGTH) : existing.purpose
  const result = b.result !== undefined ? cleanString(b.result, MAX_TEXT_LENGTH) : existing.result
  const next_date = b.next_date !== undefined ? b.next_date : existing.next_date
  const lawyer_id = b.lawyer_id !== undefined ? (b.lawyer_id ? Number(b.lawyer_id) : null) : existing.lawyer_id
  const status = b.status !== undefined && isAllowed(b.status, [...ALLOWED_HEARING_STATUSES]) ? b.status : existing.status
  const notes = b.notes !== undefined ? cleanString(b.notes, MAX_NOTE_LENGTH) : existing.notes

  await c.env.DB.prepare(
    `UPDATE hearings SET hearing_date=?, hearing_time=?, court_id=?, circuit=?, type=?, purpose=?, result=?, next_date=?, lawyer_id=?, status=?, notes=? WHERE id=?`
  ).bind(hearing_date, hearing_time, court_id, circuit, type, purpose, result, next_date, lawyer_id, status, notes, id).run()

  return c.json({ ok: true })
})
