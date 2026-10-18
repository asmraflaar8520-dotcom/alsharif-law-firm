import { ensureDatabaseInitialized, getD1Database, getLibSqlClient } from '../src/db'
import { runMigrations } from '../src/db/migrations'
import { seedDatabase } from '../src/db/seed'
import { CasesService } from '../src/services/cases.service'
import { ClientsService } from '../src/services/clients.service'
import { DocumentsService } from '../src/services/documents.service'
import { parsePaginationParams, createPaginationEnvelope } from '../src/utils/pagination'

async function runPaginationVerification() {
  console.log('========================================================================');
  console.log('🚀 Phase 3 Verification: Server-Side Pagination, Filtering & Search');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      throw new Error(`Test failed: ${testName} ${detail ? `(${detail})` : ''}`);
    }
  }

  // 1. Initialize DB & Migrations & Seed
  console.log('Step 1: Initializing Database, Schema Migrations & Seed Data...');
  await ensureDatabaseInitialized();
  const client = getLibSqlClient();
  await runMigrations(client);
  await seedDatabase(client);
  const db = getD1Database() as unknown as D1Database;
  console.log('  Database and seed data successfully initialized.\n');

  // 2. Unit Testing parsePaginationParams & Boundary Clamping
  console.log('Step 2: Pagination Parameter Parsing & Boundary Clamping...');
  const defaultParams = parsePaginationParams({});
  assert(defaultParams.page === 1, 'Default page is 1');
  assert(defaultParams.limit === 20, 'Default limit is 20');
  assert(defaultParams.offset === 0, 'Default offset is 0');

  const negativeParams = parsePaginationParams({ page: -5, limit: -10 });
  assert(negativeParams.page === 1, 'Negative page (-5) clamped to 1');
  assert(negativeParams.limit === 20, 'Negative limit clamped to default 20');

  const oversizedParams = parsePaginationParams({ page: 2, limit: 999 });
  assert(oversizedParams.page === 2, 'Page 2 preserved');
  assert(oversizedParams.limit === 100, 'Limit > 100 (999) safely clamped to 100');
  assert(oversizedParams.offset === 100, 'Offset correctly computed as (2-1)*100 = 100');

  const nonNumericParams = parsePaginationParams({ page: 'foo', limit: 'bar' });
  assert(nonNumericParams.page === 1, 'NaN page falls back to 1');
  assert(nonNumericParams.limit === 20, 'NaN limit falls back to 20');

  const searchAliasQ = parsePaginationParams({ q: '  شركة النيل  ' });
  assert(searchAliasQ.search === 'شركة النيل', 'Parameter q is trimmed and aliased to search');

  const searchParamDirect = parsePaginationParams({ search: '  أحمد مصطفى  ' });
  assert(searchParamDirect.search === 'أحمد مصطفى', 'Parameter search is extracted and trimmed');
  console.log('');

  // 3. Response Envelope Structure Verification
  console.log('Step 3: Paginated Response Envelope Standard Compliance...');
  const envelope = createPaginationEnvelope(['item1', 'item2'], 150, 1, 20);
  assert(Array.isArray(envelope.data) && envelope.data.length === 2, 'Envelope contains data array');
  assert(typeof envelope.pagination === 'object', 'Envelope contains pagination metadata object');
  assert(envelope.pagination.total === 150, 'Metadata has accurate total (150)');
  assert(envelope.pagination.page === 1, 'Metadata has page 1');
  assert(envelope.pagination.limit === 20, 'Metadata has limit 20');
  assert(envelope.pagination.totalPages === 8, 'Metadata calculates totalPages = ceil(150/20) = 8');
  assert(envelope.pagination.hasMore === true, 'Metadata flags hasMore = true when page < totalPages');

  const lastPageEnvelope = createPaginationEnvelope(['item'], 150, 8, 20);
  assert(lastPageEnvelope.pagination.hasMore === false, 'Metadata flags hasMore = false on final page (8)');
  console.log('');

  // 4. Cases Pagination, Filtering & Search Tests
  console.log('Step 4: Cases Server-Side Pagination & Substring Search...');
  const casesP1 = await CasesService.getPaginatedCases(db, { page: 1, limit: 2 });
  assert(casesP1.data.length <= 2, 'Page 1 respects limit = 2');
  assert(casesP1.pagination.page === 1, 'Page 1 metadata confirmed');
  assert(casesP1.pagination.total > 0, `Total cases recorded: ${casesP1.pagination.total}`);

  if (casesP1.pagination.total > 2) {
    const casesP2 = await CasesService.getPaginatedCases(db, { page: 2, limit: 2 });
    assert(casesP2.data.length > 0, 'Page 2 returns records');
    assert(casesP2.pagination.page === 2, 'Page 2 metadata confirmed');
    const p1Ids = new Set(casesP1.data.map((c) => c.id));
    const p2HasOverlap = casesP2.data.some((c) => p1Ids.has(c.id));
    assert(!p2HasOverlap, 'Page 2 records have zero ID overlap with Page 1 (offset verified)');
  }

  // Case substring search
  const knownCase = casesP1.data[0];
  const searchTerm = knownCase.case_no || knownCase.title.slice(0, 4);
  const caseSearchRes = await CasesService.getPaginatedCases(db, { search: searchTerm, limit: 10 });
  assert(caseSearchRes.data.length > 0, `Search for "${searchTerm}" returned matching results`);
  assert(caseSearchRes.pagination.total >= caseSearchRes.data.length, 'Total count matches or exceeds page count');
  assert(
    caseSearchRes.data.some((c) => c.case_no?.includes(searchTerm) || c.title?.includes(searchTerm)),
    'Returned cases contain the search term'
  );

  // Case status filter
  const caseStatusRes = await CasesService.getPaginatedCases(db, { status: 'متداولة', limit: 10 });
  assert(
    caseStatusRes.data.every((c) => c.status === 'متداولة'),
    'All returned records strictly match status "متداولة"'
  );
  console.log('');

  // 5. Clients Pagination, Filtering & Search Tests
  console.log('Step 5: Clients Server-Side Pagination & Substring Search...');
  const clientsP1 = await ClientsService.getPaginatedClients(db, { page: 1, limit: 2 });
  assert(clientsP1.data.length <= 2, 'Clients page 1 respects limit = 2');
  assert(clientsP1.pagination.page === 1, 'Clients page 1 metadata confirmed');
  assert(clientsP1.pagination.total > 0, `Total clients recorded: ${clientsP1.pagination.total}`);

  if (clientsP1.pagination.total > 2) {
    const clientsP2 = await ClientsService.getPaginatedClients(db, { page: 2, limit: 2 });
    assert(clientsP2.data.length > 0, 'Clients page 2 returns records');
    const c1Ids = new Set(clientsP1.data.map((c) => c.id));
    const c2Overlap = clientsP2.data.some((c) => c1Ids.has(c.id));
    assert(!c2Overlap, 'Clients Page 2 records have zero overlap with Page 1');
  }

  const knownClient = clientsP1.data[0];
  const clientQuery = knownClient.name.slice(0, 4);
  const clientSearchRes = await ClientsService.getPaginatedClients(db, { q: clientQuery, limit: 10 });
  assert(clientSearchRes.data.length > 0, `Client search for "${clientQuery}" succeeded`);
  assert(
    clientSearchRes.data.every((c) => c.name.includes(clientQuery) || c.phone?.includes(clientQuery)),
    'All returned clients match query term'
  );
  console.log('');

  // 6. Documents Pagination, Filtering & Search Tests
  console.log('Step 6: Documents Server-Side Pagination & Search...');
  const docsP1 = await DocumentsService.getPaginatedDocuments(db, { page: 1, limit: 2 });
  assert(docsP1.pagination.page === 1, 'Documents page 1 metadata confirmed');
  assert(docsP1.data.length <= 2, 'Documents page 1 respects limit = 2');

  if (docsP1.pagination.total > 0) {
    const knownDoc = docsP1.data[0];
    const docQuery = knownDoc.title.slice(0, 3);
    const docSearchRes = await DocumentsService.getPaginatedDocuments(db, { search: docQuery, limit: 10 });
    assert(docSearchRes.data.length > 0, `Document search for "${docQuery}" returned records`);
  }
  console.log('');

  // 7. Hearings Pagination, Filtering & Search Tests
  console.log('Step 7: Hearings Server-Side Pagination & Filtering...');
  const hearingsP1 = await CasesService.getPaginatedHearings(db, { page: 1, limit: 2 });
  assert(hearingsP1.pagination.page === 1, 'Hearings page 1 metadata confirmed');
  assert(hearingsP1.data.length <= 2, 'Hearings page 1 respects limit = 2');

  const hearingStatusRes = await CasesService.getPaginatedHearings(db, { status: 'قادمة', limit: 10 });
  assert(
    hearingStatusRes.data.every((h) => h.status === 'قادمة'),
    'Hearings filter strictly matches status'
  );
  console.log('');

  // 8. Edge Cases & Boundary Conditions
  console.log('Step 8: Edge Cases & Out-of-Bounds Queries...');
  // Out of bounds page
  const outOfBounds = await CasesService.getPaginatedCases(db, { page: 9999, limit: 20 });
  assert(outOfBounds.data.length === 0, 'Page 9999 returns empty data array without error');
  assert(outOfBounds.pagination.hasMore === false, 'Page 9999 flags hasMore = false');
  assert(outOfBounds.pagination.total > 0, 'Page 9999 preserves accurate total count');

  // Search yielding 0 results
  const emptySearch = await CasesService.getPaginatedCases(db, {
    search: '___NON_EXISTENT_CASE_QUERY_XYZ_12345___'
  });
  assert(emptySearch.data.length === 0, 'Non-existent search returns empty array');
  assert(emptySearch.pagination.total === 0, 'Total count is 0 for non-existent search');
  assert(emptySearch.pagination.totalPages === 0, 'totalPages is 0 for non-existent search');
  assert(emptySearch.pagination.hasMore === false, 'hasMore is false for empty results');
  console.log('');

  // 9. Backward Compatibility Verification
  console.log('Step 9: Backward Compatibility on Legacy Unpaginated Consumers...');
  const rawCases = await CasesService.getCases(db);
  assert(Array.isArray(rawCases), 'Legacy CasesService.getCases returns raw flat array');

  const rawClients = await ClientsService.getClients(db);
  assert(Array.isArray(rawClients), 'Legacy ClientsService.getClients returns raw flat array');

  const rawDocs = await DocumentsService.getDocuments(db);
  assert(Array.isArray(rawDocs), 'Legacy DocumentsService.getDocuments returns raw flat array');

  const rawHearings = await CasesService.getHearings(db);
  assert(Array.isArray(rawHearings), 'Legacy CasesService.getHearings returns raw flat array');
  console.log('');

  console.log('========================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 3 PAGINATION VERIFICATION CHECKS PASSED AT 100%!`);
  console.log('========================================================================\n');
}

runPaginationVerification().catch((err) => {
  console.error('Fatal error in pagination verification script:', err);
  process.exit(1);
});
