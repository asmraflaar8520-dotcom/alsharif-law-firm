import test from 'node:test'
import assert from 'node:assert/strict'
import { CasesService } from '../../src/services/cases.service.ts'
import { ClientsService } from '../../src/services/clients.service.ts'
import { DocumentsService } from '../../src/services/documents.service.ts'
import { createSqliteD1 } from '../../src/utils/d1-sqlite.ts'
import { parsePaginationParams, createPaginationEnvelope } from '../../src/utils/pagination.ts'

test('Phase 3 Pagination & Search Service Unit Tests', async (t) => {
  let db

  t.beforeEach(() => {
    db = createSqliteD1(':memory:', true)
  })

  await t.test('parsePaginationParams enforces defaults and clamps', () => {
    const p1 = parsePaginationParams({})
    assert.equal(p1.page, 1)
    assert.equal(p1.limit, 20)
    assert.equal(p1.offset, 0)
    assert.equal(p1.search, '')

    const p2 = parsePaginationParams({ page: -10, limit: 999, q: '  بحث تجريبي  ' })
    assert.equal(p2.page, 1)
    assert.equal(p2.limit, 100)
    assert.equal(p2.offset, 0)
    assert.equal(p2.search, 'بحث تجريبي')
  })

  await t.test('createPaginationEnvelope builds standard envelope', () => {
    const env = createPaginationEnvelope([{ id: 1 }, { id: 2 }], 45, 1, 20)
    assert.equal(env.data.length, 2)
    assert.equal(env.pagination.total, 45)
    assert.equal(env.pagination.page, 1)
    assert.equal(env.pagination.limit, 20)
    assert.equal(env.pagination.totalPages, 3)
    assert.equal(env.pagination.hasMore, true)

    const envLast = createPaginationEnvelope([{ id: 45 }], 45, 3, 20)
    assert.equal(envLast.pagination.hasMore, false)
  })

  await t.test('CasesService.getPaginatedCases paginates and filters', async () => {
    const page1 = await CasesService.getPaginatedCases(db, { page: 1, limit: 2 })
    assert.ok(Array.isArray(page1.data))
    assert.equal(page1.data.length, 2)
    assert.equal(page1.pagination.page, 1)
    assert.ok(page1.pagination.total >= 3)
    assert.equal(page1.pagination.hasMore, true)

    const page2 = await CasesService.getPaginatedCases(db, { page: 2, limit: 2 })
    assert.equal(page2.pagination.page, 2)
    assert.notEqual(page1.data[0].id, page2.data[0].id)

    // Filter by search
    const searchRes = await CasesService.getPaginatedCases(db, { search: 'أطلس' })
    assert.ok(searchRes.data.length >= 1)
    assert.match(searchRes.data[0].title, /أطلس/)
  })

  await t.test('ClientsService.getPaginatedClients paginates and filters', async () => {
    const page1 = await ClientsService.getPaginatedClients(db, { page: 1, limit: 2 })
    assert.ok(Array.isArray(page1.data))
    assert.equal(page1.data.length, 2)
    assert.equal(page1.pagination.page, 1)

    const page2 = await ClientsService.getPaginatedClients(db, { page: 2, limit: 2 })
    assert.notEqual(page1.data[0].id, page2.data[0].id)

    const qRes = await ClientsService.getPaginatedClients(db, { q: 'النيل' })
    assert.ok(qRes.data.length >= 1)
    assert.match(qRes.data[0].name, /النيل/)
  })

  await t.test('DocumentsService.getPaginatedDocuments paginates and filters', async () => {
    const page1 = await DocumentsService.getPaginatedDocuments(db, { page: 1, limit: 2 })
    assert.ok(Array.isArray(page1.data))
    assert.equal(page1.pagination.page, 1)
    assert.equal(page1.pagination.limit, 2)
  })

  await t.test('CasesService.getPaginatedHearings paginates and filters', async () => {
    const page1 = await CasesService.getPaginatedHearings(db, { page: 1, limit: 2 })
    assert.ok(Array.isArray(page1.data))
    assert.equal(page1.pagination.page, 1)
  })

  await t.test('Out-of-bounds page returns empty data and hasMore false', async () => {
    const out = await CasesService.getPaginatedCases(db, { page: 999, limit: 20 })
    assert.equal(out.data.length, 0)
    assert.equal(out.pagination.hasMore, false)
    assert.ok(out.pagination.total > 0)
  })
})
