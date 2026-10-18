import { $, $$, state, formatNum, egp, esc, chip, pageHead, empty } from '../core/state.js'
import { api } from '../core/api.js'
import { normalizePaginated, paginationBar, bindPaginationEvents } from '../components/PaginationBar.js'
import { gridSkeleton } from '../components/Skeletons.js'
import { clientForm } from '../components/Forms.js'

let _clientsDebounceTimer = null;

export const ClientsView = {
  async render() {
    const p = new URLSearchParams();
    p.set('page', state.clientsPage || 1);
    p.set('limit', state.clientsLimit || 18);
    if (state.clientsSearch) p.set('q', state.clientsSearch);

    const res = await api('/api/clients?' + p.toString());
    const norm = normalizePaginated(res, state.clientsLimit || 18);
    const list = norm.data;
    const pagination = norm.pagination;

    return `
      ${pageHead('الموكلون', `${formatNum(pagination.total)} موكل مسجل (أفراد وشركات وهيئات).`, `
        <button id="new-client" class="btn-gold"><i class="fas fa-plus ml-1"></i> موكل جديد</button>
      `)}
      <input id="client-q" class="input-lux mb-4 max-w-md" placeholder="بحث بالاسم أو الرقم القومي أو الهاتف" value="${esc(state.clientsSearch || '')}"/>
      <div id="client-section">
        <div id="client-grid" class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${ClientsView.renderCards(list)}</div>
        ${paginationBar(pagination, 'clients')}
      </div>`;
  },

  renderCards(list) {
    if (!list || !list.length) {
      return empty('fa-user-tie', 'لا موكلين مطابقين', 'غيّر نص البحث أو سجّل موكلاً جديداً.');
    }
    return list.map((c) => `
      <article class="paper-card rounded-xl p-4 md:p-5 cursor-pointer hover:-translate-y-0.5 transition" data-go="client" data-id="${c.id}">
        <div class="flex justify-between items-start">
          <div>
            <div class="text-[11px] text-gold-700 font-semibold">${c.type === 'company' ? 'شخص اعتباري' : 'شخص طبيعي'} ${c.status === 'vip' ? '· عميل استراتيجي' : ''}</div>
            <h3 class="font-amiri text-xl md:text-2xl mt-1 text-navy-950">${esc(c.name)}</h3>
          </div>
          ${chip(c.status)}
        </div>
        <p class="text-xs md:text-sm text-navy-700/70 mt-2">${esc(c.city || '')} ${c.city && c.phone ? '·' : ''} ${esc(c.phone || '')}</p>
        <div class="flex justify-between text-xs mt-4 pt-3 border-t gold-hairline font-semibold">
          <span class="text-navy-900">${formatNum(c.cases_count)} قضايا</span>
          <span class="text-gold-700">رصيد ${egp(c.balance)}</span>
        </div>
      </article>`).join('');
  },

  mount(container, router) {
    $('#new-client')?.addEventListener('click', () => clientForm());

    const clientSectionEl = $('#client-section');
    const runClients = async () => {
      const p = new URLSearchParams();
      p.set('page', state.clientsPage || 1);
      p.set('limit', state.clientsLimit || 18);
      if (state.clientsSearch) p.set('q', state.clientsSearch);

      const res = await api('/api/clients?' + p.toString());
      const norm = normalizePaginated(res, state.clientsLimit || 18);
      const gridEl = $('#client-grid');
      if (gridEl) {
        gridEl.innerHTML = ClientsView.renderCards(norm.data);
      }
      const existingPagination = $('#client-section .pagination-container');
      if (existingPagination) existingPagination.remove();
      const newPagHtml = paginationBar(norm.pagination, 'clients');
      if (newPagHtml && clientSectionEl) {
        const temp = document.createElement('div');
        temp.innerHTML = newPagHtml;
        clientSectionEl.appendChild(temp.firstElementChild);
      }
      $$('#client-grid [data-go]').forEach((b) => {
        b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
      });
    };

    $('#client-q')?.addEventListener('input', (e) => {
      clearTimeout(_clientsDebounceTimer);
      _clientsDebounceTimer = setTimeout(() => {
        state.clientsPage = 1;
        state.clientsSearch = e.target.value.trim();
        const gridEl = $('#client-grid');
        if (gridEl) gridEl.innerHTML = gridSkeleton(6);
        runClients();
      }, 300);
    });

    if (clientSectionEl) {
      bindPaginationEvents(clientSectionEl, 'clients', async (targetPage) => {
        if (targetPage !== state.clientsPage) {
          state.clientsPage = targetPage;
          const gridEl = $('#client-grid');
          if (gridEl) gridEl.innerHTML = gridSkeleton(6);
          await runClients();
        }
      });
      $$('#client-grid [data-go]').forEach((b) => {
        b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
      });
    }
  },

  destroy() {
    clearTimeout(_clientsDebounceTimer);
    _clientsDebounceTimer = null;
  }
};
