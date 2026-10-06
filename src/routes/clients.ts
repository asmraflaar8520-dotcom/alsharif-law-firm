import { Hono } from 'hono'
import { requireUser } from '../middleware/auth'
import { ClientsService } from '../services/clients.service'
import { AppContext, User } from '../types'

export const clientRoutes = new Hono<AppContext>()

/**
 * GET /api/clients
 * Controller listing clients with optional keyword and status filtering
 */
clientRoutes.get('/', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const clients = await ClientsService.getClients(c.env.DB, {
    q: c.req.query('q'),
    status: c.req.query('status')
  })
  return c.json(clients)
})

/**
 * GET /api/clients/:id
 * Controller fetching single client details with linked cases, invoices, POAs, and notes
 */
clientRoutes.get('/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const client = await ClientsService.getClientById(c.env.DB, c.req.param('id'))
  if (!client) return c.json({ error: 'الموكل غير موجود' }, 404)
  return c.json(client)
})

/**
 * POST /api/clients
 * Controller registering a new client
 */
clientRoutes.post('/', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await ClientsService.createClient(c.env.DB, body, (user as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * PUT /api/clients/:id
 * Controller safely updating client details
 */
clientRoutes.put('/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    await ClientsService.updateClient(c.env.DB, c.req.param('id'), body, (user as User).id)
    return c.json({ ok: true })
  } catch (err: any) {
    const status: 400 | 404 = err.message === 'الموكل غير موجود' ? 404 : 400
    return c.json({ error: err.message }, status)
  }
})
