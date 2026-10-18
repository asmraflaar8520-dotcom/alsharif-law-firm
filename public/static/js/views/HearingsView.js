import { $, $$, state, formatNum, arDate, todayISO, esc, chip, avatar, caseRef, pageHead, empty } from '../core/state.js'
import { api } from '../core/api.js'
import { normalizePaginated, paginationBar, bindPaginationEvents } from '../components/PaginationBar.js'
import { tableSkeleton } from '../components/Skeletons.js'
import { hearingForm, ensureCasesMini } from '../components/Forms.js'

let _hearingsDebounceTimer = null;

export const HearingsView = {
  async render() {
    const currentTab = state.hearingsTab || 'calendar';
    const from = new Date(); from.setDate(1);
    const to = new Date(from.getFullYear(), from.getMonth() + 3, 0);

    // Continuous Agenda data for calendar
    const agendaRes = await api(`/api/hearings?from=${todayISO(from)}&to=${todayISO(to)}&all=1`);
    const agendaList = Array.isArray(agendaRes) ? agendaRes : (agendaRes.data || []);

    // Paginated table data
    const p = new URLSearchParams();
    p.set('page', state.hearingsPage || 1);
    p.set('limit', state.hearingsLimit || 20);
    if (state.hearingsSearch) p.set('search', state.hearingsSearch);
    if (state.hearingsStatus) p.set('status', state.hearingsStatus);

    const tableRes = await api('/api/hearings?' + p.toString());
    const normTable = normalizePaginated(tableRes, state.hearingsLimit || 20);
    const tableList = normTable.data;
    const tablePagination = normTable.pagination;

    const today = todayISO();
    const groups = {};
    agendaList.forEach((h) => { (groups[h.hearing_date] ||= []).push(h); });
    const days = [];
    const start = new Date(); start.setDate(start.getDate() - 1);
    for (let i = 0; i < 21; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      days.push(todayISO(d));
    }

    return `
      ${pageHead('أجندة وسجل الجلسات', `${formatNum(tablePagination.total)} جلسة مسجلة بالمكتب.`, `
        <button id="new-hearing" class="btn-gold"><i class="fas fa-plus ml-1"></i> قيد جلسة جديدة</button>
      `)}
      <div class="flex gap-2 mb-4 border-b gold-hairline pb-2">
        <button type="button" class="px-4 py-2 text-sm font-bold rounded-lg transition ${currentTab === 'calendar' ? 'bg-navy-900 text-gold-soft' : 'bg-transparent text-navy-800 hover:bg-navy-900/5'}" data-hearings-tab="calendar">
          <i class="fas fa-calendar-alt ml-1"></i> التقويم والأجندة
        </button>
        <button type="button" class="px-4 py-2 text-sm font-bold rounded-lg transition ${currentTab === 'table' ? 'bg-navy-900 text-gold-soft' : 'bg-transparent text-navy-800 hover:bg-navy-900/5'}" data-hearings-tab="table">
          <i class="fas fa-list-ul ml-1"></i> جدول الجلسات والبحث (${formatNum(tablePagination.total)})
        </button>
      </div>

      <!-- Calendar View -->
      <div id="hearings-calendar-view" class="${currentTab === 'calendar' ? '' : 'hidden'}">
        <div class="grid lg:grid-cols-3 gap-4">
          <div class="lg:col-span-2 space-y-3">
            ${days.map((d) => {
              const items = groups[d] || [];
              const isT = d === today;
              return `<section class="paper-card rounded-xl p-3 md:p-4 ${isT ? 'ring-1 ring-gold-500' : ''}">
                <div class="flex items-center justify-between mb-2">
                  <h3 class="font-amiri text-lg md:text-xl">${arDate(d)}${isT ? ' · اليوم' : ''}</h3>
                  <span class="text-xs text-navy-700/50">${items.length} جلسة</span>
                </div>
                ${items.length ? items.map((h) => `
                  <button data-go="case" data-id="${h.case_id}" class="w-full text-right border-t gold-hairline py-3 hover:bg-navy-900/[.03] transition">
                    <div class="flex justify-between gap-2">
                      <div>
                        <div class="font-semibold text-xs md:text-sm">${esc(h.hearing_time || '—')} · ${esc(h.type)} — ${caseRef(h)}</div>
                        <div class="text-xs md:text-sm text-navy-800">${esc(h.case_title)}</div>
                        <div class="text-[11px] text-navy-700/50">${esc(h.court_name || h.circuit || '')} · ${esc(h.lawyer_name || '')}</div>
                      </div>
                      ${chip(h.status)}
                    </div>
                  </button>`).join('') : `<p class="text-xs md:text-sm text-navy-700/40">لا جلسات</p>`}
              </section>`;
            }).join('')}
          </div>
          <aside class="paper-card rounded-xl p-4 md:p-5 h-fit sticky top-24">
            <h3 class="font-amiri text-xl mb-3">توزيع المحامين</h3>
            ${Object.entries(agendaList.reduce((a, h) => { a[h.lawyer_name || 'غير معيّن'] = (a[h.lawyer_name || 'غير معيّن'] || 0) + 1; return a; }, {})).map(([n, v]) => `
              <div class="flex justify-between text-sm py-1.5 border-b gold-hairline"><span>${esc(n)}</span><b>${v}</b></div>`).join('')}
          </aside>
        </div>
      </div>

      <!-- Table View with Pagination & Debounced Search -->
      <div id="hearings-table-view" class="${currentTab === 'table' ? '' : 'hidden'}">
        <div class="paper-card rounded-xl p-3 md:p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input id="hearing-q" class="input-lux sm:col-span-2" placeholder="بحث بالدعوى، المحكمة، الدائرة، أو المحامي..." value="${esc(state.hearingsSearch || '')}"/>
          <select id="hearing-status-filter" class="input-lux">
            <option value="">كل الحالات</option>
            ${['قادمة', 'تمت', 'تأجيل', 'حجز للحكم', 'شطب'].map((s) => `<option value="${s}" ${state.hearingsStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div id="hearings-table-container">
          ${HearingsView.renderTable(tableList, tablePagination)}
        </div>
      </div>
    `;
  },

  renderTable(list, pagination) {
    if (!list || !list.length) {
      return empty('fa-calendar-times', 'لا توجد جلسات مطابقة', 'غيّر عوامل التصفية أو قيد جلسة جديدة.');
    }
    return `
      <div class="paper-card rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-navy-900 text-ivory/80 text-xs">
              <tr>
                <th class="text-right p-3">التاريخ والوقت</th>
                <th class="text-right">الدعوى</th>
                <th class="text-right">المحكمة والدائرة</th>
                <th class="text-right">المحامي الحاضر</th>
                <th class="text-right">الغرض / القرار</th>
                <th class="text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((h) => `
                <tr class="ledger-row border-t gold-hairline cursor-pointer" data-go="case" data-id="${h.case_id}">
                  <td class="p-3 whitespace-nowrap">
                    <div class="font-bold text-navy-900">${arDate(h.hearing_date)}</div>
                    <div class="text-[11px] text-navy-700/50">${esc(h.hearing_time || 'صباحاً')}</div>
                  </td>
                  <td>
                    <div class="font-semibold">${caseRef(h)}</div>
                    <div class="text-xs text-navy-700/60 truncate">${esc(h.case_title)}</div>
                  </td>
                  <td>
                    <div>${esc(h.court_name || '—')}</div>
                    <div class="text-[11px] text-navy-700/50">${esc(h.circuit || '—')}</div>
                  </td>
                  <td>
                    <span class="inline-flex items-center gap-2">
                      ${avatar({ initials: h.initials, color: h.color }, 24)}
                      ${esc(h.lawyer_name || 'غير معيّن')}
                    </span>
                  </td>
                  <td>
                    <div class="text-xs">${esc(h.purpose || h.result || '—')}</div>
                  </td>
                  <td class="p-3 whitespace-nowrap">${chip(h.status)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ${pagination ? paginationBar(pagination, 'hearings') : ''}
    `;
  },

  mount(container, router) {
    $('#new-hearing')?.addEventListener('click', async () => {
      await ensureCasesMini();
      hearingForm({ case_id: state.params.id });
    });

    // Tab Switcher (Calendar vs Table)
    $$('[data-hearings-tab]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const tab = tabBtn.dataset.hearingsTab;
        state.hearingsTab = tab;
        if (tab === 'calendar') {
          $('#hearings-calendar-view')?.classList.remove('hidden');
          $('#hearings-table-view')?.classList.add('hidden');
        } else {
          $('#hearings-calendar-view')?.classList.add('hidden');
          $('#hearings-table-view')?.classList.remove('hidden');
        }
        $$('[data-hearings-tab]').forEach((b) => {
          if (b.dataset.hearingsTab === tab) {
            b.className = 'px-4 py-2 text-sm font-bold rounded-lg transition bg-navy-900 text-gold-soft';
          } else {
            b.className = 'px-4 py-2 text-sm font-bold rounded-lg transition bg-transparent text-navy-800 hover:bg-navy-900/5';
          }
        });
      });
    });

    const hearingsTableContainer = $('#hearings-table-container');
    const runHearings = async () => {
      const p = new URLSearchParams();
      p.set('page', state.hearingsPage || 1);
      p.set('limit', state.hearingsLimit || 20);
      if (state.hearingsSearch) p.set('search', state.hearingsSearch);
      if (state.hearingsStatus) p.set('status', state.hearingsStatus);

      const res = await api('/api/hearings?' + p.toString());
      const norm = normalizePaginated(res, state.hearingsLimit || 20);
      if (hearingsTableContainer) {
        hearingsTableContainer.innerHTML = HearingsView.renderTable(norm.data, norm.pagination);
        $$('#hearings-table-container [data-go]').forEach((b) => {
          b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
        });
      }
    };

    $('#hearing-q')?.addEventListener('input', (e) => {
      clearTimeout(_hearingsDebounceTimer);
      _hearingsDebounceTimer = setTimeout(() => {
        state.hearingsPage = 1;
        state.hearingsSearch = e.target.value.trim();
        if (hearingsTableContainer) hearingsTableContainer.innerHTML = tableSkeleton(6);
        runHearings();
      }, 300);
    });

    $('#hearing-status-filter')?.addEventListener('change', (e) => {
      state.hearingsPage = 1;
      state.hearingsStatus = e.target.value;
      if (hearingsTableContainer) hearingsTableContainer.innerHTML = tableSkeleton(6);
      runHearings();
    });

    if (hearingsTableContainer) {
      bindPaginationEvents(hearingsTableContainer, 'hearings', async (targetPage) => {
        if (targetPage !== state.hearingsPage) {
          state.hearingsPage = targetPage;
          hearingsTableContainer.innerHTML = tableSkeleton(6);
          await runHearings();
        }
      });
    }

    $$('[data-go]', container).forEach((b) => {
      b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
    });
  },

  destroy() {
    clearTimeout(_hearingsDebounceTimer);
    _hearingsDebounceTimer = null;
  }
};
