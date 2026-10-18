import { $, $$, arDate, esc, caseRef, pageHead } from '../core/state.js'
import { api } from '../core/api.js'
import { timeForm, ensureCasesMini } from '../components/Forms.js'

export const TimeView = {
  async render() {
    const list = await api('/api/time');
    const total = (list || []).reduce((s, t) => s + Number(t.hours), 0);

    return `
      ${pageHead('ساعات العمل', `إجمالي السجل المعروض: ${total.toFixed(1)} ساعة.`, `
        <button id="new-time" class="btn-gold"><i class="fas fa-plus ml-1"></i> تسجيل ساعات</button>
      `)}
      <div class="paper-card rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-xs text-navy-700/50 bg-navy-900 text-ivory/80">
              <tr>
                <th class="text-right p-3">التاريخ</th>
                <th class="text-right">المحامي</th>
                <th class="text-right">القضية</th>
                <th class="text-right">الوصف</th>
                <th class="text-right">الساعات</th>
              </tr>
            </thead>
            <tbody>
              ${(list || []).map((t) => `
                <tr class="border-t gold-hairline ledger-row">
                  <td class="p-3 whitespace-nowrap">${arDate(t.work_date)}</td>
                  <td>${esc(t.user_name)}</td>
                  <td>${t.case_no ? caseRef(t) : '—'}</td>
                  <td>${esc(t.description || '')}</td>
                  <td class="font-bold p-3">${t.hours}</td>
                </tr>
              `).join('') || '<tr><td colspan="5" class="p-4 text-center text-navy-700/50">لا توجد ساعات عمل مسجلة</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  mount(container, router) {
    $('#new-time')?.addEventListener('click', async () => {
      await ensureCasesMini();
      timeForm();
    });

    $$('[data-go]', container).forEach((b) => {
      b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
    });
  },

  destroy() {
    // cleanup
  }
};
