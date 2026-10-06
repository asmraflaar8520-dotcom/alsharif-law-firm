import test from 'node:test'
import assert from 'node:assert/strict'
import { AuthService } from '../../src/services/auth.service.ts'
import { createSqliteD1 } from '../../src/utils/d1-sqlite.ts'

test('AuthService Unit Test Suite', async (t) => {
  let db

  t.beforeEach(() => {
    db = createSqliteD1(':memory:', true)
  })

  await t.test('login successfully authenticates valid user', async () => {
    const result = await AuthService.login(db, {
      email: 'ahmed@alsharif.law',
      password: 'sharif2026',
      ip: '127.0.0.1'
    })

    assert.ok(result.user, 'User object should be returned')
    assert.equal(result.user.email, 'ahmed@alsharif.law')
    assert.equal(result.user.name, 'المستشار أحمد عبدالعزيز الشريف')
    assert.equal(result.user.password_hash, undefined, 'password_hash must never be leaked')
    assert.ok(result.sessionToken, 'Session token must be generated')
    assert.equal(result.sessionToken.length, 48)
    assert.ok(result.expiresAt)
  })

  await t.test('login rejects invalid password and logs failed attempt', async () => {
    await assert.rejects(
      async () => {
        await AuthService.login(db, {
          email: 'ahmed@alsharif.law',
          password: 'wrong_password',
          ip: '127.0.0.1'
        })
      },
      { message: 'بيانات الدخول غير صحيحة' }
    )

    // Verify activity logged
    const activity = await db.prepare(
      `SELECT * FROM activities WHERE action = 'فشل_دخول' ORDER BY id DESC LIMIT 1`
    ).first()
    assert.ok(activity)
    assert.match(activity.detail, /127.0.0.1/)
  })

  await t.test('login rejects unknown email', async () => {
    await assert.rejects(
      async () => {
        await AuthService.login(db, {
          email: 'nonexistent@alsharif.law',
          password: 'password',
          ip: '127.0.0.1'
        })
      },
      { message: 'بيانات الدخول غير صحيحة' }
    )
  })

  await t.test('login enforces single session per user', async () => {
    const res1 = await AuthService.login(db, {
      email: 'ahmed@alsharif.law',
      password: 'sharif2026'
    })
    const res2 = await AuthService.login(db, {
      email: 'ahmed@alsharif.law',
      password: 'sharif2026'
    })

    assert.notEqual(res1.sessionToken, res2.sessionToken)

    const user1 = await AuthService.getUserFromToken(db, res1.sessionToken)
    assert.equal(user1, null, 'First token should be invalidated by second login')

    const user2 = await AuthService.getUserFromToken(db, res2.sessionToken)
    assert.ok(user2, 'Second token should be active')
    assert.equal(user2.id, 1)
  })

  await t.test('logout invalidates active token', async () => {
    const res = await AuthService.login(db, {
      email: 'mona@alsharif.law',
      password: 'sharif2026'
    })

    const activeUser = await AuthService.getUserFromToken(db, res.sessionToken)
    assert.ok(activeUser)

    await AuthService.logout(db, res.sessionToken)
    const afterLogout = await AuthService.getUserFromToken(db, res.sessionToken)
    assert.equal(afterLogout, null)
  })

  await t.test('getUserFromToken returns null for empty or invalid token', async () => {
    assert.equal(await AuthService.getUserFromToken(db, ''), null)
    assert.equal(await AuthService.getUserFromToken(db, 'non_existent_token_1234567890'), null)
  })

  await t.test('pruneExpiredSessions deletes expired sessions', async () => {
    // Insert an expired session
    await db.prepare(
      `INSERT INTO sessions (token, user_id, expires_at) VALUES ('expired_token', 1, '2020-01-01 00:00:00')`
    ).run()

    const prunedCount = await AuthService.pruneExpiredSessions(db)
    assert.ok(prunedCount >= 1)

    const check = await db.prepare(`SELECT * FROM sessions WHERE token = 'expired_token'`).first()
    assert.equal(check, null)
  })
})
