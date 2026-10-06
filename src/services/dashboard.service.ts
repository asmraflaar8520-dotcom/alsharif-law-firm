import { escapeLike } from '../utils/validation'
import { safeUser } from '../middleware/auth'
import { User } from '../types'

export class DashboardService {
  /**
   * High-performance aggregated KPIs, agenda, and workload metrics.
   */
  static async getDashboardMetrics(db: D1Database, user: User): Promise<any> {
    const today = new Date().toISOString().slice(0, 10)

    const [
      casesRow, hearingsToday, openTasks, invoiceStats, monthPaid,
      byStatus, byType, upcomingHearings, recentAct, teamLoad, expiringPoa, monthExp
    ] = await Promise.all([
      db.prepare(`SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('متداولة','محجوزة للحكم','موقوفة') THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN status = 'منتهية' THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN priority IN ('عاجلة','عالية') AND status != 'منتهية' THEN 1 ELSE 0 END) AS urgent
        FROM cases`).first<{ total: number; open: number; closed: number; urgent: number }>(),
      db.prepare(`SELECT COUNT(*) AS n FROM hearings WHERE hearing_date = ? AND status = 'قادمة'`).bind(today).first<{ n: number }>(),
      db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status IN ('مفتوحة','جارية')`).first<{ n: number }>(),
      db.prepare(`SELECT
        COUNT(CASE WHEN status IN ('صادرة','جزئي','متأخرة') AND due_date IS NOT NULL AND due_date < date('now') THEN 1 END) AS overdue_count,
        COALESCE(SUM(CASE WHEN status IN ('صادرة','جزئي','متأخرة') AND due_date IS NOT NULL AND due_date < date('now') THEN total-paid ELSE 0 END), 0) AS overdue_amount,
        COALESCE(SUM(CASE WHEN status IN ('صادرة','جزئي','متأخرة') THEN total-paid ELSE 0 END), 0) AS outstanding_amount,
        COALESCE(SUM(CASE WHEN issue_date >= date('now','start of month') AND status != 'ملغاة' THEN total ELSE 0 END), 0) AS month_invoiced
        FROM invoices`).first<{ overdue_count: number; overdue_amount: number; outstanding_amount: number; month_invoiced: number }>(),
      db.prepare(`SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE paid_at >= date('now','start of month')`).first<{ n: number }>(),
      db.prepare(`SELECT status, COUNT(*) AS n FROM cases GROUP BY status`).all(),
      db.prepare(`SELECT ct.category AS name, COUNT(*) AS n FROM cases c LEFT JOIN case_types ct ON ct.id = c.case_type_id WHERE c.status != 'منتهية' GROUP BY ct.category`).all(),
      db.prepare(`SELECT h.*, cs.case_no, cs.year, cs.title AS case_title, cl.name AS client_name, u.name AS lawyer_name, co.name AS court_name
        FROM hearings h
        JOIN cases cs ON cs.id = h.case_id
        JOIN clients cl ON cl.id = cs.client_id
        LEFT JOIN users u ON u.id = h.lawyer_id
        LEFT JOIN courts co ON co.id = h.court_id
        WHERE h.hearing_date >= date('now') AND h.status IN ('قادمة','حجز للحكم')
        ORDER BY h.hearing_date, h.hearing_time LIMIT 10`).all(),
      db.prepare(`SELECT a.*, u.name AS user_name, u.initials, u.color FROM activities a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 8`).all(),
      db.prepare(`SELECT u.id, u.name, u.initials, u.color, u.role, u.title,
        (SELECT COUNT(*) FROM cases WHERE lead_lawyer_id = u.id AND status != 'منتهية') AS open_cases,
        (SELECT COUNT(*) FROM tasks WHERE assignee_id = u.id AND status IN ('مفتوحة','جارية')) AS open_tasks
        FROM users u WHERE u.is_active = 1 AND u.role NOT IN ('accountant','secretary') ORDER BY open_cases DESC LIMIT 6`).all(),
      db.prepare(`SELECT p.*, cl.name AS client_name FROM powers_of_attorney p JOIN clients cl ON cl.id = p.client_id
        WHERE p.status = 'ساري' AND p.expiry_date IS NOT NULL AND p.expiry_date <= date('now','+45 days')
        ORDER BY p.expiry_date LIMIT 6`).all(),
      db.prepare(`SELECT COALESCE(SUM(amount),0) AS n FROM expenses WHERE expense_date >= date('now','start of month')`).first<{ n: number }>()
    ])

    return {
      kpis: {
        open_cases: casesRow?.open || 0,
        total_cases: casesRow?.total || 0,
        closed_cases: casesRow?.closed || 0,
        urgent_cases: casesRow?.urgent || 0,
        hearings_today: hearingsToday?.n || 0,
        open_tasks: openTasks?.n || 0,
        overdue_invoices: invoiceStats?.overdue_count || 0,
        overdue_amount: invoiceStats?.overdue_amount || 0,
        month_collected: monthPaid?.n || 0,
        month_invoiced: invoiceStats?.month_invoiced || 0,
        outstanding: invoiceStats?.outstanding_amount || 0,
        overdue: invoiceStats?.overdue_amount || 0,
        month_expenses: monthExp?.n || 0
      },
      by_status: byStatus.results || [],
      by_type: byType.results || [],
      upcoming_hearings: upcomingHearings.results || [],
      activity: recentAct.results || [],
      team: teamLoad.results || [],
      expiring_poa: expiringPoa.results || [],
      me: safeUser(user)
    }
  }

  /**
   * Returns lookup dictionaries (courts, case types, users, clients, cases)
   */
  static async getLookups(db: D1Database): Promise<any> {
    const [courts, types, users, clients, cases] = await Promise.all([
      db.prepare(`SELECT * FROM courts ORDER BY name`).all(),
      db.prepare(`SELECT * FROM case_types ORDER BY category, name`).all(),
      db.prepare(`SELECT id, name, title, role, initials, color, department FROM users WHERE is_active = 1 ORDER BY name`).all(),
      db.prepare(`SELECT id, name, type, status FROM clients ORDER BY name`).all(),
      db.prepare(`SELECT id, case_no, year, title FROM cases ORDER BY id DESC LIMIT 200`).all()
    ])

    return {
      courts: courts.results || [],
      case_types: types.results || [],
      users: users.results || [],
      clients: clients.results || [],
      cases: cases.results || []
    }
  }

  /**
   * Fast global search across cases, clients, and powers of attorney
   */
  static async globalSearch(db: D1Database, rawQuery: string): Promise<{ cases: any[]; clients: any[]; poas: any[] }> {
    const q = (rawQuery || '').trim()
    if (q.length < 2) {
      return { cases: [], clients: [], poas: [] }
    }

    const like = `%${escapeLike(q)}%`
    const [cases, clients, poas] = await Promise.all([
      db.prepare(`SELECT c.id, c.case_no, c.year, c.title, c.status, cl.name AS client_name
        FROM cases c JOIN clients cl ON cl.id = c.client_id
        WHERE c.title LIKE ? ESCAPE '\\' OR c.case_no LIKE ? ESCAPE '\\' OR cl.name LIKE ? ESCAPE '\\' OR c.opposing_name LIKE ? ESCAPE '\\' LIMIT 8`).bind(like, like, like, like).all(),
      db.prepare(`SELECT id, name, type, phone, city FROM clients WHERE name LIKE ? ESCAPE '\\' OR national_id LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' LIMIT 6`).bind(like, like, like).all(),
      db.prepare(`SELECT p.id, p.poa_no, p.type, cl.name AS client_name FROM powers_of_attorney p JOIN clients cl ON cl.id = p.client_id WHERE p.poa_no LIKE ? ESCAPE '\\' OR cl.name LIKE ? ESCAPE '\\' LIMIT 4`).bind(like, like).all()
    ])

    return {
      cases: cases.results || [],
      clients: clients.results || [],
      poas: poas.results || []
    }
  }
}
