import { Hono } from 'hono'
import { requireUser, requireAdminOrPartner } from '../middleware/auth'
import { UsersService } from '../services/users.service'
import { AppContext, User } from '../types'

export const userRoutes = new Hono<AppContext>()

/**
 * GET /api/users
 * Controller listing firm team members
 */
userRoutes.get('/', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const users = await UsersService.getUsers(c.env.DB)
  return c.json(users)
})

/**
 * GET /api/users/:id
 * Controller retrieving lawyer profile and workload
 */
userRoutes.get('/:id', async (c) => {
  const currentUser = await requireUser(c)
  if (currentUser instanceof Response) return currentUser

  const profile = await UsersService.getUserProfile(c.env.DB, c.req.param('id'))
  if (!profile) return c.json({ error: 'المستخدم غير موجود' }, 404)
  return c.json(profile)
})

/**
 * POST /api/users
 * Controller creating a new user/lawyer account (Restricted to Partner / Admin)
 */
userRoutes.post('/', async (c) => {
  const currentUser = await requireUser(c)
  if (currentUser instanceof Response) return currentUser

  const forbidden = requireAdminOrPartner(currentUser as User, c)
  if (forbidden) return forbidden

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await UsersService.createUser(c.env.DB, body, (currentUser as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * PUT /api/users/:id
 * Controller updating user profile with RBAC restrictions
 */
userRoutes.put('/:id', async (c) => {
  const currentUser = await requireUser(c)
  if (currentUser instanceof Response) return currentUser

  const body = await c.req.json().catch(() => ({}))
  try {
    await UsersService.updateUser(c.env.DB, c.req.param('id'), body, currentUser as User)
    return c.json({ ok: true })
  } catch (err: any) {
    let status: 400 | 403 | 404 = 400
    if (err.message.includes('غير مصرح')) status = 403
    else if (err.message === 'المستخدم غير موجود') status = 404
    return c.json({ error: err.message }, status)
  }
})
