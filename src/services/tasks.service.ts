export interface TaskFilterParams {
  status?: string
  assignee?: string | number
  mine?: boolean
  currentUserId?: number
}

export interface CreateTaskDTO {
  title: string
  description?: string | null
  case_id?: number | null
  client_id?: number | null
  assignee_id?: number | null
  due_date?: string | null
  due_time?: string | null
  priority?: string
  status?: string
  category?: string | null
}

export interface UpdateTaskDTO {
  title?: string
  description?: string | null
  case_id?: number | null
  client_id?: number | null
  assignee_id?: number | null
  due_date?: string | null
  due_time?: string | null
  priority?: string
  status?: string
  category?: string | null
}

export class TasksService {
  /**
   * Lists tasks with filtering by status, assignee, or mine flag
   */
  static async getTasks(db: D1Database, filters: TaskFilterParams = {}): Promise<any[]> {
    const { status, assignee, mine, currentUserId } = filters
    let sql = `SELECT t.*, u.name AS assignee_name, u.initials, u.color, cs.title AS case_title, cs.case_no, cs.year, cl.name AS client_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN cases cs ON cs.id = t.case_id
      LEFT JOIN clients cl ON cl.id = COALESCE(t.client_id, cs.client_id)
      WHERE 1=1`
    const binds: any[] = []

    if (status) {
      sql += ` AND t.status = ?`
      binds.push(status)
    }
    if (assignee) {
      sql += ` AND t.assignee_id = ?`
      binds.push(assignee)
    }
    if (mine && currentUserId) {
      sql += ` AND t.assignee_id = ?`
      binds.push(currentUserId)
    }

    sql += ` ORDER BY CASE t.status WHEN 'جارية' THEN 0 WHEN 'مفتوحة' THEN 1 ELSE 2 END, CASE t.priority WHEN 'عاجلة' THEN 0 WHEN 'عالية' THEN 1 ELSE 2 END, t.due_date LIMIT 150`
    const { results } = await db.prepare(sql).bind(...binds).all()
    return results || []
  }

  /**
   * Creates a new task assignment
   */
  static async createTask(db: D1Database, data: CreateTaskDTO, currentUserId: number): Promise<number> {
    const title = data.title?.trim()
    if (!title) {
      throw new Error('عنوان المهمة مطلوب')
    }

    const result = await db.prepare(
      `INSERT INTO tasks (title, description, case_id, client_id, assignee_id, creator_id, due_date, due_time, priority, status, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      title,
      data.description || null,
      data.case_id ? Number(data.case_id) : null,
      data.client_id ? Number(data.client_id) : null,
      data.assignee_id ? Number(data.assignee_id) : null,
      currentUserId,
      data.due_date || null,
      data.due_time || null,
      data.priority || 'عادية',
      data.status || 'مفتوحة',
      data.category || null
    ).run()

    return result.meta.last_row_id as number
  }

  /**
   * Updates task status, priority, due date, or assignee
   */
  static async updateTask(db: D1Database, id: number | string, data: UpdateTaskDTO): Promise<boolean> {
    const existing = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first<any>()
    if (!existing) {
      throw new Error('المهمة غير موجودة')
    }

    const title = data.title !== undefined ? (data.title?.trim() || existing.title) : existing.title
    const description = data.description !== undefined ? data.description : existing.description
    const case_id = data.case_id !== undefined ? (data.case_id ? Number(data.case_id) : null) : existing.case_id
    const client_id = data.client_id !== undefined ? (data.client_id ? Number(data.client_id) : null) : existing.client_id
    const assignee_id = data.assignee_id !== undefined ? (data.assignee_id ? Number(data.assignee_id) : null) : existing.assignee_id
    const due_date = data.due_date !== undefined ? data.due_date : existing.due_date
    const due_time = data.due_time !== undefined ? data.due_time : existing.due_time
    const priority = data.priority !== undefined ? data.priority : existing.priority
    const status = data.status !== undefined ? data.status : existing.status
    const category = data.category !== undefined ? data.category : existing.category
    const completed = status === 'مكتملة' ? (existing.completed_at || new Date().toISOString().slice(0, 19).replace('T', ' ')) : null

    await db.prepare(
      `UPDATE tasks SET title=?, description=?, case_id=?, client_id=?, assignee_id=?, due_date=?, due_time=?, priority=?, status=?, category=?, completed_at=? WHERE id=?`
    ).bind(title, description, case_id, client_id, assignee_id, due_date, due_time, priority, status, category, completed, id).run()

    return true
  }
}
