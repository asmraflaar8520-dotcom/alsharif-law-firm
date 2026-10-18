import assert from 'node:assert/strict'
import {
  getLibSqlClient,
  getD1Database,
  ensureDatabaseInitialized,
  closeDatabase,
  getDatabaseConfig
} from '../src/db'

async function runVerification() {
  console.log('======================================================================')
  console.log('   MANDATORY DATABASE PERSISTENCE & ARCHITECTURE VERIFICATION TEST   ')
  console.log('======================================================================')

  const config = getDatabaseConfig()
  console.log(`\n[Step 1: Connection & Protocol Check]`)
  console.log(`- Connection URL: ${config.url.replace(/:[^:]*@/, ':***@')}`)
  console.log(`- Mode: ${config.isRemote ? 'Remote Serverless Database' : 'Local Persistent Storage (File-backed)'}`)

  // a) Connecting successfully to the database
  const client1 = getLibSqlClient()
  const ping = await client1.execute('SELECT 1 as ping, sqlite_version() as version;')
  assert.equal(ping.rows[0]?.ping, 1, 'Ping query must return 1')
  console.log(`✅ a) Successfully connected! SQLite Engine Version: ${ping.rows[0]?.version}`)

  // Ensure schema and seeds are initialized
  await ensureDatabaseInitialized(client1)
  console.log('✅ Initialized schema migrations and seed state.')

  console.log(`\n[Step 2: Schema Objects, Constraints & Index Verification]`)
  // Verify essential tables exist
  const tables = await client1.execute(
    `SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%';`
  )
  const tableNames = tables.rows.map((r: any) => String(r.name))
  const requiredTables = ['clients', 'cases', 'hearings', 'documents', 'poas', 'time_entries']
  for (const t of requiredTables) {
    assert.ok(tableNames.includes(t), `Essential table or view '${t}' must exist in schema`)
    console.log(`  ✓ Table/View '${t}' verified`)
  }

  // Verify required indexes exist
  const indexCheck = await client1.execute(
    `SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL;`
  )
  const indexSqls = indexCheck.rows.map((r: any) => ({ name: String(r.name), sql: String(r.sql) }))

  const hasCaseIndex = indexSqls.some((i) =>
    i.sql.includes('cases') && (i.sql.includes('case_number') || i.sql.includes('case_no')) && i.sql.includes('client_id')
  )
  assert.ok(hasCaseIndex, 'Index on cases(case_number, client_id) must exist')
  console.log(`  ✓ Required Index: cases(case_number, client_id) verified`)

  const hasHearingIndex = indexSqls.some((i) =>
    i.sql.includes('hearings') && i.sql.includes('hearing_date') && i.sql.includes('case_id')
  )
  assert.ok(hasHearingIndex, 'Index on hearings(hearing_date, case_id) must exist')
  console.log(`  ✓ Required Index: hearings(hearing_date, case_id) verified`)

  const hasDocIndex = indexSqls.some((i) =>
    i.sql.includes('documents') && i.sql.includes('case_id')
  )
  assert.ok(hasDocIndex, 'Index on documents(case_id) must exist')
  console.log(`  ✓ Required Index: documents(case_id) verified`)

  console.log(`\n[Step 3: Insert & Query Verification (via D1-compatible Adapter)]`)
  // b) Inserting a test client and case
  const d1 = getD1Database()
  const testEmail = `verify-${Date.now()}@test-enterprise.law`
  const testCaseNo = `VERIFY-CASE-${Date.now()}`

  const clientInsert = await d1.prepare(
    `INSERT INTO clients (name, type, email, phone, status) VALUES (?, ?, ?, ?, ?)`
  ).bind('مؤسسة الصفا للتجارة والاستثمار', 'company', testEmail, '01099998888', 'vip').run()

  const testClientId = clientInsert.meta.last_row_id
  assert.ok(testClientId > 0, 'Test client must have a positive generated ID')
  console.log(`  ✓ b) Inserted test client: ID ${testClientId}`)

  const caseInsert = await d1.prepare(
    `INSERT INTO cases (case_no, year, title, client_id, status, priority, claim_value) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(testCaseNo, 2026, 'قضية التحقق المعماري من ثبات التخزين الدائم', testClientId, 'متداولة', 'عاجلة', 7500000).run()

  const testCaseId = caseInsert.meta.last_row_id
  assert.ok(testCaseId > 0, 'Test case must have a positive generated ID')
  console.log(`  ✓ b) Inserted test case: ID ${testCaseId} linked to client ${testClientId}`)

  // c) Fetching the inserted record
  const fetchedCase = await d1.prepare(
    `SELECT c.id, c.case_no, c.case_number, c.year, c.title, c.claim_value, cl.name as client_name
     FROM cases c
     JOIN clients cl ON cl.id = c.client_id
     WHERE c.id = ?`
  ).bind(testCaseId).first<any>()

  assert.ok(fetchedCase, 'Fetched case must exist')
  assert.equal(fetchedCase.case_no, testCaseNo, 'Case number must match')
  assert.equal(fetchedCase.case_number, testCaseNo, 'Virtual case_number column must match case_no')
  assert.equal(fetchedCase.client_name, 'مؤسسة الصفا للتجارة والاستثمار', 'Joined client name must match')
  console.log(`  ✓ c) Fetched record with virtual column & relation:`, {
    id: fetchedCase.id,
    case_no: fetchedCase.case_no,
    case_number: fetchedCase.case_number,
    client: fetchedCase.client_name
  })

  // Insert linked hearing, document, and POA
  const hearingDate = '2026-11-20'
  await d1.prepare(
    `INSERT INTO hearings (case_id, hearing_date, type, purpose, status) VALUES (?, ?, ?, ?, ?)`
  ).bind(testCaseId, hearingDate, 'مرافعة', 'جلسة تحقيق نهائية', 'قادمة').run()

  await d1.prepare(
    `INSERT INTO documents (case_id, client_id, title, doc_type) VALUES (?, ?, ?, ?)`
  ).bind(testCaseId, testClientId, 'سند الوكالة والتفويض المالي', 'توكيل').run()

  await d1.prepare(
    `INSERT INTO poas (poa_no, client_id, case_id, type, status) VALUES (?, ?, ?, ?, ?)`
  ).bind(`POA-${testCaseNo}`, testClientId, testCaseId, 'عام قضايا', 'ساري').run()

  console.log(`  ✓ Inserted linked hearings, documents, and transparent 'poas' record`)

  console.log(`\n[Step 4: Simulated Instance Cold Start / Container Restart Verification]`)
  // d) Reconnecting to ensure data persistence between simulated restarts
  console.log('  -> Simulating Vercel container shutdown & memory teardown...')
  closeDatabase()
  console.log('  -> All cached instances and connections cleared.')

  console.log('  -> Simulating fresh container cold start spinning up...')
  const client2 = getLibSqlClient()
  const d1_restarted = getD1Database()

  // Fetch from the brand new connection
  const persistentCase = await d1_restarted.prepare(
    `SELECT c.id, c.case_no, c.case_number, c.title, cl.name as client_name,
            (SELECT COUNT(*) FROM hearings WHERE case_id = c.id) as hearing_count,
            (SELECT COUNT(*) FROM documents WHERE case_id = c.id) as doc_count,
            (SELECT COUNT(*) FROM poas WHERE client_id = cl.id) as poa_count
     FROM cases c
     JOIN clients cl ON cl.id = c.client_id
     WHERE c.id = ?`
  ).bind(testCaseId).first<any>()

  assert.ok(persistentCase, 'Case record MUST persist after full connection restart')
  assert.equal(persistentCase.case_no, testCaseNo)
  assert.equal(persistentCase.case_number, testCaseNo)
  assert.equal(persistentCase.client_name, 'مؤسسة الصفا للتجارة والاستثمار')
  assert.equal(Number(persistentCase.hearing_count), 1)
  assert.equal(Number(persistentCase.doc_count), 1)
  assert.equal(Number(persistentCase.poa_count), 1)

  console.log(`  ✓ d) DATA PERSISTENCE CONFIRMED ACROSS RESTART!`)
  console.log(`       Verified Record: Case ID ${persistentCase.id}, Case No: ${persistentCase.case_no}, Hearings: ${persistentCase.hearing_count}, Docs: ${persistentCase.doc_count}, POAs: ${persistentCase.poa_count}`)

  console.log(`\n[Step 5: Test Fixture Teardown]`)
  // Clean up test records
  await client2.execute({ sql: `DELETE FROM cases WHERE id = ?;`, args: [testCaseId] })
  await client2.execute({ sql: `DELETE FROM clients WHERE id = ?;`, args: [testClientId] })
  console.log('  ✓ Cleaned up test fixture records.')

  closeDatabase()

  console.log('\n======================================================================')
  console.log('   🎉 ALL VERIFICATION CRITERIA PASSED WITHOUT ERRORS (100% SUCCESS)  ')
  console.log('======================================================================\n')
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err)
  process.exit(1)
})
