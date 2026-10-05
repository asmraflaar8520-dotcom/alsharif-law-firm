import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { SESSION_COOKIE_NAME, SESSION_DURATION_DAYS, SESSION_DURATION_MS } from '../config/constants'
import { checkRateLimit } from '../middleware/rate-limiter'
import { getCurrentUser, safeUser } from '../middleware/auth'
import { verifyPassword, generateToken } from '../utils/crypto'
import { logActivity } from '../utils/logger'
import { AppContext, User } from '../types'

export const authRoutes = new Hono<AppContext>()

/**
 * POST /api/login
 * Authenticates user credentials with rate-limiting and secure session creation.
 * Uses PBKDF2 password verification. Prevents session fixation by
 * deleting existing sessions for the user before issuing a new one.
 */
authRoutes.post('/login', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || (c.req.header('x-forwarded-for') ? c.req.header('x-forwarded-for')!.split(',')[0].trim() : 'local')
  if (!checkRateLimit(ip)) {
    return c.json({ error: 'تم تجاوز عدد محاولات الدخول المسموح بها. يرجى الانتظار 15 دقيقة.' }, 429)
  }

  const body = await c.req.json().catch(() => ({}))
  const { email, password } = body
  if (!email || !password) {
    return c.json({ error: 'البريد وكلمة المرور مطلوبان' }, 400)
  }

  const cleanEmail = String(email).trim().toLowerCase()
  // Fetch user by email only — password verification is done separately with PBKDF2
  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE email = ? AND is_active = 1`
  ).bind(cleanEmail).first<User & { password_hash: string }>()

  if (!user) {
    return c.json({ error: 'بيانات الدخول غير صحيحة' }, 401)
  }

  // Verify password using PBKDF2 (constant-time comparison)
  const valid = await verifyPassword(String(password), user.password_hash)
  if (!valid) {
    await logActivity(c.env.DB, null, 'auth', user.id, 'فشل_دخول', `محاولة دخول فاشلة من ${ip}`)
    return c.json({ error: 'بيانات الدخول غير صحيحة' }, 401)
  }

  // Session fixation prevention: invalidate all existing sessions for this user
  await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id).run().catch(() => {})

  // Periodic pruning of expired sessions (all users)
  await c.env.DB.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run().catch(() => {})

  const sessionToken = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString().slice(0, 19).replace('T', ' ')
  await c.env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
  ).bind(sessionToken, user.id, expiresAt).run()

  const isHttps = c.req.url.startsWith('https://') || c.req.header('x-forwarded-proto') === 'https'
  setCookie(c, SESSION_COOKIE_NAME, sessionToken, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: isHttps,
    maxAge: SESSION_DURATION_DAYS * 86400
  })

  await logActivity(c.env.DB, user.id, 'auth', user.id, 'دخول', 'تسجيل دخول إلى النظام')
  return c.json({ user: safeUser(user) })
})

/**
 * POST /api/logout
 * Destroys the active session token in the database and clears the session cookie
 */
authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME)
  if (token) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run()
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
  return c.json({ ok: true })
})

/**
 * GET /api/me
 * Retrieves the currently logged-in user profile
 */
authRoutes.get('/me', async (c) => {
  const user = await getCurrentUser(c)
  if (!user) return c.json({ user: null })
  return c.json({ user: safeUser(user) })
})
