import { $, $$, state, arDate, esc, chip, pageHead } from '../core/state.js'
import { api } from '../core/api.js'
import { previewModal } from '../components/Modal.js'
import { poaForm } from '../components/Forms.js'

export const POAsView = {
  async render() {
    const list = await api('/api/poas');
    return `
      ${pageHead('التوكيلات', 'العامة والخاصة والرسمية.', `<button id="new-poa" class="btn-gold"><i class="fas fa-plus ml-1"></i> توكيل جديد</button>`)}
      <div class="paper-card rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-navy-900 text-ivory/80 text-xs">
              <tr>
                <th class="text-right p-3">الرقم</th>
                <th class="text-right">الموكل</th>
                <th class="text-right">النوع</th>
                <th class="text-right">التوثيق</th>
                <th class="text-right">الانتهاء</th>
                <th class="text-right">الحالة</th>
                <th class="text-center p-3">الملف والإجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${(list || []).map((p) => `
                <tr class="border-t gold-hairline ledger-row">
                  <td class="p-3 font-semibold whitespace-nowrap">${esc(p.poa_no)}</td>
                  <td>${esc(p.client_name)}</td>
                  <td>${esc(p.type)}</td>
                  <td>${esc(p.notary_office || '—')}</td>
                  <td class="whitespace-nowrap">${arDate(p.expiry_date)}</td>
                  <td class="p-3">${chip(p.status)}</td>
                  <td class="p-3 text-center whitespace-nowrap">
                    ${p.file_url ? `
                      <div class="inline-flex items-center gap-1">
                        <button type="button" class="btn-ghost text-xs py-1 px-2.5" data-preview-url="${esc(p.file_url)}" data-preview-title="توكيل رقم ${esc(p.poa_no)}" data-preview-mime="${esc(p.mime_type || '')}" title="معاينة المستند">
                          <i class="fas fa-eye text-gold-600"></i> معاينة
                        </button>
                        <a href="${esc(p.file_url)}?download=1" download class="btn-ghost text-xs py-1 px-2.5 hover:text-gold-700" title="تحميل">
                          <i class="fas fa-download"></i> تحميل
                        </a>
                      </div>
                    ` : `<span class="text-xs text-navy-700/40">بدون مرفق</span>`}
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="7" class="p-6 text-center text-navy-700/50">لا توجد توكيلات مسجلة بعد</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  mount(container, router) {
    $('#new-poa')?.addEventListener('click', () => {
      poaForm();
    });

    $$('[data-preview-url]', container).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        previewModal(btn.dataset.previewUrl, btn.dataset.previewTitle, btn.dataset.previewMime);
      });
    });

    $$('[data-go]', container).forEach((b) => {
      b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
    });
  },

  destroy() {
    // No active timers
  }
};
