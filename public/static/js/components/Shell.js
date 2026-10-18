import { $, $$, state, NAV, ROLE, avatar, esc, caseRef } from '../core/state.js'
import { api } from '../core/api.js'

/**
 * Shell Layout Component
 * Generates and binds the master application chrome:
 * Sidebar Navigation, Header with Live Global Search, User Profile Badge, and Mobile Drawer.
 */
export function shell(content) {
  const u = state.user || {};
  return `
  <div class="min-h-screen flex bg-ivory">
    <div id="mobile-overlay" class="mobile-drawer-backdrop hidden md:hidden"></div>
    <aside id="sidebar" class="w-[272px] shrink-0 marble-bg text-ivory fixed inset-y-0 right-0 z-50 transform translate-x-full transition-transform duration-300 md:translate-x-0 md:static md:sticky top-0 h-screen flex flex-col shadow-2xl md:shadow-none">
      <div class="px-5 pt-6 pb-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img src="/static/img/logo.png" alt="الشريف" class="w-14 h-14 rounded-full crest-glow object-cover"/>
          <div>
            <div class="font-corm text-gold-400 text-lg leading-tight">Al-Sharif</div>
            <div class="text-[10px] sidebar-brand text-gold-300/80 tracking-[.28em]">& PARTNERS</div>
            <div class="text-[11px] text-ivory/70 mt-1">الشريف وشركاه للمحاماة</div>
          </div>
        </div>
        <button id="close-mobile-nav" class="md:hidden text-ivory/70 hover:text-gold-400 p-2"><i class="fas fa-xmark text-lg"></i></button>
      </div>
      <div class="gold-rule mx-5 mb-3"></div>
      <nav class="flex-1 overflow-y-auto scroll-thin px-3 pb-4 space-y-0.5">
        ${NAV.map((n) => `
          <button data-go="${n.id}" class="nav-item w-full text-right flex items-center gap-3 px-3 py-2.5 rounded-md text-[13.5px] ${state.route === n.id || (n.id === 'cases' && state.route === 'case') || (n.id === 'clients' && state.route === 'client') || (n.id === 'billing' && state.route === 'invoice') ? 'active text-gold-400' : 'text-ivory/75'}">
            <i class="fas ${n.icon} w-5 text-center text-gold-500/80"></i>
            <span>${n.label}</span>
          </button>`).join('')}
      </nav>
      <div class="sidebar-user-card px-3.5 py-3.5 mt-auto shrink-0">
        <div class="sidebar-user-badge flex items-center gap-3">
          ${avatar(u, 42)}
          <div class="min-w-0 flex-1">
            <div class="text-[13.5px] font-bold text-ivory truncate">${esc(u.name || '')}</div>
            <div class="text-[11px] text-gold-400/90 truncate">${esc(u.title || ROLE[u.role] || '')}</div>
          </div>
        </div>
        <button id="logout-btn" class="mt-2.5 w-full text-[12px] text-ivory/70 hover:text-gold-300 transition-colors text-right flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gold-500/10">
          <span><i class="fas fa-right-from-bracket ml-1.5 text-gold-400/80"></i> تسجيل الخروج</span>
          <span class="text-[10px] text-ivory/40">خروج</span>
        </button>
      </div>
    </aside>
    <div class="flex-1 min-w-0 flex flex-col">
      <header class="sticky top-0 z-30 bg-ivory/95 backdrop-blur border-b gold-hairline shadow-sm">
        <div class="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-8 h-16">
          <button id="mobile-nav" class="md:hidden text-navy-900 p-2 hover:bg-gold-500/10 rounded-lg shrink-0" aria-label="فتح القائمة"><i class="fas fa-bars text-lg"></i></button>
          <div class="relative flex-1 max-w-xl">
            <i class="fas fa-magnifying-glass absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-700/50 text-sm pointer-events-none z-10"></i>
            <input id="global-search" class="input-lux search-input-header w-full" placeholder="بحث في القضايا، الموكلين، أرقام الدعاوى، التوكيلات…"/>
            <div id="search-results" class="hidden absolute top-full mt-1.5 w-full paper-card rounded-xl overflow-hidden z-50 max-h-96 overflow-y-auto shadow-2xl border border-gold-500/20"></div>
          </div>
          <div class="text-[12px] text-navy-700/70 hidden lg:block font-amiri shrink-0">
            ${new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
          </div>
          <button data-go="hearings" class="btn-navy text-sm hidden sm:inline-flex shrink-0"><i class="fas fa-calendar-plus ml-1"></i> الجلسات</button>
        </div>
      </header>
      <main class="flex-1 p-4 md:p-8 fade-in">${content}</main>

      <!-- Mobile Quick Navigation Bottom Bar -->
      <nav class="mobile-bottom-bar md:hidden no-print" aria-label="التنقل السريع">
        <button data-go="dashboard" class="mobile-bottom-item ${state.route === 'dashboard' ? 'active' : ''}">
          <i class="fas fa-landmark"></i>
          <span>الرئيسية</span>
        </button>
        <button data-go="cases" class="mobile-bottom-item ${state.route === 'cases' || state.route === 'case' ? 'active' : ''}">
          <i class="fas fa-gavel"></i>
          <span>القضايا</span>
        </button>
        <button data-go="hearings" class="mobile-bottom-item ${state.route === 'hearings' ? 'active' : ''}">
          <i class="fas fa-calendar-day"></i>
          <span>الجلسات</span>
        </button>
        <button data-go="clients" class="mobile-bottom-item ${state.route === 'clients' || state.route === 'client' ? 'active' : ''}">
          <i class="fas fa-user-tie"></i>
          <span>الموكلون</span>
        </button>
        <button id="mobile-bottom-menu" class="mobile-bottom-item">
          <i class="fas fa-bars"></i>
          <span>المزيد</span>
        </button>
      </nav>
    </div>
  </div>
  <div id="modal-root"></div>`;
}

