/**
 * Egyptian Statutory Appeal Deadlines Engine (محرك مواعيد الطعون القانونية)
 * Implements Egyptian Procedural Law & Criminal Procedure Law deadline rules.
 */

export interface AppealDeadlineRule {
  key: string
  days: number
  label: string
  lawReference: string
  courtDegree: string
}

export const APPEAL_RULES: Record<string, AppealDeadlineRule> = {
  civil_appeal: {
    key: 'civil_appeal',
    days: 40,
    label: 'استئناف مدني',
    lawReference: 'المادة 227 من قانون المرافعات المدنية والتجارية رقم 13 لسنة 1968 (40 يوماً)',
    courtDegree: 'استئناف عالي'
  },
  urgent_appeal: {
    key: 'urgent_appeal',
    days: 15,
    label: 'استئناف مستعجل',
    lawReference: 'المادة 227 من قانون المرافعات المدنية والتجارية (15 يوماً للأحكام المستعجلة)',
    courtDegree: 'استئناف مستعجل'
  },
  misdemeanor_appeal: {
    key: 'misdemeanor_appeal',
    days: 10,
    label: 'استئناف جنح',
    lawReference: 'المادة 406 من قانون الإجراءات الجنائية رقم 150 لسنة 1950 (10 أيام من تاريخ صدور الحكم)',
    courtDegree: 'جنح مستأنفة'
  },
  cassation: {
    key: 'cassation',
    days: 60,
    label: 'طعن بالنقض',
    lawReference: 'المادة 34 من قانون حالات وإجراءات الطعن أمام محكمة النقض رقم 57 لسنة 1959 (60 يوماً)',
    courtDegree: 'محكمة النقض'
  },
  administrative_supreme: {
    key: 'administrative_supreme',
    days: 60,
    label: 'طعن أمام الإدارية العليا',
    lawReference: 'المادة 44 من قانون مجلس الدولة رقم 47 لسنة 1972 (60 يوماً)',
    courtDegree: 'المحكمة الإدارية العليا'
  }
}

export interface DeadlineRecord {
  id: number
  case_id: number
  deadline_type: string
  deadline_label?: string
  law_reference?: string
  judgment_date: string
  due_date: string
  status: 'pending' | 'filed' | 'expired'
  notes?: string
  created_at: string
  case_no?: string
  year?: number
  case_title?: string
  client_id?: number
  client_name?: string
  client_phone?: string
  court_name?: string
  circuit?: string
  remaining_days?: number
  alert_level?: 'expired' | 'urgent' | 'warning' | 'safe'
}

/**
 * Calculates due date according to Egyptian procedural computation rule:
 * Day of judgment/notification is excluded (لا يُحسب يوم صدور الحكم أو الإعلان).
 * Computation strictly begins on the following day (يبدأ الميعاد من اليوم التالي).
 */
export function calculateAppealDueDate(judgmentDateStr: string, deadlineType: string): string {
  const rule = APPEAL_RULES[deadlineType]
  if (!rule) {
    throw new Error(`نوع ميعاد الطعن غير معتمد: ${deadlineType}`)
  }

  const parts = judgmentDateStr.trim().split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`صيغة تاريخ الحكم غير صالحة، يجب أن تكون YYYY-MM-DD: ${judgmentDateStr}`)
  }

  const [year, month, day] = parts
  const date = new Date(Date.UTC(year, month - 1, day))

  // In Egyptian Procedural Law (Art. 15 Civil Procedures):
  // Day of judgment is excluded; calculation starts next day for rule.days days.
  // e.g. May 1 + 10 days = May 11.
  date.setUTCDate(date.getUTCDate() + rule.days)

  const resYear = date.getUTCFullYear()
  const resMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  const resDay = String(date.getUTCDate()).padStart(2, '0')

  return `${resYear}-${resMonth}-${resDay}`
}

/**
 * Calculates remaining days from reference date (default: today)
 */
export function calculateRemainingDays(dueDateStr: string, fromDateStr?: string): number {
  const today = fromDateStr ? fromDateStr.trim().slice(0, 10) : new Date().toISOString().slice(0, 10)
  const [ty, tm, td] = today.split('-').map(Number)
  const [dy, dm, dd] = dueDateStr.trim().split('-').map(Number)

  const tMs = Date.UTC(ty, tm - 1, td)
  const dMs = Date.UTC(dy, dm - 1, dd)

  return Math.round((dMs - tMs) / (1000 * 60 * 60 * 24))
}

/**
 * Determines alert classification for radar display
 */
export function getDeadlineAlertLevel(dueDateStr: string, status: string, fromDateStr?: string): 'expired' | 'urgent' | 'warning' | 'safe' {
  if (status === 'filed') return 'safe'
  const remaining = calculateRemainingDays(dueDateStr, fromDateStr)
  if (remaining < 0) return 'expired'
  if (remaining <= 3) return 'urgent'
  if (remaining <= 7) return 'warning'
  return 'safe'
}

