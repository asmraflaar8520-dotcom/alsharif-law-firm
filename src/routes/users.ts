import { Hono } from 'hono'
import { ALLOWED_ROLES, MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '../config/constants'
import { requireUser, requireAdminOrPartner } from '../middleware/auth'
import { hashPassword, verifyPassword } from '../utils/crypto'
import { logActivity } from '../utils/logger'
import { isAllowed, cleanString, isValidEmail } from '../utils/validation'
import { AppContext, User } from '../types'

export const userRoutes = new Hono<AppContext>()

/**
 * GET /api/users
 * Returns list of firm team members sorted by hierarchy and name
 */
userRoutes.get('/', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const { results } = await c.env.DB.prepare(
    `SELECT id, name, title, email, phone, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active, created_at
     FROM users ORDER BY
      CASE role WHEN 'managing_partner' THEN 1 WHEN 'partner' THEN 2 WHEN 'senior' THEN 3 WHEN 'lawyer' THEN 4 WHEN 'intern' THEN 5 ELSE 6 END, name`
  ).all()

  return c.json(results || [])
})

/**
 * GET /api/users/:id
 * Returns lawyer profile, workload, month hours, and assigned open cases
 */
userRoutes.get('/:id', async (c) => {
  const currentUser = await requireUser(c)
  if (currentUser instanceof Response) return currentUser

  const id = c.req.param('id')
  const user = await c.env.DB.prepare(
    `SELECT id, name, title, email, phone, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active
     FROM users WHERE id = ?`
  ).bind(id).first()

  if (!user) return c.json({ error: 'المستخدم غير موجود' }, 404)

  const [cases, hours, tasks] = await Promise.all([
    c.env.DB.prepare(
      `SELECT c.*, cl.name AS client_name FROM cases c JOIN clients cl ON cl.id = c.client_id
       WHERE c.lead_lawyer_id = ? ORDER BY c.updated_at DESC LIMIT 50`
    ).bind(id).all(),
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(hours),0) AS n FROM time_entries WHERE user_id = ? AND work_date >= date('now','start of month')`
    ).bind(id).first<{ n: number }>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM tasks WHERE assignee_id = ? AND status IN ('مفتوحة','جارية')`
    ).bind(id).first<{ n: number }>()
  ])

  return c.json({
    ...user,
    cases: cases.results || [],
    month_hours: hours?.n || 0,
    open_tasks: tasks?.n || 0
  })
})

/**
 * POST /api/users
 * Creates a new user/lawyer account (Restricted to Managing Partner / Partner / Admin)
 */