/**
 * Updates active indicators across sidebar and mobile navigation
 */
export function updateActiveNav(route) {
  $$('#sidebar .nav-item').forEach((b) => {
    const id = b.dataset.go;
    const isActive = route === id ||
      (id === 'cases' && route === 'case') ||
      (id === 'clients' && route === 'client') ||
      (id === 'billing' && route === 'invoice');
    b.className = `nav-item w-full text-right flex items-center gap-3 px-3 py-2.5 rounded-md text-[13.5px] ${isActive ? 'active text-gold-400' : 'text-ivory/75'}`;
  });

  $$('.mobile-bottom-item').forEach((b) => {
    const id = b.dataset.go;
    const isActive = route === id ||
      (id === 'cases' && route === 'case') ||
      (id === 'clients' && route === 'client');
    b.classList.toggle('active', !!isActive);
  });
}

/**
 * Binds sidebar drawer, search autocomplete, and navigation events
 */
export function bindShellEvents(router) {
  const sidebar = $('#sidebar');
  const overlay = $('#mobile-overlay');
  const toggleMobileNav = (open) => {
    if (!sidebar || !overlay) return;
    if (open) {
      sidebar.classList.remove('translate-x-full');
      overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    } else {
      sidebar.classList.add('translate-x-full');
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }
  };

  $('#mobile-nav')?.addEventListener('click', () => toggleMobileNav(true));
  $('#mobile-bottom-menu')?.addEventListener('click', () => toggleMobileNav(true));
  $('#close-mobile-nav')?.addEventListener('click', () => toggleMobileNav(false));
  overlay?.addEventListener('click', () => toggleMobileNav(false));
  $$('#sidebar [data-go]').forEach((b) => b.addEventListener('click', () => toggleMobileNav(false)));

  $$('#sidebar [data-go], header [data-go], .mobile-bottom-item[data-go]').forEach((b) => {
    b.addEventListener('click', () => router.navigate(b.dataset.go, b.dataset.id ? { id: b.dataset.id } : {}));
  });

  $('#logout-btn')?.addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch {}
    state.user = null;
    state.activeCase = null;
    state._shellMounted = false;
    router.navigate('login');
  });

  // Global Header Search Autocomplete
  const box = $('#global-search');
  const res = $('#search-results');
  let searchTimer;
  state._searchCache = state._searchCache || {};

  box?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const q = box.value.trim();
      if (q.length < 2) {
        res?.classList.add('hidden');
        return;
      }
      let data = state._searchCache[q];
      if (!data) {
        data = await api('/api/search?q=' + encodeURIComponent(q));
        state._searchCache[q] = data;
      }
      if (!res) return;
      res.classList.remove('hidden');
      res.innerHTML = [
        ...(data.cases || []).map((c) => `<button data-go="case" data-id="${c.id}" class="block w-full text-right px-4 py-2 hover:bg-navy-900/5 text-sm transition"><b>${caseRef(c)}</b> ${esc(c.title)}<div class="text-[11px] text-navy-700/50">${esc(c.client_name)}</div></button>`),
        ...(data.clients || []).map((c) => `<button data-go="client" data-id="${c.id}" class="block w-full text-right px-4 py-2 hover:bg-navy-900/5 text-sm transition">${esc(c.name)}</button>`),
        ...(data.poas || []).map((p) => `<div class="px-4 py-2 text-xs text-navy-700/60">${esc(p.poa_no)} · ${esc(p.client_name)}</div>`),
      ].join('') || `<div class="px-4 py-3 text-sm text-navy-700/50">لا توجد نتائج مطابقة</div>`;

      $$('[data-go]', res).forEach((b) => b.addEventListener('click', () => {
        res.classList.add('hidden');
        router.navigate(b.dataset.go, b.dataset.id ? { id: b.dataset.id } : {});
      }));
    }, 250);
  });

  if (!state._docClickBound) {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#global-search') && !e.target.closest('#search-results')) {
        $('#search-results')?.classList.add('hidden');
      }
    });
    state._docClickBound = true;
  }
}
