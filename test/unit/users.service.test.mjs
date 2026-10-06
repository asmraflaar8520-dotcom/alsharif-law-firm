import test from 'node:test'
import assert from 'node:assert/strict'
import { UsersService } from '../../src/services/users.service.ts'
import { verifyPassword } from '../../src/utils/crypto.ts'
import { createSqliteD1 } from '../../src/utils/d1-sqlite.ts'

test('UsersService Unit Test Suite', async (t) => {
  let db

  t.beforeEach(() => {
    db = createSqliteD1(':memory:', true)
  })

  await t.test('getUsers returns team members sorted by hierarchy', async () => {
    const users = await UsersService.getUsers(db)
    assert.ok(Array.isArray(users))
    assert.ok(users.length > 0)
    // First user is managing partner
    assert.equal(users[0].role, 'managing_partner')
  })

  await t.test('getUserProfile retrieves profile and assigned workload', async () => {
    const profile = await UsersService.getUserProfile(db, 2)
    assert.ok(profile)
    assert.equal(profile.id, 2)
    assert.equal(profile.name, 'أ.د. منى عبدالفتاح حسني')
    assert.ok(Array.isArray(profile.cases))
    assert.ok(typeof profile.month_hours === 'number')
    assert.ok(typeof profile.open_tasks === 'number')
  })

  await t.test('getUserProfile returns null for unknown user', async () => {
    const profile = await UsersService.getUserProfile(db, 99999)
    assert.equal(profile, null)
  })

  await t.test('createUser validates email and prevents duplicate emails', async () => {
    // Missing fields
    await assert.rejects(
      async () => {
        await UsersService.createUser(db, { name: 'مستخدم جديد', email: '' }, 1)
      },
      { message: 'الاسم والبريد الإلكتروني مطلوبان' }
    )

    // Invalid email format
    await assert.rejects(
      async () => {
        await UsersService.createUser(db, { name: 'مستخدم جديد', email: 'invalid_email' }, 1)
      },
      { message: 'صيغة البريد الإلكتروني غير صحيحة' }
    )

    // Duplicate email
    await assert.rejects(
      async () => {
        await UsersService.createUser(db, { name: 'مستخدم', email: 'ahmed@alsharif.law' }, 1)
      },
      { message: 'البريد الإلكتروني مسجل بالفعل' }
    )
  })

  await t.test('createUser hashes password with PBKDF2', async () => {
    const newId = await UsersService.createUser(
      db,
      {
        name: 'الأستاذ أحمد شاكر',
        email: 'shaker@alsharif.law',
        password: 'Password#2026',
        role: 'lawyer',
        hourly_rate: 1500
      },
      1
    )

    assert.ok(newId)
    const userRow = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(newId).first()
    assert.equal(userRow.email, 'shaker@alsharif.law')
    assert.ok(userRow.password_hash.startsWith('100000$'))
    assert.equal(await verifyPassword('Password#2026', userRow.password_hash), true)
  })

  await t.test('updateUser enforces RBAC permissions for non-privileged users', async () => {
    const regularLawyer = { id: 6, role: 'lawyer' }
    const managingPartner = { id: 1, role: 'managing_partner' }

    // Lawyer tries to update another user -> rejected
    await assert.rejects(
      async () => {
        await UsersService.updateUser(db, 5, { title: 'محام أول' }, regularLawyer)
      },
      { message: 'غير مصرح بتعديل بيانات هذا المستخدم' }
    )

    // Lawyer updates own title -> allowed
    await UsersService.updateUser(db, 6, { title: 'محامية أولى — عمال' }, regularLawyer)
    const updated = await UsersService.getUserProfile(db, 6)
    assert.equal(updated.title, 'محامية أولى — عمال')

    // Lawyer tries to promote self to partner -> ignored (retains lawyer role)
    await UsersService.updateUser(db, 6, { role: 'partner' }, regularLawyer)
    const checkRole = await UsersService.getUserProfile(db, 6)
    assert.equal(checkRole.role, 'lawyer')

    // Managing Partner promotes lawyer -> allowed
    await UsersService.updateUser(db, 6, { role: 'senior' }, managingPartner)
    const promotedRole = await UsersService.getUserProfile(db, 6)
    assert.equal(promotedRole.role, 'senior')
  })

  await t.test('updateUser verifies current password when regular user changes password', async () => {
    const user = { id: 5, role: 'lawyer' }

    // Missing current password
    await assert.rejects(
      async () => {
        await UsersService.updateUser(db, 5, { password: 'newpassword123' }, user)
      },
      { message: 'يرجى إدخال كلمة المرور الحالية لتغيير كلمة المرور' }
    )

    // Incorrect current password
    await assert.rejects(
      async () => {
        await UsersService.updateUser(
          db,
          5,
          { current_password: 'wrongpassword', password: 'newpassword123' },
          user
        )
      },
      { message: 'كلمة المرور الحالية غير صحيحة' }
    )

    // Correct current password (sharif2026) -> succeeds
    await UsersService.updateUser(
      db,
      5,
      { current_password: 'sharif2026', password: 'newpassword123' },
      user
    )

    const updatedUser = await db.prepare(`SELECT password_hash FROM users WHERE id = 5`).first()
    assert.equal(await verifyPassword('newpassword123', updatedUser.password_hash), true)
  })
})
