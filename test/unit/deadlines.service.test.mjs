import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateAppealDueDate,
  calculateRemainingDays,
  getDeadlineAlertLevel,
  APPEAL_RULES,
  DeadlinesService
} from '../../src/services/deadlines.service.ts'
import { createSqliteD1 } from '../../src/utils/d1-sqlite.ts'

test('Egyptian Statutory Appeal Deadlines Unit Test Suite', async (t) => {
  let db

  t.beforeEach(() => {
    db = createSqliteD1(':memory:', true)
  })

  await t.test('All 5 statutory appeal deadlines exist with correct legal rules and days count', () => {
    assert.equal(APPEAL_RULES.civil_appeal.days, 40)
    assert.match(APPEAL_RULES.civil_appeal.lawReference, /المادة 227/)

    assert.equal(APPEAL_RULES.urgent_appeal.days, 15)
    assert.match(APPEAL_RULES.urgent_appeal.lawReference, /المادة 227/)

    assert.equal(APPEAL_RULES.misdemeanor_appeal.days, 10)
    assert.match(APPEAL_RULES.misdemeanor_appeal.lawReference, /المادة 406/)

    assert.equal(APPEAL_RULES.cassation.days, 60)
    assert.match(APPEAL_RULES.cassation.lawReference, /المادة 34/)

    assert.equal(APPEAL_RULES.administrative_supreme.days, 60)
    assert.match(APPEAL_RULES.administrative_supreme.lawReference, /المادة 44/)
  })

  await t.test('calculateAppealDueDate computes statutory appeal deadlines accurately (Day of judgment excluded)', () => {
    // 1. Civil appeal: 40 days (May 1 -> June 10)
    assert.equal(calculateAppealDueDate('2026-05-01', 'civil_appeal'), '2026-06-10')

    // 2. Urgent appeal: 15 days (May 1 -> May 16)
    assert.equal(calculateAppealDueDate('2026-05-01', 'urgent_appeal'), '2026-05-16')

    // 3. Misdemeanor appeal: 10 days (May 1 -> May 11)
    assert.equal(calculateAppealDueDate('2026-05-01', 'misdemeanor_appeal'), '2026-05-11')

    // 4. Cassation: 60 days (May 1 -> June 30)
    assert.equal(calculateAppealDueDate('2026-05-01', 'cassation'), '2026-06-30')

    // 5. High Administrative Court: 60 days (May 1 -> June 30)
    assert.equal(calculateAppealDueDate('2026-05-01', 'administrative_supreme'), '2026-06-30')

    // 6. Leap year test: Feb 15 2024 (leap year, 29 days) + 15 days urgent appeal = March 1 2024
    assert.equal(calculateAppealDueDate('2024-02-15', 'urgent_appeal'), '2024-03-01')

    // 7. Non-leap year test: Feb 15 2023 (28 days) + 15 days urgent appeal = March 2 2023
    assert.equal(calculateAppealDueDate('2023-02-15', 'urgent_appeal'), '2023-03-02')
  })

  await t.test('calculateAppealDueDate rejects unknown deadline types and invalid formats', () => {
    assert.throws(() => calculateAppealDueDate('2026-05-01', 'invalid_type'), /غير معتمد/)
    assert.throws(() => calculateAppealDueDate('invalid-date', 'civil_appeal'), /غير صالحة/)
  })

  await t.test('calculateRemainingDays computes day difference correctly', () => {
    assert.equal(calculateRemainingDays('2026-05-10', '2026-05-05'), 5)
    assert.equal(calculateRemainingDays('2026-05-05', '2026-05-05'), 0)
    assert.equal(calculateRemainingDays('2026-05-01', '2026-05-05'), -4)
  })

  await t.test('getDeadlineAlertLevel classifies urgency correctly', () => {
    // Filed is always safe
    assert.equal(getDeadlineAlertLevel('2026-05-01', 'filed', '2026-05-05'), 'safe')

    // Past due date is expired
    assert.equal(getDeadlineAlertLevel('2026-05-04', 'pending', '2026-05-05'), 'expired')

    // <= 3 days is urgent (Red Alert)
    assert.equal(getDeadlineAlertLevel('2026-05-05', 'pending', '2026-05-05'), 'urgent') // 0 days
    assert.equal(getDeadlineAlertLevel('2026-05-07', 'pending', '2026-05-05'), 'urgent') // 2 days
    assert.equal(getDeadlineAlertLevel('2026-05-08', 'pending', '2026-05-05'), 'urgent') // 3 days

    // 4-7 days is warning (Yellow Alert)
    assert.equal(getDeadlineAlertLevel('2026-05-09', 'pending', '2026-05-05'), 'warning') // 4 days
    assert.equal(getDeadlineAlertLevel('2026-05-12', 'pending', '2026-05-05'), 'warning') // 7 days

    // > 7 days is safe
    assert.equal(getDeadlineAlertLevel('2026-05-13', 'pending', '2026-05-05'), 'safe') // 8 days
  })

  await t.test('DeadlinesService database lifecycle: create, get, radar, update status, and delete', async () => {
    // 1. Create a deadline for case 1
    const created = await DeadlinesService.createDeadline(
      db,
      {
        case_id: 1,
        deadline_type: 'civil_appeal',
        judgment_date: '2026-09-01',
        notes: 'حكم صادر في الدائرة التجارية'
      },
      1
    )

    assert.ok(created.id > 0)
    assert.equal(created.case_id, 1)
    assert.equal(created.deadline_type, 'civil_appeal')
    assert.equal(created.judgment_date, '2026-09-01')
    // Sept has 30 days. Sept 1 + 40 days = Oct 11
    assert.equal(created.due_date, '2026-10-11')
    assert.equal(created.status, 'pending')
    assert.ok(created.client_name)

    // 2. Fetch list of deadlines
    const list = await DeadlinesService.getDeadlines(db, { case_id: 1 })
    assert.ok(list.length >= 1)
    const found = list.find((d) => d.id === created.id)
    assert.ok(found)
    assert.equal(found.deadline_label, 'استئناف مدني')

    // 3. Create an urgent deadline (e.g. 2 days from now)
    const today = new Date()
    const twoDaysBefore = new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const urgent = await DeadlinesService.createDeadline(
      db,
      {
        case_id: 1,
        deadline_type: 'misdemeanor_appeal', // 10 days -> due in 2 days
        judgment_date: twoDaysBefore,
        notes: 'مستعجل جداً'
      },
      1
    )

    // 4. Test Radar Deadlines
    const radar = await DeadlinesService.getRadarDeadlines(db)
    assert.ok(radar.total_pending >= 2)
    const inUrgent = radar.urgent.find((u) => u.id === urgent.id)
    assert.ok(inUrgent, 'Urgent deadline should appear in radar urgent list')

    // 5. Update status to "filed" (تم قيد الطعن)
    const updated = await DeadlinesService.updateDeadlineStatus(db, urgent.id, 'filed', 'قُيّد برقم 441 استئناف')
    assert.equal(updated, true)

    // Verify it is no longer in radar
    const radarAfter = await DeadlinesService.getRadarDeadlines(db)
    const stillInUrgent = radarAfter.urgent.find((u) => u.id === urgent.id)
    assert.equal(stillInUrgent, undefined, 'Filed deadline must not appear in radar')

    // 6. Delete deadline
    const deleted = await DeadlinesService.deleteDeadline(db, created.id)
    assert.equal(deleted, true)
    const listAfter = await DeadlinesService.getDeadlines(db, { case_id: 1 })
    assert.equal(listAfter.find((d) => d.id === created.id), undefined)
  })
})
