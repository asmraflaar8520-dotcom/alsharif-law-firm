import { SESSION_DURATION_MS } from '../config/constants'
import { verifyPassword, generateToken } from '../utils/crypto'
import { logActivity } from '../utils/logger'
import { safeUser } from '../middleware/auth'
import { User } from '../types'

export interface LoginParams {
  email: string
  password: string
  ip?: string
}

export interface LoginResult {
  user: Partial<User>
  sessionToken: string
  expiresAt: string
}

export class AuthService {
  /**
   * Authenticates user credentials using PBKDF2 verification.
   * Manages single-session policy and expired session cleanup.
   */
  static async login(db: D1Database, { email, password, ip = 'local' }: LoginParams): Promise<LoginResult> {
    const cleanEmail = String(email).trim().toLowerCase()

    const user = await db.prepare(
      `SELECT * FROM users WHERE email = ? AND is_active = 1`
    ).bind(cleanEmail).first<User & { password_hash: string }>()

    if (!user) {
      throw new Error('بيانات الدخول غير صحيحة')
    }

    const valid = await verifyPassword(String(password), user.password_hash)
    if (!valid) {
      await logActivity(db, null, 'auth', user.id, 'فشل_دخول', `محاولة دخول فاشلة من ${ip}`)
      throw new Error('بيانات الدخول غير صحيحة')
    }

    // Invalidate existing sessions for this user (prevent session fixation)
    await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id).run().catch(() => {})

    // Prune all expired sessions
    await db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run().catch(() => {})

    const sessionToken = generateToken()
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString().slice(0, 19).replace('T', ' ')

    await db.prepare(
      `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
    ).bind(sessionToken, user.id, expiresAt).run()

    await logActivity(db, user.id, 'auth', user.id, 'دخول', 'تسجيل دخول إلى النظام')

    return {
      user: safeUser(user) as Partial<User>,
      sessionToken,
      expiresAt
    }
  }

  /**
   * Terminates active session token
   */
  static async logout(db: D1Database, token: string): Promise<void> {
    if (token) {
      await db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run()
    }
  }

  /**
   * Resolves user by session token
   */
  static async getUserFromToken(db: D1Database, token: string): Promise<User | null> {
    if (!token) return null
    const user = await db.prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1`
    ).bind(token).first<User>()
    return user || null
  }

  /**
   * Cleans up expired sessions
   */
  static async pruneExpiredSessions(db: D1Database): Promise<number> {
    const res = await db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run()
    return (res.meta as any)?.changes || 0
  }
}
