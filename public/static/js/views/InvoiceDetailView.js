import { $, egp, arDate, esc, chip, caseRef } from '../core/state.js'
import { api } from '../core/api.js'
import { paymentForm } from '../components/Forms.js'

export const InvoiceDetailView = {
  async render(params) {
    const id = params?.id;
    const i = await api('/api/invoices/' + id);
    InvoiceDetailView._currentInvoice = i;

    return `
      <button data-go="billing" class="text-sm text-gold-700 mb-3 hover:underline no-print inline-flex items-center gap-1">
        <i class="fas fa-arrow-right"></i> عودة للفواتير
      </button>
      <div class="paper-card rounded-xl p-5 md:p-8 print-sheet mx-auto shadow-md" id="invoice-sheet">
        <div class="flex justify-between items-start mb-6">
          <div class="flex items-center gap-3">
            <img src="/static/img/logo.png" class="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover" alt="شعار المكتب"/>
            <div>
              <div class="font-amiri text-xl md:text-2xl text-navy-900">الشريف وشركاه للمحاماة</div>
              <div class="text-xs text-navy-700/60">Al-Sharif & Partners · القاهرة</div>
            </div>
          </div>
          <div class="text-left">
            <div class="text-xs text-gold-700 font-bold">فاتورة أتعاب</div>
            <div class="kpi-num text-2xl md:text-3xl">${esc(i.invoice_no)}</div>
            ${chip(i.status)}
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4 text-xs md:text-sm mb-6">
          <div>
            <div class="text-navy-700/50">الموكل</div>
            <div class="font-semibold text-sm md:text-base">${esc(i.client_name)}</div>
            <div>${esc(i.address || '')}</div>
          </div>
          <div class="text-left">
            <div>التاريخ: ${arDate(i.issue_date)}</div>
            <div>الاستحقاق: ${arDate(i.due_date)}</div>
            ${i.case_no ? `<div>القضية: ${caseRef(i)}</div>` : ''}
          </div>
        </div>
        <div class="overflow-x-auto mb-4">
          <table class="w-full text-xs md:text-sm">
            <thead class="bg-navy-900 text-ivory text-xs">
              <tr>
                <th class="text-right p-2">البيان</th>
                <th class="text-right">الكمية</th>
                <th class="text-right">السعر</th>
                <th class="text-right">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${(i.items || []).map((it) => `
                <tr class="border-b gold-hairline">
                  <td class="p-2">${esc(it.description)}</td>
                  <td>${it.qty}</td>
                  <td>${egp(it.unit_price)}</td>
                  <td>${egp(it.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="text-left space-y-1 text-xs md:text-sm">
          <div>المجموع: ${egp(i.subtotal)}</div>
          <div>ضريبة القيمة المضافة 14%: ${egp(i.tax)}</div>
          ${Number(i.discount) ? `<div>خصم: ${egp(i.discount)}</div>` : ''}
          <div class="kpi-num text-2xl md:text-3xl text-navy-900 font-bold mt-2">المستحق ${egp(i.total)}</div>
          <div>المدفوع ${egp(i.paid)} · المتبقي ${egp(Number(i.total) - Number(i.paid))}</div>
        </div>
        ${i.notes ? `<p class="text-xs mt-6 text-navy-700/60 border-t gold-hairline pt-3">${esc(i.notes)}</p>` : ''}
      </div>
      <div class="no-print flex justify-center gap-2 mt-4">
        <button id="print-invoice-btn" class="btn-navy"><i class="fas fa-print ml-1"></i> طباعة الفاتورة</button>
        ${Number(i.paid) < Number(i.total) ? `<button id="pay-this" class="btn-gold"><i class="fas fa-coins ml-1"></i> تسجيل دفعة</button>` : ''}
      </div>`;
  },

  mount(container, router) {
    const i = InvoiceDetailView._currentInvoice;

    $('#print-invoice-btn')?.addEventListener('click', () => {
      window.print();
    });

    $('#pay-this')?.addEventListener('click', () => {
      if (!i) return;
      paymentForm({
        client_id: i.client_id,
        invoice_id: i.id,
        amount: Math.max(0, Number(i.total) - Number(i.paid))
      });
    });

    $('[data-go="billing"]', container)?.addEventListener('click', () => {
      router.navigate('billing');
    });
  },

  destroy() {
    InvoiceDetailView._currentInvoice = null;
  }
};
