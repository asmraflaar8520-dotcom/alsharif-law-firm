/**
 * Domain Exception Classes & Centralized Error Handling
 */

export class AppError extends Error {
  public readonly statusCode: number
  public readonly details?: any
  public readonly isOperational: boolean

  constructor(message: string, statusCode: number = 500, details?: any) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.details = details
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'فشل التحقق من صحة المدخلات', details?: any) {
    super(message, 400, details)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'جلسة العمل غير صالحة أو منتهية') {
    super(message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'ليس لديك الصلاحية الكافية لتنفيذ هذه العملية') {
    super(message, 403)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'المورد المطلوب غير موجود') {
    super(message, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'تعارض في البيانات المدخلة') {
    super(message, 409)
  }
}
