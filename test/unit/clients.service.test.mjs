import test from 'node:test'
import assert from 'node:assert/strict'
import { ClientsService } from '../../src/services/clients.service.ts'
import { createSqliteD1 } from '../../src/utils/d1-sqlite.ts'

test('ClientsService Unit Test Suite', async (t) => {
  let db

  t.beforeEach(() => {
    db = createSqliteD1(':memory:', true)
  })

  await t.test('getClients returns client list with calculated cases_count and balance', async () => {
    const clients = await ClientsService.getClients(db)
    assert.ok(Array.isArray(clients))
    assert.ok(clients.length > 0)
    assert.ok(typeof clients[0].cases_count === 'number')
    assert.ok(typeof clients[0].balance === 'number')
  })

  await t.test('getClients filters by query q and status', async () => {
    const nile = await ClientsService.getClients(db, { q: 'النيل' })
    assert.ok(nile.length >= 1)
    assert.match(nile[0].name, /النيل/)

    const vips = await ClientsService.getClients(db, { status: 'vip' })
    assert.ok(vips.every((c) => c.status === 'vip'))
  })

  await t.test('getClientById returns full dossier with linked relations', async () => {
    const client = await ClientsService.getClientById(db, 1)
    assert.ok(client)
    assert.equal(client.id, 1)
    assert.equal(client.name, 'مجموعة النيل القابضة ش.م.م')
    assert.ok(Array.isArray(client.cases))
    assert.ok(Array.isArray(client.invoices))
    assert.ok(Array.isArray(client.poas))
    assert.ok(Array.isArray(client.notes))
  })

  await t.test('getClientById returns null for invalid client', async () => {
    const client = await ClientsService.getClientById(db, 99999)
    assert.equal(client, null)
  })

  await t.test('createClient validates required name', async () => {
    await assert.rejects(
      async () => {
        await ClientsService.createClient(db, { phone: '01000000000' }, 1)
      },
      { message: 'اسم الموكل مطلوب' }
    )
  })

  await t.test('createClient registers individual and company clients', async () => {
    const id = await ClientsService.createClient(
      db,
      {
        name: 'شركة الأفق للتطوير العمراني',
        type: 'company',
        commercial_reg: '654321',
        tax_id: '987-654-321',
        phone: '01012345678',
        city: 'القاهرة',
        status: 'vip'
      },
      1
    )

    assert.ok(id)
    const client = await ClientsService.getClientById(db, id)
    assert.equal(client.name, 'شركة الأفق للتطوير العمراني')
    assert.equal(client.type, 'company')
    assert.equal(client.status, 'vip')
  })

  await t.test('updateClient performs safe partial updates', async () => {
    await ClientsService.updateClient(db, 1, { city: 'الشيخ زايد' }, 1)

    const updated = await ClientsService.getClientById(db, 1)
    assert.equal(updated.city, 'الشيخ زايد')
    assert.equal(updated.name, 'مجموعة النيل القابضة ش.م.م', 'Name should be preserved')

    await assert.rejects(
      async () => {
        await ClientsService.updateClient(db, 99999, { city: 'test' }, 1)
      },
      { message: 'الموكل غير موجود' }
    )
  })
})
