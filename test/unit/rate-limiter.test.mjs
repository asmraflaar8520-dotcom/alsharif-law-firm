import test from 'node:test'
import assert from 'node:assert/strict'
import { checkRateLimit, resetRateLimit } from '../../src/middleware/rate-limiter.ts'
import { RATE_LIMIT_MAX_ATTEMPTS } from '../../src/config/constants.ts'

test('Rate Limiter Unit Test Suite', async (t) => {
  const testIp = '192.168.1.100'

  t.beforeEach(() => {
    resetRateLimit()
  })

  await t.test('Allows initial request for key', () => {
    const allowed = checkRateLimit(testIp)
    assert.equal(allowed, true)
  })

  await t.test('Allows requests up to RATE_LIMIT_MAX_ATTEMPTS', () => {
    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      assert.equal(checkRateLimit(testIp), true, `Attempt ${i + 1} should be allowed`)
    }
    // Next attempt must be blocked
    assert.equal(checkRateLimit(testIp), false, 'Attempt beyond limit must be blocked')
  })

  await t.test('resetRateLimit unblocks key immediately', () => {
    for (let i = 0; i <= RATE_LIMIT_MAX_ATTEMPTS; i++) {
      checkRateLimit(testIp)
    }
    assert.equal(checkRateLimit(testIp), false)

    resetRateLimit(testIp)
    assert.equal(checkRateLimit(testIp), true, 'Key should be unblocked after reset')
  })

  await t.test('Different keys maintain independent rate limit counters', () => {
    const ipA = '10.0.0.1'
    const ipB = '10.0.0.2'

    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      checkRateLimit(ipA)
    }
    assert.equal(checkRateLimit(ipA), false)
    assert.equal(checkRateLimit(ipB), true, 'ipB should not be affected by ipA reaching limit')
  })
})
