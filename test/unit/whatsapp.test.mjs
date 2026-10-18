import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeEgyptianPhone,
  generateHearingWhatsAppMessage,
  buildWhatsAppLink
} from '../../src/utils/whatsapp.ts'

test('WhatsApp Dispatcher & Egyptian Phone Sanitizer Unit Test Suite', async (t) => {
  await t.test('sanitizeEgyptianPhone normalizes varied Egyptian phone formats to 201XXXXXXXXX', () => {
    // Standard local mobile 010... -> 2010...
    assert.equal(sanitizeEgyptianPhone('01012345678'), '201012345678')
    assert.equal(sanitizeEgyptianPhone('01123456789'), '201123456789')
    assert.equal(sanitizeEgyptianPhone('01234567890'), '201234567890')
    assert.equal(sanitizeEgyptianPhone('01512345678'), '201512345678')

    // Formats with +20 or +201...
    assert.equal(sanitizeEgyptianPhone('+201012345678'), '201012345678')
    assert.equal(sanitizeEgyptianPhone('+20 101 234 5678'), '201012345678')

    // Formats with international double zeros 0020...
    assert.equal(sanitizeEgyptianPhone('00201012345678'), '201012345678')

    // Formats with dashes, spaces, and parentheses
    assert.equal(sanitizeEgyptianPhone('(010) 1234-5678'), '201012345678')

    // Empty or invalid input
    assert.equal(sanitizeEgyptianPhone(''), '')
    assert.equal(sanitizeEgyptianPhone(null), '')
    assert.equal(sanitizeEgyptianPhone(undefined), '')
  })

  await t.test('generateHearingWhatsAppMessage builds structured professional legal notice', () => {
    const message = generateHearingWhatsAppMessage({
      clientName: 'أحمد محمود التاجي',
      caseNo: '1842',
      year: 2025,
      courtName: 'محكمة اقتصادي القاهرة',
      circuit: 'الدائرة 4 اقتصادي',
      hearingDate: '2026-09-21',
      decision: 'تأجيل لتقديم المذكرات الختامية والمستندات',
      nextHearingDate: '2026-10-15',
      nextHearingPurpose: 'للمرافعة'
    })

    assert.match(message, /السيد\/ة: أحمد محمود التاجي/)
    assert.match(message, /1842 لسنة 2025/)
    assert.match(message, /محكمة اقتصادي القاهرة - دائرة الدائرة 4 اقتصادي/)
    assert.match(message, /قرار جلسة اليوم 2026-09-21/)
    assert.match(message, /القرار: تأجيل لتقديم المذكرات الختامية والمستندات/)
    assert.match(message, /الجلسة القادمة: 2026-10-15 - لـ: للمرافعة/)
    assert.match(message, /مكتب الشريف وشركاه للمحاماة والاستشارات القانونية/)
  })

  await t.test('buildWhatsAppLink generates valid encoded wa.me URL with sanitized phone', () => {
    const link = buildWhatsAppLink({
      clientPhone: '01012345678',
      clientName: 'منى حسني',
      caseNo: '771',
      year: 2024,
      courtName: 'غرفة القاهرة للتحكيم',
      decision: 'حجزت للحكم',
      nextHearingDate: '2026-10-24'
    })

    assert.ok(link.startsWith('https://wa.me/201012345678?text='))
    const url = new URL(link)
    const textParam = url.searchParams.get('text')
    assert.ok(textParam)
    assert.match(textParam, /منى حسني/)
    assert.match(textParam, /771 لسنة 2024/)
    assert.match(textParam, /حجزت للحكم/)
  })

  await t.test('buildWhatsAppLink handles missing phone gracefully', () => {
    const link = buildWhatsAppLink({
      clientPhone: '',
      clientName: 'عميل بدون هاتف',
      caseNo: '100'
    })
    assert.ok(link.startsWith('https://wa.me/?text='))
  })
})
