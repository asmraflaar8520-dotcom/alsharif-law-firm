import { $, $$, state, egp, esc, chip, pageHead, empty } from '../core/state.js'
import { api } from '../core/api.js'
import { clientForm } from '../components/Forms.js'
import { CasesView } from './CasesView.js'

export const ClientDetailView = {
  async render() {
    const c = await api('/api/clients/' + state.params.id);
    state._activeClient = c;

    return `
      <button data-go="clients" class="text-sm text-gold-700 mb-3 hover:underline inline-flex items-center gap-1">
        <i class="fas fa-arrow-right"></i> الموكلون
      </button>
      ${pageHead(c.name, `${c.type === 'company' ? 'شخص اعتباري' : 'شخص طبيعي'} · ${esc(c.city || '')}`, `
        <button id="edit-client" class="btn-ghost"><i class="fas fa-pen-to-square ml-1"></i> تعديل</button>
      `)}
      <div class="grid md:grid-cols-3 gap-3 mb-6">
        <div class="paper-card rounded-xl p-4 text-sm leading-7">
          <div><span class="text-navy-700/50">الهاتف:</span> ${esc(c.phone || '—')}</div>
          <div><span class="text-navy-700/50">البريد:</span> ${esc(c.email || '—')}</div>
          <div><span class="text-navy-700/50">العنوان:</span> ${esc(c.address || '—')}</div>
          <div><span class="text-navy-700/50">${c.type === 'company' ? 'ضريبي:' : 'قومي:'}</span> ${esc(c.type === 'company' ? c.tax_id : c.national_id) || '—'}</div>
          <div><span class="text-navy-700/50">المحامي:</span> ${esc(c.lawyer_name || '—')}</div>
        </div>
        <div class="md:col-span-2 paper-card rounded-xl p-4">
          <h3 class="font-semibold mb-2">ملاحظات داخلية</h3>
          <p class="leading-8 text-sm md:text-base">${esc(c.notes || '—')}</p>
        </div>
      </div>
      <h3 class="font-amiri text-xl md:text-2xl mb-3">القضايا</h3>
      ${CasesView.renderTable((c.cases || []).map((x) => ({ ...x, client_name: c.name })))}
      <h3 class="font-amiri text-xl md:text-2xl mt-8 mb-3">التوكيلات</h3>
      ${(c.poas || []).length ? (c.poas || []).map((p) => `
        <div class="paper-card rounded-xl p-3 mb-2 flex justify-between text-sm">
          <span>${esc(p.poa_no)} · ${esc(p.type)}</span>
          ${chip(p.status)}
        </div>
      `).join('') : empty('fa-scroll', 'لا توكيلات', '')}
      <h3 class="font-amiri text-xl md:text-2xl mt-8 mb-3">الفواتير</h3>
      ${(c.invoices || []).length ? (c.invoices || []).map((i) => `
        <div class="paper-card rounded-xl p-3 mb-2 flex justify-between">
          <button data-go="invoice" data-id="${i.id}" class="font-semibold hover:text-gold-700">
            ${esc(i.invoice_no)}
          </button>
          <span>${egp(i.total)} ${chip(i.status)}</span>
        </div>
      `).join('') : '<p class="text-sm text-navy-700/50">لا توجد فواتير بعد</p>'}`;
  },

  mount(container, router) {
    $('#edit-client')?.addEventListener('click', async () => {
      clientForm(state._activeClient || await api('/api/clients/' + state.params.id));
    });

    $$('[data-go]', container).forEach((b) => {
      b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
    });
  },

  destroy() {
    state._activeClient = null;
  }
};
