import { $, $$, state, egp, arDate, arDateTime, esc, chip, pchip, avatar, caseRef, pageHead, empty } from '../core/state.js'
import { api } from '../core/api.js'
import { toast } from '../components/Toast.js'
import { previewModal } from '../components/Modal.js'
import { caseForm, hearingForm, docForm, ensureCasesMini } from '../components/Forms.js'

function formatDocSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export const CaseDetailView = {
  async render() {
    const c = await api('/api/cases/' + state.params.id);
    state.activeCase = c;
    const tabs = [
      ['hearings', 'الجلسات', (c.hearings || []).length],
      ['docs', 'المستندات', (c.documents || []).length],
      ['notes', 'الملاحظات', (c.notes || []).length],
      ['tasks', 'المهام', (c.tasks || []).length],
      ['finance', 'المالية', (c.invoices || []).length],
      ['time', 'الساعات', (c.time_entries || []).length],
      ['team', 'الفريق', (c.lawyers || []).length],
    ];
    const tab = state.params.tab || 'hearings';

    return `
      <button data-go="cases" class="text-sm text-gold-700 mb-3 hover:underline inline-flex items-center gap-1">
        <i class="fas fa-arrow-right"></i> عودة للسجل
      </button>
      ${pageHead(c.title, `${caseRef(c)} · ${esc(c.client_name)} · ${esc(c.court_name || c.degree)}`, `
        <button id="edit-case" class="btn-ghost"><i class="fas fa-pen-to-square ml-1"></i> تعديل</button>
        <button id="add-hearing" class="btn-navy"><i class="fas fa-plus ml-1"></i> جلسة جديدة</button>
      `)}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div class="paper-card rounded-xl p-3 md:p-4">
          <div class="text-xs text-navy-700/50">الحالة</div>
          <div class="mt-1 flex flex-wrap gap-1">${chip(c.status)} ${pchip(c.priority)}</div>
        </div>
        <div class="paper-card rounded-xl p-3 md:p-4">
          <div class="text-xs text-navy-700/50">الخصم / محاميه</div>
          <div class="font-semibold mt-1 truncate">${esc(c.opposing_name || '—')}</div>
          <div class="text-xs text-navy-700/60 truncate">${esc(c.opposing_lawyer || '')}</div>
        </div>
        <div class="paper-card rounded-xl p-3 md:p-4">
          <div class="text-xs text-navy-700/50">قيمة المطالبة</div>
          <div class="kpi-num text-xl md:text-2xl">${c.claim_value ? egp(c.claim_value) : '—'}</div>
        </div>
        <div class="paper-card rounded-xl p-3 md:p-4">
          <div class="text-xs text-navy-700/50">المحامي المسؤول</div>
          <div class="font-semibold mt-1 truncate">${esc(c.lawyer_name || '—')}</div>
        </div>
      </div>
      <div class="paper-card rounded-xl p-4 md:p-5 mb-5">
        <h3 class="font-semibold mb-2">موضوع الدعوى</h3>
        <p class="leading-8 text-navy-800 text-sm md:text-base">${esc(c.subject || '—')}</p>
        ${c.next_action ? `<p class="mt-3 text-sm"><span class="text-gold-700 font-semibold">الإجراء التالي:</span> ${esc(c.next_action)}</p>` : ''}
        ${c.outcome ? `<p class="mt-2 text-sm"><span class="font-semibold">المنطوق / النتيجة:</span> ${esc(c.outcome)}</p>` : ''}
      </div>
      <div class="flex gap-1 overflow-x-auto mb-4 pb-1">
        ${tabs.map(([id, l, n]) => `
          <button data-tab="${id}" class="px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition whitespace-nowrap ${tab === id ? 'bg-navy-900 text-ivory' : 'bg-white border gold-hairline hover:bg-navy-900/5'}">
            ${l} <span class="opacity-60 text-xs">(${n})</span>
          </button>
        `).join('')}
      </div>
      <div id="case-tab">${CaseDetailView.renderTab(c, tab)}</div>`;
  },

  renderTab(c, tab) {
    if (tab === 'hearings') {
      return `
        <div class="paper-card rounded-xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-xs text-navy-700/50">
                <tr>
                  <th class="text-right p-3">التاريخ</th>
                  <th class="text-right">النوع</th>
                  <th class="text-right">الغرض</th>
                  <th class="text-right">النتيجة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${(c.hearings || []).map((h) => `
                  <tr class="border-t gold-hairline ledger-row">
                    <td class="p-3 whitespace-nowrap">
                      ${arDate(h.hearing_date)} <span class="text-navy-700/50">${esc(h.hearing_time || '')}</span>
                      <div class="text-[11px]">${esc(h.court_name || h.circuit || '')}</div>
                    </td>
                    <td>${esc(h.type)}</td>
                    <td>${esc(h.purpose || '')}</td>
                    <td>${esc(h.result || '—')}</td>
                    <td>${chip(h.status)}</td>
                  </tr>
                `).join('') || '<tr><td class="p-6 text-navy-700/50" colspan="5">لا جلسات مسجلة بعد</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;
    }
    if (tab === 'docs') {
      return `
        <div class="flex justify-end mb-3">
          <button id="add-doc" class="btn-gold text-sm"><i class="fas fa-plus ml-1"></i> إضافة مستند</button>
        </div>
        <div class="grid md:grid-cols-2 gap-3">
          ${(c.documents || []).map((d) => `
            <article class="paper-card rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-gold-700 font-semibold">${esc(d.doc_type)}</span>
                  ${d.file_url ? `<span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><i class="fas fa-paperclip ml-1"></i>مرفق</span>` : ''}
                </div>
                <div class="font-semibold text-navy-950 mt-1">${esc(d.title)}</div>
                <div class="text-xs text-navy-700/50 mt-1">${esc(d.ref_no || '')} · ${arDate(d.date_issued)} · ${d.pages || '—'} صفحات</div>
                ${d.file_name ? `<div class="text-xs text-navy-700/60 mt-1 truncate"><i class="fas fa-file text-gold-600"></i> ${esc(d.file_name)} ${d.file_size ? `(${formatDocSize(d.file_size)})` : ''}</div>` : ''}
              </div>
              <div class="mt-3 pt-2 border-t gold-hairline flex items-center justify-between gap-2">
                ${d.file_url ? `
                  <button type="button" class="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1 text-navy-900" data-preview-url="${esc(d.file_url)}" data-preview-title="${esc(d.title)}" data-preview-mime="${esc(d.mime_type || '')}">
                    <i class="fas fa-eye text-gold-600"></i> معاينة المستند
                  </button>
                  <a href="${esc(d.file_url)}?download=1" download class="btn-gold text-xs py-1 px-2.5 flex items-center gap-1">
                    <i class="fas fa-download"></i> تحميل
                  </a>
                ` : `<span class="text-xs text-navy-700/40">لا يوجد ملف مرفق</span>`}
              </div>
            </article>
          `).join('') || empty('fa-folder-open', 'لا مستندات', '')}
        </div>`;
    }
    if (tab === 'notes') {
      return `
        <form id="note-form" class="paper-card rounded-xl p-3 md:p-4 mb-3 flex gap-2">
          <input name="content" class="input-lux flex-1" placeholder="أضف ملاحظة على الملف…" required/>
          <button class="btn-gold shrink-0">حفظ</button>
        </form>
        <div id="notes-list">
          ${(c.notes || []).map((n) => `
            <article class="paper-card rounded-xl p-4 mb-2 ${n.pinned ? 'ring-1 ring-gold-500' : ''}">
              <div class="text-xs text-navy-700/50 mb-1">${esc(n.user_name || 'عضو بالفريق')} · ${arDateTime(n.created_at)}</div>
              <p class="leading-7 text-sm md:text-base">${esc(n.content)}</p>
            </article>
          `).join('') || empty('fa-note-sticky', 'لا ملاحظات مسجلة', '')}
        </div>`;
    }
    if (tab === 'tasks') {
      return (c.tasks || []).length ? (c.tasks || []).map((t) => `
        <div class="paper-card rounded-xl p-3 md:p-4 mb-2 flex items-center justify-between">
          <div>
            <div class="font-semibold text-sm md:text-base">${esc(t.title)}</div>
            <div class="text-xs text-navy-700/50">${esc(t.assignee_name || '')} · ${arDate(t.due_date)}</div>
          </div>
          ${chip(t.status)}
        </div>
      `).join('') : empty('fa-list', 'لا مهام', '');
    }
    if (tab === 'finance') {
      const exp = (c.expenses || []).reduce((s, e) => s + Number(e.amount), 0);
      return `
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="paper-card rounded-xl p-3 md:p-4">
            فواتير: ${(c.invoices || []).length}
            <div class="kpi-num text-xl md:text-2xl">${egp((c.invoices || []).reduce((s, i) => s + Number(i.total), 0))}</div>
          </div>
          <div class="paper-card rounded-xl p-3 md:p-4">
            مصروفات
            <div class="kpi-num text-xl md:text-2xl">${egp(exp)}</div>
          </div>
        </div>
        ${(c.invoices || []).map((i) => `
          <div class="paper-card rounded-xl p-3 mb-2 flex justify-between text-sm">
            <span>${esc(i.invoice_no)}</span>
            <span>${egp(i.total)} ${chip(i.status)}</span>
          </div>
        `).join('')}
        <h4 class="font-semibold mt-4 mb-2">المصروفات</h4>
        ${(c.expenses || []).map((e) => `
          <div class="text-sm flex justify-between border-t gold-hairline py-2">
            <span>${esc(e.title)}</span>
            <span>${egp(e.amount)}</span>
          </div>
        `).join('') || '—'}`;
    }
    if (tab === 'time') {
      return (c.time_entries || []).length ? (c.time_entries || []).map((t) => `
        <div class="paper-card rounded-xl p-3 mb-2 flex justify-between text-sm">
          <span class="truncate ml-2">${esc(t.user_name)} · ${arDate(t.work_date)} · ${esc(t.description || '')}</span>
          <b class="shrink-0">${t.hours} س</b>
        </div>
      `).join('') : empty('fa-clock', 'لا ساعات مسجّلة', '');
    }
    return `
      <div class="grid md:grid-cols-2 gap-3">
        ${(c.lawyers || []).map((l) => `
          <div class="paper-card rounded-xl p-3 md:p-4 flex items-center gap-3">
            ${avatar(l, 44)}
            <div>
              <div class="font-semibold">${esc(l.name)}</div>
              <div class="text-xs text-navy-700/60">${esc(l.title || '')} · ${esc(l.role || '')}</div>
            </div>
          </div>
        `).join('')}
      </div>
      ${(c.poas || []).length ? `
        <div class="mt-4">
          <h4 class="font-semibold mb-2">التوكيلات المرتبطة</h4>
          ${(c.poas || []).map((p) => `
            <div class="paper-card rounded-xl p-3 mb-2 text-sm flex justify-between">
              <span>${esc(p.poa_no)} · ${esc(p.type)}</span>
              ${chip(p.status)}
            </div>
          `).join('')}
        </div>
      ` : ''}`;
  },

  mount(container, router) {
    const bindTabSubEvents = () => {
      $('#note-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = e.target.content.value;
        if (!content.trim()) return;
        try {
          await api('/api/notes', { method: 'POST', body: { case_id: state.params.id, content } });
          toast('أُضيفت الملاحظة');
          const updated = await api('/api/cases/' + state.params.id);
          state.activeCase = updated;
          const tabEl = $('#case-tab');
          if (tabEl) tabEl.innerHTML = CaseDetailView.renderTab(state.activeCase, 'notes');
          const badge = $('[data-tab="notes"] span');
          if (badge) badge.textContent = `(${updated.notes.length})`;
          bindTabSubEvents();
        } catch (err) {
          toast(err.message, 'err');
        }
      });

      $('#add-doc')?.addEventListener('click', async () => {
        await ensureCasesMini();
        docForm({ case_id: state.activeCase?.id, client_id: state.activeCase?.client_id });
      });

      $$('#case-tab [data-preview-url]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          previewModal(btn.dataset.previewUrl, btn.dataset.previewTitle, btn.dataset.previewMime);
        });
      });
    };

    $('#edit-case')?.addEventListener('click', async () => {
      caseForm(state.activeCase || await api('/api/cases/' + state.params.id));
    });

    $('#add-hearing')?.addEventListener('click', async () => {
      await ensureCasesMini();
      hearingForm({ case_id: state.params.id });
    });

    $$('[data-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        state.params.tab = b.dataset.tab;
        $$('[data-tab]').forEach((btn) => {
          const isActive = btn.dataset.tab === state.params.tab;
          btn.className = `px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition whitespace-nowrap ${isActive ? 'bg-navy-900 text-ivory' : 'bg-white border gold-hairline hover:bg-navy-900/5'}`;
        });
        const tabEl = $('#case-tab');
        if (tabEl && state.activeCase) {
          tabEl.innerHTML = CaseDetailView.renderTab(state.activeCase, state.params.tab);
          bindTabSubEvents();
        }
      });
    });

    $$('[data-go]').forEach((b) => {
      b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
    });

    bindTabSubEvents();
  },

  destroy() {
    // clean references
  }
};
