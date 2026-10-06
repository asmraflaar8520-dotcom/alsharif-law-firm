import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { SESSION_COOKIE_NAME, SESSION_DURATION_DAYS } from '../config/constants'
import { checkRateLimit } from '../middleware/rate-limiter'
import { getCurrentUser, safeUser } from '../middleware/auth'
import { AuthService } from '../services/auth.service'
import { AppContext } from '../types'

export const authRoutes = new Hono<AppContext>()

/**
 * POST /api/login
 * Controller handling user authentication, rate-limiting, and cookie setting
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

  try {
    const result = await AuthService.login(c.env.DB, { email, password, ip })

    const isHttps = c.req.url.startsWith('https://') || c.req.header('x-forwarded-proto') === 'https'
    setCookie(c, SESSION_COOKIE_NAME, result.sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: isHttps,
      maxAge: SESSION_DURATION_DAYS * 86400
    })

    return c.json({ user: result.user })
  } catch (err: any) {
    return c.json({ error: err.message || 'بيانات الدخول غير صحيحة' }, 401)
  }
})

/**
 * POST /api/logout
 * Controller handling active session teardown and cookie clearing
 */
authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME)
  if (token) {
    await AuthService.logout(c.env.DB, token)
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
  return c.json({ ok: true })
})

/**
 * GET /api/me
 * Controller returning profile of currently logged-in user
 */
authRoutes.get('/me', async (c) => {
  const user = await getCurrentUser(c)
  if (!user) return c.json({ user: null })
  return c.json({ user: safeUser(user) })
})
