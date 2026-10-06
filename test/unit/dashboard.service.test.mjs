import test from 'node:test'
import assert from 'node:assert/strict'
import { DashboardService } from '../../src/services/dashboard.service.ts'
import { createSqliteD1 } from '../../src/utils/d1-sqlite.ts'

test('DashboardService Unit Test Suite', async (t) => {
  let db

  t.beforeEach(() => {
    db = createSqliteD1(':memory:', true)
  })

  await t.test('getDashboardMetrics aggregates KPIs and agenda', async () => {
    const user = { id: 1, name: 'أحمد الشريف', role: 'managing_partner' }
    const metrics = await DashboardService.getDashboardMetrics(db, user)

    assert.ok(metrics.kpis)
    assert.ok(typeof metrics.kpis.total_cases === 'number')
    assert.ok(typeof metrics.kpis.open_cases === 'number')
    assert.ok(typeof metrics.kpis.closed_cases === 'number')
    assert.ok(typeof metrics.kpis.urgent_cases === 'number')
    assert.ok(typeof metrics.kpis.open_tasks === 'number')
    assert.ok(typeof metrics.kpis.overdue_invoices === 'number')
    assert.ok(typeof metrics.kpis.month_collected === 'number')

    assert.ok(Array.isArray(metrics.by_status))
    assert.ok(Array.isArray(metrics.by_type))
    assert.ok(Array.isArray(metrics.upcoming_hearings))
    assert.ok(Array.isArray(metrics.activity))
    assert.ok(Array.isArray(metrics.team))
    assert.ok(Array.isArray(metrics.expiring_poa))
  })

  await t.test('getLookups returns reference dictionaries', async () => {
    const lookups = await DashboardService.getLookups(db)

    assert.ok(Array.isArray(lookups.courts) && lookups.courts.length > 0)
    assert.ok(Array.isArray(lookups.case_types) && lookups.case_types.length > 0)
    assert.ok(Array.isArray(lookups.users) && lookups.users.length > 0)
    assert.ok(Array.isArray(lookups.clients) && lookups.clients.length > 0)
    assert.ok(Array.isArray(lookups.cases) && lookups.cases.length > 0)
  })

  await t.test('globalSearch ignores short queries (< 2 chars)', async () => {
    const res = await DashboardService.globalSearch(db, 'a')
    assert.deepEqual(res, { cases: [], clients: [], poas: [] })
  })

  await t.test('globalSearch finds matching cases, clients, and POAs', async () => {
    const res = await DashboardService.globalSearch(db, 'النيل')
    assert.ok(res.clients.length >= 1 || res.cases.length >= 1)

    const poaSearch = await DashboardService.globalSearch(db, 'توثيق')
    assert.ok(poaSearch.poas.length >= 1)
  })
})
