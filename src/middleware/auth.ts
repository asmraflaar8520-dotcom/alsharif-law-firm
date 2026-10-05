import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { SESSION_COOKIE_NAME } from '../config/constants'
import { AppContext, User } from '../types'

/**
 * Strips sensitive fields like password_hash before returning user data
 */
export function safeUser(u: any): Partial<User> | null {
  if (!u) return null
  const { password_hash, ...rest } = u
  return rest
}

/**
 * Retrieves the currently authenticated user from the session cookie
 */
export async function getCurrentUser(c: Context<AppContext>): Promise<User | null> {
  const token = getCookie(c, SESSION_COOKIE_NAME)
  if (!token) return null

  const user = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1`
  ).bind(token).first<User>()

  return user || null
}

/**
 * Middleware/helper enforcing authentication on protected routes
 */
export async function requireUser(c: Context<AppContext>): Promise<User | Response> {
  const user = await getCurrentUser(c)
  if (!user) {
    return c.json({ error: 'غير مصرح' }, 401)
  }
  return user
}

/**
 * RBAC helper ensuring the user is a Managing Partner, Partner, or Admin
 */
export function requireAdminOrPartner(user: User, c: Context<AppContext>): Response | null {
  if (!['managing_partner', 'partner', 'admin'].includes(user.role)) {
    return c.json({ error: 'غير مصرح — صلاحية شركاء وإدارة فقط' }, 403)
  }
  return null
}
