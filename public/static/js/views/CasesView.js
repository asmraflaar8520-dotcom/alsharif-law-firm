import { $, $$, state, formatNum, arDate, esc, chip, pchip, avatar, caseRef, pageHead, empty } from '../core/state.js'
import { api } from '../core/api.js'
import { normalizePaginated, paginationBar, bindPaginationEvents } from '../components/PaginationBar.js'
import { tableSkeleton } from '../components/Skeletons.js'
import { caseForm } from '../components/Forms.js'

let _casesDebounceTimer = null;

export const CasesView = {
  async render() {
    const p = new URLSearchParams();
    p.set('page', state.casesPage || 1);
    p.set('limit', state.casesLimit || 20);
    if (state.casesFilters?.q) p.set('q', state.casesFilters.q);
    if (state.casesFilters?.status) p.set('status', state.casesFilters.status);
    if (state.casesFilters?.priority) p.set('priority', state.casesFilters.priority);
    if (state.casesFilters?.lawyer) p.set('lawyer', state.casesFilters.lawyer);
    if (state.casesFilters?.type) p.set('type', state.casesFilters.type);

    const res = await api('/api/cases?' + p.toString());
    const norm = normalizePaginated(res, state.casesLimit || 20);
    const list = norm.data;
    const pagination = norm.pagination;
    const L = state.lookups || { users: [], case_types: [] };

    return `
      ${pageHead('سجل القضايا', `${formatNum(pagination.total)} قضية في الأرشيف الحي للمكتب.`, `
        <button id="new-case" class="btn-gold"><i class="fas fa-plus ml-1"></i> قيد قضية جديدة</button>
      `)}
      <div class="paper-card rounded-xl p-3 md:p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
        <input id="f-q" class="input-lux" placeholder="بحث بالرقم أو الخصم أو الموكل" value="${esc(state.casesFilters?.q || '')}"/>
        <select id="f-status" class="input-lux">
          <option value="">كل الحالات</option>
          ${['متداولة', 'محجوزة للحكم', 'موقوفة', 'منتهية'].map((s) => `<option value="${s}" ${state.casesFilters?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select id="f-pri" class="input-lux">
          <option value="">كل الأولويات</option>
          ${['عاجلة', 'عالية', 'عادية', 'منخفضة'].map((s) => `<option value="${s}" ${state.casesFilters?.priority === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select id="f-lawyer" class="input-lux">
          <option value="">كل المحامين</option>
          ${(L.users || []).map((u) => `<option value="${u.id}" ${state.casesFilters?.lawyer == u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
        </select>
        <select id="f-type" class="input-lux">
          <option value="">كل الأنواع</option>
          ${(L.case_types || []).map((t) => `<option value="${t.id}" ${state.casesFilters?.type == t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
        </select>
      </div>
      <div id="cases-table">${CasesView.renderTable(list, pagination)}</div>`;
  },

  renderTable(list, pagination) {
    if (!list || !list.length) {
      return empty('fa-gavel', 'لا قضايا مطابقة', 'غيّر عوامل التصفية أو قيد قضية جديدة.');
    }
    return `
      <div class="paper-card rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-navy-900 text-ivory/80 text-xs">
              <tr>
                <th class="text-right p-3">الرقم</th>
                <th class="text-right">الموضوع</th>
                <th class="text-right">الموكل</th>
                <th class="text-right">المحكمة</th>
                <th class="text-right">المحامي</th>
                <th class="text-right">الجلسة القادمة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${list.map((c) => `
                <tr class="ledger-row border-t gold-hairline cursor-pointer" data-go="case" data-id="${c.id}">
                  <td class="p-3 whitespace-nowrap font-bold text-navy-900">
                    ${caseRef(c)}
                    <div class="text-[11px] font-normal text-navy-700/50">${esc(c.degree)} · ${esc(c.type_name || '')}</div>
                  </td>
                  <td class="max-w-xs">
                    <div class="font-semibold">${esc(c.title)}</div>
                    <div class="text-[11px] text-navy-700/50 truncate">${esc(c.opposing_name || '')}</div>
                  </td>
                  <td>${esc(c.client_name)}</td>
                  <td>
                    ${esc(c.court_name || '—')}
                    <div class="text-[11px] text-navy-700/50">${esc(c.circuit || '')}</div>
                  </td>
                  <td>
                    <span class="inline-flex items-center gap-2">
                      ${avatar({ initials: c.lawyer_initials, color: c.lawyer_color }, 26)}
                      ${esc(c.lawyer_name || '—')}
                    </span>
                  </td>
                  <td class="whitespace-nowrap">${c.next_hearing ? arDate(c.next_hearing) : '—'}</td>
                  <td class="whitespace-nowrap p-3">${pchip(c.priority)} ${chip(c.status)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ${pagination ? paginationBar(pagination, 'cases') : ''}`;
  },

  mount(container, router) {
    $('#new-case')?.addEventListener('click', () => caseForm());

    const casesTableEl = $('#cases-table');
    const runCases = async () => {
      const p = new URLSearchParams();
      p.set('page', state.casesPage || 1);
      p.set('limit', state.casesLimit || 20);
      if (state.casesFilters?.q) p.set('q', state.casesFilters.q);
      if (state.casesFilters?.status) p.set('status', state.casesFilters.status);
      if (state.casesFilters?.priority) p.set('priority', state.casesFilters.priority);
      if (state.casesFilters?.lawyer) p.set('lawyer', state.casesFilters.lawyer);
      if (state.casesFilters?.type) p.set('type', state.casesFilters.type);

      const res = await api('/api/cases?' + p.toString());
      const norm = normalizePaginated(res, state.casesLimit || 20);
      if (casesTableEl) {
        casesTableEl.innerHTML = CasesView.renderTable(norm.data, norm.pagination);
        $$('#cases-table [data-go]').forEach((b) => {
          b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
        });
      }
    };

    const onCasesFilterChange = () => {
      state.casesPage = 1;
      state.casesFilters = {
        q: $('#f-q')?.value.trim() || '',
        status: $('#f-status')?.value || '',
        priority: $('#f-pri')?.value || '',
        lawyer: $('#f-lawyer')?.value || '',
        type: $('#f-type')?.value || ''
      };
      if (casesTableEl) casesTableEl.innerHTML = tableSkeleton(6);
      runCases();
    };

    ['f-status', 'f-pri', 'f-lawyer', 'f-type'].forEach((id) => {
      $('#' + id)?.addEventListener('change', onCasesFilterChange);
    });

    $('#f-q')?.addEventListener('input', () => {
      clearTimeout(_casesDebounceTimer);
      _casesDebounceTimer = setTimeout(onCasesFilterChange, 300);
    });

    if (casesTableEl) {
      bindPaginationEvents(casesTableEl, 'cases', async (targetPage) => {
        if (targetPage !== state.casesPage) {
          state.casesPage = targetPage;
          casesTableEl.innerHTML = tableSkeleton(6);
          await runCases();
        }
      });
      $$('#cases-table [data-go]').forEach((b) => {
        b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
      });
    }
  },

  destroy() {
    clearTimeout(_casesDebounceTimer);
    _casesDebounceTimer = null;
  }
};
