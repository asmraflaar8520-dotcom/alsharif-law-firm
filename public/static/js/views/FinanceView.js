import { $, state, egp, esc, pageHead } from '../core/state.js'
import { api } from '../core/api.js'

export const FinanceView = {
  async render() {
    const r = await api('/api/reports/finance');
    state._financeData = r;

    return `
      ${pageHead('الموقف المالي', 'الفوترة، التحصيل، والساعات غير المفوترة.')}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div class="paper-card rounded-xl p-4">
          <div class="text-xs text-navy-700/60 mb-1">ساعات غير مفوترة</div>
          <div class="kpi-num text-2xl md:text-3xl">${egp(r.unbilled?.time_value)}</div>
        </div>
        <div class="paper-card rounded-xl p-4">
          <div class="text-xs text-navy-700/60 mb-1">مصروفات قابلة للترحيل</div>
          <div class="kpi-num text-2xl md:text-3xl">${egp(r.unbilled?.exp_value)}</div>
        </div>
        <div class="paper-card rounded-xl p-4">
          <div class="text-xs text-navy-700/60 mb-1">إجمالي غير مفوتر</div>
          <div class="kpi-num text-2xl md:text-3xl">${egp(Number(r.unbilled?.time_value || 0) + Number(r.unbilled?.exp_value || 0))}</div>
        </div>
      </div>
      <div class="paper-card rounded-xl p-4 md:p-5 mb-6">
        <h3 class="font-semibold mb-3">الفوترة والتحصيل الشهري</h3>
        <canvas id="finChart" height="120"></canvas>
      </div>
      <h3 class="font-amiri text-xl md:text-2xl mb-3">الموكلون حسب المديونية</h3>
      ${(r.by_client || []).length ? r.by_client.map((c) => `
        <div class="paper-card rounded-xl p-3 mb-2 flex justify-between text-xs md:text-sm">
          <span class="font-semibold">${esc(c.name)}</span>
          <span>مستحق ${egp(c.due)} · حُصّل ${egp(c.paid)}</span>
        </div>
      `).join('') : '<p class="text-sm text-navy-700/50">لا توجد مديونيات معلقة.</p>'}`;
  },

  mount(container, router) {
    const r = state._financeData;
    const el = $('#finChart');
    if (!el || !window.Chart || !r) return;

    if (state.charts.fin) {
      state.charts.fin.destroy();
      state.charts.fin = null;
    }

    state.charts.fin = new window.Chart(el, {
      type: 'bar',
      data: {
        labels: (r.months || []).map((m) => m.m),
        datasets: [
          { label: 'مفوتر', data: (r.months || []).map((m) => m.invoiced), backgroundColor: '#0B1F3A' },
          { label: 'محصّل', data: (r.months || []).map((m) => m.paid), backgroundColor: '#C9A227' },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { font: { family: 'Cairo' } } }
        },
        scales: {
          y: { ticks: { font: { family: 'Cairo' } } },
          x: { ticks: { font: { family: 'Cairo' } } }
        }
      },
    });
  },

  destroy() {
    if (state.charts.fin) {
      state.charts.fin.destroy();
      state.charts.fin = null;
    }
    state._financeData = null;
  }
};
