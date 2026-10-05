import { MiddlewareHandler } from 'hono'
import { cors } from 'hono/cors'

/**
 * Global HTTP Security Headers Middleware
 * Protects against clickjacking, MIME-sniffing, XSS, and other browser-level attacks
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  c.res.headers.set('X-Content-Type-Options', 'nosniff')
  c.res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  // CSP: allow Tailwind CDN, Google Fonts, Font Awesome, Chart.js — restrict everything else
  c.res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  )
}

/**
 * CORS Middleware restricted to authorized domains with credential support.
 * Returns null (blocks) for unrecognized origins; omits CORS headers when no Origin is present
 * (same-origin requests from browser don't send Origin).
 */
export const corsMiddleware: MiddlewareHandler = cors({
  origin: (origin) => {
    // No Origin header = same-origin request, no CORS headers needed
    if (!origin) return origin as unknown as string
    try {
      const u = new URL(origin)
      if (
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname.endsWith('.pages.dev') ||
        u.hostname === 'alsharif.law'
      ) {
        return origin
      }
    } catch { /* invalid origin URL */ }
    return null as unknown as string
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
})

/**
 * Cache-Control headers middleware for static assets to reduce bandwidth and speed up mobile clients
 */
export const staticCacheMiddleware: MiddlewareHandler = async (c, next) => {
  await next()
  if (c.res.status === 200) {
    c.res.headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  }
}

/**
 * Prevents browser caching of sensitive API responses containing user data
 */
export const apiNoCacheMiddleware: MiddlewareHandler = async (c, next) => {
  await next()
  c.res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  c.res.headers.set('Pragma', 'no-cache')
}
