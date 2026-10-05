/**
 * Core Application Configuration Constants
 */
export const SESSION_COOKIE_NAME = 'sharif_session'
export const SESSION_DURATION_DAYS = 14
export const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000

// Rate Limiting settings
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
export const RATE_LIMIT_MAX_ATTEMPTS = 10 // Max 10 attempts per window

// Input validation — allowed values (allowlists)
export const ALLOWED_ROLES = ['managing_partner', 'partner', 'senior', 'lawyer', 'intern', 'admin', 'accountant', 'secretary'] as const
export const ALLOWED_CLIENT_STATUSES = ['active', 'vip', 'inactive'] as const
export const ALLOWED_CASE_STATUSES = ['متداولة', 'محجوزة للحكم', 'موقوفة', 'منتهية'] as const
export const ALLOWED_CASE_PRIORITIES = ['عاجلة', 'عالية', 'عادية', 'منخفضة'] as const
export const ALLOWED_TASK_STATUSES = ['مفتوحة', 'جارية', 'مكتملة', 'ملغاة'] as const
export const ALLOWED_INVOICE_STATUSES = ['مسودة', 'صادرة', 'جزئي', 'مسددة', 'متأخرة', 'ملغاة'] as const
export const ALLOWED_POA_STATUSES = ['ساري', 'منتهٍ', 'ملغى'] as const
export const ALLOWED_HEARING_STATUSES = ['قادمة', 'تمت', 'تأجيل', 'شطب', 'حجز للحكم'] as const
export const ALLOWED_CASE_DEGREES = ['ابتدائي', 'استئناف', 'نقض', 'إداري', 'تحكيم', 'تنفيذ'] as const
export const ALLOWED_CLIENT_TYPES = ['individual', 'company'] as const

// Maximum field lengths
export const MAX_TEXT_LENGTH = 1000
export const MAX_NAME_LENGTH = 200
export const MAX_NOTE_LENGTH = 5000
export const MAX_EMAIL_LENGTH = 254
