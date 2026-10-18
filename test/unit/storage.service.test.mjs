import test from 'node:test'
import assert from 'node:assert/strict'
import { StorageService } from '../../src/storage/service.ts'
import { DocumentsService } from '../../src/services/documents.service.ts'
import { createSqliteD1 } from '../../src/utils/d1-sqlite.ts'

test('StorageService & Phase 2 Pipeline Unit Tests', async (t) => {
  let db

  t.beforeEach(() => {
    db = createSqliteD1(':memory:', true)
  })

  await t.test('sanitizeFilename removes path traversal and unsafe characters', () => {
    assert.equal(StorageService.sanitizeFilename('../../etc/shadow.pdf'), 'shadow.pdf')
    assert.equal(StorageService.sanitizeFilename('..\\..\\windows\\system32\\cmd.exe'), 'cmd.exe')
    assert.ok(StorageService.sanitizeFilename('صحيفة_دعوى_رقم_12.pdf').includes('صحيفة_دعوى_رقم_12.pdf'))
    assert.equal(StorageService.sanitizeFilename(''), 'document.pdf')
  })

  await t.test('validateFile enforces 15MB limit and allowed MIME types', () => {
    // Valid cases
    assert.ok(StorageService.validateFile(1024, 'application/pdf', 'doc.pdf').valid)
    assert.ok(StorageService.validateFile(2048, 'image/jpeg', 'photo.jpg').valid)
    assert.ok(StorageService.validateFile(4096, 'image/png', 'stamp.png').valid)

    // Invalid size cases
    assert.equal(StorageService.validateFile(0, 'application/pdf', 'empty.pdf').valid, false)
    assert.equal(StorageService.validateFile(16 * 1024 * 1024, 'application/pdf', 'too-big.pdf').valid, false)

    // Disallowed MIME types
    assert.equal(StorageService.validateFile(1024, 'application/x-msdownload', 'bad.exe').valid, false)
    assert.equal(StorageService.validateFile(1024, 'text/html', 'xss.html').valid, false)
    assert.equal(StorageService.validateFile(1024, 'application/javascript', 'script.js').valid, false)

    // MIME / Extension mismatch
    assert.equal(StorageService.validateFile(1024, 'application/pdf', 'fake.png').valid, false)
    assert.equal(StorageService.validateFile(1024, 'image/png', 'fake.pdf').valid, false)
  })

  await t.test('uploadFile, getFile, and deleteFile local storage round-trip', async () => {
    const testContent = Buffer.from('%PDF-1.5\n%Antigravity Phase 2 Storage Test\n%%EOF')
    const uploadRes = await StorageService.uploadFile({
      buffer: testContent,
      filename: 'contract_lease_2026.pdf',
      mimeType: 'application/pdf',
      folder: 'test_docs'
    })

    assert.ok(uploadRes.storage_key)
    assert.ok(uploadRes.file_url.includes(uploadRes.storage_key))
    assert.equal(uploadRes.file_size, testContent.length)
    assert.equal(uploadRes.mime_type, 'application/pdf')

    // Retrieve file
    const fileResult = await StorageService.getFile(uploadRes.storage_key)
    assert.ok(fileResult)
    assert.equal(fileResult.data.toString(), testContent.toString())
    assert.equal(fileResult.mimeType, 'application/pdf')

    // Prevent path traversal on retrieval
    await assert.rejects(
      async () => {
        await StorageService.getFile('../../../etc/passwd')
      },
      { message: 'مسار غير مصرح به' }
    )

    // Delete file
    const deleted = await StorageService.deleteFile(uploadRes.storage_key)
    assert.equal(deleted, true)

    // Verify gone
    const afterDelete = await StorageService.getFile(uploadRes.storage_key)
    assert.equal(afterDelete, null)
  })

  await t.test('DocumentsService persists and retrieves file metadata', async () => {
    const docId = await DocumentsService.createDocument(
      db,
      {
        title: 'عقد استشارات سنوي',
        doc_type: 'عقد',
        file_url: '/api/files/documents/sample-contract.pdf',
        file_name: 'sample-contract.pdf',
        file_size: 45020,
        mime_type: 'application/pdf',
        storage_key: 'documents/sample-contract.pdf'
      },
      1
    )

    assert.ok(docId)
    const doc = await DocumentsService.getDocumentById(db, docId)
    assert.ok(doc)
    assert.equal(doc.title, 'عقد استشارات سنوي')
    assert.equal(doc.file_url, '/api/files/documents/sample-contract.pdf')
    assert.equal(doc.file_name, 'sample-contract.pdf')
    assert.equal(doc.file_size, 45020)
    assert.equal(doc.mime_type, 'application/pdf')
    assert.equal(doc.storage_key, 'documents/sample-contract.pdf')
  })

  await t.test('DocumentsService persists and updates POA file metadata', async () => {
    const poaId = await DocumentsService.createPoa(
      db,
      {
        poa_no: 'توكيل_رسمي_7711_لسنة_2026',
        client_id: 1,
        type: 'رسمي عام',
        status: 'ساري',
        file_url: '/api/files/poas/poa-scan.png',
        file_name: 'poa-scan.png',
        file_size: 120500,
        mime_type: 'image/png',
        storage_key: 'poas/poa-scan.png'
      },
      1
    )

    assert.ok(poaId)
    const poa = await DocumentsService.getPoaById(db, poaId)
    assert.ok(poa)
    assert.equal(poa.file_url, '/api/files/poas/poa-scan.png')
    assert.equal(poa.storage_key, 'poas/poa-scan.png')

    // Update POA file metadata
    await DocumentsService.updatePoa(
      db,
      poaId,
      {
        file_url: '/api/files/poas/poa-scan-updated.pdf',
        file_name: 'poa-scan-updated.pdf',
        file_size: 180000,
        mime_type: 'application/pdf',
        storage_key: 'poas/poa-scan-updated.pdf'
      },
      1
    )

    const updatedPoa = await DocumentsService.getPoaById(db, poaId)
    assert.equal(updatedPoa.file_url, '/api/files/poas/poa-scan-updated.pdf')
    assert.equal(updatedPoa.file_name, 'poa-scan-updated.pdf')
    assert.equal(updatedPoa.mime_type, 'application/pdf')
    assert.equal(updatedPoa.storage_key, 'poas/poa-scan-updated.pdf')
  })
})
