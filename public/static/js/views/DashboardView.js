import { $, state, formatNum, egp, arDate, arDateTime, esc, chip, avatar, caseRef, pageHead, ROLE } from '../core/state.js'
import { api } from '../core/api.js'

/**
 * Dashboard View Controller
 */
export const DashboardView = {
  async render() {
    const d = await api('/api/dashboard');
    state._dashboardData = d;
    const k = d.kpis;
    const kpis = [
      { l: 'قضايا متداولة', v: formatNum(k.open_cases), i: 'fa-gavel', s: `${formatNum(k.urgent_cases)} عاجلة / عالية` },
      { l: 'جلسات اليوم', v: formatNum(k.hearings_today), i: 'fa-calendar-day', s: 'أمام المحاكم وهيئات التحكيم' },
      { l: 'مهام مفتوحة', v: formatNum(k.open_tasks), i: 'fa-list-check', s: 'على فريق المكتب' },
      { l: 'متحصلات الشهر', v: egp(k.month_collected), i: 'fa-coins', s: `فُوتر ${egp(k.month_invoiced)}` },
      { l: 'مديونية قائمة', v: egp(k.outstanding), i: 'fa-scale-balanced', s: `متأخر ${egp(k.overdue)}` },
      { l: 'مصروفات الشهر', v: egp(k.month_expenses), i: 'fa-receipt', s: 'قضائية وتشغيلية' },
    ];

    return `
      ${pageHead('لوحة المكتب', `صباح الخير، ${esc(d.me.name.split(' ').slice(0, 3).join(' '))} — هذه حركة المكتب اليوم.`)}
      <section class="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3 mb-6 md:mb-8">
        ${kpis.map((x) => `
          <article class="paper-card rounded-xl p-3 md:p-4 flex flex-col justify-between">
            <div class="flex items-center justify-between text-navy-700/70 text-xs mb-2">
              <span class="truncate font-semibold">${x.l}</span><i class="fas ${x.i} text-gold-500/90 text-sm shrink-0 mr-1"></i>
            </div>
            <div class="kpi-num text-xl sm:text-2xl md:text-3xl text-navy-900 leading-tight">${x.v}</div>
            <div class="text-[10px] sm:text-[11px] text-navy-700/60 mt-1 truncate">${x.s}</div>
          </article>`).join('')}
      </section>
      <section class="grid lg:grid-cols-3 gap-5 mb-6 md:mb-8">
        <article class="lg:col-span-2 paper-card rounded-xl p-4 md:p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-amiri text-xl md:text-2xl">أجندة الجلسات القادمة</h2>
            <button data-go="hearings" class="text-xs md:text-sm text-gold-700 font-semibold hover:underline">عرض التقويم</button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-navy-700/50 text-xs">
                <tr><th class="text-right py-2">التاريخ</th><th class="text-right">القضية</th><th class="text-right">المحكمة</th><th class="text-right">المحامي</th><th></th></tr>
              </thead>
              <tbody>
                ${(d.upcoming_hearings || []).map((h) => `
                  <tr class="ledger-row border-t gold-hairline">
                    <td class="py-3 whitespace-nowrap">
                      <div class="font-semibold">${arDate(h.hearing_date)}</div>
                      <div class="text-[11px] text-navy-700/50">${esc(h.hearing_time || '')} · ${esc(h.type)}</div>
                    </td>
                    <td>
                      <button data-go="case" data-id="${h.case_id}" class="font-semibold text-navy-900 hover:text-gold-700 text-right">
                        ${caseRef(h)} — ${esc(h.case_title)}
                      </button>
                      <div class="text-[11px] text-navy-700/50">${esc(h.client_name)}</div>
                    </td>
                    <td class="text-navy-700/80">${esc(h.court_name || h.circuit || '—')}</td>
                    <td>${esc(h.lawyer_name || '—')}</td>
                    <td>${chip(h.status)}</td>
                  </tr>`).join('') || `<tr><td colspan="5" class="py-6 text-center text-navy-700/50">لا جلسات قادمة</td></tr>`}
              </tbody>
            </table>
          </div>
        </article>
        <article class="paper-card rounded-xl p-4 md:p-5">
          <h2 class="font-amiri text-xl md:text-2xl mb-4">توزيع القضايا</h2>
          <canvas id="typeChart" height="220"></canvas>
          <div class="mt-4 space-y-2">
            ${(d.by_status || []).map((s) => `
              <div class="flex items-center justify-between text-sm">
                <span>${chip(s.status)}</span><span class="kpi-num text-lg">${s.n}</span>
              </div>`).join('')}
          </div>
        </article>
      </section>
      <section class="grid lg:grid-cols-3 gap-5">
        <article class="paper-card rounded-xl p-4 md:p-5">
          <h2 class="font-amiri text-xl md:text-2xl mb-4">حمل الفريق</h2>
          <div class="space-y-3">
            ${(d.team || []).map((t) => `
              <div class="flex items-center gap-3">
                ${avatar(t, 38)}
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold truncate">${esc(t.name)}</div>
                  <div class="text-[11px] text-navy-700/50">${esc(t.title || ROLE[t.role])}</div>
                </div>
                <div class="text-left text-xs">
                  <div class="font-bold text-navy-900">${t.open_cases} قضايا</div>
                  <div class="text-navy-700/50">${t.open_tasks} مهام</div>
                </div>
              </div>`).join('')}
          </div>
        </article>
        <article class="paper-card rounded-xl p-4 md:p-5">
          <h2 class="font-amiri text-xl md:text-2xl mb-1">توكيلات قاربت على الانتهاء</h2>
          <p class="text-xs text-navy-700/50 mb-3">خلال 45 يوماً</p>
          ${(d.expiring_poa || []).length ? d.expiring_poa.map((p) => `
            <div class="border-t gold-hairline py-3">
              <div class="font-semibold text-sm">${esc(p.client_name)}</div>
              <div class="text-[12px] text-navy-700/60">${esc(p.poa_no)}</div>
              <div class="text-[12px] text-gold-700 mt-1">ينتهي ${arDate(p.expiry_date)}</div>
            </div>`).join('') : `<p class="text-sm text-navy-700/50">لا توكيلات منتهية قريباً.</p>`}
        </article>
        <article class="paper-card rounded-xl p-4 md:p-5">
          <h2 class="font-amiri text-xl md:text-2xl mb-4">سجل الحركة</h2>
          <div class="space-y-3 max-h-[360px] overflow-y-auto scroll-thin">
            ${(d.activity || []).map((a) => `
              <div class="flex gap-3">
                ${avatar(a, 32)}
                <div>
                  <div class="text-sm"><b>${esc(a.user_name || 'النظام')}</b> · ${esc(a.action)}</div>
                  <div class="text-[12px] text-navy-700/60">${esc(a.detail)}</div>
                  <div class="text-[11px] text-navy-700/40">${arDateTime(a.created_at)}</div>
                </div>
              </div>`).join('')}
          </div>
        </article>
      </section>`;
  },

  mount() {
    const el = $('#typeChart');
    if (!el || !window.Chart) return;
    if (state.charts.type) {
      try { state.charts.type.destroy(); } catch {}
    }
    const d = state._dashboardData;
    if (!d) return;
    const rows = d.by_type || [];
    state.charts.type = new window.Chart(el, {
      type: 'doughnut',
      data: {
        labels: rows.map((r) => r.name || 'غير محدد'),
        datasets: [{
          data: rows.map((r) => r.n),
          backgroundColor: ['#0B1F3A', '#C9A227', '#1F4E79', '#8B6914', '#2E5A3C', '#6B3FA0', '#8B3A3A']
        }],
      },
      options: {
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Cairo', size: 11 } } }
        },
        cutout: '62%'
      },
    });
  },

  destroy() {
    if (state.charts.type) {
      try { state.charts.type.destroy(); } catch {}
      state.charts.type = null;
    }
  }
};
