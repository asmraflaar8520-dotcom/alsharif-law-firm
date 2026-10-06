import { ALLOWED_ROLES, MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '../config/constants'
import { isAllowed, cleanString, isValidEmail } from '../utils/validation'
import { hashPassword, verifyPassword, generateRandomPassword } from '../utils/crypto'
import { logActivity } from '../utils/logger'
import { User } from '../types'

export interface CreateUserDTO {
  name: string
  email: string
  password?: string
  role?: string
  title?: string | null
  phone?: string | null
  department?: string | null
  bar_number?: string | null
  bar_year?: number | null
  hourly_rate?: number
  bio?: string | null
  initials?: string | null
  color?: string | null
}

export interface UpdateUserDTO {
  name?: string
  title?: string | null
  phone?: string | null
  bio?: string | null
  initials?: string | null
  color?: string | null
  department?: string | null
  bar_number?: string | null
  bar_year?: number | null
  role?: string
  is_active?: number
  hourly_rate?: number
  email?: string
  password?: string
  current_password?: string
}

export class UsersService {
  /**
   * Lists firm team members sorted by hierarchy and name
   */
  static async getUsers(db: D1Database): Promise<any[]> {
    const { results } = await db.prepare(
      `SELECT id, name, title, email, phone, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active, created_at
       FROM users ORDER BY
        CASE role WHEN 'managing_partner' THEN 1 WHEN 'partner' THEN 2 WHEN 'senior' THEN 3 WHEN 'lawyer' THEN 4 WHEN 'intern' THEN 5 ELSE 6 END, name`
    ).all()
    return results || []
  }

  /**
   * Retrieves user profile, assigned open cases, and workload hours
   */
  static async getUserProfile(db: D1Database, id: number | string): Promise<any | null> {
    const user = await db.prepare(
      `SELECT id, name, title, email, phone, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active
       FROM users WHERE id = ?`
    ).bind(id).first()

    if (!user) return null

    const [cases, hours, tasks] = await Promise.all([
      db.prepare(
        `SELECT c.*, cl.name AS client_name FROM cases c JOIN clients cl ON cl.id = c.client_id
         WHERE c.lead_lawyer_id = ? ORDER BY c.updated_at DESC LIMIT 50`
      ).bind(id).all(),
      db.prepare(
        `SELECT COALESCE(SUM(hours),0) AS n FROM time_entries WHERE user_id = ? AND work_date >= date('now','start of month')`
      ).bind(id).first<{ n: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS n FROM tasks WHERE assignee_id = ? AND status IN ('مفتوحة','جارية')`
      ).bind(id).first<{ n: number }>()
    ])

    return {
      ...user,
      cases: cases.results || [],
      month_hours: hours?.n || 0,
      open_tasks: tasks?.n || 0
    }
  }

  /**
   * Creates a new user account with hashed password
   */
  static async createUser(db: D1Database, data: CreateUserDTO, currentUserId: number): Promise<number> {
    const name = cleanString(data.name, MAX_NAME_LENGTH)
    const email = cleanString(data.email, 254)

    if (!name || !email) {
      throw new Error('الاسم والبريد الإلكتروني مطلوبان')
    }
    if (!isValidEmail(email)) {
      throw new Error('صيغة البريد الإلكتروني غير صحيحة')
    }

    const cleanEmail = email.toLowerCase()
    const existing = await db.prepare(`SELECT id FROM users WHERE email = ?`).bind(cleanEmail).first()
    if (existing) {
      throw new Error('البريد الإلكتروني مسجل بالفعل')
    }

    const role = data.role && isAllowed(data.role, [...ALLOWED_ROLES]) ? data.role : 'lawyer'
    const rawPassword = data.password || generateRandomPassword(16)
    const hash = await hashPassword(rawPassword)

    const result = await db.prepare(
      `INSERT INTO users (name, title, email, phone, password_hash, role, department, bar_number, bar_year, hourly_rate, bio, initials, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      name,
      cleanString(data.title, MAX_TEXT_LENGTH),
      cleanEmail,
      cleanString(data.phone, 30),
      hash,
      role,
      cleanString(data.department, MAX_TEXT_LENGTH),
      cleanString(data.bar_number, 50),
      data.bar_year ? Number(data.bar_year) : null,
      Number(data.hourly_rate || 0),
      cleanString(data.bio, MAX_TEXT_LENGTH),
      cleanString(data.initials, 5) || name.slice(0, 2),
      data.color || '#1F4E79'
    ).run()

    const id = result.meta.last_row_id as number
    await logActivity(db, currentUserId, 'user', id, 'إنشاء', `مستخدم جديد: ${name}`)
    return id
  }

  /**
   * Updates user details with role-based field restrictions
   */
  static async updateUser(db: D1Database, targetId: number | string, data: UpdateUserDTO, currentUser: User): Promise<boolean> {
    const isSelf = currentUser.id === Number(targetId)
    const isPrivileged = ['managing_partner', 'partner', 'admin'].includes(currentUser.role)

    if (!isSelf && !isPrivileged) {
      throw new Error('غير مصرح بتعديل بيانات هذا المستخدم')
    }

    const existing = await db.prepare(
      `SELECT id, name, title, email, phone, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active FROM users WHERE id = ?`
    ).bind(targetId).first<any>()

    if (!existing) {
      throw new Error('المستخدم غير موجود')
    }

    const name = data.name !== undefined ? (cleanString(data.name, MAX_NAME_LENGTH) || existing.name) : existing.name
    const title = data.title !== undefined ? cleanString(data.title, MAX_TEXT_LENGTH) : existing.title
    const phone = data.phone !== undefined ? cleanString(data.phone, 30) : existing.phone
    const bio = data.bio !== undefined ? cleanString(data.bio, MAX_TEXT_LENGTH) : existing.bio
    const initials = data.initials !== undefined ? cleanString(data.initials, 5) : existing.initials
    const color = data.color !== undefined ? data.color : existing.color
    const department = data.department !== undefined ? cleanString(data.department, MAX_TEXT_LENGTH) : existing.department
    const bar_number = data.bar_number !== undefined ? cleanString(data.bar_number, 50) : existing.bar_number
    const bar_year = data.bar_year !== undefined ? (data.bar_year ? Number(data.bar_year) : null) : existing.bar_year

    // Privileged fields
    const role = isPrivileged && data.role !== undefined && isAllowed(data.role, [...ALLOWED_ROLES]) ? data.role : existing.role
    const is_active = isPrivileged && data.is_active !== undefined ? Number(data.is_active) : existing.is_active
    const hourly_rate = isPrivileged && data.hourly_rate !== undefined ? Number(data.hourly_rate) : existing.hourly_rate
    const email = isPrivileged && data.email !== undefined ? String(data.email).trim().toLowerCase() : existing.email

    await db.prepare(
      `UPDATE users SET name=?, title=?, email=?, phone=?, role=?, department=?, bar_number=?, bar_year=?, hourly_rate=?, bio=?, initials=?, color=?, is_active=? WHERE id=?`
    ).bind(name, title, email, phone, role, department, bar_number, bar_year, hourly_rate, bio, initials, color, is_active, targetId).run()

    // Password change
    if (data.password) {
      if (typeof data.password !== 'string' || data.password.length < 6) {
        throw new Error('كلمة المرور يجب ألا تقل عن 6 أحرف')
      }
      if (!isPrivileged) {
        if (!data.current_password) {
          throw new Error('يرجى إدخال كلمة المرور الحالية لتغيير كلمة المرور')
        }
        const fullUser = await db.prepare(`SELECT password_hash FROM users WHERE id = ?`).bind(targetId).first<{ password_hash: string }>()
        if (!fullUser || !(await verifyPassword(String(data.current_password), fullUser.password_hash))) {
          throw new Error('كلمة المرور الحالية غير صحيحة')
        }
      }
      const newHash = await hashPassword(String(data.password))
      await db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(newHash, targetId).run()
    }

    await logActivity(db, currentUser.id, 'user', Number(targetId), 'تحديث', `تحديث بيانات المستخدم ${name}`)
    return true
  }
}
