/**
 * Input validation helpers
 * Centralizes validation logic used across routes
 */

/**
 * Escapes SQL LIKE wildcard characters in user input
 * Prevents users from using % or _ to bypass search filters
 */
export function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, (c) => '\\' + c)
}

/**
 * Validates that a value is within an allowed set of values
 */
export function isAllowed(value: string, allowedValues: readonly string[]): boolean {
  return allowedValues.includes(value)
}

/**
 * Truncates a string to a maximum length
 */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return value.slice(0, maxLength)
}

/**
 * Validates and sanitizes a string input:
 * - Trims whitespace
 * - Enforces max length
 * - Returns null if empty after trimming
 */
export function cleanString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  if (str.length === 0) return null
  return str.slice(0, maxLength)
}

/**
 * Validates that a numeric value is a finite positive number
 */
export function isPositiveNumber(value: unknown): boolean {
  const n = Number(value)
  return !isNaN(n) && isFinite(n) && n > 0
}

/**
 * Validates an email format (basic check)
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}
