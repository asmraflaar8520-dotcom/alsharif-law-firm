import { Hono } from 'hono'
import { requireUser } from '../middleware/auth'
import { CasesService } from '../services/cases.service'
import { AppContext, User } from '../types'

export const caseRoutes = new Hono<AppContext>()

/**
 * GET /api/cases
 * Controller listing cases with filters
 */
caseRoutes.get('/cases', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const query = c.req.query()
  const cases = await CasesService.getCases(c.env.DB, query)
  return c.json(cases)
})

/**
 * GET /api/cases/:id
 * Controller retrieving full dossier of a case
 */
caseRoutes.get('/cases/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const caseData = await CasesService.getCaseById(c.env.DB, c.req.param('id'))
  if (!caseData) return c.json({ error: 'القضية غير موجودة' }, 404)
  return c.json(caseData)
})

/**
 * POST /api/cases
 * Controller creating a new legal case file
 */
caseRoutes.post('/cases', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await CasesService.createCase(c.env.DB, body, (user as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * PUT /api/cases/:id
 * Controller updating case record
 */
caseRoutes.put('/cases/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    await CasesService.updateCase(c.env.DB, c.req.param('id'), body, (user as User).id)
    return c.json({ ok: true })
  } catch (err: any) {
    const status: 400 | 404 = err.message === 'القضية غير موجودة' ? 404 : 400
    return c.json({ error: err.message }, status)
  }
})

/**
 * POST /api/cases/:id/lawyers
 * Controller assigning an additional lawyer to a case team
 */
caseRoutes.post('/cases/:id/lawyers', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  if (!body.user_id) return c.json({ error: 'المحامي مطلوب' }, 400)

  await CasesService.assignLawyer(c.env.DB, c.req.param('id'), body.user_id, body.role)
  return c.json({ ok: true })
})

/**
 * GET /api/hearings
 * Controller listing court session hearings
 */
caseRoutes.get('/hearings', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const hearings = await CasesService.getHearings(c.env.DB, c.req.query())
  return c.json(hearings)
})

/**
 * POST /api/hearings
 * Controller scheduling a court hearing
 */
caseRoutes.post('/hearings', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await CasesService.scheduleHearing(c.env.DB, body, (user as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * PUT /api/hearings/:id
 * Controller updating hearing decision, attendance lawyer, or roll-over date
 */
caseRoutes.put('/hearings/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    await CasesService.updateHearing(c.env.DB, c.req.param('id'), body)
    return c.json({ ok: true })
  } catch (err: any) {
    const status: 400 | 404 = err.message === 'الجلسة غير موجودة' ? 404 : 400
    return c.json({ error: err.message }, status)
  }
})
