import { $, $$, egp, arDate, esc, chip, pageHead } from '../core/state.js'
import { api } from '../core/api.js'
import { contractForm } from '../components/Forms.js'

export const ContractsView = {
  async render() {
    const list = await api('/api/contracts');

    return `
      ${pageHead('عقود الأتعاب', 'اتفاقيات الاستشارة والأتعاب السنوية.', `
        <button id="new-contract" class="btn-gold"><i class="fas fa-plus ml-1"></i> عقد جديد</button>
      `)}
      <div class="space-y-3">
        ${(list || []).map((c) => `
          <article class="paper-card rounded-xl p-4 md:p-5 flex flex-wrap justify-between items-center gap-2">
            <div>
              <div class="font-amiri text-lg md:text-xl font-bold text-navy-950">${esc(c.title)}</div>
              <div class="text-xs md:text-sm text-navy-700/60 mt-1">${esc(c.client_name)} · ${esc(c.type)} · ${arDate(c.start_date)}</div>
            </div>
            <div class="text-left">
              <div class="kpi-num text-xl md:text-2xl">${egp(c.value)}</div>
              <div class="mt-1">${chip(c.status)}</div>
            </div>
          </article>
        `).join('') || '<p class="paper-card rounded-xl p-8 text-center text-navy-700/50">لا توجد عقود مسجلة بعد</p>'}
      </div>`;
  },

  mount(container, router) {
    $('#new-contract')?.addEventListener('click', () => {
      contractForm();
    });

    $$('[data-go]', container).forEach((b) => {
      b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
    });
  },

  destroy() {
    // cleanup
  }
};
