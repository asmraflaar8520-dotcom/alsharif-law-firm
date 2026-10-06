import { Hono } from 'hono'
import { requireUser } from '../middleware/auth'
import { DocumentsService } from '../services/documents.service'
import { AppContext, User } from '../types'

export const documentRoutes = new Hono<AppContext>()

/**
 * GET /api/documents
 * Controller listing uploaded documents
 */
documentRoutes.get('/documents', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const documents = await DocumentsService.getDocuments(c.env.DB)
  return c.json(documents)
})

/**
 * POST /api/documents
 * Controller creating a new document record
 */
documentRoutes.post('/documents', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await DocumentsService.createDocument(c.env.DB, body, (user as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * GET /api/poas
 * Controller listing powers of attorney
 */
documentRoutes.get('/poas', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const poas = await DocumentsService.getPoas(c.env.DB)
  return c.json(poas)
})

/**
 * POST /api/poas
 * Controller registering a new Power of Attorney
 */
documentRoutes.post('/poas', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await DocumentsService.createPoa(c.env.DB, body, (user as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * PUT /api/poas/:id
 * Controller updating power of attorney record
 */
documentRoutes.put('/poas/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    await DocumentsService.updatePoa(c.env.DB, c.req.param('id'), body, (user as User).id)
    return c.json({ ok: true })
  } catch (err: any) {
    const status: 400 | 404 = err.message === 'التوكيل غير موجود' ? 404 : 400
    return c.json({ error: err.message }, status)
  }
})

/**
 * POST /api/notes
 * Controller appending memo or quick note
 */
documentRoutes.post('/notes', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await DocumentsService.createNote(c.env.DB, body, (user as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})
