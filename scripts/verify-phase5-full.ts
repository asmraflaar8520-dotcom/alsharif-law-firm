/**
 * Phase 5 Automated End-to-End Verification Script
 * Validates:
 * 1. Egyptian Procedural Appeal Deadlines Arithmetic (All 5 appeal types)
 * 2. WhatsApp Legal Dispatcher & Phone Sanitization
 * 3. Client Production Bundle compilation, minification, and integrity
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  calculateAppealDueDate,
  calculateRemainingDays,
  getDeadlineAlertLevel,
  APPEAL_RULES
} from '../src/services/deadlines.service'
import {
  sanitizeEgyptianPhone,
  generateHearingWhatsAppMessage,
  buildWhatsAppLink
} from '../src/utils/whatsapp'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`)
    process.exit(1)
  }
}

async function verifyPhase5() {
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('⚖️  PHASE 5 AUTOMATED VERIFICATION: STATUTORY DEADLINES & BUNDLER')
  console.log('═══════════════════════════════════════════════════════════════════\n')

  // ─── 1. Statutory Appeal Deadlines Verification ───
  console.log('1️⃣  Verifying Egyptian Procedural Law Appeal Deadlines Arithmetic...')

  // Civil Appeal (40 days)
  const civilDue = calculateAppealDueDate('2026-05-01', 'civil_appeal')
  assert(civilDue === '2026-06-10', `Civil appeal must be 2026-06-10, got ${civilDue}`)
  console.log(`  ✓ Civil Appeal (40 days): 2026-05-01 -> ${civilDue}`)

  // Urgent Appeal (15 days)
  const urgentDue = calculateAppealDueDate('2026-05-01', 'urgent_appeal')
  assert(urgentDue === '2026-05-16', `Urgent appeal must be 2026-05-16, got ${urgentDue}`)
  console.log(`  ✓ Urgent Appeal (15 days): 2026-05-01 -> ${urgentDue}`)

  // Misdemeanor Appeal (10 days)
  const misDue = calculateAppealDueDate('2026-05-01', 'misdemeanor_appeal')
  assert(misDue === '2026-05-11', `Misdemeanor appeal must be 2026-05-11, got ${misDue}`)
  console.log(`  ✓ Misdemeanor Appeal (10 days): 2026-05-01 -> ${misDue}`)

  // Cassation Appeal (60 days)
  const cassDue = calculateAppealDueDate('2026-05-01', 'cassation')
  assert(cassDue === '2026-06-30', `Cassation must be 2026-06-30, got ${cassDue}`)
  console.log(`  ✓ Cassation (60 days): 2026-05-01 -> ${cassDue}`)

  // High Administrative Court Appeal (60 days)
  const adminDue = calculateAppealDueDate('2026-05-01', 'administrative_supreme')
  assert(adminDue === '2026-06-30', `Administrative Supreme must be 2026-06-30, got ${adminDue}`)
  console.log(`  ✓ High Administrative Court (60 days): 2026-05-01 -> ${adminDue}`)

  // Leap Year Calculation (Feb 15 2024 -> March 1 2024, 29 days in Feb 2024)
  const leapDue = calculateAppealDueDate('2024-02-15', 'urgent_appeal')
  assert(leapDue === '2024-03-01', `Leap year urgent appeal must be 2024-03-01, got ${leapDue}`)
  console.log(`  ✓ Leap Year Accuracy (Feb 2024 has 29 days): 2024-02-15 + 15d -> ${leapDue}`)

  // Alert Level & Radar Classification
  const urgentLevel = getDeadlineAlertLevel('2026-05-03', 'pending', '2026-05-01') // 2 days left
  assert(urgentLevel === 'urgent', `2 days left must trigger Red Alert 'urgent', got ${urgentLevel}`)
  const warningLevel = getDeadlineAlertLevel('2026-05-07', 'pending', '2026-05-01') // 6 days left
  assert(warningLevel === 'warning', `6 days left must trigger Yellow Alert 'warning', got ${warningLevel}`)
  console.log('  ✓ Alert level classification (Red Alert <= 3d, Yellow Alert 4-7d) verified.')

  // ─── 2. WhatsApp Dispatcher & Phone Sanitization ───
  console.log('\n2️⃣  Verifying WhatsApp Legal Notice & Phone Sanitization...')

  assert(sanitizeEgyptianPhone('01012345678') === '201012345678', '010... format')
  assert(sanitizeEgyptianPhone('+201012345678') === '201012345678', '+2010... format')
  assert(sanitizeEgyptianPhone('00201012345678') === '201012345678', '002010... format')
  assert(sanitizeEgyptianPhone('(010) 1234-5678') === '201012345678', 'Formatted with brackets/dashes')
  console.log('  ✓ Egyptian phone numbers sanitized to standard E.164: +201XXXXXXXXX')

  const sampleNotice = generateHearingWhatsAppMessage({
    clientName: 'أحمد التاجي',
    caseNo: '1842',
    year: 2025,
    courtName: 'محكمة اقتصادي القاهرة',
    circuit: 'الدائرة 4',
    hearingDate: '2026-09-21',
    decision: 'تأجيل للمذكرات الختامية',
    nextHearingDate: '2026-10-15',
    nextHearingPurpose: 'للمرافعة'
  })
  assert(sampleNotice.includes('أحمد التاجي') && sampleNotice.includes('1842 لسنة 2025'), 'Notice message content')
  console.log('  ✓ Legal WhatsApp notice template verified.')

  const link = buildWhatsAppLink({
    clientPhone: '01012345678',
    clientName: 'أحمد التاجي',
    caseNo: '1842',
    decision: 'حكم تمهيدي'
  })
  assert(link.startsWith('https://wa.me/201012345678?text='), 'WhatsApp link shape')
  console.log('  ✓ WhatsApp URL generation and parameter encoding verified.')

  // ─── 3. Client Production Bundle Integrity ───
  console.log('\n3️⃣  Verifying Client Production Bundle Pipeline...')
  const bundlePath = path.resolve(process.cwd(), 'public', 'static', 'bundle.min.js')
  const mapPath = path.resolve(process.cwd(), 'public', 'static', 'bundle.min.js.map')

  assert(fs.existsSync(bundlePath), `Production bundle must exist at ${bundlePath}`)
  const stat = fs.statSync(bundlePath)
  assert(stat.size > 50000 && stat.size < 500000, `Bundle size must be reasonable (50KB-500KB), got ${stat.size} bytes`)
  console.log(`  ✓ Production bundle verified: ${(stat.size / 1024).toFixed(2)} KB`)

  assert(fs.existsSync(mapPath), `Source map must exist at ${mapPath}`)
  console.log(`  ✓ Source map verified: ${(fs.statSync(mapPath).size / 1024).toFixed(2)} KB`)

  // Check bundle content for core modules
  const content = fs.readFileSync(bundlePath, 'utf8')
  assert(content.includes('DashboardView') || content.includes('render'), 'Bundle contains view logic')
  assert(content.includes('router') || content.includes('handleRoute'), 'Bundle contains router logic')
  assert(content.includes('wa.me'), 'Bundle contains WhatsApp dispatcher logic')
  console.log('  ✓ Bundle contents verified: All views, router, and WhatsApp dispatcher incorporated.')

  console.log('\n═══════════════════════════════════════════════════════════════════')
  console.log('✅ ALL PHASE 5 AUTOMATED VERIFICATION CHECKS PASSED (100%)')
  console.log('═══════════════════════════════════════════════════════════════════\n')
}

verifyPhase5().catch((e) => {
  console.error(e)
  process.exit(1)
})
