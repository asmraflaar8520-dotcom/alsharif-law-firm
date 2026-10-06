import test from 'node:test'
import assert from 'node:assert/strict'
import { TasksService } from '../../src/services/tasks.service.ts'
import { createSqliteD1 } from '../../src/utils/d1-sqlite.ts'

test('TasksService Unit Test Suite', async (t) => {
  let db

  t.beforeEach(() => {
    db = createSqliteD1(':memory:', true)
  })

  await t.test('getTasks returns task list with assignee and case details', async () => {
    const tasks = await TasksService.getTasks(db)
    assert.ok(Array.isArray(tasks))
    assert.ok(tasks.length > 0)
    assert.ok(tasks[0].title)
  })

  await t.test('getTasks filters by status, assignee, and mine flag', async () => {
    const inProgress = await TasksService.getTasks(db, { status: 'جارية' })
    assert.ok(inProgress.every((t) => t.status === 'جارية'))

    const assigned = await TasksService.getTasks(db, { assignee: 2 })
    assert.ok(assigned.every((t) => t.assignee_id === 2))

    const myTasks = await TasksService.getTasks(db, { mine: true, currentUserId: 2 })
    assert.ok(myTasks.every((t) => t.assignee_id === 2))
  })

  await t.test('createTask validates required title', async () => {
    await assert.rejects(
      async () => {
        await TasksService.createTask(db, { title: '' }, 1)
      },
      { message: 'عنوان المهمة مطلوب' }
    )
  })

  await t.test('createTask sets defaults and creator_id', async () => {
    const id = await TasksService.createTask(
      db,
      {
        title: 'مراجعة حافظة المستندات',
        case_id: 1,
        priority: 'عاجلة',
        due_date: '2026-10-25'
      },
      1
    )

    assert.ok(id)
    const tasks = await TasksService.getTasks(db)
    const task = tasks.find((t) => t.id === id)
    assert.equal(task.title, 'مراجعة حافظة المستندات')
    assert.equal(task.priority, 'عاجلة')
    assert.equal(task.status, 'مفتوحة')
    assert.equal(task.creator_id, 1)
  })

  await t.test('updateTask updates details and marks completed_at when completed', async () => {
    await TasksService.updateTask(db, 1, {
      status: 'مكتملة',
      priority: 'عالية'
    })

    const tasks = await TasksService.getTasks(db)
    const task = tasks.find((t) => t.id === 1)
    assert.equal(task.status, 'مكتملة')
    assert.equal(task.priority, 'عالية')
    assert.ok(task.completed_at, 'completed_at timestamp should be set')

    await assert.rejects(
      async () => {
        await TasksService.updateTask(db, 99999, { status: 'مكتملة' })
      },
      { message: 'المهمة غير موجودة' }
    )
  })
})
