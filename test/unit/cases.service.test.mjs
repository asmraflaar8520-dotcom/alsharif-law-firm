import test from 'node:test'
import assert from 'node:assert/strict'
import { CasesService } from '../../src/services/cases.service.ts'
import { createSqliteD1 } from '../../src/utils/d1-sqlite.ts'

test('CasesService Unit Test Suite', async (t) => {
  let db

  t.beforeEach(() => {
    db = createSqliteD1(':memory:', true)
  })

  await t.test('getCases returns seeded cases with client and lawyer info', async () => {
    const cases = await CasesService.getCases(db)
    assert.ok(Array.isArray(cases))
    assert.ok(cases.length > 0)
    assert.ok(cases[0].client_name)
    assert.ok(cases[0].case_no)
  })

  await t.test('getCases filters by search query q', async () => {
    const cases = await CasesService.getCases(db, { q: 'أطلس' })
    assert.ok(cases.length >= 1)
    assert.match(cases[0].title, /أطلس/)
  })

  await t.test('getCases filters by status and priority', async () => {
    const openCases = await CasesService.getCases(db, { status: 'متداولة' })
    assert.ok(openCases.every((c) => c.status === 'متداولة'))

    const urgentCases = await CasesService.getCases(db, { priority: 'عاجلة' })
    assert.ok(urgentCases.every((c) => c.priority === 'عاجلة'))
  })

  await t.test('getCaseById returns complete dossier with all relations', async () => {
    const dossier = await CasesService.getCaseById(db, 1)
    assert.ok(dossier)
    assert.equal(dossier.id, 1)
    assert.equal(dossier.case_no, '1842')
    assert.ok(Array.isArray(dossier.hearings))
    assert.ok(Array.isArray(dossier.documents))
    assert.ok(Array.isArray(dossier.notes))
    assert.ok(Array.isArray(dossier.lawyers))
    assert.ok(Array.isArray(dossier.invoices))
    assert.ok(Array.isArray(dossier.expenses))
    assert.ok(Array.isArray(dossier.time_entries))
    assert.ok(Array.isArray(dossier.tasks))
    assert.ok(Array.isArray(dossier.poas))
  })

  await t.test('getCaseById returns null for unknown case', async () => {
    const dossier = await CasesService.getCaseById(db, 99999)
    assert.equal(dossier, null)
  })

  await t.test('createCase validates required fields', async () => {
    await assert.rejects(
      async () => {
        await CasesService.createCase(db, { title: 'قضية ناقصة' }, 1)
      },
      { message: 'رقم الدعوى والسنة وعنوان الدعوى والموكل حقول إجبارية' }
    )
  })

  await t.test('createCase inserts case and assigns lead lawyer', async () => {
    const newId = await CasesService.createCase(
      db,
      {
        case_no: '9901',
        year: 2026,
        title: 'دعوى تعويض مدني جديدة',
        client_id: 1,
        degree: 'ابتدائي',
        priority: 'عالية',
        claim_value: 500000,
        currency: 'EGP',
        lead_lawyer_id: 2
      },
      1
    )

    assert.ok(newId)
    const created = await CasesService.getCaseById(db, newId)
    assert.equal(created.case_no, '9901')
    assert.equal(created.year, 2026)
    assert.equal(created.title, 'دعوى تعويض مدني جديدة')
    assert.equal(created.lead_lawyer_id, 2)
    assert.ok(created.lawyers.some((l) => l.id === 2 && l.role === 'رئيس'))
  })

  await t.test('updateCase updates fields and throws if case not found', async () => {
    const updated = await CasesService.updateCase(
      db,
      1,
      { next_action: 'إيداع مذكرة الدفاع قبل جلسة الأحد' },
      1
    )
    assert.equal(updated, true)

    const check = await CasesService.getCaseById(db, 1)
    assert.equal(check.next_action, 'إيداع مذكرة الدفاع قبل جلسة الأحد')

    await assert.rejects(
      async () => {
        await CasesService.updateCase(db, 99999, { title: 'test' }, 1)
      },
      { message: 'القضية غير موجودة' }
    )
  })

  await t.test('assignLawyer adds secondary lawyer to case team', async () => {
    await CasesService.assignLawyer(db, 1, 3, 'مستشار جنائي')
    const caseData = await CasesService.getCaseById(db, 1)
    assert.ok(caseData.lawyers.some((l) => l.id === 3 && l.role === 'مستشار جنائي'))
  })

  await t.test('getHearings filters by date and status', async () => {
    const allHearings = await CasesService.getHearings(db)
    assert.ok(Array.isArray(allHearings))
    assert.ok(allHearings.length > 0)

    const upcoming = await CasesService.getHearings(db, { status: 'قادمة' })
    assert.ok(upcoming.every((h) => h.status === 'قادمة'))
  })

  await t.test('scheduleHearing schedules court session', async () => {
    const hearingId = await CasesService.scheduleHearing(
      db,
      {
        case_id: 1,
        hearing_date: '2026-11-15',
        hearing_time: '10:30',
        court_id: 1,
        type: 'مرافعة',
        purpose: 'تقديم مذكرات الدفاع',
        lawyer_id: 2
      },
      1
    )

    assert.ok(hearingId)
    const hearings = await CasesService.getHearings(db, { from: '2026-11-01', to: '2026-11-30' })
    assert.ok(hearings.some((h) => h.id === hearingId))
  })

  await t.test('updateHearing updates result and status', async () => {
    await CasesService.updateHearing(db, 1, {
      result: 'حجزت للحكم لجلسة الشهر القادم',
      status: 'حجز للحكم'
    })

    const hearings = await CasesService.getHearings(db)
    const hearing = hearings.find((h) => h.id === 1)
    assert.equal(hearing.result, 'حجزت للحكم لجلسة الشهر القادم')
    assert.equal(hearing.status, 'حجز للحكم')
  })
})
