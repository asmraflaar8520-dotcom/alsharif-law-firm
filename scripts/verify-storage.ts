import { ensureDatabaseInitialized, getD1Database, getLibSqlClient } from '../src/db'
import { runMigrations } from '../src/db/migrations'
import { StorageService } from '../src/storage'
import { DocumentsService } from '../src/services/documents.service'

async function runStorageVerification() {
  console.log('================================================================');
  console.log('🚀 Phase 2 Pre-Flight Verification: Real File & Storage Pipeline');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // 1. Initialize DB & Migrations
  console.log('Step 1: Initializing Database & Executing Schema Migrations...');
  await ensureDatabaseInitialized();
  const client = getLibSqlClient();
  await runMigrations(client);
  const db = getD1Database() as unknown as D1Database;
  console.log('  Database and migrations verified.\n');

  // 2. Security Validation Tests
  console.log('Step 2: Server-side Security & MIME Type Validation...');
  const validPdfCheck = StorageService.validateFile(1024, 'application/pdf', 'contract.pdf');
  assert(validPdfCheck.valid, 'Valid PDF passes validation');

  const validPngCheck = StorageService.validateFile(2048, 'image/png', 'stamp.png');
  assert(validPngCheck.valid, 'Valid PNG passes validation');

  const validJpgCheck = StorageService.validateFile(2048, 'image/jpeg', 'photo.jpg');
  assert(validJpgCheck.valid, 'Valid JPEG passes validation');

  const invalidMimeCheck = StorageService.validateFile(1024, 'application/x-msdownload', 'virus.exe');
  assert(!invalidMimeCheck.valid, 'Disallowed MIME type (EXE) rejected');

  const mismatchExtCheck = StorageService.validateFile(1024, 'application/pdf', 'fake.png');
  assert(!mismatchExtCheck.valid, 'Mismatched extension/MIME rejected');

  const oversizedCheck = StorageService.validateFile(16 * 1024 * 1024, 'application/pdf', 'huge.pdf');
  assert(!oversizedCheck.valid, 'Oversized file (> 15MB) rejected');

  const zeroSizeCheck = StorageService.validateFile(0, 'application/pdf', 'empty.pdf');
  assert(!zeroSizeCheck.valid, 'Zero byte file rejected');
  console.log('');

  // 3. Filename Sanitization & Path Traversal Prevention
  console.log('Step 3: Path Traversal Prevention & Filename Sanitization...');
  const cleanName1 = StorageService.sanitizeFilename('../../etc/passwd.pdf');
  assert(!cleanName1.includes('..') && !cleanName1.includes('/'), 'Path traversal characters stripped from filename');

  const cleanName2 = StorageService.sanitizeFilename('عقد_بيع_شقة_2026.pdf');
  assert(cleanName2.includes('عقد_بيع_شقة_2026.pdf'), 'Arabic characters preserved in filename');
  console.log('');

  // 4. PDF Document Upload, Database Persistence & Retrieval
  console.log('Step 4: PDF Document Upload & Database Metadata Persistence...');
  const samplePdfBytes = Buffer.from('%PDF-1.5\n%Legal Pleading Content Sample\n%%EOF');
  const uploadDocResult = await StorageService.uploadFile({
    buffer: samplePdfBytes,
    filename: 'pleading_appeal_124.pdf',
    mimeType: 'application/pdf',
    folder: 'documents'
  });

  assert(!!uploadDocResult.storage_key, 'Storage key generated for uploaded PDF');
  assert(uploadDocResult.file_size === samplePdfBytes.length, 'Reported file size matches uploaded buffer');
  assert(uploadDocResult.mime_type === 'application/pdf', 'MIME type preserved');

  const docId = await DocumentsService.createDocument(
    db,
    {
      title: 'صحيفة استئناف رقم 124 لسنة 2026',
      doc_type: 'صحيفة',
      ref_no: 'REF-2026-001',
      date_issued: '2026-10-18',
      pages: 12,
      notes: 'تم إيداع أصل الصحيفة بقلم كتاب المحكمة',
      file_url: uploadDocResult.file_url,
      file_name: uploadDocResult.file_name,
      file_size: uploadDocResult.file_size,
      mime_type: uploadDocResult.mime_type,
      storage_key: uploadDocResult.storage_key
    },
    1 // Admin user ID
  );

  assert(docId > 0, 'Document record created in database');

  const retrievedDoc = await DocumentsService.getDocumentById(db, docId);
  assert(retrievedDoc !== null, 'Document retrieved by ID');
  assert(retrievedDoc.file_url === uploadDocResult.file_url, 'Persisted file_url matches');
  assert(retrievedDoc.file_name === uploadDocResult.file_name, 'Persisted file_name matches');
  assert(retrievedDoc.storage_key === uploadDocResult.storage_key, 'Persisted storage_key matches');
  assert(retrievedDoc.mime_type === 'application/pdf', 'Persisted mime_type matches');

  // Verify binary retrieval
  const retrievedPdfFile = await StorageService.getFile(uploadDocResult.storage_key);
  assert(retrievedPdfFile !== null, 'File successfully retrieved from storage backend');
  assert(retrievedPdfFile?.data.toString() === samplePdfBytes.toString(), 'Retrieved file buffer matches original bytes');
  console.log('');

  // 5. POA Scan Upload, Persistence & Update
  console.log('Step 5: Power of Attorney (POA) Scan Upload & Persistence...');
  // Minimal 1x1 valid PNG
  const samplePngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const uploadPoaResult = await StorageService.uploadFile({
    buffer: samplePngBytes,
    filename: 'poa_scan_789.png',
    mimeType: 'image/png',
    folder: 'poas'
  });

  // Ensure a test client exists
  const existingClient = await db.prepare('SELECT id FROM clients LIMIT 1').first<any>();
  let clientId = existingClient?.id;
  if (!clientId) {
    const cRes = await db.prepare('INSERT INTO clients (name, type, phone) VALUES (?, ?, ?)').bind('شركة النور للمقاولات', 'شركة', '01012345678').run();
    clientId = cRes.meta.last_row_id;
  }

  const poaId = await DocumentsService.createPoa(
    db,
    {
      poa_no: 'توكيل_9988_عام_2026',
      client_id: clientId,
      type: 'عام قضايا',
      notary_office: 'توثيق قصر النيل النموذجي',
      issue_date: '2026-01-15',
      expiry_date: '2028-01-15',
      status: 'ساري',
      scope: 'المرافعة والصلح والإقرار أمام المحاكم',
      file_url: uploadPoaResult.file_url,
      file_name: uploadPoaResult.file_name,
      file_size: uploadPoaResult.file_size,
      mime_type: uploadPoaResult.mime_type,
      storage_key: uploadPoaResult.storage_key
    },
    1
  );

  assert(poaId > 0, 'POA record created in database');

  const retrievedPoa = await DocumentsService.getPoaById(db, poaId);
  assert(retrievedPoa !== null, 'POA retrieved by ID');
  assert(retrievedPoa.file_url === uploadPoaResult.file_url, 'POA persisted file_url matches');
  assert(retrievedPoa.storage_key === uploadPoaResult.storage_key, 'POA persisted storage_key matches');

  // Verify binary retrieval for image
  const retrievedPngFile = await StorageService.getFile(uploadPoaResult.storage_key);
  assert(retrievedPngFile !== null, 'POA scan image successfully retrieved from storage');
  assert(retrievedPngFile?.data.length === samplePngBytes.length, 'Retrieved image buffer length matches');
  console.log('');

  // 6. Cleanup Verification
  console.log('Step 6: Cleaning up test artifacts...');
  const deletedDoc = await StorageService.deleteFile(uploadDocResult.storage_key);
  const deletedPoa = await StorageService.deleteFile(uploadPoaResult.storage_key);
  assert(deletedDoc && deletedPoa, 'Storage test files cleanly deleted');
  console.log('');

  console.log('================================================================');
  console.log(`🎉 ALL STORAGE VERIFICATION TESTS PASSED (${passedTests}/${totalTests})`);
  console.log('================================================================\n');
}

runStorageVerification().catch((err) => {
  console.error('\n❌ Fatal Verification Error:', err);
  process.exit(1);
});
