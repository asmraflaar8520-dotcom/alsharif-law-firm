import { RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS } from '../config/constants'

// In-memory rate limiting store
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

/**
 * Periodic cleanup of expired rate limit entries to prevent memory leaks.
 * Runs at most once per window period.
 */
let lastCleanup = 0
function cleanupExpired(): void {
  const now = Date.now()
  if (now - lastCleanup < RATE_LIMIT_WINDOW_MS) return
  lastCleanup = now
  for (const [key, record] of rateLimitMap) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key)
    }
  }
}

/**
 * Checks if a given IP or key has exceeded the allowed rate limit.
 * Returns true if allowed, false if limit exceeded.
 */
export function checkRateLimit(key: string): boolean {
  cleanupExpired()
  const now = Date.now()
  const record = rateLimitMap.get(key)
  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return false
  }
  record.count++
  return true
}

/**
 * Resets rate limit for a key (or clears all if no key provided).
 * Useful for tests and administrative resets.
 */
export function resetRateLimit(key?: string): void {
  if (key) {
    rateLimitMap.delete(key)
  } else {
    rateLimitMap.clear()
  }
}
