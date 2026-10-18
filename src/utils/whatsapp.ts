/**
 * Egyptian Legal WhatsApp Dispatcher & Phone Sanitization Utility
 * مكتب الشريف وشركاه للمحاماة
 */

export interface HearingNotificationPayload {
  clientName: string
  caseNo: string
  year?: string | number
  courtName?: string
  circuit?: string
  hearingDate?: string
  decision?: string
  nextHearingDate?: string
  nextHearingPurpose?: string
  clientPhone?: string
}

/**
 * Sanitizes Egyptian phone numbers into international WhatsApp standard (e.g. 201012345678)
 */
export function sanitizeEgyptianPhone(phone: string): string {
  if (!phone) return ''
  // Strip all non-numeric characters
  let digits = phone.replace(/[^0-9]/g, '')

  if (digits.startsWith('0020')) {
    digits = digits.slice(2) // becomes 20...
  } else if (digits.startsWith('20') && digits.length >= 12) {
    // Already in correct 201XXXXXXXXX format
  } else if (digits.startsWith('01') && digits.length === 11) {
    // 010..., 011..., 012..., 015...
    digits = '20' + digits.slice(1)
  } else if (digits.startsWith('1') && digits.length === 10) {
    // 10..., 11..., 12..., 15...
    digits = '20' + digits
  }

  return digits
}

/**
 * Formats official legal notice for client WhatsApp delivery
 */
export function generateHearingWhatsAppMessage(payload: HearingNotificationPayload): string {
  const caseRef = payload.year ? `${payload.caseNo} لسنة ${payload.year}` : (payload.caseNo || '—')
  const courtText = payload.courtName || 'المحكمة المختصة'
  const circuitText = payload.circuit ? ` - دائرة ${payload.circuit}` : ''
  const todayText = payload.hearingDate || new Date().toISOString().slice(0, 10)
  const decisionText = payload.decision || 'مؤجلة للاطلاع والمستندات'
  const nextDateText = payload.nextHearingDate || 'تحدد لاحقاً'
  const purposeText = payload.nextHearingPurpose || 'للمرافعة وتقديم المذكرات'

  return `السيد/ة: ${payload.clientName || 'الموكل الكريم'}
تحية طيبة وبعد،،
بشأن القضية رقم ${caseRef} مقيدة بمحكمة ${courtText}${circuitText}:
نود إحاطتكم بقرار جلسة اليوم ${todayText}:
القرار: ${decisionText}
الجلسة القادمة: ${nextDateText} - لـ: ${purposeText}
مكتب الشريف وشركاه للمحاماة والاستشارات القانونية`
}

/**
 * Generates ready-to-click wa.me URL
 */
export function buildWhatsAppLink(payload: HearingNotificationPayload): string {
  const phone = sanitizeEgyptianPhone(payload.clientPhone || '')
  const message = generateHearingWhatsAppMessage(payload)
  const encoded = encodeURIComponent(message)
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`
}
