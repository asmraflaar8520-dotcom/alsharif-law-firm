import { Hono } from 'hono'
import { requireUser } from '../middleware/auth'
import { TasksService } from '../services/tasks.service'
import { AppContext, User } from '../types'

export const taskRoutes = new Hono<AppContext>()

/**
 * GET /api/tasks
 * Controller listing tasks with filtering
 */
taskRoutes.get('/', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const query = c.req.query()
  const tasks = await TasksService.getTasks(c.env.DB, {
    status: query.status,
    assignee: query.assignee,
    mine: query.mine === '1',
    currentUserId: (user as User).id
  })
  return c.json(tasks)
})

/**
 * POST /api/tasks
 * Controller creating a new task assignment
 */
taskRoutes.post('/', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await TasksService.createTask(c.env.DB, body, (user as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * PUT /api/tasks/:id
 * Controller updating task status, priority, or details
 */
taskRoutes.put('/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    await TasksService.updateTask(c.env.DB, c.req.param('id'), body)
    return c.json({ ok: true })
  } catch (err: any) {
    const status: 400 | 404 = err.message === 'المهمة غير موجودة' ? 404 : 400
    return c.json({ error: err.message }, status)
  }
})
