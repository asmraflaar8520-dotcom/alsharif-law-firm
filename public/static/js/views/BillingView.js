import { $, $$, egp, arDate, esc, chip, caseRef, pageHead } from '../core/state.js'
import { api } from '../core/api.js'
import { invoiceForm, paymentForm, expenseForm, ensureCasesMini } from '../components/Forms.js'

export const BillingView = {
  async render() {
    const [inv, pays, exp] = await Promise.all([
      api('/api/invoices'),
      api('/api/payments'),
      api('/api/expenses')
    ]);

    return `
      ${pageHead('الأتعاب والفواتير', 'إصدار، تحصيل، ومصروفات قضائية.', `
        <button id="new-expense" class="btn-ghost"><i class="fas fa-receipt ml-1"></i> مصروف</button>
        <button id="new-payment" class="btn-navy"><i class="fas fa-coins ml-1"></i> قيد تحصيل</button>
        <button id="new-invoice" class="btn-gold"><i class="fas fa-file-invoice-dollar ml-1"></i> فاتورة أتعاب</button>
      `)}
      <div class="flex gap-2 mb-4 overflow-x-auto pb-1">
        ${['الكل', 'مسودة', 'صادرة', 'جزئي', 'متأخرة', 'مسددة'].map((s, i) => `
          <button data-inv-f="${i ? s : ''}" class="px-3 py-1 rounded-full text-xs md:text-sm border gold-hairline bg-white hover:bg-navy-900/5 transition whitespace-nowrap">
            ${s}
          </button>
        `).join('')}
      </div>
      <div id="inv-table">${BillingView.renderTable(inv)}</div>
      <h3 class="font-amiri text-xl md:text-2xl mt-8 md:mt-10 mb-3">التحصيلات</h3>
      <div class="paper-card rounded-xl overflow-hidden mb-8">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-xs text-navy-700/50">
              <tr>
                <th class="text-right p-3">التاريخ</th>
                <th class="text-right">الموكل</th>
                <th class="text-right">الفاتورة</th>
                <th class="text-right">الوسيلة</th>
                <th class="text-right">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${(pays || []).map((p) => `
                <tr class="border-t gold-hairline">
                  <td class="p-3 whitespace-nowrap">${arDate(p.paid_at)}</td>
                  <td>${esc(p.client_name)}</td>
                  <td>${esc(p.invoice_no || '')}</td>
                  <td>${esc(p.method)}</td>
                  <td class="font-bold p-3">${egp(p.amount)}</td>
                </tr>
              `).join('') || '<tr><td colspan="5" class="p-4 text-center text-navy-700/50">لا توجد تحصيلات مسجلة بعد</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <h3 class="font-amiri text-xl md:text-2xl mb-3">المصروفات</h3>
      <div class="paper-card rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-xs text-navy-700/50">
              <tr>
                <th class="text-right p-3">التاريخ</th>
                <th class="text-right">البيان</th>
                <th class="text-right">التصنيف</th>
                <th class="text-right">القضية</th>
                <th class="text-right">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${(exp || []).map((e) => `
                <tr class="border-t gold-hairline">
                  <td class="p-3 whitespace-nowrap">${arDate(e.expense_date)}</td>
                  <td>${esc(e.title)}</td>
                  <td>${esc(e.category)}</td>
                  <td>${e.case_no ? caseRef(e) : '—'}</td>
                  <td class="font-bold p-3">${egp(e.amount)}</td>
                </tr>
              `).join('') || '<tr><td colspan="5" class="p-4 text-center text-navy-700/50">لا توجد مصروفات مسجلة بعد</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  renderTable(inv) {
    return `
      <div class="paper-card rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-navy-900 text-ivory/80 text-xs">
              <tr>
                <th class="text-right p-3">الرقم</th>
                <th class="text-right">الموكل</th>
                <th class="text-right">القضية</th>
                <th class="text-right">الإصدار</th>
                <th class="text-right">الإجمالي</th>
                <th class="text-right">المدفوع</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${(inv || []).map((i) => `
                <tr class="border-t gold-hairline ledger-row cursor-pointer" data-go="invoice" data-id="${i.id}">
                  <td class="p-3 font-bold whitespace-nowrap">${esc(i.invoice_no)}</td>
                  <td>${esc(i.client_name)}</td>
                  <td>${i.case_no ? caseRef(i) : '—'}</td>
                  <td class="whitespace-nowrap">${arDate(i.issue_date)}</td>
                  <td class="whitespace-nowrap">${egp(i.total)}</td>
                  <td class="whitespace-nowrap">${egp(i.paid)}</td>
                  <td class="p-3">${chip(i.status)}</td>
                </tr>
              `).join('') || '<tr><td colspan="7" class="p-4 text-center text-navy-700/50">لا توجد فواتير</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  mount(container, router) {
    $('#new-expense')?.addEventListener('click', async () => {
      await ensureCasesMini();
      expenseForm();
    });

    $('#new-payment')?.addEventListener('click', () => {
      paymentForm();
    });

    $('#new-invoice')?.addEventListener('click', async () => {
      await ensureCasesMini();
      invoiceForm();
    });

    $$('[data-inv-f]', container).forEach((b) => {
      b.addEventListener('click', async () => {
        const s = b.dataset.invF;
        const list = await api('/api/invoices' + (s ? '?status=' + encodeURIComponent(s) : ''));
        const tableEl = $('#inv-table');
        if (tableEl) {
          tableEl.innerHTML = BillingView.renderTable(list);
          $$('#inv-table [data-go]').forEach((x) => {
            x.addEventListener('click', () => router.navigate(x.dataset.go, { id: x.dataset.id }));
          });
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
