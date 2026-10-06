import test from 'node:test'
import assert from 'node:assert/strict'
import { DocumentsService } from '../../src/services/documents.service.ts'
import { createSqliteD1 } from '../../src/utils/d1-sqlite.ts'

test('DocumentsService Unit Test Suite', async (t) => {
  let db

  t.beforeEach(() => {
    db = createSqliteD1(':memory:', true)
  })

  await t.test('getDocuments returns electronic archive records', async () => {
    const docs = await DocumentsService.getDocuments(db)
    assert.ok(Array.isArray(docs))
    assert.ok(docs.length > 0)
    assert.ok(docs[0].title)
  })

  await t.test('createDocument validates title and inserts record', async () => {
    await assert.rejects(
      async () => {
        await DocumentsService.createDocument(db, { title: '' }, 1)
      },
      { message: 'عنوان المستند مطلوب' }
    )

    const docId = await DocumentsService.createDocument(
      db,
      {
        case_id: 1,
        title: 'محضر إيداع تقرير الخبير الحسابي',
        doc_type: 'تقرير',
        pages: 15
      },
      1
    )

    assert.ok(docId)
    const docs = await DocumentsService.getDocuments(db)
    assert.ok(docs.some((d) => d.id === docId && d.title === 'محضر إيداع تقرير الخبير الحسابي'))
  })

  await t.test('getPoas returns powers of attorney list', async () => {
    const poas = await DocumentsService.getPoas(db)
    assert.ok(Array.isArray(poas))
    assert.ok(poas.length > 0)
    assert.ok(poas[0].poa_no)
  })

  await t.test('createPoa validates required poa_no and client_id', async () => {
    await assert.rejects(
      async () => {
        await DocumentsService.createPoa(db, { poa_no: '123' }, 1)
      },
      { message: 'رقم التوكيل والموكل حقول إجبارية' }
    )

    const poaId = await DocumentsService.createPoa(
      db,
      {
        poa_no: '9988 لسنة 2026 توثيق الدقي',
        client_id: 1,
        type: 'عام قضايا',
        notary_office: 'توثيق الدقي',
        issue_date: '2026-05-01',
        expiry_date: '2028-05-01'
      },
      1
    )

    assert.ok(poaId)
    const poas = await DocumentsService.getPoas(db)
    assert.ok(poas.some((p) => p.id === poaId && p.poa_no === '9988 لسنة 2026 توثيق الدقي'))
  })

  await t.test('updatePoa updates status and throws if not found', async () => {
    await DocumentsService.updatePoa(db, 1, { status: 'منتهٍ' }, 1)
    const poas = await DocumentsService.getPoas(db)
    const poa = poas.find((p) => p.id === 1)
    assert.equal(poa.status, 'منتهٍ')

    await assert.rejects(
      async () => {
        await DocumentsService.updatePoa(db, 99999, { status: 'ساري' }, 1)
      },
      { message: 'التوكيل غير موجود' }
    )
  })

  await t.test('createNote appends case/client note with pinned status', async () => {
    await assert.rejects(
      async () => {
        await DocumentsService.createNote(db, { content: '' }, 1)
      },
      { message: 'محتوى الملاحظة مطلوب' }
    )

    const noteId = await DocumentsService.createNote(
      db,
      {
        case_id: 1,
        content: 'تأكيد موعد حضور الخبير الهندسي يوم الخميس القادم',
        pinned: true
      },
      1
    )

    assert.ok(noteId)
    const note = await db.prepare(`SELECT * FROM notes WHERE id = ?`).bind(noteId).first()
    assert.equal(note.content, 'تأكيد موعد حضور الخبير الهندسي يوم الخميس القادم')
    assert.equal(note.pinned, 1)
  })
})
