import { $, $$, arDate, esc, chip, pchip, pageHead } from '../core/state.js'
import { api } from '../core/api.js'
import { toast } from '../components/Toast.js'
import { taskForm, ensureCasesMini } from '../components/Forms.js'

export const TasksView = {
  async render() {
    const list = await api('/api/tasks');
    const cols = ['مفتوحة', 'جارية', 'مكتملة'];
    return `
      ${pageHead('مهام المكتب', 'صياغة، إعلانات، أبحاث، ومتابعات.', `<button id="new-task" class="btn-gold"><i class="fas fa-plus ml-1"></i> مهمة جديدة</button>`)}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${cols.map((st) => `
          <section>
            <h3 class="font-semibold mb-3 flex items-center gap-2">
              ${chip(st)}
              <span class="text-xs text-navy-700/50">(${(list || []).filter((t) => t.status === st).length})</span>
            </h3>
            ${(list || []).filter((t) => t.status === st).map((t) => `
              <article class="paper-card rounded-xl p-4 mb-3">
                <div class="flex justify-between items-center">
                  ${pchip(t.priority)}
                  <span class="text-[11px] text-navy-700/60">${arDate(t.due_date)}</span>
                </div>
                <div class="font-semibold mt-2 text-sm md:text-base">${esc(t.title)}</div>
                ${t.description ? `<p class="text-xs text-navy-700/60 mt-1 line-clamp-2">${esc(t.description)}</p>` : ''}
                <div class="text-xs text-navy-700/50 mt-2">${esc(t.assignee_name || '')} ${t.case_no ? '· ' + esc(t.case_no) + '/' + esc(t.year) : ''}</div>
                <div class="mt-3 pt-2 border-t gold-hairline flex gap-2 justify-end">
                  ${st === 'مفتوحة' ? `<button data-start="${t.id}" class="text-xs text-navy-700 hover:text-navy-950 font-semibold p-1">بدء العمل</button>` : ''}
                  ${st !== 'مكتملة' ? `<button data-done="${t.id}" class="text-xs text-gold-700 hover:text-gold-800 font-semibold p-1">تعليم كمكتملة</button>` : ''}
                </div>
              </article>
            `).join('') || `<p class="text-xs md:text-sm text-navy-700/40">لا توجد مهام في هذه القائمة</p>`}
          </section>
        `).join('')}
      </div>`;
  },

  mount(container, router) {
    $('#new-task')?.addEventListener('click', async () => {
      await ensureCasesMini();
      taskForm();
    });

    $$('[data-start]', container).forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.dataset.start;
        try {
          await api('/api/tasks/' + id, { method: 'PUT', body: { status: 'جارية' } });
          toast('تم تحويل المهمة إلى جارية');
          router.refresh();
        } catch (e) {
          toast(e.message, 'err');
        }
      });
    });

    $$('[data-done]', container).forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.dataset.done;
        try {
          await api('/api/tasks/' + id, { method: 'PUT', body: { status: 'مكتملة' } });
          toast('أُنجزت المهمة');
          router.refresh();
        } catch (e) {
          toast(e.message, 'err');
        }
      });
    });

    $$('[data-go]', container).forEach((b) => {
      b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
    });
  },

  destroy() {
    // cleanup
  }
};
