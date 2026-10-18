/**
 * Client WhatsApp Dispatcher & Phone Sanitization Utility
 * مكتب الشريف وشركاه للمحاماة
 */

export function sanitizeEgyptianPhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/[^0-9]/g, '');

  if (digits.startsWith('0020')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('20') && digits.length >= 12) {
    // Already in correct 201XXXXXXXXX format
  } else if (digits.startsWith('01') && digits.length === 11) {
    digits = '20' + digits.slice(1);
  } else if (digits.startsWith('1') && digits.length === 10) {
    digits = '20' + digits;
  }

  return digits;
}

export function generateHearingWhatsAppMessage(payload) {
  const caseRef = payload.year ? `${payload.caseNo} لسنة ${payload.year}` : (payload.caseNo || '—');
  const courtText = payload.courtName || 'المحكمة المختصة';
  const circuitText = payload.circuit ? ` - دائرة ${payload.circuit}` : '';
  const todayText = payload.hearingDate || new Date().toISOString().slice(0, 10);
  const decisionText = payload.decision || 'مؤجلة للاطلاع والمستندات';
  const nextDateText = payload.nextHearingDate || 'تحدد لاحقاً';
  const purposeText = payload.nextHearingPurpose || 'للمرافعة وتقديم المذكرات';

  return `السيد/ة: ${payload.clientName || 'الموكل الكريم'}
تحية طيبة وبعد،،
بشأن القضية رقم ${caseRef} مقيدة بمحكمة ${courtText}${circuitText}:
نود إحاطتكم بقرار جلسة اليوم ${todayText}:
القرار: ${decisionText}
الجلسة القادمة: ${nextDateText} - لـ: ${purposeText}
مكتب الشريف وشركاه للمحاماة والاستشارات القانونية`;
}

export function buildWhatsAppLink(payload) {
  const phone = sanitizeEgyptianPhone(payload.clientPhone || '');
  const message = generateHearingWhatsAppMessage(payload);
  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}
