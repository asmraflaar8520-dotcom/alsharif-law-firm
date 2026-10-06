import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sha256,
  generateToken,
  hashPassword,
  verifyPassword,
  generateRandomPassword
} from '../../src/utils/crypto.ts'

test('Crypto Utilities Unit Test Suite', async (t) => {
  await t.test('sha256 computes consistent 64-character hex digest', async () => {
    const hash1 = await sha256('hello world')
    const hash2 = await sha256('hello world')
    assert.equal(hash1.length, 64)
    assert.equal(hash1, hash2)
    assert.equal(hash1, 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
  })

  await t.test('generateToken produces unique 48-char hex strings', () => {
    const t1 = generateToken()
    const t2 = generateToken()
    assert.equal(typeof t1, 'string')
    assert.equal(t1.length, 48)
    assert.match(t1, /^[0-9a-f]{48}$/)
    assert.notEqual(t1, t2)
  })

  await t.test('hashPassword generates valid PBKDF2 format', async () => {
    const hash = await hashPassword('my-secure-password')
    assert.ok(hash.startsWith('100000$'), 'Hash should specify 100,000 iterations')
    const parts = hash.split('$')
    assert.equal(parts.length, 3, 'Format must be iterations$salt$hash')
    assert.equal(parts[1].length, 32, 'Salt hex should be 32 chars (16 bytes)')
    assert.equal(parts[2].length, 64, 'Derived key hex should be 64 chars (32 bytes)')
  })

  await t.test('verifyPassword authenticates correct password', async () => {
    const password = 'CorrectPassword#2026'
    const storedHash = await hashPassword(password)
    const isValid = await verifyPassword(password, storedHash)
    assert.equal(isValid, true)
  })

  await t.test('verifyPassword rejects incorrect password', async () => {
    const storedHash = await hashPassword('CorrectPassword#2026')
    const isValid = await verifyPassword('WrongPassword', storedHash)
    assert.equal(isValid, false)
  })

  await t.test('verifyPassword handles empty or invalid inputs gracefully', async () => {
    assert.equal(await verifyPassword('', '100000$salt$hash'), false)
    assert.equal(await verifyPassword('password', ''), false)
    assert.equal(await verifyPassword('password', 'corrupted-hash'), false)
    assert.equal(await verifyPassword('password', '100000$invalid-hex$invalid-hash'), false)
  })

  await t.test('verifyPassword supports legacy plain sha256 hash', async () => {
    const legacy = await sha256('legacy-password')
    assert.equal(await verifyPassword('legacy-password', legacy), true)
    assert.equal(await verifyPassword('wrong-password', legacy), false)
  })

  await t.test('generateRandomPassword generates requested length and varied characters', () => {
    const pass16 = generateRandomPassword(16)
    const pass32 = generateRandomPassword(32)
    assert.equal(pass16.length, 16)
    assert.equal(pass32.length, 32)
    assert.notEqual(pass16, generateRandomPassword(16))
  })
})
