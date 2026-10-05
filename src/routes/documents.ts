import { Hono } from 'hono'
import { ALLOWED_POA_STATUSES, MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_NOTE_LENGTH } from '../config/constants'
import { requireUser } from '../middleware/auth'
import { logActivity } from '../utils/logger'
import { isAllowed, cleanString } from '../utils/validation'
import { AppContext, User } from '../types'

export const documentRoutes = new Hono<AppContext>()

/**
 * GET /api/documents
 * Lists uploaded documents and archive records
 */
documentRoutes.get('/documents', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const { results } = await c.env.DB.prepare(
    `SELECT d.*, cs.title AS case_title, cs.case_no, cs.year, cl.name AS client_name, u.name AS uploader
     FROM documents d
     LEFT JOIN cases cs ON cs.id=d.case_id
     LEFT JOIN clients cl ON cl.id=COALESCE(d.client_id, cs.client_id)
     LEFT JOIN users u ON u.id=d.uploaded_by
     ORDER BY d.created_at DESC LIMIT 150`
  ).all()

  return c.json(results || [])
})

/**
 * POST /api/documents
 * Creates a new document record in the electronic case file
 */
documentRoutes.post('/documents', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  const title = cleanString(b.title, MAX_NAME_LENGTH)
  if (!title) return c.json({ error: 'عنوان المستند مطلوب' }, 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO documents (case_id, client_id, title, doc_type, ref_no, date_issued, pages, notes, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    b.case_id ? Number(b.case_id) : null,
    b.client_id ? Number(b.client_id) : null,
    title,
    cleanString(b.doc_type, 50) || 'أخرى',
    cleanString(b.ref_no, 100),
    b.date_issued || null,
    b.pages ? Number(b.pages) : null,
    cleanString(b.notes, MAX_NOTE_LENGTH),
    (user as User).id
  ).run()

  const id = result.meta.last_row_id as number
  await logActivity(c.env.DB, (user as User).id, 'document', id, 'إنشاء', `مستند جديد: ${title}`)
  return c.json({ id })
})

/**
 * GET /api/poas
 * Lists powers of attorney with client names, assigned lawyers, and expiry dates
 */
documentRoutes.get('/poas', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const { results } = await c.env.DB.prepare(
    `SELECT p.*, cl.name AS client_name, u.name AS lawyer_name, cs.title AS case_title
     FROM powers_of_attorney p
     JOIN clients cl ON cl.id=p.client_id
     LEFT JOIN users u ON u.id=p.lawyer_id
     LEFT JOIN cases cs ON cs.id=p.case_id
     ORDER BY CASE p.status WHEN 'ساري' THEN 0 WHEN 'منتهٍ' THEN 1 ELSE 2 END, p.expiry_date LIMIT 150`
  ).all()

  return c.json(results || [])
})

/**
 * POST /api/poas
 * Registers a new Power of Attorney (توكيل)
 */
documentRoutes.post('/poas', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  const poa_no = cleanString(b.poa_no, 100)
  if (!poa_no || !b.client_id) {
    return c.json({ error: 'رقم التوكيل والموكل حقول إجبارية' }, 400)
  }

  const status = b.status && isAllowed(b.status, [...ALLOWED_POA_STATUSES]) ? b.status : 'ساري'

  const result = await c.env.DB.prepare(
    `INSERT INTO powers_of_attorney (poa_no, client_id, case_id, lawyer_id, type, notary_office, issue_date, expiry_date, status, scope, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    poa_no,
    Number(b.client_id),
    b.case_id ? Number(b.case_id) : null,
    b.lawyer_id ? Number(b.lawyer_id) : null,
    cleanString(b.type, 50) || 'عام قضايا',
    cleanString(b.notary_office, MAX_TEXT_LENGTH),
    b.issue_date || null,
    b.expiry_date || null,
    status,
    cleanString(b.scope, MAX_TEXT_LENGTH),
    cleanString(b.notes, MAX_NOTE_LENGTH)
  ).run()

  const id = result.meta.last_row_id as number
  await logActivity(c.env.DB, (user as User).id, 'poa', id, 'إنشاء', `توكيل جديد: ${poa_no}`)
  return c.json({ id })
})

/**
 * PUT /api/poas/:id
 * Updates power of attorney record safely
 */
documentRoutes.put('/poas/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(`SELECT * FROM powers_of_attorney WHERE id = ?`).bind(id).first<any>()
  if (!existing) return c.json({ error: 'التوكيل غير موجود' }, 404)

  const b = await c.req.json()
  const poa_no = b.poa_no !== undefined ? (cleanString(b.poa_no, 100) || existing.poa_no) : existing.poa_no
  const client_id = b.client_id !== undefined ? Number(b.client_id) : existing.client_id
  const case_id = b.case_id !== undefined ? (b.case_id ? Number(b.case_id) : null) : existing.case_id
  const lawyer_id = b.lawyer_id !== undefined ? (b.lawyer_id ? Number(b.lawyer_id) : null) : existing.lawyer_id
  const type = b.type !== undefined ? (cleanString(b.type, 50) || existing.type) : existing.type
  const notary_office = b.notary_office !== undefined ? cleanString(b.notary_office, MAX_TEXT_LENGTH) : existing.notary_office
  const issue_date = b.issue_date !== undefined ? b.issue_date : existing.issue_date
  const expiry_date = b.expiry_date !== undefined ? b.expiry_date : existing.expiry_date
  const status = b.status !== undefined && isAllowed(b.status, [...ALLOWED_POA_STATUSES]) ? b.status : existing.status
  const scope = b.scope !== undefined ? cleanString(b.scope, MAX_TEXT_LENGTH) : existing.scope
  const notes = b.notes !== undefined ? cleanString(b.notes, MAX_NOTE_LENGTH) : existing.notes

  await c.env.DB.prepare(
    `UPDATE powers_of_attorney SET poa_no=?, client_id=?, case_id=?, lawyer_id=?, type=?, notary_office=?, issue_date=?, expiry_date=?, status=?, scope=?, notes=? WHERE id=?`
  ).bind(poa_no, client_id, case_id, lawyer_id, type, notary_office, issue_date, expiry_date, status, scope, notes, id).run()

  await logActivity(c.env.DB, (user as User).id, 'poa', Number(id), 'تحديث', `تحديث التوكيل: ${poa_no}`)
  return c.json({ ok: true })
})

/**
 * POST /api/notes
 * Appends a memo or quick note to a case or client
 */
documentRoutes.post('/notes', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  const content = cleanString(b.content, MAX_NOTE_LENGTH)
  if (!content) return c.json({ error: 'محتوى الملاحظة مطلوب' }, 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO notes (case_id, client_id, user_id, content, pinned) VALUES (?, ?, ?, ?, ?)`
  ).bind(
    b.case_id ? Number(b.case_id) : null,
    b.client_id ? Number(b.client_id) : null,
    (user as User).id,
    content,
    b.pinned ? 1 : 0
  ).run()

  return c.json({ id: result.meta.last_row_id })
})
