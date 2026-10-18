import { ValidationError } from './errors'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../storage/config'
import {
  ALLOWED_CASE_STATUSES,
  ALLOWED_CASE_PRIORITIES,
  ALLOWED_CLIENT_STATUSES,
  ALLOWED_CLIENT_TYPES,
  ALLOWED_HEARING_STATUSES
} from '../config/constants'
import { isValidEmail } from './validation'

export interface ValidationIssue {
  readonly field: string
  readonly message: string
}

export interface ValidationResult<T> {
  readonly success: boolean
  readonly data?: T
  readonly errors?: ValidationIssue[]
}

/**
 * Asserts that a validation result is successful.
 * Throws a domain ValidationError with structured details if unsuccessful.
 */
export function assertValid<T>(result: ValidationResult<T>): T {
  if (!result.success || !result.data) {
    throw new ValidationError(
      result.errors?.[0]?.message || 'فشل التحقق من صحة المدخلات',
      result.errors || []
    )
  }
  return result.data
}

/**
 * Validates pagination query parameters
 */
export function validatePaginationQuery(query: Record<string, any> = {}): ValidationResult<{
  page: number
  limit: number
  search: string
  isRawAll: boolean
}> {
  const errors: ValidationIssue[] = []

  // Check search query bounds
  const rawSearch = query.search || query.q
  let search = ''
  if (rawSearch !== undefined && rawSearch !== null) {
    search = String(rawSearch).trim()
    if (search.length > 250) {
      errors.push({ field: 'search', message: 'نص البحث لا يجب أن يتجاوز 250 حرفاً' })
    }
  }

  // Parse page safely
  let page = 1
  if (query.page !== undefined && query.page !== null && String(query.page).trim() !== '') {
    const parsedPage = Number(query.page)
    if (isNaN(parsedPage) || !Number.isInteger(parsedPage) || parsedPage < 1) {
      // Clamped to 1 per system design, but flag if manifestly invalid string
      if (typeof query.page === 'string' && isNaN(parseInt(query.page, 10))) {
        errors.push({ field: 'page', message: 'رقم الصفحة يجب أن يكون عدداً صحيحاً موجباً' })
      }
    } else {
      page = parsedPage
    }
  }

  // Parse limit safely
  let limit = 20
  if (query.limit !== undefined && query.limit !== null && String(query.limit).trim() !== '') {
    const parsedLimit = Number(query.limit)
    if (isNaN(parsedLimit) || !Number.isInteger(parsedLimit) || parsedLimit < 1) {
      if (typeof query.limit === 'string' && isNaN(parseInt(query.limit, 10))) {
        errors.push({ field: 'limit', message: 'عدد السجلات في الصفحة يجب أن يكون عدداً صحيحاً' })
      }
    } else {
      limit = Math.min(100, parsedLimit)
    }
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  const isRawAll = query.all === 'true' || query.all === '1'
  return {
    success: true,
    data: { page, limit, search, isRawAll }
  }
}

/**
 * Validates file upload metadata before storage processing
 */
export function validateFileUploadMetadata(data: {
  filename?: unknown
  mimeType?: unknown
  size?: unknown
  folder?: unknown
}): ValidationResult<{
  filename: string
  mimeType: string
  size: number
  folder: string
}> {
  const errors: ValidationIssue[] = []

  // 1. Filename validation
  if (!data.filename || typeof data.filename !== 'string' || !data.filename.trim()) {
    errors.push({ field: 'filename', message: 'اسم الملف إجباري' })
  } else {
    const name = data.filename.trim()
    if (name.length > 255) {
      errors.push({ field: 'filename', message: 'اسم الملف طويل جداً (الحد الأقصى 255 حرف)' })
    }
    if (name.includes('\0') || name.includes('..') || /[<>:"/\\|?*]/.test(name)) {
      errors.push({ field: 'filename', message: 'اسم الملف يحتوي على رموز غير مسموح بها أو محاولة اجتياز مسار' })
    }
  }

  // 2. MIME type validation
  const cleanMime = typeof data.mimeType === 'string' ? data.mimeType.toLowerCase().trim() : ''
  if (!cleanMime) {
    errors.push({ field: 'mimeType', message: 'نوع الملف (MIME Type) إجباري' })
  } else if (!ALLOWED_MIME_TYPES.includes(cleanMime)) {
    errors.push({
      field: 'mimeType',
      message: `نوع الملف غير مدعوم (${cleanMime}). الصيغ المدعومة فقط: PDF, JPEG, PNG`
    })
  }

  // 3. File size validation
  const size = Number(data.size)
  if (data.size !== undefined && (isNaN(size) || size <= 0)) {
    errors.push({ field: 'size', message: 'حجم الملف غير صالح' })
  } else if (size > MAX_FILE_SIZE_BYTES) {
    errors.push({
      field: 'size',
      message: `حجم الملف (${(size / (1024 * 1024)).toFixed(1)}MB) يتجاوز الحد الأقصى المسموح به (15MB)`
    })
  }

  // 4. Folder validation
  const folder = typeof data.folder === 'string' && data.folder.trim() ? data.folder.trim() : 'documents'
  if (!/^[a-zA-Z0-9_-]+$/.test(folder) || folder.length > 50) {
    errors.push({ field: 'folder', message: 'اسم المجلد غير صالح' })
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  return {
    success: true,
    data: {
      filename: String(data.filename).trim(),
      mimeType: cleanMime,
      size: isNaN(size) ? 0 : size,
      folder
    }
  }
}

/**
 * Validates client creation request DTO
 */
export function validateCreateClientInput(data: Record<string, any> = {}): ValidationResult<{
  name: string
  type: string
  status: string
  email?: string | null
}> {
  const errors: ValidationIssue[] = []

  const name = typeof data.name === 'string' ? data.name.trim() : ''
  if (!name) {
    errors.push({ field: 'name', message: 'اسم العميل حقل إجباري' })
  } else if (name.length > 255) {
    errors.push({ field: 'name', message: 'اسم العميل لا يجب أن يتجاوز 255 حرفاً' })
  }

  const type = data.type ? String(data.type).trim() : 'فرد'
  if (type && !ALLOWED_CLIENT_TYPES.includes(type as any)) {
    errors.push({ field: 'type', message: `نوع العميل غير صالح. الأنواع المسموحة: ${ALLOWED_CLIENT_TYPES.join(', ')}` })
  }

  const status = data.status ? String(data.status).trim() : 'نشط'
  if (status && !ALLOWED_CLIENT_STATUSES.includes(status as any)) {
    errors.push({ field: 'status', message: `حالة العميل غير صالحة. الحالات المسموحة: ${ALLOWED_CLIENT_STATUSES.join(', ')}` })
  }

  if (data.email && typeof data.email === 'string' && data.email.trim()) {
    if (!isValidEmail(data.email.trim())) {
      errors.push({ field: 'email', message: 'صيغة البريد الإلكتروني غير صحيحة' })
    }
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  return {
    success: true,
    data: {
      name,
      type,
      status,
      email: data.email ? String(data.email).trim() : null
    }
  }
}

/**
 * Validates case creation request DTO
 */
export function validateCreateCaseInput(data: Record<string, any> = {}): ValidationResult<{
  title: string
  case_no: string
  client_id: number
  status: string
  priority: string
}> {
  const errors: ValidationIssue[] = []

  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (!title) {
    errors.push({ field: 'title', message: 'عنوان القضية حقل إجباري' })
  }

  const case_no = typeof data.case_no === 'string' ? data.case_no.trim() : ''
  if (!case_no) {
    errors.push({ field: 'case_no', message: 'رقم القضية حقل إجباري' })
  }

  const clientId = Number(data.client_id)
  if (!data.client_id || isNaN(clientId) || clientId <= 0) {
    errors.push({ field: 'client_id', message: 'معرف العميل (client_id) غير صالح أو مفقود' })
  }

  const status = data.status ? String(data.status).trim() : 'متداولة'
  if (status && !ALLOWED_CASE_STATUSES.includes(status as any)) {
    errors.push({ field: 'status', message: `حالة القضية غير صالحة. الحالات المسموحة: ${ALLOWED_CASE_STATUSES.join(', ')}` })
  }

  const priority = data.priority ? String(data.priority).trim() : 'عادية'
  if (priority && !ALLOWED_CASE_PRIORITIES.includes(priority as any)) {
    errors.push({ field: 'priority', message: `أولوية القضية غير صالحة. الأولويات المسموحة: ${ALLOWED_CASE_PRIORITIES.join(', ')}` })
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  return {
    success: true,
    data: {
      title,
      case_no,
      client_id: clientId,
      status,
      priority
    }
  }
}
