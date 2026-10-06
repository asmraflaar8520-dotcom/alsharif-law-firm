import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { AppContext } from './types'
import { securityHeaders, corsMiddleware, staticCacheMiddleware, apiNoCacheMiddleware } from './middleware/security'
import { authRoutes } from './routes/auth'
import { dashboardRoutes } from './routes/dashboard'
import { userRoutes } from './routes/users'
import { clientRoutes } from './routes/clients'
import { caseRoutes } from './routes/cases'
import { taskRoutes } from './routes/tasks'
import { documentRoutes } from './routes/documents'
import { financeRoutes } from './routes/finance'
import { renderAppLayout } from './views/layout'
import { getFallbackD1 } from './utils/d1-sqlite'

export const app = new Hono<AppContext>()

// Auto-fallback database binding for Vercel / Node.js environments
app.use('*', async (c, next) => {
  if (!c.env?.DB) {
    const fallback = getFallbackD1()
    if (fallback) {
      c.env = { ...c.env, DB: fallback }
    }
  }
  await next()
})

// Global uncaught exception handler — never leak internal details to clients
app.onError((err, c) => {
  console.error('Unhandled server error:', err)
  return c.json({ error: 'حدث خطأ غير متوقع في الخادم' }, 500)
})

// Global HTTP Security Headers (anti-clickjacking, nosniff, CSP, HSTS)
app.use('*', securityHeaders)

// Strict CORS Middleware
app.use('/api/*', corsMiddleware)

// Prevent browser caching of sensitive API responses
app.use('/api/*', apiNoCacheMiddleware)

// Static Assets Caching & Serving
app.use('/static/*', staticCacheMiddleware)
app.use('/static/*', async (c, next) => {
  if ((c.env as any)?.ASSETS || (c.env as any)?.__STATIC_CONTENT) {
    return serveStatic({ root: './public' })(c, next)
  }
  // Node.js fallback (Vercel serverless / local Node)
  try {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const rel = c.req.path.replace(/^\/static\//, '')
    const file = path.resolve(process.cwd(), 'public', 'static', rel)
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      const ext = path.extname(file).toLowerCase()
      const mimes: Record<string, string> = {
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      }
      const data = fs.readFileSync(file)
      return new Response(data, {
        headers: { 'Content-Type': mimes[ext] || 'application/octet-stream' }
      })
    }
  } catch {}
  await next()
})

// Mount Modular API Routes
app.route('/api', authRoutes)
app.route('/api', dashboardRoutes)
app.route('/api/users', userRoutes)
app.route('/api/clients', clientRoutes)
app.route('/api', caseRoutes)
app.route('/api/tasks', taskRoutes)
app.route('/api', documentRoutes)
app.route('/api', financeRoutes)

// Serve Single Page Application (SPA) HTML Shell
app.get('/', (c) => c.html(renderAppLayout()))
app.get('/login', (c) => c.html(renderAppLayout()))
app.get('/app', (c) => c.html(renderAppLayout()))
app.get('/app/*', (c) => c.html(renderAppLayout()))

// SPA Fallback: non-API unknown routes return the HTML shell
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'المسار غير موجود' }, 404)
  }
  return c.html(renderAppLayout())
})

export default app
