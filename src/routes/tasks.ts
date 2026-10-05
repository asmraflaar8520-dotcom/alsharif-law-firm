import { Hono } from 'hono'
import { requireUser } from '../middleware/auth'
import { AppContext, User } from '../types'

export const taskRoutes = new Hono<AppContext>()

/**
 * GET /api/tasks
 * Lists tasks with filtering by status, assignee, or mine flag
 */
taskRoutes.get('/', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const { status, assignee, mine } = c.req.query()
  let sql = `SELECT t.*, u.name AS assignee_name, u.initials, u.color, cs.title AS case_title, cs.case_no, cs.year, cl.name AS client_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN cases cs ON cs.id = t.case_id
    LEFT JOIN clients cl ON cl.id = COALESCE(t.client_id, cs.client_id)
    WHERE 1=1`
  const binds: any[] = []

  if (status) {
    sql += ` AND t.status = ?`
    binds.push(status)
  }
  if (assignee) {
    sql += ` AND t.assignee_id = ?`
    binds.push(assignee)
  }
  if (mine === '1') {
    sql += ` AND t.assignee_id = ?`
    binds.push((user as User).id)
  }

  sql += ` ORDER BY CASE t.status WHEN 'جارية' THEN 0 WHEN 'مفتوحة' THEN 1 ELSE 2 END, CASE t.priority WHEN 'عاجلة' THEN 0 WHEN 'عالية' THEN 1 ELSE 2 END, t.due_date LIMIT 150`
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json(results || [])
})

/**
 * POST /api/tasks
 * Creates a new task assignment
 */
taskRoutes.post('/', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const b = await c.req.json()
  if (!b.title?.trim()) return c.json({ error: 'عنوان المهمة مطلوب' }, 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO tasks (title, description, case_id, client_id, assignee_id, creator_id, due_date, due_time, priority, status, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    b.title.trim(),
    b.description || null,
    b.case_id ? Number(b.case_id) : null,
    b.client_id ? Number(b.client_id) : null,
    b.assignee_id ? Number(b.assignee_id) : null,
    (user as User).id,
    b.due_date || null,
    b.due_time || null,
    b.priority || 'عادية',
    b.status || 'مفتوحة',
    b.category || null
  ).run()

  return c.json({ id: result.meta.last_row_id })
})

/**
 * PUT /api/tasks/:id
 * Updates task status, priority, due date, or assignee
 */
taskRoutes.put('/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first<any>()
  if (!existing) return c.json({ error: 'المهمة غير موجودة' }, 404)

  const b = await c.req.json()
  const title = b.title !== undefined ? (b.title?.trim() || existing.title) : existing.title
  const description = b.description !== undefined ? b.description : existing.description
  const case_id = b.case_id !== undefined ? (b.case_id ? Number(b.case_id) : null) : existing.case_id
  const client_id = b.client_id !== undefined ? (b.client_id ? Number(b.client_id) : null) : existing.client_id
  const assignee_id = b.assignee_id !== undefined ? (b.assignee_id ? Number(b.assignee_id) : null) : existing.assignee_id
  const due_date = b.due_date !== undefined ? b.due_date : existing.due_date
  const due_time = b.due_time !== undefined ? b.due_time : existing.due_time
  const priority = b.priority !== undefined ? b.priority : existing.priority
  const status = b.status !== undefined ? b.status : existing.status
  const category = b.category !== undefined ? b.category : existing.category
  const completed = status === 'مكتملة' ? (existing.completed_at || new Date().toISOString().slice(0, 19).replace('T', ' ')) : null

  await c.env.DB.prepare(
    `UPDATE tasks SET title=?, description=?, case_id=?, client_id=?, assignee_id=?, due_date=?, due_time=?, priority=?, status=?, category=?, completed_at=? WHERE id=?`
  ).bind(title, description, case_id, client_id, assignee_id, due_date, due_time, priority, status, category, completed, id).run()

  return c.json({ ok: true })
})
