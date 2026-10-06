import { Hono } from 'hono'
import { requireUser } from '../middleware/auth'
import { DashboardService } from '../services/dashboard.service'
import { AppContext, User } from '../types'

export const dashboardRoutes = new Hono<AppContext>()

/**
 * GET /api/dashboard
 * Controller returning aggregated KPIs, agenda, and workload metrics
 */
dashboardRoutes.get('/dashboard', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const data = await DashboardService.getDashboardMetrics(c.env.DB, user as User)
  return c.json(data)
})

/**
 * GET /api/lookups
 * Controller returning system dictionaries (courts, case types, users, clients, cases)
 */
dashboardRoutes.get('/lookups', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const lookups = await DashboardService.getLookups(c.env.DB)
  return c.json(lookups)
})

/**
 * GET /api/search
 * Controller handling global multi-entity search
 */
dashboardRoutes.get('/search', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const results = await DashboardService.globalSearch(c.env.DB, c.req.query('q') || '')
  return c.json(results)
})