export class DeadlinesService {
  /**
   * Retrieves appeal deadlines with client and case metadata
   */
  static async getDeadlines(
    db: D1Database,
    filters: { status?: string; case_id?: number | string; search?: string } = {}
  ): Promise<DeadlineRecord[]> {
    let sql = `
      SELECT 
        ad.*,
        c.case_no,
        c.year,
        c.title AS case_title,
        c.client_id,
        cl.name AS client_name,
        cl.phone AS client_phone,
        co.name AS court_name,
        c.circuit
      FROM appeal_deadlines ad
      JOIN cases c ON c.id = ad.case_id
      JOIN clients cl ON cl.id = c.client_id
      LEFT JOIN courts co ON co.id = c.court_id
      WHERE 1=1
    `
    const binds: any[] = []

    if (filters.status) {
      sql += ` AND ad.status = ?`
      binds.push(filters.status)
    }

    if (filters.case_id) {
      sql += ` AND ad.case_id = ?`
      binds.push(Number(filters.case_id))
    }

    if (filters.search) {
      const like = `%${filters.search.trim()}%`
      sql += ` AND (c.case_no LIKE ? OR c.title LIKE ? OR cl.name LIKE ? OR ad.notes LIKE ?)`
      binds.push(like, like, like, like)
    }

    sql += ` ORDER BY ad.due_date ASC, ad.id DESC`

    const res = await db.prepare(sql).bind(...binds).all<any>()
    const rows = res.results || []

    return rows.map((r) => {
      const rule = APPEAL_RULES[r.deadline_type]
      const remaining = calculateRemainingDays(r.due_date)
      const alert = getDeadlineAlertLevel(r.due_date, r.status)

      return {
        ...r,
        deadline_label: rule?.label || r.deadline_type,
        law_reference: rule?.lawReference || '',
        remaining_days: remaining,
        alert_level: alert
      }
    })
  }

  /**
   * Retrieves high-priority deadlines for the Dashboard Radar Widget
   * (Deadlines pending and due within 7 days, or expired pending)
   */
  static async getRadarDeadlines(db: D1Database): Promise<{
    urgent: DeadlineRecord[]
    warning: DeadlineRecord[]
    total_pending: number
    expired_count: number
  }> {
    const all = await this.getDeadlines(db, { status: 'pending' })
    const urgent: DeadlineRecord[] = []
    const warning: DeadlineRecord[] = []
    let expiredCount = 0

    for (const d of all) {
      if (d.alert_level === 'expired') {
        expiredCount++
        urgent.push(d) // Expired is critical red alert
      } else if (d.alert_level === 'urgent') {
        urgent.push(d)
      } else if (d.alert_level === 'warning') {
        warning.push(d)
      }
    }

    return {
      urgent,
      warning,
      total_pending: all.length,
      expired_count: expiredCount
    }
  }

  /**
   * Registers a new appeal deadline with auto-calculated due date
   */
  static async createDeadline(
    db: D1Database,
    payload: {
      case_id: number | string
      deadline_type: string
      judgment_date: string
      notes?: string
    },
    userId?: number
  ): Promise<DeadlineRecord> {
    if (!payload.case_id) {
      throw new Error('رقم ملف القضية مطلوب لإنشاء ميعاد الطعن')
    }
    if (!payload.deadline_type) {
      throw new Error('نوع ميعاد الطعن مطلوب')
    }
    if (!payload.judgment_date) {
      throw new Error('تاريخ صدور الحكم أو الإعلان مطلوب')
    }

    const dueDate = calculateAppealDueDate(payload.judgment_date, payload.deadline_type)

    const insertRes = await db
      .prepare(
        `INSERT INTO appeal_deadlines (case_id, deadline_type, judgment_date, due_date, status, notes)
         VALUES (?, ?, ?, ?, 'pending', ?)`
      )
      .bind(
        Number(payload.case_id),
        payload.deadline_type,
        payload.judgment_date.trim().slice(0, 10),
        dueDate,
        payload.notes?.trim() || null
      )
      .run()

    const newId = insertRes.meta.last_row_id

    // Log activity if user available
    if (userId) {
      const rule = APPEAL_RULES[payload.deadline_type]
      await db
        .prepare(
          `INSERT INTO activities (user_id, entity_type, entity_id, action, detail)
           VALUES (?, 'appeal_deadline', ?, 'قيد ميعاد طعن', ?)`
        )
        .bind(userId, newId, `قيد ${rule?.label || payload.deadline_type} يستحق في ${dueDate}`)
        .run()
        .catch(() => {})
    }

    const created = await this.getDeadlines(db, { case_id: payload.case_id })
    const found = created.find((c) => c.id === newId)
    if (!found) {
      throw new Error('تعذر العثور على ميعاد الطعن بعد إنشائه')
    }
    return found
  }

  /**
   * Updates deadline status (e.g. marked as filed 'تم قيد الطعن')
   */
  static async updateDeadlineStatus(
    db: D1Database,
    id: number | string,
    status: 'pending' | 'filed' | 'expired',
    notes?: string
  ): Promise<boolean> {
    const valid = ['pending', 'filed', 'expired']
    if (!valid.includes(status)) {
      throw new Error(`حالة ميعاد الطعن غير صالحة: ${status}`)
    }

    let sql = `UPDATE appeal_deadlines SET status = ?`
    const binds: any[] = [status]

    if (notes !== undefined) {
      sql += `, notes = ?`
      binds.push(notes.trim())
    }

    sql += ` WHERE id = ?`
    binds.push(Number(id))

    const res = await db.prepare(sql).bind(...binds).run()
    return res.meta.changes > 0
  }

  /**
   * Deletes an appeal deadline
   */
  static async deleteDeadline(db: D1Database, id: number | string): Promise<boolean> {
    const res = await db.prepare(`DELETE FROM appeal_deadlines WHERE id = ?`).bind(Number(id)).run()
    return res.meta.changes > 0
  }
}