userRoutes.post('/', async (c) => {
  const currentUser = await requireUser(c)
  if (currentUser instanceof Response) return currentUser

  const forbidden = requireAdminOrPartner(currentUser as User, c)
  if (forbidden) return forbidden

  const body = await c.req.json()
  const name = cleanString(body.name, MAX_NAME_LENGTH)
  const email = cleanString(body.email, 254)

  if (!name || !email) {
    return c.json({ error: 'الاسم والبريد الإلكتروني مطلوبان' }, 400)
  }
  if (!isValidEmail(email)) {
    return c.json({ error: 'صيغة البريد الإلكتروني غير صحيحة' }, 400)
  }

  const cleanEmail = email.toLowerCase()
  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(cleanEmail).first()
  if (existing) {
    return c.json({ error: 'البريد الإلكتروني مسجل بالفعل' }, 400)
  }

  // Validate role against allowlist
  const role = body.role && isAllowed(body.role, [...ALLOWED_ROLES]) ? body.role : 'lawyer'

  // Generate a random password if none provided (never use a default)
  const rawPassword = body.password || crypto.getRandomValues(new Uint8Array(16)).reduce((s: string, b: number) => s + b.toString(36), '')
  const hash = await hashPassword(rawPassword)

  const result = await c.env.DB.prepare(
    `INSERT INTO users (name, title, email, phone, password_hash, role, department, bar_number, bar_year, hourly_rate, bio, initials, color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    name,
    cleanString(body.title, MAX_TEXT_LENGTH),
    cleanEmail,
    cleanString(body.phone, 30),
    hash,
    role,
    cleanString(body.department, MAX_TEXT_LENGTH),
    cleanString(body.bar_number, 50),
    body.bar_year ? Number(body.bar_year) : null,
    Number(body.hourly_rate || 0),
    cleanString(body.bio, MAX_TEXT_LENGTH),
    cleanString(body.initials, 5) || name.slice(0, 2),
    body.color || '#1F4E79'
  ).run()

  const id = result.meta.last_row_id as number
  await logActivity(c.env.DB, (currentUser as User).id, 'user', id, 'إنشاء', `مستخدم جديد: ${name}`)
  return c.json({ id })
})

/**
 * PUT /api/users/:id
 * Updates lawyer profile details with strict field authorization.
 * Non-privileged users can only edit their own non-sensitive fields.
 * Privileged users can change role, email, active status, and hourly rate.
 */
userRoutes.put('/:id', async (c) => {
  const currentUser = await requireUser(c)
  if (currentUser instanceof Response) return currentUser

  const targetId = Number(c.req.param('id'))
  const isSelf = (currentUser as User).id === targetId
  const isPrivileged = ['managing_partner', 'partner', 'admin'].includes((currentUser as User).role)

  if (!isSelf && !isPrivileged) {
    return c.json({ error: 'غير مصرح بتعديل بيانات هذا المستخدم' }, 403)
  }

  const existing = await c.env.DB.prepare(
    `SELECT id, name, title, email, phone, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active FROM users WHERE id = ?`
  ).bind(targetId).first<any>()
  if (!existing) return c.json({ error: 'المستخدم غير موجود' }, 404)

  const body = await c.req.json()
  const name = body.name !== undefined ? (cleanString(body.name, MAX_NAME_LENGTH) || existing.name) : existing.name
  const title = body.title !== undefined ? cleanString(body.title, MAX_TEXT_LENGTH) : existing.title
  const phone = body.phone !== undefined ? cleanString(body.phone, 30) : existing.phone
  const bio = body.bio !== undefined ? cleanString(body.bio, MAX_TEXT_LENGTH) : existing.bio
  const initials = body.initials !== undefined ? cleanString(body.initials, 5) : existing.initials
  const color = body.color !== undefined ? body.color : existing.color
  const department = body.department !== undefined ? cleanString(body.department, MAX_TEXT_LENGTH) : existing.department
  const bar_number = body.bar_number !== undefined ? cleanString(body.bar_number, 50) : existing.bar_number
  const bar_year = body.bar_year !== undefined ? (body.bar_year ? Number(body.bar_year) : null) : existing.bar_year

  // Privileged-only fields: role, is_active, hourly_rate, email
  const role = isPrivileged && body.role !== undefined && isAllowed(body.role, [...ALLOWED_ROLES]) ? body.role : existing.role
  const is_active = isPrivileged && body.is_active !== undefined ? Number(body.is_active) : existing.is_active
  const hourly_rate = isPrivileged && body.hourly_rate !== undefined ? Number(body.hourly_rate) : existing.hourly_rate
  const email = isPrivileged && body.email !== undefined ? String(body.email).trim().toLowerCase() : existing.email

  await c.env.DB.prepare(
    `UPDATE users SET name=?, title=?, email=?, phone=?, role=?, department=?, bar_number=?, bar_year=?, hourly_rate=?, bio=?, initials=?, color=?, is_active=? WHERE id=?`
  ).bind(name, title, email, phone, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active, targetId).run()

  // Secure password update if provided
  if (body.password) {
    if (typeof body.password !== 'string' || body.password.length < 6) {
      return c.json({ error: 'كلمة المرور يجب ألا تقل عن 6 أحرف' }, 400)
    }
    if (!isPrivileged) {
      if (!body.current_password) {
        return c.json({ error: 'يرجى إدخال كلمة المرور الحالية لتغيير كلمة المرور' }, 400)
      }
      const fullUser = await c.env.DB.prepare(`SELECT password_hash FROM users WHERE id = ?`).bind(targetId).first<{ password_hash: string }>()
      if (!fullUser || !(await verifyPassword(String(body.current_password), fullUser.password_hash))) {
        return c.json({ error: 'كلمة المرور الحالية غير صحيحة' }, 400)
      }
    }
    const newHash = await hashPassword(String(body.password))
    await c.env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(newHash, targetId).run()
  }

  await logActivity(c.env.DB, (currentUser as User).id, 'user', targetId, 'تحديث', `تحديث بيانات المستخدم ${name}`)
  return c.json({ ok: true })
})
