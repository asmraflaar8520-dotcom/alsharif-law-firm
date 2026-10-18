import { $, $$, state, formatNum, egp, arDate, arDateTime, esc, chip, avatar, caseRef, pageHead, ROLE } from '../core/state.js'
import { api } from '../core/api.js'
import { toast } from '../components/Toast.js'

/**
 * Dashboard View Controller
 * Features Executive KPIs, Egyptian Statutory Deadlines Radar, Upcoming Hearings Agenda, and Case Distribution.
 */
export const DashboardView = {
  async render() {
    const [d, radar] = await Promise.all([
      api('/api/dashboard'),
      api('/api/deadlines/radar').catch(() => ({ urgent: [], warning: [], total_pending: 0, expired_count: 0 }))
    ]);

    state._dashboardData = d;
    state._radarData = radar;

    const k = d.kpis;
    const kpis = [
      { l: 'قضايا متداولة', v: formatNum(k.open_cases), i: 'fa-gavel', s: `${formatNum(k.urgent_cases)} عاجلة / عالية` },
      { l: 'جلسات اليوم', v: formatNum(k.hearings_today), i: 'fa-calendar-day', s: 'أمام المحاكم وهيئات التحكيم' },
      { l: 'مهام مفتوحة', v: formatNum(k.open_tasks), i: 'fa-list-check', s: 'على فريق المكتب' },
      { l: 'متحصلات الشهر', v: egp(k.month_collected), i: 'fa-coins', s: `فُوتر ${egp(k.month_invoiced)}` },
      { l: 'مديونية قائمة', v: egp(k.outstanding), i: 'fa-scale-balanced', s: `متأخر ${egp(k.overdue)}` },
      { l: 'مصروفات الشهر', v: egp(k.month_expenses), i: 'fa-receipt', s: 'قضائية وتشغيلية' },
    ];

    const radarItems = [...(radar.urgent || []), ...(radar.warning || [])];

    return `
      ${pageHead('لوحة المكتب', `صباح الخير، ${esc(d.me.name.split(' ').slice(0, 3).join(' '))} — حركة المكتب ومواعيد الطعون القانونية اليوم.`)}
      
      <!-- Executive Deadlines Radar Widget -->
      ${radarItems.length > 0 ? `
        <section class="widget-deadlines">
          <div class="widget-deadlines__header">
            <div class="widget-deadlines__title">
              <span class="widget-deadlines__beacon"></span>
              <i class="fas fa-radar text-red-600 ml-1"></i> رادار مواعيد الطعون القانونية (قانون المرافعات والإجراءات)
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold border border-red-200">
                ${radarItems.length} مواعيد وشيكة
              </span>
            </div>
            <div class="text-xs text-navy-700/60 font-semibold">
              اليوم التالي للحكم مستبعد قانوناً · يبدأ الحساب وفقاً للمدد الإجرائية المقررة
            </div>
          </div>
          <div class="widget-deadlines__list">
            ${radarItems.map((item) => {
              const isUrgent = item.alert_level === 'urgent' || item.alert_level === 'expired';
              const days = item.remaining_days;
              let countdownText = '';
              if (days < 0) countdownText = `متجاوز منذ ${Math.abs(days)} يوم`;
              else if (days === 0) countdownText = 'ينتهي اليوم!';
              else if (days === 1) countdownText = 'باقٍ يوم واحد';
              else if (days === 2) countdownText = 'باقٍ يومان';
              else countdownText = `باقٍ ${days} أيام`;

              return `
                <div class="widget-deadlines__item ${isUrgent ? 'widget-deadlines__item--urgent' : 'widget-deadlines__item--warning'}">
                  <div class="widget-deadlines__info">
                    <div class="widget-deadlines__type">
                      <i class="fas ${isUrgent ? 'fa-triangle-exclamation text-red-600' : 'fa-clock text-amber-600'} ml-1"></i>
                      ${esc(item.deadline_label)}: ${item.case_no ? `قضية ${esc(item.case_no)}/${esc(item.year)}` : ''} — ${esc(item.case_title || '')}
                    </div>
                    <div class="widget-deadlines__meta">
                      الموكل: <b>${esc(item.client_name || '—')}</b> · صدر الحكم: ${arDate(item.judgment_date)} · الاستحقاق الأخير: <b>${arDate(item.due_date)}</b>
                      ${item.law_reference ? ` · <span class="opacity-75">(${esc(item.law_reference)})</span>` : ''}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="widget-deadlines__countdown">
                      ${countdownText}
                    </span>
                    <button type="button" class="btn-ghost text-xs py-1 px-2.5" data-go="case" data-id="${item.case_id}">
                      الملف
                    </button>
                    <button type="button" class="widget-deadlines__action" data-mark-filed="${item.id}" title="تسجيل قيد الطعن بقلم كتاب المحكمة">
                      <i class="fas fa-check ml-1"></i> قُيّد الطعن
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      ` : `
        <div class="paper-card rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 mb-6 flex items-center justify-between text-xs text-emerald-900">
          <div class="flex items-center gap-2">
            <i class="fas fa-shield-halved text-emerald-600 text-base"></i>
            <span><b>رادار الطعون في النطاق الآمن:</b> لا توجد مواعيد استئناف أو نقض حرجة مستحقة خلال الأيام السبعة القادمة.</span>
          </div>
          <span class="font-bold text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-300">
            ${radar.total_pending} ميعاد مسجل سارٍ
          </span>
        </div>
      `}

      <!-- Executive KPIs Grid -->
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

      <!-- Main Agenda & Chart Grid -->
      <section class="grid lg:grid-cols-3 gap-5 mb-6 md:mb-8">
        <article class="lg:col-span-2 paper-card rounded-xl p-4 md:p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-amiri text-xl md:text-2xl font-bold text-navy-950">أجندة الجلسات القادمة</h2>
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
          <h2 class="font-amiri text-xl md:text-2xl mb-4 font-bold text-navy-950">توزيع القضايا</h2>
          <canvas id="typeChart" height="220"></canvas>
          <div class="mt-4 space-y-2">
            ${(d.by_status || []).map((s) => `
              <div class="flex items-center justify-between text-sm">
                <span>${chip(s.status)}</span><span class="kpi-num text-lg">${s.n}</span>
              </div>`).join('')}
          </div>
        </article>
      </section>

      <!-- Workload & Activities Grid -->
      <section class="grid lg:grid-cols-3 gap-5">
        <article class="paper-card rounded-xl p-4 md:p-5">
          <h2 class="font-amiri text-xl md:text-2xl mb-4 font-bold text-navy-950">حمل الفريق</h2>
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
          <h2 class="font-amiri text-xl md:text-2xl mb-1 font-bold text-navy-950">توكيلات قاربت على الانتهاء</h2>
          <p class="text-xs text-navy-700/50 mb-3">خلال 45 يوماً</p>
          ${(d.expiring_poa || []).length ? d.expiring_poa.map((p) => `
            <div class="border-t gold-hairline py-3">
              <div class="font-semibold text-sm">${esc(p.client_name)}</div>
              <div class="text-[12px] text-navy-700/60">${esc(p.poa_no)}</div>
              <div class="text-[12px] text-gold-700 mt-1 font-semibold">ينتهي ${arDate(p.expiry_date)}</div>
            </div>`).join('') : `<p class="text-sm text-navy-700/50">لا توكيلات منتهية قريباً.</p>`}
        </article>
        <article class="paper-card rounded-xl p-4 md:p-5">
          <h2 class="font-amiri text-xl md:text-2xl mb-4 font-bold text-navy-950">سجل الحركة</h2>
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

  mount(container, router) {
    // 1. Chart.js Doughnut Initialization
    const el = $('#typeChart');
    if (el && window.Chart) {
      if (state.charts.type) {
        try { state.charts.type.destroy(); } catch {}
      }
      const d = state._dashboardData;
      if (d) {
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
      }
    }

    // 2. Mark Deadline as Filed Quick Action
    $$('[data-mark-filed]', container).forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.markFiled;
        try {
          await api('/api/deadlines/' + id, { method: 'PUT', body: { status: 'filed' } });
          toast('تم تسجيل قيد الطعن بنجاح وإخراجه من الرادار');
          router.refresh();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    });

    // 3. Navigation Links
    $$('[data-go]', container).forEach((b) => {
      b.addEventListener('click', () => router.navigate(b.dataset.go, b.dataset.id ? { id: b.dataset.id } : {}));
    });
  },

  destroy() {
    if (state.charts.type) {
      try { state.charts.type.destroy(); } catch {}
      state.charts.type = null;
    }
  }
};
