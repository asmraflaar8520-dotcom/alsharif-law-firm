import { Hono } from 'hono'
import { requireUser } from '../middleware/auth'
import { DeadlinesService } from '../services/deadlines.service'
import { AppContext, User } from '../types'

export const deadlinesRoutes = new Hono<AppContext>()

/**
 * GET /api/deadlines
 * Controller listing appeal deadlines with filters
 */
deadlinesRoutes.get('/deadlines', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const query = c.req.query()
  const data = await DeadlinesService.getDeadlines(c.env.DB, {
    status: query.status,
    case_id: query.case_id,
    search: query.q || query.search
  })

  return c.json(data)
})

/**
 * GET /api/deadlines/radar
 * Controller returning urgent (< 4 days / expired) and warning (4-7 days) deadlines
 */
deadlinesRoutes.get('/deadlines/radar', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const radar = await DeadlinesService.getRadarDeadlines(c.env.DB)
  return c.json(radar)
})

/**
 * POST /api/deadlines
 * Controller registering an appeal deadline with calculated statutory due date
 */
deadlinesRoutes.post('/deadlines', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const record = await DeadlinesService.createDeadline(c.env.DB, body, (user as User).id)
    return c.json(record, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * PUT /api/deadlines/:id
 * Controller updating deadline status (e.g., marking as filed 'تم قيد الطعن')
 */
deadlinesRoutes.put('/deadlines/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  try {
    const ok = await DeadlinesService.updateDeadlineStatus(
      c.env.DB,
      id,
      body.status || 'filed',
      body.notes
    )
    if (!ok) return c.json({ error: 'ميعاد الطعن غير موجود' }, 404)
    return c.json({ success: true, message: 'تم تحديث ميعاد الطعن بنجاح' })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * DELETE /api/deadlines/:id
 * Controller deleting an appeal deadline record
 */
deadlinesRoutes.delete('/deadlines/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const id = c.req.param('id')
  const ok = await DeadlinesService.deleteDeadline(c.env.DB, id)
  if (!ok) return c.json({ error: 'ميعاد الطعن غير موجود' }, 404)
  return c.json({ success: true, message: 'تم حذف ميعاد الطعن بنجاح' })
})
