import test from 'node:test'
import assert from 'node:assert/strict'
import {
  escapeLike,
  isAllowed,
  truncate,
  cleanString,
  isPositiveNumber,
  isValidEmail
} from '../../src/utils/validation.ts'

test('Validation Utilities Unit Test Suite', async (t) => {
  await t.test('escapeLike escapes wildcards %, _, and \\', () => {
    assert.equal(escapeLike('normal text'), 'normal text')
    assert.equal(escapeLike('50% discount'), '50\\% discount')
    assert.equal(escapeLike('user_name'), 'user\\_name')
    assert.equal(escapeLike('path\\to\\file'), 'path\\\\to\\\\file')
    assert.equal(escapeLike('%_%'), '\\%\\_\\%')
  })

  await t.test('isAllowed validates against allowed array', () => {
    const roles = ['admin', 'lawyer', 'client']
    assert.equal(isAllowed('admin', roles), true)
    assert.equal(isAllowed('lawyer', roles), true)
    assert.equal(isAllowed('hacker', roles), false)
    assert.equal(isAllowed('', roles), false)
  })

  await t.test('truncate cuts string to maximum length', () => {
    assert.equal(truncate('hello', 10), 'hello')
    assert.equal(truncate('hello world', 5), 'hello')
    assert.equal(truncate('', 5), '')
  })

  await t.test('cleanString trims, truncates, and handles empty/null/undefined', () => {
    assert.equal(cleanString('  Ahmed  ', 10), 'Ahmed')
    assert.equal(cleanString('   ', 10), null)
    assert.equal(cleanString(null, 10), null)
    assert.equal(cleanString(undefined, 10), null)
    assert.equal(cleanString('1234567890', 5), '12345')
    assert.equal(cleanString(12345, 10), '12345')
  })

  await t.test('isPositiveNumber identifies valid positive finite numbers', () => {
    assert.equal(isPositiveNumber(10), true)
    assert.equal(isPositiveNumber('10.5'), true)
    assert.equal(isPositiveNumber(0), false)
    assert.equal(isPositiveNumber(-5), false)
    assert.equal(isPositiveNumber(NaN), false)
    assert.equal(isPositiveNumber(Infinity), false)
    assert.equal(isPositiveNumber('abc'), false)
    assert.equal(isPositiveNumber(null), false)
    assert.equal(isPositiveNumber(undefined), false)
  })

  await t.test('isValidEmail checks email format and bounds', () => {
    assert.equal(isValidEmail('ahmed@alsharif.law'), true)
    assert.equal(isValidEmail('test.user+tag@domain.co.uk'), true)
    assert.equal(isValidEmail('plainaddress'), false)
    assert.equal(isValidEmail('@missingusername.com'), false)
    assert.equal(isValidEmail('missingdomain@.com'), false)
    assert.equal(isValidEmail('spaces in@email.com'), false)
    assert.equal(isValidEmail(''), false)
    assert.equal(isValidEmail('a'.repeat(250) + '@test.com'), false, 'Should reject emails > 254 characters')
  })
})
