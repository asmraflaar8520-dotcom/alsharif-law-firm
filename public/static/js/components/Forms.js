import { $, state, todayISO, ROLE } from '../core/state.js'
import { api } from '../core/api.js'
import { toast } from './Toast.js'
import { modal, closeModal, field, opt, formTo } from './Modal.js'
import { fileUploaderComponent, bindFileUploader } from './Uploader.js'

let _router = null;
export function setFormsModuleRouter(router) {
  _router = router;
}

function navigate(route, params = {}) {
  if (_router) _router.navigate(route, params);
  else window.location.hash = `#/${route}` + (params.id ? `/${params.id}` : '');
}

function refreshCurrentView() {
  if (_router) _router.render();
}

export async function ensureCasesMini() {
  if (!state.cache.casesMini) {
    if (state.lookups?.cases?.length) {
      state.cache.casesMini = state.lookups.cases.map((c) => ({ id: c.id, title: `${c.case_no}/${c.year} — ${c.title}` }));
    } else {
      const res = await api('/api/cases?all=1');
      const list = Array.isArray(res) ? res : (res?.data || []);
      state.cache.casesMini = list.map((c) => ({ id: c.id, title: `${c.case_no}/${c.year} — ${c.title}` }));
    }
  }
}

export function caseForm(c = {}) {
  const L = state.lookups;
  modal(c.id ? 'تعديل القضية' : 'قيد قضية جديدة', `
    <form id="mform" class="grid md:grid-cols-2 gap-x-3">
      ${field('رقم الدعوى *', 'case_no', 'text', c.case_no || '', 'required')}
      ${field('السنة *', 'year', 'number', c.year || new Date().getFullYear(), 'required')}
      <div class="md:col-span-2">${field('العنوان / الموضوع المختصر *', 'title', 'text', c.title || '', 'required')}</div>
      ${field('الموكل *', 'client_id', 'select', '', opt(L.clients, 'id', 'name', c.client_id))}
      ${field('نوع القضية', 'case_type_id', 'select', '', opt(L.case_types, 'id', 'name', c.case_type_id))}
      ${field('المحكمة', 'court_id', 'select', '', opt(L.courts, 'id', 'name', c.court_id))}
      ${field('الدائرة', 'circuit', 'text', c.circuit || '')}
      ${field('الدرجة', 'degree', 'select', '', ['ابتدائي', 'استئناف', 'نقض', 'إداري', 'تحكيم', 'تنفيذ'].map((x) => `<option ${(c.degree || 'ابتدائي') === x ? 'selected' : ''}>${x}</option>`).join(''))}
      ${field('الحالة', 'status', 'select', '', ['متداولة', 'محجوزة للحكم', 'موقوفة', 'منتهية'].map((x) => `<option ${(c.status || 'متداولة') === x ? 'selected' : ''}>${x}</option>`).join(''))}
      ${field('الأولوية', 'priority', 'select', '', ['عادية', 'عالية', 'عاجلة', 'منخفضة'].map((x) => `<option ${(c.priority || 'عادية') === x ? 'selected' : ''}>${x}</option>`).join(''))}
      ${field('المحامي المسؤول', 'lead_lawyer_id', 'select', '', opt(L.users, 'id', 'name', c.lead_lawyer_id || state.user?.id))}
      ${field('الخصم', 'opposing_name', 'text', c.opposing_name || '')}
      ${field('محامي الخصم', 'opposing_lawyer', 'text', c.opposing_lawyer || '')}
      ${field('قيمة المطالبة', 'claim_value', 'number', c.claim_value || 0)}
      ${field('تاريخ القيد', 'filing_date', 'date', (c.filing_date || todayISO()).slice(0, 10))}
      <div class="md:col-span-2">${field('موضوع الدعوى', 'subject', 'textarea', c.subject || '')}</div>
      <div class="md:col-span-2">${field('الإجراء التالي', 'next_action', 'text', c.next_action || '')}</div>
    </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);

  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.case_no || !b.year || !b.title || !b.client_id) {
      toast('يرجى استيفاء الحقول الإجبارية (الرقم، السنة، العنوان، الموكل)', 'err');
      return;
    }
    b.year = Number(b.year);
    b.claim_value = Number(b.claim_value || 0);
    try {
      if (c.id) {
        await api('/api/cases/' + c.id, { method: 'PUT', body: b });
        state.cache.casesMini = null;
        toast('تم تحديث القضية بنجاح');
      } else {
        const r = await api('/api/cases', { method: 'POST', body: b });
        state.cache.casesMini = null;
        toast('تم قيد القضية بنجاح');
        closeModal();
        navigate('case', { id: r.id });
        return;
      }
      closeModal();
      refreshCurrentView();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

export function clientForm(c = {}) {
  const L = state.lookups;
  modal(c.id ? 'تعديل الموكل' : 'موكل جديد', `
    <form id="mform" class="grid md:grid-cols-2 gap-x-3">
      ${field('النوع', 'type', 'select', '', `<option value="individual" ${(c.type || 'individual') !== 'company' ? 'selected' : ''}>شخص طبيعي</option><option value="company" ${c.type === 'company' ? 'selected' : ''}>شخص اعتباري</option>`)}
      ${field('التصنيف', 'status', 'select', '', `<option value="active" ${(c.status || 'active') === 'active' ? 'selected' : ''}>نشط</option><option value="vip" ${c.status === 'vip' ? 'selected' : ''}>استراتيجي</option><option value="inactive" ${c.status === 'inactive' ? 'selected' : ''}>غير نشط</option>`)}
      <div class="md:col-span-2">${field('الاسم *', 'name', 'text', c.name || '', 'required')}</div>
      ${field('الهاتف', 'phone', 'text', c.phone || '')}
      ${field('هاتف 2', 'phone2', 'text', c.phone2 || '')}
      ${field('البريد', 'email', 'email', c.email || '')}
      ${field('المدينة', 'city', 'text', c.city || '')}
      ${field('الرقم القومي', 'national_id', 'text', c.national_id || '')}
      ${field('الرقم الضريبي', 'tax_id', 'text', c.tax_id || '')}
      ${field('السجل التجاري', 'commercial_reg', 'text', c.commercial_reg || '')}
      ${field('المهنة / النشاط', 'occupation', 'text', c.occupation || '')}
      ${field('الممثل', 'company_rep', 'text', c.company_rep || '')}
      ${field('المحامي', 'assigned_lawyer_id', 'select', '', opt(L.users, 'id', 'name', c.assigned_lawyer_id))}
      <div class="md:col-span-2">${field('العنوان', 'address', 'text', c.address || '')}</div>
      <div class="md:col-span-2">${field('ملاحظات', 'notes', 'textarea', c.notes || '')}</div>
    </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);

  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.name?.trim()) {
      toast('اسم الموكل مطلوب', 'err');
      return;
    }
    try {
      if (c.id) {
        await api('/api/clients/' + c.id, { method: 'PUT', body: b });
      } else {
        const r = await api('/api/clients', { method: 'POST', body: b });
        state.lookups = await api('/api/lookups');
        closeModal();
        toast('تم قيد الموكل بنجاح');
        navigate('client', { id: r.id });
        return;
      }
      state.lookups = await api('/api/lookups');
      closeModal();
      toast('تم الحفظ');
      refreshCurrentView();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

export function hearingForm(h = {}) {
  const L = state.lookups;
  modal('قيد جلسة', `
    <form id="mform" class="grid md:grid-cols-2 gap-x-3">
      ${field('القضية *', 'case_id', 'select', '', opt(state.cache.casesMini || [], 'id', 'title', h.case_id || state.params.id))}
      ${field('التاريخ *', 'hearing_date', 'date', h.hearing_date || todayISO(), 'required')}
      ${field('الوقت', 'hearing_time', 'time', h.hearing_time || '09:30')}
      ${field('المحكمة', 'court_id', 'select', '', opt(L.courts, 'id', 'name', h.court_id))}
      ${field('الدائرة', 'circuit', 'text', h.circuit || '')}
      ${field('النوع', 'type', 'select', '', ['مرافعة', 'حكم', 'تحقيق', 'خبرة', 'صلح', 'تنفيذ'].map((x) => `<option>${x}</option>`).join(''))}
      ${field('المحامي', 'lawyer_id', 'select', '', opt(L.users, 'id', 'name', h.lawyer_id || state.user?.id))}
      <div class="md:col-span-2">${field('الغرض', 'purpose', 'text', h.purpose || '')}</div>
      <div class="md:col-span-2">${field('ملاحظات', 'notes', 'textarea', h.notes || '')}</div>
    </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);

  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.case_id || !b.hearing_date) {
      toast('القضية وتاريخ الجلسة مطلوبان', 'err');
      return;
    }
    try {
      await api('/api/hearings', { method: 'POST', body: b });
      closeModal();
      toast('أُضيفت الجلسة بنجاح');
      refreshCurrentView();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

export function taskForm() {
  const L = state.lookups;
  modal('مهمة جديدة', `
    <form id="mform">
      ${field('العنوان *', 'title', 'text', '', 'required')}
      ${field('الوصف', 'description', 'textarea')}
      ${field('المكلّف', 'assignee_id', 'select', '', opt(L.users, 'id', 'name', state.user?.id))}
      ${field('القضية', 'case_id', 'select', '', opt(state.cache.casesMini || [], 'id', 'title', state.params.id))}
      ${field('الاستحقاق', 'due_date', 'date', todayISO())}
      ${field('الأولوية', 'priority', 'select', '', ['عادية', 'عالية', 'عاجلة', 'منخفضة'].map((x) => `<option>${x}</option>`).join(''))}
      ${field('التصنيف', 'category', 'select', '', ['مرافعة', 'بحث', 'صياغة', 'إعلان', 'تنفيذ', 'إداري'].map((x) => `<option>${x}</option>`).join(''))}
    </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);

  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.title?.trim()) {
      toast('عنوان المهمة مطلوب', 'err');
      return;
    }
    try {
      await api('/api/tasks', { method: 'POST', body: b });
      closeModal();
      toast('أُضيفت المهمة بنجاح');
      refreshCurrentView();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

export function poaForm(preset = {}) {
  const L = state.lookups;
  const defClient = preset.client_id || (state.route === 'client' ? state.params.id : (state.activeCase?.client_id || ''));
  modal('توكيل جديد', `<form id="mform" class="grid md:grid-cols-2 gap-x-3">
    <div class="md:col-span-2">${field('رقم التوكيل *', 'poa_no', 'text', preset.poa_no || '', 'required')}</div>
    ${field('الموكل *', 'client_id', 'select', '', opt(L.clients, 'id', 'name', defClient))}
    ${field('المحامي', 'lawyer_id', 'select', '', opt(L.users, 'id', 'name', preset.lawyer_id || state.user?.id))}
    ${field('النوع', 'type', 'select', '', ['عام قضايا', 'رسمي عام', 'خاص', 'إداري'].map((x) => `<option ${preset.type === x ? 'selected' : ''}>${x}</option>`).join(''))}
    ${field('مكتب التوثيق', 'notary_office', 'text', preset.notary_office || '')}
    ${field('تاريخ الإصدار', 'issue_date', 'date', preset.issue_date || todayISO())}
    ${field('تاريخ الانتهاء', 'expiry_date', 'date', preset.expiry_date || '')}
    <div class="md:col-span-2">${field('النطاق', 'scope', 'textarea', preset.scope || 'الحضور والمرافعة أمام جميع المحاكم')}</div>
    <div class="md:col-span-2">
      <div class="mt-2 font-semibold text-xs md:text-sm text-navy-950">صورة التوكيل الممسوح ضوئياً (PDF / صور)</div>
      ${fileUploaderComponent('poas')}
    </div>
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);

  $('#modal-x2').onclick = closeModal;
  bindFileUploader('poas');
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.poa_no?.trim() || !b.client_id) {
      toast('رقم التوكيل والموكل حقول إجبارية', 'err');
      return;
    }
    try {
      await api('/api/poas', { method: 'POST', body: b });
      closeModal();
      toast('تم قيد التوكيل بنجاح');
      refreshCurrentView();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

export function docForm(preset = {}) {
  const L = state.lookups;
  const defCase = preset.case_id || (state.route === 'case' ? state.params.id : '');
  const defClient = preset.client_id || (state.route === 'client' ? state.params.id : (state.activeCase?.client_id || ''));
  modal('قيد مستند', `<form id="mform">
    ${field('العنوان *', 'title', 'text', preset.title || '', 'required')}
    ${field('النوع', 'doc_type', 'select', '', ['صحيفة', 'مذكرة', 'حكم', 'توكيل', 'عقد', 'إنذار', 'أخرى'].map((x) => `<option>${x}</option>`).join(''))}
    ${field('القضية', 'case_id', 'select', '', opt(state.cache.casesMini || [], 'id', 'title', defCase))}
    ${field('الموكل', 'client_id', 'select', '', opt(L.clients, 'id', 'name', defClient))}
    ${field('الرقم المرجعي', 'ref_no', 'text', preset.ref_no || '')}
    ${field('تاريخ المستند', 'date_issued', 'date', preset.date_issued || todayISO())}
    ${field('عدد الصفحات', 'pages', 'number', preset.pages || '')}
    <div class="mt-2 font-semibold text-xs md:text-sm text-navy-950">الملف المرفق (PDF / صور)</div>
    ${fileUploaderComponent('documents')}
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);

  $('#modal-x2').onclick = closeModal;
  bindFileUploader('documents');
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.title?.trim()) {
      toast('عنوان المستند مطلوب', 'err');
      return;
    }
    try {
      await api('/api/documents', { method: 'POST', body: b });
      closeModal();
      toast('تم حفظ المستند');
      refreshCurrentView();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

export function invoiceForm(preset = {}) {
  const L = state.lookups;
  const defClient = preset.client_id || (state.route === 'client' ? state.params.id : (state.activeCase?.client_id || ''));
  const defCase = preset.case_id || (state.route === 'case' ? state.params.id : '');
  modal('فاتورة أتعاب', `<form id="mform">
    ${field('الموكل *', 'client_id', 'select', '', opt(L.clients, 'id', 'name', defClient))}
    ${field('القضية (اختياري)', 'case_id', 'select', '', opt(state.cache.casesMini || [], 'id', 'title', defCase))}
    ${field('تاريخ الإصدار', 'issue_date', 'date', preset.issue_date || todayISO())}
    ${field('الاستحقاق', 'due_date', 'date', preset.due_date || '')}
    ${field('بيان البند', 'desc', 'text', preset.desc || 'أتعاب مهنية')}
    ${field('المبلغ (ج.م) *', 'amount', 'number', preset.amount || '0')}
    ${field('ملاحظات', 'notes', 'textarea', preset.notes || '')}
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">إصدار</button>`);

  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.client_id) {
      toast('يرجى اختيار الموكل', 'err');
      return;
    }
    const amount = Number(b.amount || 0);
    b.items = [{ description: b.desc || 'أتعاب مهنية', qty: 1, unit_price: amount, amount: amount }];
    try {
      const r = await api('/api/invoices', { method: 'POST', body: b });
      closeModal();
      toast('صدرت الفاتورة ' + r.invoice_no);
      navigate('invoice', { id: r.id });
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

export function paymentForm(preset = {}) {
  const L = state.lookups;
  modal('قيد تحصيل', `<form id="mform">
    ${field('الموكل *', 'client_id', 'select', '', opt(L.clients, 'id', 'name', preset.client_id))}
    ${field('رقم الفاتورة الداخلي', 'invoice_id', 'number', preset.invoice_id || '')}
    ${field('المبلغ (ج.م) *', 'amount', 'number', preset.amount || '', 'required min="1"')}
    ${field('الوسيلة', 'method', 'select', '', ['تحويل', 'شيك', 'نقدي', 'بطاقة'].map((x) => `<option>${x}</option>`).join(''))}
    ${field('التاريخ', 'paid_at', 'date', todayISO())}
    ${field('المرجع', 'reference', 'text')}
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);

  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    b.amount = Number(b.amount);
    if (!b.amount || b.amount <= 0) {
      toast('مبلغ التحصيل يجب أن يكون أكبر من صفر', 'err');
      return;
    }
    try {
      await api('/api/payments', { method: 'POST', body: b });
      closeModal();
      toast('تم قيد التحصيل بنجاح');
      refreshCurrentView();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

export function expenseForm() {
  modal('مصروف قضائي', `<form id="mform">
    ${field('البيان *', 'title', 'text', '', 'required')}
    ${field('التصنيف', 'category', 'select', '', ['رسوم محكمة', 'إعلانات', 'خبرة', 'انتقالات', 'تصوير', 'ترجمة', 'أخرى'].map((x) => `<option>${x}</option>`).join(''))}
    ${field('المبلغ (ج.م) *', 'amount', 'number', '', 'required min="1"')}
    ${field('التاريخ', 'expense_date', 'date', todayISO())}
    ${field('القضية', 'case_id', 'select', '', opt(state.cache.casesMini || [], 'id', 'title', state.params.id))}
    ${field('الجهة', 'vendor', 'text')}
    <label class="text-sm cursor-pointer flex items-center gap-2 mt-2"><input type="checkbox" name="billable" checked/> قابل للترحيل على الموكل</label>
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);

  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    b.amount = Number(b.amount);
    if (!b.title?.trim() || !b.amount || b.amount <= 0) {
      toast('بيان المصروف ومبلغ صالح مطلوبان', 'err');
      return;
    }
    b.billable = $('#mform [name=billable]').checked ? 1 : 0;
    try {
      await api('/api/expenses', { method: 'POST', body: b });
      closeModal();
      toast('تم قيد المصروف');
      refreshCurrentView();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

export function timeForm() {
  modal('تسجيل ساعات', `<form id="mform">
    ${field('التاريخ', 'work_date', 'date', todayISO())}
    ${field('الساعات *', 'hours', 'number', '1', 'step="0.5" min="0.5" required')}
    ${field('القضية', 'case_id', 'select', '', opt(state.cache.casesMini || [], 'id', 'title', state.params.id))}
    ${field('الوصف', 'description', 'textarea')}
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);

  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    b.hours = Number(b.hours);
    if (!b.hours || b.hours <= 0) {
      toast('عدد الساعات يجب أن يكون أكبر من صفر', 'err');
      return;
    }
    try {
      await api('/api/time', { method: 'POST', body: b });
      closeModal();
      toast('سُجّلت الساعات بنجاح');
      refreshCurrentView();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

export function userForm(u = {}) {
  modal(u.id ? 'تعديل بيانات المستخدم' : 'إضافة عضو جديد للفريق', `
    <form id="mform" class="grid md:grid-cols-2 gap-x-3">
      ${field('الاسم بالكامل *', 'name', 'text', u.name || '', 'required')}
      ${field('البريد الإلكتروني *', 'email', 'email', u.email || '', 'required')}
      ${field('المسمى الوظيفي', 'title', 'text', u.title || '')}
      ${field('الدور / الصلاحية', 'role', 'select', '', Object.entries(ROLE).map(([k, v]) => `<option value="${k}" ${(u.role || 'lawyer') === k ? 'selected' : ''}>${v}</option>`).join(''))}
      ${field('الهاتف', 'phone', 'text', u.phone || '')}
      ${field('القسم', 'department', 'text', u.department || '')}
      ${field('رقم القيد بالنقابة', 'bar_number', 'text', u.bar_number || '')}
      ${field('سنة القيد', 'bar_year', 'number', u.bar_year || '')}
      ${field('سعر الساعة (ج.م)', 'hourly_rate', 'number', u.hourly_rate || 0)}
      ${field('كلمة المرور' + (u.id ? ' (اتركها فارغة إذا لم ترد التغيير)' : ' *'), 'password', 'password', '', u.id ? '' : 'required minlength="6"')}
      <div class="md:col-span-2">${field('نبذة تعريفية', 'bio', 'textarea', u.bio || '')}</div>
    </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);

  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.name?.trim() || !b.email?.trim()) {
      toast('الاسم والبريد حقول إجبارية', 'err');
      return;
    }
    if (!u.id && (!b.password || b.password.length < 6)) {
      toast('كلمة المرور مطلوبة ويجب ألا تقل عن 6 أحرف', 'err');
      return;
    }
    if (b.bar_year) b.bar_year = Number(b.bar_year);
    if (b.hourly_rate) b.hourly_rate = Number(b.hourly_rate);
    try {
      if (u.id) {
        await api('/api/users/' + u.id, { method: 'PUT', body: b });
        toast('تم تحديث بيانات العضو');
      } else {
        await api('/api/users', { method: 'POST', body: b });
        toast('تم إضافة العضو بنجاح');
      }
      closeModal();
      state.lookups = await api('/api/lookups');
      refreshCurrentView();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

export function contractForm(preset = {}) {
  const L = state.lookups;
  const defClient = preset.client_id || (state.route === 'client' ? state.params.id : (state.activeCase?.client_id || ''));
  modal('عقد أتعاب', `<form id="mform">
    ${field('العنوان *', 'title', 'text', preset.title || '', 'required')}
    ${field('الموكل *', 'client_id', 'select', '', opt(L.clients, 'id', 'name', defClient))}
    ${field('النوع', 'type', 'select', '', ['أتعاب', 'استشارة', 'أخرى'].map((x) => `<option ${preset.type === x ? 'selected' : ''}>${x}</option>`).join(''))}
    ${field('البداية', 'start_date', 'date', preset.start_date || todayISO())}
    ${field('النهاية', 'end_date', 'date', preset.end_date || '')}
    ${field('القيمة (ج.م)', 'value', 'number', preset.value || '')}
    ${field('ملاحظات', 'notes', 'textarea', preset.notes || '')}
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);

  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.title?.trim() || !b.client_id) {
      toast('عنوان العقد والموكل حقول إجبارية', 'err');
      return;
    }
    try {
      await api('/api/contracts', { method: 'POST', body: b });
      closeModal();
      toast('تم حفظ العقد');
      refreshCurrentView();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}
