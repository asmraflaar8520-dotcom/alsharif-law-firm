/* الشريف وشركاه — نظام إدارة المكتب */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  user: null,
  lookups: { courts: [], case_types: [], users: [], clients: [] },
  route: 'dashboard',
  params: {},
  cache: {},
  activeCase: null,
  toastTimer: null,
  charts: {},
};

const ROLE = {
  managing_partner: 'الشريك المدير',
  partner: 'شريك',
  senior: 'محامٍ أول',
  lawyer: 'محامٍ',
  intern: 'تحت التمرين',
  secretary: 'سكرتارية',
  accountant: 'محاسب',
  admin: 'إدارة',
};

const PRI = { عاجلة: 'badge-urgent', عالية: 'badge-high', عادية: 'badge-normal', منخفضة: 'badge-low' };
const CST = {
  متداولة: 'status-open', 'محجوزة للحكم': 'status-hold', موقوفة: 'status-stop', منتهية: 'status-done',
  قادمة: 'status-open', تمت: 'status-done', تأجيل: 'status-hold', شطب: 'status-late', 'حجز للحكم': 'status-hold',
  مسودة: 'status-draft', صادرة: 'status-open', جزئي: 'status-part', مسددة: 'status-paid', متأخرة: 'status-late', ملغاة: 'status-stop',
  ساري: 'status-paid', 'منتهٍ': 'status-late', ملغى: 'status-stop', مفتوحة: 'status-open', جارية: 'status-hold', مكتملة: 'status-done',
  vip: 'badge-high', active: 'status-open', inactive: 'status-stop',
};

function egp(n) {
  const v = Number(n || 0);
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(v) + ' ج.م';
}
function arDate(d) {
  if (!d) return '—';
  const x = String(d).slice(0, 10);
  try { return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(x)); }
  catch { return x; }
}
function arDateTime(d) {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(String(d).replace(' ', 'T'))); }
  catch { return d; }
}
function todayISO(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function chip(status) {
  const cls = CST[status] || 'status-open';
  return `<span class="chip ${cls}">${esc(status || '—')}</span>`;
}
function pchip(p) { return `<span class="chip ${PRI[p] || 'badge-normal'}">${esc(p || 'عادية')}</span>`; }
function avatar(u, size = 36) {
  const ini = esc(u?.initials || (u?.name || '?').slice(0, 2));
  const col = /^#[0-9a-fA-F]{3,8}$/.test(u?.color || '') ? u.color : '#1F4E79';
  return `<span class="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 shadow-sm" style="width:${size}px;height:${size}px;background:${col};font-size:${Math.round(size * 0.34)}px">${ini}</span>`;
}
function caseRef(c) { return `${esc(c.case_no)} / ${esc(c.year)}`; }

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    state.user = null;
    if (state.route !== 'login') render();
    throw new Error(data.error || 'غير مصرح');
  }
  if (!res.ok) throw new Error(data.error || 'تعذّر تنفيذ الطلب');
  return data;
}

function toast(msg, type = 'ok') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-lg text-sm font-semibold shadow-2xl transition-all duration-300';
    document.body.appendChild(el);
  }
  el.style.background = type === 'err' ? '#7A1F1F' : '#0B1F3A';
  el.style.color = '#F6F1E7';
  el.style.border = '1px solid rgba(201,162,39,.45)';
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2800);
}

function go(route, params = {}) {
  state.route = route;
  state.params = params;
  let hash = '#/';
  if (route === 'case' && params.id) hash = `#/cases/${params.id}`;
  else if (route === 'client' && params.id) hash = `#/clients/${params.id}`;
  else if (route === 'invoice' && params.id) hash = `#/invoices/${params.id}`;
  else if (route !== 'dashboard') hash = `#/${route}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
  render();
}

function parseHash() {
  const h = (location.hash || '#/').replace(/^#/, '');
  const parts = h.split('/').filter(Boolean);
  if (!parts.length) return { route: 'dashboard', params: {} };
  if ((parts[0] === 'cases' || parts[0] === 'case') && parts[1]) return { route: 'case', params: { id: parts[1] } };
  if ((parts[0] === 'clients' || parts[0] === 'client') && parts[1]) return { route: 'client', params: { id: parts[1] } };
  if ((parts[0] === 'invoices' || parts[0] === 'invoice') && parts[1]) return { route: 'invoice', params: { id: parts[1] } };
  return { route: parts[0], params: {} };
}

/* ───────────── Layout ───────────── */
const NAV = [
  { id: 'dashboard', icon: 'fa-landmark', label: 'لوحة المكتب' },
  { id: 'cases', icon: 'fa-gavel', label: 'القضايا' },
  { id: 'hearings', icon: 'fa-calendar-day', label: 'الجلسات' },
  { id: 'clients', icon: 'fa-user-tie', label: 'الموكلون' },
  { id: 'tasks', icon: 'fa-list-check', label: 'المهام' },
  { id: 'poas', icon: 'fa-scroll', label: 'التوكيلات' },
  { id: 'documents', icon: 'fa-folder-open', label: 'المستندات' },
  { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'الأتعاب والفواتير' },
  { id: 'finance', icon: 'fa-chart-line', label: 'المالية' },
  { id: 'time', icon: 'fa-clock', label: 'ساعات العمل' },
  { id: 'team', icon: 'fa-users', label: 'الفريق' },
  { id: 'contracts', icon: 'fa-file-contract', label: 'العقود' },
];

function shell(content) {
  const u = state.user;
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
      <div class="px-4 py-4 border-t border-gold-500/20">
        <div class="flex items-center gap-3">
          ${avatar(u, 40)}
          <div class="min-w-0">
            <div class="text-sm font-semibold truncate">${esc(u.name)}</div>
            <div class="text-[11px] text-gold-400/80 truncate">${esc(u.title || ROLE[u.role])}</div>
          </div>
        </div>
        <button id="logout-btn" class="mt-3 w-full text-[12px] text-ivory/60 hover:text-gold-400 text-right">
          <i class="fas fa-right-from-bracket ml-1"></i> تسجيل الخروج
        </button>
      </div>
    </aside>
    <div class="flex-1 min-w-0 flex flex-col">
      <header class="sticky top-0 z-30 bg-ivory/90 backdrop-blur border-b gold-hairline">
        <div class="flex items-center gap-3 px-4 md:px-8 h-16">
          <button id="mobile-nav" class="md:hidden text-navy-900 p-2" aria-label="فتح القائمة"><i class="fas fa-bars text-lg"></i></button>
          <div class="relative flex-1 max-w-xl">
            <i class="fas fa-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-navy-700/40 text-sm"></i>
            <input id="global-search" class="input-lux pr-9" placeholder="بحث في القضايا، الموكلين، أرقام الدعاوى، التوكيلات…"/>
            <div id="search-results" class="hidden absolute top-full mt-1 w-full paper-card rounded-lg overflow-hidden z-40 max-h-96 overflow-y-auto"></div>
          </div>
          <div class="text-[12px] text-navy-700/70 hidden lg:block font-amiri">
            ${new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
          </div>
          <button data-go="hearings" class="btn-navy text-sm"><i class="fas fa-calendar-plus ml-1"></i> الجلسات</button>
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

function loginView() {
  return `
  <div class="min-h-screen marble-bg relative overflow-hidden">
    <img src="/static/img/hero.jpg" alt="" class="absolute inset-0 w-full h-full object-cover opacity-35" loading="eager"/>
    <div class="absolute inset-0 bg-gradient-to-l from-navy-950/90 via-navy-900/80 to-navy-950/40"></div>
    <div class="relative min-h-screen grid lg:grid-cols-2">
      <div class="hidden lg:flex flex-col justify-end p-16 text-ivory">
        <p class="font-corm text-gold-400 tracking-[.4em] text-sm mb-4">EST. CAIRO · 1988</p>
        <h1 class="font-amiri text-5xl leading-tight mb-4">مكتب الشريف<br/>وشركاه للمحاماة</h1>
        <div class="gold-rule w-48 mb-6"></div>
        <p class="max-w-md text-ivory/80 leading-8 text-lg">نظام إدارة المكتب المتكامل — القضايا، الجلسات، التوكيلات، الأتعاب، والفريق في منصة واحدة تليق بمكتب أمام النقض.</p>
        <p class="mt-10 text-gold-400/80 text-sm font-corm tracking-widest">AL-SHARIF & PARTNERS</p>
      </div>
      <div class="flex items-center justify-center p-4 md:p-6">
        <form id="login-form" class="w-full max-w-md paper-card rounded-2xl p-6 md:p-10 shadow-2xl">
          <div class="flex justify-center mb-5">
            <img src="/static/img/logo.png" class="w-20 h-20 md:w-24 md:h-24 rounded-full crest-glow object-cover" alt="الشعار"/>
          </div>
          <h2 class="text-center font-amiri text-2xl md:text-3xl text-navy-900 mb-1">دخول المكتب</h2>
          <p class="text-center text-xs md:text-sm text-navy-700/60 mb-6 md:mb-8">للمحامين والشركاء والإدارة فقط</p>
          <label class="block text-sm mb-1 font-semibold">البريد الإلكتروني</label>
          <input id="login-email" name="email" type="email" required placeholder="ahmed@alsharif.law" class="input-lux mb-4" autocomplete="username"/>
          <label class="block text-sm mb-1 font-semibold">كلمة المرور</label>
          <input id="login-pass" name="password" type="password" required placeholder="••••••••" class="input-lux mb-6" autocomplete="current-password"/>
          <button class="btn-gold w-full py-3 text-base">دخول النظام</button>
          <p id="login-err" class="text-red-800 text-sm mt-3 text-center hidden"></p>
          <div class="gold-rule my-6"></div>
          <div class="text-[12px] text-navy-700/60 leading-6 text-center">
            <button type="button" id="fill-demo" class="text-gold-700 hover:text-gold-500 font-semibold underline underline-offset-4 cursor-pointer transition">
              اضغط هنا لتعبئة بيانات الحساب التجريبي تلقائياً
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

function empty(icon, title, sub) {
  return `<div class="paper-card rounded-xl p-8 md:p-12 text-center text-navy-700/60">
    <i class="fas ${icon} text-3xl text-gold-500 mb-3"></i>
    <div class="font-semibold text-navy-900">${title}</div>
    <div class="text-sm mt-1">${sub || ''}</div>
  </div>`;
}

function pageHead(title, sub, actions = '') {
  return `<div class="flex flex-wrap items-end justify-between gap-3 mb-6">
    <div>
      <div class="text-[11px] tracking-[.25em] text-gold-700 font-semibold mb-1">AL-SHARIF & PARTNERS</div>
      <h1 class="font-amiri text-2xl md:text-4xl text-navy-900">${esc(title)}</h1>
      ${sub ? `<p class="text-xs md:text-sm text-navy-700/70 mt-1">${sub}</p>` : ''}
    </div>
    <div class="flex flex-wrap gap-2">${actions}</div>
  </div>`;
}

/* ───────────── Dashboard ───────────── */
async function viewDashboard() {
  const d = await api('/api/dashboard');
  state._dashboardData = d;
  const k = d.kpis;
  const kpis = [
    { l: 'قضايا متداولة', v: k.open_cases, i: 'fa-gavel', s: `${k.urgent_cases} عاجلة / عالية` },
    { l: 'جلسات اليوم', v: k.hearings_today, i: 'fa-calendar-day', s: 'أمام المحاكم وهيئات التحكيم' },
    { l: 'مهام مفتوحة', v: k.open_tasks, i: 'fa-list-check', s: 'على فريق المكتب' },
    { l: 'متحصلات الشهر', v: egp(k.month_collected), i: 'fa-coins', s: `فُوتر ${egp(k.month_invoiced)}` },
    { l: 'مديونية قائمة', v: egp(k.outstanding), i: 'fa-scale-balanced', s: `متأخر ${egp(k.overdue)}` },
    { l: 'مصروفات الشهر', v: egp(k.month_expenses), i: 'fa-receipt', s: 'قضائية وتشغيلية' },
  ];
  return `
    ${pageHead('لوحة المكتب', `صباح الخير، ${esc(d.me.name.split(' ').slice(0, 3).join(' '))} — هذه حركة المكتب اليوم.`)}
    <section class="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3 mb-6 md:mb-8">
      ${kpis.map((x) => `
        <article class="paper-card rounded-xl p-3 md:p-4">
          <div class="flex items-center justify-between text-navy-700/60 text-xs mb-2">
            <span class="truncate">${x.l}</span><i class="fas ${x.i} text-gold-500"></i>
          </div>
          <div class="kpi-num text-2xl md:text-3xl text-navy-900">${x.v}</div>
          <div class="text-[10px] md:text-[11px] text-navy-700/55 mt-1 truncate">${x.s}</div>
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
}

function drawTypeChart(d) {
  const el = $('#typeChart');
  if (!el || !window.Chart) return;
  if (state.charts.type) state.charts.type.destroy();
  const rows = d.by_type || [];
  state.charts.type = new Chart(el, {
    type: 'doughnut',
    data: {
      labels: rows.map((r) => r.name || 'غير محدد'),
      datasets: [{ data: rows.map((r) => r.n), backgroundColor: ['#0B1F3A', '#C9A227', '#1F4E79', '#8B6914', '#2E5A3C', '#6B3FA0', '#8B3A3A'] }],
    },
    options: { plugins: { legend: { position: 'bottom', labels: { font: { family: 'Cairo', size: 11 } } } }, cutout: '62%' },
  });
}

/* ───────────── Cases ───────────── */
async function viewCases() {
  const list = await api('/api/cases');
  const L = state.lookups;
  return `
    ${pageHead('سجل القضايا', `${list.length} قضية في الأرشيف الحي للمكتب.`, `
      <button id="new-case" class="btn-gold"><i class="fas fa-plus ml-1"></i> قيد قضية جديدة</button>
    `)}
    <div class="paper-card rounded-xl p-3 md:p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
      <input id="f-q" class="input-lux" placeholder="بحث بالرقم أو الخصم أو الموكل"/>
      <select id="f-status" class="input-lux"><option value="">كل الحالات</option>${['متداولة', 'محجوزة للحكم', 'موقوفة', 'منتهية'].map((s) => `<option>${s}</option>`).join('')}</select>
      <select id="f-pri" class="input-lux"><option value="">كل الأولويات</option>${['عاجلة', 'عالية', 'عادية', 'منخفضة'].map((s) => `<option>${s}</option>`).join('')}</select>
      <select id="f-lawyer" class="input-lux"><option value="">كل المحامين</option>${L.users.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select>
      <select id="f-type" class="input-lux"><option value="">كل الأنواع</option>${L.case_types.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
    </div>
    <div id="cases-table">${casesTable(list)}</div>`;
}

function casesTable(list) {
  if (!list.length) return empty('fa-gavel', 'لا قضايا مطابقة', 'غيّر عوامل التصفية أو قيد قضية جديدة.');
  return `<div class="paper-card rounded-xl overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-navy-900 text-ivory/80 text-xs">
          <tr>
            <th class="text-right p-3">الرقم</th><th class="text-right">الموضوع</th><th class="text-right">الموكل</th>
            <th class="text-right">المحكمة</th><th class="text-right">المحامي</th><th class="text-right">الجلسة القادمة</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${list.map((c) => `
            <tr class="ledger-row border-t gold-hairline cursor-pointer" data-go="case" data-id="${c.id}">
              <td class="p-3 whitespace-nowrap font-bold text-navy-900">${caseRef(c)}<div class="text-[11px] font-normal text-navy-700/50">${esc(c.degree)} · ${esc(c.type_name || '')}</div></td>
              <td class="max-w-xs"><div class="font-semibold">${esc(c.title)}</div><div class="text-[11px] text-navy-700/50 truncate">${esc(c.opposing_name || '')}</div></td>
              <td>${esc(c.client_name)}</td>
              <td>${esc(c.court_name || '—')}<div class="text-[11px] text-navy-700/50">${esc(c.circuit || '')}</div></td>
              <td><span class="inline-flex items-center gap-2">${avatar({ initials: c.lawyer_initials, color: c.lawyer_color }, 26)} ${esc(c.lawyer_name || '—')}</span></td>
              <td class="whitespace-nowrap">${c.next_hearing ? arDate(c.next_hearing) : '—'}</td>
              <td class="whitespace-nowrap p-3">${pchip(c.priority)} ${chip(c.status)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function viewCase() {
  const c = await api('/api/cases/' + state.params.id);
  state.activeCase = c;
  const tabs = [
    ['hearings', 'الجلسات', c.hearings.length],
    ['docs', 'المستندات', c.documents.length],
    ['notes', 'الملاحظات', c.notes.length],
    ['tasks', 'المهام', c.tasks.length],
    ['finance', 'المالية', c.invoices.length],
    ['time', 'الساعات', c.time_entries.length],
    ['team', 'الفريق', c.lawyers.length],
  ];
  const tab = state.params.tab || 'hearings';
  return `
    <button data-go="cases" class="text-sm text-gold-700 mb-3 hover:underline inline-flex items-center gap-1"><i class="fas fa-arrow-right"></i> عودة للسجل</button>
    ${pageHead(c.title, `${caseRef(c)} · ${esc(c.client_name)} · ${esc(c.court_name || c.degree)}`, `
      <button id="edit-case" class="btn-ghost">تعديل</button>
      <button id="add-hearing" class="btn-navy">جلسة جديدة</button>
    `)}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="paper-card rounded-xl p-3 md:p-4"><div class="text-xs text-navy-700/50">الحالة</div><div class="mt-1 flex flex-wrap gap-1">${chip(c.status)} ${pchip(c.priority)}</div></div>
      <div class="paper-card rounded-xl p-3 md:p-4"><div class="text-xs text-navy-700/50">الخصم / محاميه</div><div class="font-semibold mt-1 truncate">${esc(c.opposing_name || '—')}</div><div class="text-xs text-navy-700/60 truncate">${esc(c.opposing_lawyer || '')}</div></div>
      <div class="paper-card rounded-xl p-3 md:p-4"><div class="text-xs text-navy-700/50">قيمة المطالبة</div><div class="kpi-num text-xl md:text-2xl">${c.claim_value ? egp(c.claim_value) : '—'}</div></div>
      <div class="paper-card rounded-xl p-3 md:p-4"><div class="text-xs text-navy-700/50">المحامي المسؤول</div><div class="font-semibold mt-1 truncate">${esc(c.lawyer_name || '—')}</div></div>
    </div>
    <div class="paper-card rounded-xl p-4 md:p-5 mb-5">
      <h3 class="font-semibold mb-2">موضوع الدعوى</h3>
      <p class="leading-8 text-navy-800 text-sm md:text-base">${esc(c.subject || '—')}</p>
      ${c.next_action ? `<p class="mt-3 text-sm"><span class="text-gold-700 font-semibold">الإجراء التالي:</span> ${esc(c.next_action)}</p>` : ''}
      ${c.outcome ? `<p class="mt-2 text-sm"><span class="font-semibold">المنطوق / النتيجة:</span> ${esc(c.outcome)}</p>` : ''}
    </div>
    <div class="flex gap-1 overflow-x-auto mb-4 pb-1">
      ${tabs.map(([id, l, n]) => `<button data-tab="${id}" class="px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition whitespace-nowrap ${tab === id ? 'bg-navy-900 text-ivory' : 'bg-white border gold-hairline hover:bg-navy-900/5'}">${l} <span class="opacity-60 text-xs">(${n})</span></button>`).join('')}
    </div>
    <div id="case-tab">${caseTab(c, tab)}</div>`;
}

function caseTab(c, tab) {
  if (tab === 'hearings') {
    return `<div class="paper-card rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs text-navy-700/50"><tr><th class="text-right p-3">التاريخ</th><th class="text-right">النوع</th><th class="text-right">الغرض</th><th class="text-right">النتيجة</th><th></th></tr></thead>
          <tbody>${c.hearings.map((h) => `
            <tr class="border-t gold-hairline ledger-row">
              <td class="p-3 whitespace-nowrap">${arDate(h.hearing_date)} <span class="text-navy-700/50">${esc(h.hearing_time || '')}</span>
                <div class="text-[11px]">${esc(h.court_name || h.circuit || '')}</div></td>
              <td>${esc(h.type)}</td><td>${esc(h.purpose || '')}</td><td>${esc(h.result || '—')}</td><td>${chip(h.status)}</td>
            </tr>`).join('') || '<tr><td class="p-6 text-navy-700/50" colspan="5">لا جلسات مسجلة بعد</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
  }
  if (tab === 'docs') {
    return `<div class="flex justify-end mb-3"><button id="add-doc" class="btn-gold text-sm">إضافة مستند</button></div>
      <div class="grid md:grid-cols-2 gap-3">${c.documents.map((d) => `
        <article class="paper-card rounded-xl p-4">
          <div class="text-xs text-gold-700">${esc(d.doc_type)}</div>
          <div class="font-semibold">${esc(d.title)}</div>
          <div class="text-xs text-navy-700/50 mt-1">${esc(d.ref_no || '')} · ${arDate(d.date_issued)} · ${d.pages || '—'} صفحات</div>
        </article>`).join('') || empty('fa-folder-open', 'لا مستندات', '')}</div>`;
  }
  if (tab === 'notes') {
    return `<form id="note-form" class="paper-card rounded-xl p-3 md:p-4 mb-3 flex gap-2">
      <input name="content" class="input-lux flex-1" placeholder="أضف ملاحظة على الملف…" required/>
      <button class="btn-gold shrink-0">حفظ</button></form>
      <div id="notes-list">${c.notes.map((n) => `<article class="paper-card rounded-xl p-4 mb-2 ${n.pinned ? 'ring-1 ring-gold-500' : ''}">
        <div class="text-xs text-navy-700/50 mb-1">${esc(n.user_name || 'عضو بالفريق')} · ${arDateTime(n.created_at)}</div>
        <p class="leading-7 text-sm md:text-base">${esc(n.content)}</p>
      </article>`).join('') || empty('fa-note-sticky', 'لا ملاحظات مسجلة', '')}</div>`;
  }
  if (tab === 'tasks') {
    return c.tasks.length ? c.tasks.map((t) => `<div class="paper-card rounded-xl p-3 md:p-4 mb-2 flex items-center justify-between">
      <div><div class="font-semibold text-sm md:text-base">${esc(t.title)}</div><div class="text-xs text-navy-700/50">${esc(t.assignee_name || '')} · ${arDate(t.due_date)}</div></div>
      ${chip(t.status)}</div>`).join('') : empty('fa-list', 'لا مهام', '');
  }
  if (tab === 'finance') {
    const exp = c.expenses.reduce((s, e) => s + Number(e.amount), 0);
    return `<div class="grid grid-cols-2 gap-3 mb-4">
      <div class="paper-card rounded-xl p-3 md:p-4">فواتير: ${c.invoices.length}<div class="kpi-num text-xl md:text-2xl">${egp(c.invoices.reduce((s, i) => s + Number(i.total), 0))}</div></div>
      <div class="paper-card rounded-xl p-3 md:p-4">مصروفات<div class="kpi-num text-xl md:text-2xl">${egp(exp)}</div></div>
    </div>
    ${c.invoices.map((i) => `<div class="paper-card rounded-xl p-3 mb-2 flex justify-between text-sm"><span>${esc(i.invoice_no)}</span><span>${egp(i.total)} ${chip(i.status)}</span></div>`).join('')}
    <h4 class="font-semibold mt-4 mb-2">المصروفات</h4>
    ${c.expenses.map((e) => `<div class="text-sm flex justify-between border-t gold-hairline py-2"><span>${esc(e.title)}</span><span>${egp(e.amount)}</span></div>`).join('') || '—'}`;
  }
  if (tab === 'time') {
    return c.time_entries.length ? c.time_entries.map((t) => `<div class="paper-card rounded-xl p-3 mb-2 flex justify-between text-sm">
      <span class="truncate ml-2">${esc(t.user_name)} · ${arDate(t.work_date)} · ${esc(t.description || '')}</span>
      <b class="shrink-0">${t.hours} س</b></div>`).join('') : empty('fa-clock', 'لا ساعات مسجّلة', '');
  }
  return `<div class="grid md:grid-cols-2 gap-3">${c.lawyers.map((l) => `
    <div class="paper-card rounded-xl p-3 md:p-4 flex items-center gap-3">${avatar(l, 44)}<div><div class="font-semibold">${esc(l.name)}</div><div class="text-xs text-navy-700/60">${esc(l.title || '')} · ${esc(l.role || '')}</div></div></div>`).join('')}</div>
    ${c.poas.length ? `<div class="mt-4"><h4 class="font-semibold mb-2">التوكيلات المرتبطة</h4>${c.poas.map((p) => `<div class="paper-card rounded-xl p-3 mb-2 text-sm flex justify-between"><span>${esc(p.poa_no)} · ${esc(p.type)}</span>${chip(p.status)}</div>`).join('')}</div>` : ''}`;
}

/* ───────────── Hearings calendar ───────────── */
async function viewHearings() {
  const from = new Date(); from.setDate(1);
  const to = new Date(from.getFullYear(), from.getMonth() + 3, 0);
  const list = await api(`/api/hearings?from=${todayISO(from)}&to=${todayISO(to)}`);
  const today = todayISO();
  const groups = {};
  list.forEach((h) => { (groups[h.hearing_date] ||= []).push(h); });
  const days = [];
  const start = new Date(); start.setDate(start.getDate() - 1);
  for (let i = 0; i < 21; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    days.push(todayISO(d));
  }
  return `
    ${pageHead('أجندة الجلسات', 'ثلاثة أسابيع قادمة — المحاكم، التحكيم، والتنفيذ.', `<button id="new-hearing" class="btn-gold">قيد جلسة</button>`)}
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
        ${Object.entries(list.reduce((a, h) => { a[h.lawyer_name || 'غير معيّن'] = (a[h.lawyer_name || 'غير معيّن'] || 0) + 1; return a; }, {})).map(([n, v]) => `
          <div class="flex justify-between text-sm py-1.5 border-b gold-hairline"><span>${esc(n)}</span><b>${v}</b></div>`).join('')}
      </aside>
    </div>`;
}

/* ───────────── Clients ───────────── */
async function viewClients() {
  const list = await api('/api/clients');
  return `
    ${pageHead('الموكلون', 'أفراد وشركات وهيئات.', `<button id="new-client" class="btn-gold">موكل جديد</button>`)}
    <input id="client-q" class="input-lux mb-4 max-w-md" placeholder="بحث بالاسم أو الرقم القومي أو الهاتف"/>
    <div id="client-grid" class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${clientCards(list)}</div>`;
}

function clientCards(list) {
  if (!list.length) return empty('fa-user-tie', 'لا موكلين', '');
  return list.map((c) => `
    <article class="paper-card rounded-xl p-4 md:p-5 cursor-pointer hover:-translate-y-0.5 transition" data-go="client" data-id="${c.id}">
      <div class="flex justify-between items-start">
        <div>
          <div class="text-[11px] text-gold-700">${c.type === 'company' ? 'شخص اعتباري' : 'شخص طبيعي'} ${c.status === 'vip' ? '· عميل استراتيجي' : ''}</div>
          <h3 class="font-amiri text-xl md:text-2xl mt-1">${esc(c.name)}</h3>
        </div>
        ${chip(c.status)}
      </div>
      <p class="text-xs md:text-sm text-navy-700/70 mt-2">${esc(c.city || '')} · ${esc(c.phone || '')}</p>
      <div class="flex justify-between text-xs mt-4 pt-3 border-t gold-hairline">
        <span>${c.cases_count} قضايا</span>
        <span>رصيد ${egp(c.balance)}</span>
      </div>
    </article>`).join('');
}

async function viewClient() {
  const c = await api('/api/clients/' + state.params.id);
  return `
    <button data-go="clients" class="text-sm text-gold-700 mb-3 hover:underline inline-flex items-center gap-1"><i class="fas fa-arrow-right"></i> الموكلون</button>
    ${pageHead(c.name, `${c.type === 'company' ? 'شخص اعتباري' : 'شخص طبيعي'} · ${esc(c.city || '')}`, `<button id="edit-client" class="btn-ghost">تعديل</button>`)}
    <div class="grid md:grid-cols-3 gap-3 mb-6">
      <div class="paper-card rounded-xl p-4 text-sm leading-7">
        <div>الهاتف: ${esc(c.phone || '—')}</div>
        <div>البريد: ${esc(c.email || '—')}</div>
        <div>العنوان: ${esc(c.address || '—')}</div>
        <div>${c.type === 'company' ? 'ضريبي: ' + esc(c.tax_id || '—') : 'قومي: ' + esc(c.national_id || '—')}</div>
        <div>المحامي: ${esc(c.lawyer_name || '—')}</div>
      </div>
      <div class="md:col-span-2 paper-card rounded-xl p-4">
        <h3 class="font-semibold mb-2">ملاحظات داخلية</h3>
        <p class="leading-8 text-sm md:text-base">${esc(c.notes || '—')}</p>
      </div>
    </div>
    <h3 class="font-amiri text-xl md:text-2xl mb-3">القضايا</h3>
    ${casesTable(c.cases.map((x) => ({ ...x, client_name: c.name })))}
    <h3 class="font-amiri text-xl md:text-2xl mt-8 mb-3">التوكيلات</h3>
    ${c.poas.length ? c.poas.map((p) => `<div class="paper-card rounded-xl p-3 mb-2 flex justify-between text-sm"><span>${esc(p.poa_no)} · ${esc(p.type)}</span>${chip(p.status)}</div>`).join('') : empty('fa-scroll', 'لا توكيلات', '')}
    <h3 class="font-amiri text-xl md:text-2xl mt-8 mb-3">الفواتير</h3>
    ${c.invoices.length ? c.invoices.map((i) => `<div class="paper-card rounded-xl p-3 mb-2 flex justify-between"><button data-go="invoice" data-id="${i.id}" class="font-semibold hover:text-gold-700">${esc(i.invoice_no)}</button><span>${egp(i.total)} ${chip(i.status)}</span></div>`).join('') : '<p class="text-sm text-navy-700/50">لا توجد فواتير بعد</p>'}`;
}

/* ───────────── Tasks ───────────── */
async function viewTasks() {
  const list = await api('/api/tasks');
  const cols = ['مفتوحة', 'جارية', 'مكتملة'];
  return `
    ${pageHead('مهام المكتب', 'صياغة، إعلانات، أبحاث، ومتابعات.', `<button id="new-task" class="btn-gold">مهمة جديدة</button>`)}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${cols.map((st) => `
        <section>
          <h3 class="font-semibold mb-3 flex items-center gap-2">${chip(st)} <span class="text-xs text-navy-700/50">(${list.filter((t) => t.status === st).length})</span></h3>
          ${list.filter((t) => t.status === st).map((t) => `
            <article class="paper-card rounded-xl p-4 mb-3">
              <div class="flex justify-between items-center">${pchip(t.priority)} <span class="text-[11px] text-navy-700/60">${arDate(t.due_date)}</span></div>
              <div class="font-semibold mt-2 text-sm md:text-base">${esc(t.title)}</div>
              ${t.description ? `<p class="text-xs text-navy-700/60 mt-1 line-clamp-2">${esc(t.description)}</p>` : ''}
              <div class="text-xs text-navy-700/50 mt-2">${esc(t.assignee_name || '')} ${t.case_no ? '· ' + esc(t.case_no) + '/' + esc(t.year) : ''}</div>
              <div class="mt-3 pt-2 border-t gold-hairline flex gap-2 justify-end">
                ${st === 'مفتوحة' ? `<button data-start="${t.id}" class="text-xs text-navy-700 hover:text-navy-950 font-semibold p-1">بدء العمل</button>` : ''}
                ${st !== 'مكتملة' ? `<button data-done="${t.id}" class="text-xs text-gold-700 hover:text-gold-800 font-semibold p-1">تعليم كمكتملة</button>` : ''}
              </div>
            </article>`).join('') || `<p class="text-xs md:text-sm text-navy-700/40">لا توجد مهام في هذه القائمة</p>`}
        </section>`).join('')}
    </div>`;
}

/* ───────────── POA / Docs / Time / Contracts / Team ───────────── */
async function viewPoas() {
  const list = await api('/api/poas');
  return `${pageHead('التوكيلات', 'العامة والخاصة والرسمية.', `<button id="new-poa" class="btn-gold">توكيل جديد</button>`)}
    <div class="paper-card rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-navy-900 text-ivory/80 text-xs"><tr><th class="text-right p-3">الرقم</th><th class="text-right">الموكل</th><th class="text-right">النوع</th><th class="text-right">التوثيق</th><th class="text-right">الانتهاء</th><th></th></tr></thead>
          <tbody>${list.map((p) => `<tr class="border-t gold-hairline ledger-row">
            <td class="p-3 font-semibold whitespace-nowrap">${esc(p.poa_no)}</td><td>${esc(p.client_name)}</td><td>${esc(p.type)}</td>
            <td>${esc(p.notary_office || '')}</td><td class="whitespace-nowrap">${arDate(p.expiry_date)}</td><td class="p-3">${chip(p.status)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

async function viewDocuments() {
  const list = await api('/api/documents');
  return `${pageHead('أرشيف المستندات', 'صحف، مذكرات، أحكام، عقود.', `<button id="add-doc" class="btn-gold">قيد مستند</button>`)}
    <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">${list.map((d) => `
      <article class="paper-card rounded-xl p-4">
        <div class="text-xs text-gold-700 font-semibold">${esc(d.doc_type)}</div>
        <div class="font-semibold mt-1">${esc(d.title)}</div>
        <div class="text-xs text-navy-700/50 mt-1">${d.case_no ? caseRef(d) + ' · ' : ''}${esc(d.client_name || '')}</div>
      </article>`).join('')}</div>`;
}

async function viewTime() {
  const list = await api('/api/time');
  const total = list.reduce((s, t) => s + Number(t.hours), 0);
  return `${pageHead('ساعات العمل', `إجمالي السجل المعروض: ${total.toFixed(1)} ساعة.`, `<button id="new-time" class="btn-gold">تسجيل ساعات</button>`)}
    <div class="paper-card rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs text-navy-700/50"><tr><th class="text-right p-3">التاريخ</th><th class="text-right">المحامي</th><th class="text-right">القضية</th><th class="text-right">الوصف</th><th class="text-right">الساعات</th></tr></thead>
          <tbody>${list.map((t) => `<tr class="border-t gold-hairline"><td class="p-3 whitespace-nowrap">${arDate(t.work_date)}</td><td>${esc(t.user_name)}</td><td>${t.case_no ? caseRef(t) : '—'}</td><td>${esc(t.description || '')}</td><td class="font-bold p-3">${t.hours}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

async function viewContracts() {
  const list = await api('/api/contracts');
  return `${pageHead('عقود الأتعاب', 'اتفاقيات الاستشارة والأتعاب السنوية.', `<button id="new-contract" class="btn-gold">عقد جديد</button>`)}
    ${list.map((c) => `<article class="paper-card rounded-xl p-4 md:p-5 mb-3 flex flex-wrap justify-between items-center gap-2">
      <div><div class="font-amiri text-lg md:text-xl">${esc(c.title)}</div><div class="text-xs md:text-sm text-navy-700/60">${esc(c.client_name)} · ${esc(c.type)} · ${arDate(c.start_date)}</div></div>
      <div class="text-left"><div class="kpi-num text-xl md:text-2xl">${egp(c.value)}</div>${chip(c.status)}</div>
    </article>`).join('')}`;
}

async function viewTeam() {
  const list = await api('/api/users');
  const isPrivileged = state.user && ['managing_partner', 'partner', 'admin'].includes(state.user.role);
  return `${pageHead('شركاء المكتب وفريقه', 'النقض، الاستئناف، والأسرة، والإدارة.', isPrivileged ? `<button id="new-user" class="btn-gold">عضو جديد</button>` : '')}
    <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${list.map((u) => `
      <article class="paper-card rounded-xl overflow-hidden">
        <div class="h-2" style="background:${/^#[0-9a-fA-F]{3,8}$/.test(u.color || '') ? u.color : '#1F4E79'}"></div>
        <div class="p-4 md:p-5">
          <div class="flex gap-3 items-center">
            ${avatar(u, 52)}
            <div>
              <div class="font-amiri text-lg md:text-xl leading-tight">${esc(u.name)}</div>
              <div class="text-xs text-gold-700">${esc(u.title || '')}</div>
            </div>
          </div>
          <p class="text-xs md:text-sm text-navy-700/70 mt-3 leading-6 md:leading-7">${esc(u.bio || '')}</p>
          <div class="text-xs mt-3 text-navy-700/50">
            ${u.bar_number ? 'نقابة ' + esc(u.bar_number) + ' · ' + (u.bar_year ? esc(u.bar_year) : '') : esc(ROLE[u.role] || u.role)}
            ${u.hourly_rate ? '<br/>سعر الساعة ' + egp(u.hourly_rate) : ''}
          </div>
        </div>
      </article>`).join('')}</div>`;
}

/* ───────────── Billing & Finance ───────────── */
async function viewBilling() {
  const [inv, pays, exp] = await Promise.all([api('/api/invoices'), api('/api/payments'), api('/api/expenses')]);
  return `
    ${pageHead('الأتعاب والفواتير', 'إصدار، تحصيل، ومصروفات قضائية.', `
      <button id="new-expense" class="btn-ghost">مصروف</button>
      <button id="new-payment" class="btn-navy">قيد تحصيل</button>
      <button id="new-invoice" class="btn-gold">فاتورة أتعاب</button>
    `)}
    <div class="flex gap-2 mb-4 overflow-x-auto pb-1">
      ${['الكل', 'مسودة', 'صادرة', 'جزئي', 'متأخرة', 'مسددة'].map((s, i) => `<button data-inv-f="${i ? s : ''}" class="px-3 py-1 rounded-full text-xs md:text-sm border gold-hairline bg-white hover:bg-navy-900/5 transition whitespace-nowrap">${s}</button>`).join('')}
    </div>
    <div id="inv-table">${invTable(inv)}</div>
    <h3 class="font-amiri text-xl md:text-2xl mt-8 md:mt-10 mb-3">التحصيلات</h3>
    <div class="paper-card rounded-xl overflow-hidden mb-8">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs text-navy-700/50"><tr><th class="text-right p-3">التاريخ</th><th class="text-right">الموكل</th><th class="text-right">الفاتورة</th><th class="text-right">الوسيلة</th><th class="text-right">المبلغ</th></tr></thead>
          <tbody>${pays.map((p) => `<tr class="border-t gold-hairline"><td class="p-3 whitespace-nowrap">${arDate(p.paid_at)}</td><td>${esc(p.client_name)}</td><td>${esc(p.invoice_no || '')}</td><td>${esc(p.method)}</td><td class="font-bold p-3">${egp(p.amount)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <h3 class="font-amiri text-xl md:text-2xl mb-3">المصروفات</h3>
    <div class="paper-card rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs text-navy-700/50"><tr><th class="text-right p-3">التاريخ</th><th class="text-right">البيان</th><th class="text-right">التصنيف</th><th class="text-right">القضية</th><th class="text-right">المبلغ</th></tr></thead>
          <tbody>${exp.map((e) => `<tr class="border-t gold-hairline"><td class="p-3 whitespace-nowrap">${arDate(e.expense_date)}</td><td>${esc(e.title)}</td><td>${esc(e.category)}</td><td>${e.case_no ? caseRef(e) : '—'}</td><td class="font-bold p-3">${egp(e.amount)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

function invTable(inv) {
  return `<div class="paper-card rounded-xl overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-navy-900 text-ivory/80 text-xs"><tr><th class="text-right p-3">الرقم</th><th class="text-right">الموكل</th><th class="text-right">القضية</th><th class="text-right">الإصدار</th><th class="text-right">الإجمالي</th><th class="text-right">المدفوع</th><th></th></tr></thead>
        <tbody>${inv.map((i) => `<tr class="border-t gold-hairline ledger-row cursor-pointer" data-go="invoice" data-id="${i.id}">
          <td class="p-3 font-bold whitespace-nowrap">${esc(i.invoice_no)}</td><td>${esc(i.client_name)}</td>
          <td>${i.case_no ? caseRef(i) : '—'}</td><td class="whitespace-nowrap">${arDate(i.issue_date)}</td>
          <td class="whitespace-nowrap">${egp(i.total)}</td><td class="whitespace-nowrap">${egp(i.paid)}</td><td class="p-3">${chip(i.status)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
  </div>`;
}

async function viewInvoice() {
  const i = await api('/api/invoices/' + state.params.id);
  return `
    <button data-go="billing" class="text-sm text-gold-700 mb-3 hover:underline no-print inline-flex items-center gap-1"><i class="fas fa-arrow-right"></i> عودة للفواتير</button>
    <div class="paper-card rounded-xl p-5 md:p-8 print-sheet mx-auto shadow-md" id="invoice-sheet">
      <div class="flex justify-between items-start mb-6">
        <div class="flex items-center gap-3">
          <img src="/static/img/logo.png" class="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover"/>
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
        <div><div class="text-navy-700/50">الموكل</div><div class="font-semibold text-sm md:text-base">${esc(i.client_name)}</div><div>${esc(i.address || '')}</div></div>
        <div class="text-left"><div>التاريخ: ${arDate(i.issue_date)}</div><div>الاستحقاق: ${arDate(i.due_date)}</div>${i.case_no ? `<div>القضية: ${caseRef(i)}</div>` : ''}</div>
      </div>
      <div class="overflow-x-auto mb-4">
        <table class="w-full text-xs md:text-sm">
          <thead class="bg-navy-900 text-ivory text-xs"><tr><th class="text-right p-2">البيان</th><th class="text-right">الكمية</th><th class="text-right">السعر</th><th class="text-right">المبلغ</th></tr></thead>
          <tbody>${(i.items || []).map((it) => `<tr class="border-b gold-hairline"><td class="p-2">${esc(it.description)}</td><td>${it.qty}</td><td>${egp(it.unit_price)}</td><td>${egp(it.amount)}</td></tr>`).join('')}</tbody>
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
      <button onclick="window.print()" class="btn-navy"><i class="fas fa-print ml-1"></i> طباعة الفاتورة</button>
      ${Number(i.paid) < Number(i.total) ? `<button id="pay-this" class="btn-gold"><i class="fas fa-coins ml-1"></i> تسجيل دفعة</button>` : ''}
    </div>`;
}

async function viewFinance() {
  const r = await api('/api/reports/finance');
  state._financeData = r;
  return `
    ${pageHead('الموقف المالي', 'الفوترة، التحصيل، والساعات غير المفوترة.')}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
      <div class="paper-card rounded-xl p-4">ساعات غير مفوترة<div class="kpi-num text-2xl md:text-3xl">${egp(r.unbilled?.time_value)}</div></div>
      <div class="paper-card rounded-xl p-4">مصروفات قابلة للترحيل<div class="kpi-num text-2xl md:text-3xl">${egp(r.unbilled?.exp_value)}</div></div>
      <div class="paper-card rounded-xl p-4">إجمالي غير مفوتر<div class="kpi-num text-2xl md:text-3xl">${egp(Number(r.unbilled?.time_value || 0) + Number(r.unbilled?.exp_value || 0))}</div></div>
    </div>
    <div class="paper-card rounded-xl p-4 md:p-5 mb-6"><canvas id="finChart" height="120"></canvas></div>
    <h3 class="font-amiri text-xl md:text-2xl mb-3">الموكلون حسب المديونية</h3>
    ${(r.by_client || []).length ? r.by_client.map((c) => `<div class="paper-card rounded-xl p-3 mb-2 flex justify-between text-xs md:text-sm"><span>${esc(c.name)}</span><span>مستحق ${egp(c.due)} · حُصّل ${egp(c.paid)}</span></div>`).join('') : '<p class="text-sm text-navy-700/50">لا توجد مديونيات معلقة.</p>'}`;
}

function drawFin(r) {
  const el = $('#finChart');
  if (!el || !window.Chart) return;
  if (state.charts.fin) state.charts.fin.destroy();
  state.charts.fin = new Chart(el, {
    type: 'bar',
    data: {
      labels: (r.months || []).map((m) => m.m),
      datasets: [
        { label: 'مفوتر', data: (r.months || []).map((m) => m.invoiced), backgroundColor: '#0B1F3A' },
        { label: 'محصّل', data: (r.months || []).map((m) => m.paid), backgroundColor: '#C9A227' },
      ],
    },
    options: { plugins: { legend: { labels: { font: { family: 'Cairo' } } } }, scales: { y: { ticks: { font: { family: 'Cairo' } } } } },
  });
}

/* ───────────── Modals / Forms ───────────── */
let _currentEscHandler = null;
function closeModal() {
  $('#modal-root').innerHTML = '';
  if (_currentEscHandler) {
    document.removeEventListener('keydown', _currentEscHandler);
    _currentEscHandler = null;
  }
}

function modal(title, body, footer = '') {
  closeModal();
  $('#modal-root').innerHTML = `
    <div class="modal-backdrop fixed inset-0 z-50 flex items-start justify-center p-2 md:p-4 overflow-y-auto" id="modal-bg">
      <div class="paper-card rounded-2xl w-full max-w-2xl my-4 md:my-10 p-5 md:p-6 fade-in shadow-2xl">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-amiri text-xl md:text-2xl text-navy-950">${esc(title)}</h3>
          <button id="modal-x" class="text-navy-700/60 hover:text-navy-950 p-2 rounded-full" aria-label="إغلاق"><i class="fas fa-xmark text-lg"></i></button>
        </div>
        ${body}
        <div class="mt-5 flex justify-end gap-2">${footer}</div>
      </div>
    </div>`;
  $('#modal-x').onclick = closeModal;
  $('#modal-bg').addEventListener('click', (e) => { if (e.target.id === 'modal-bg') closeModal(); });
  _currentEscHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', _currentEscHandler);
}

function field(label, name, type = 'text', val = '', extra = '') {
  if (type === 'textarea') return `<label class="block mb-3 text-xs md:text-sm font-semibold">${label}<textarea name="${name}" class="input-lux mt-1" rows="3">${esc(val)}</textarea></label>`;
  if (type === 'select') return `<label class="block mb-3 text-xs md:text-sm font-semibold">${label}<select name="${name}" class="input-lux mt-1">${extra}</select></label>`;
  return `<label class="block mb-3 text-xs md:text-sm font-semibold">${label}<input name="${name}" type="${type}" value="${esc(val)}" class="input-lux mt-1" ${extra}/></label>`;
}

function opt(list, valKey, labelKey, selected) {
  return `<option value="">—</option>` + (list || []).map((x) => `<option value="${x[valKey]}" ${String(x[valKey]) === String(selected) ? 'selected' : ''}>${esc(x[labelKey])}</option>`).join('');
}

function formTo(fd) {
  const o = {};
  new FormData(fd).forEach((v, k) => { o[k] = v === '' ? null : v; });
  return o;
}

function caseForm(c = {}) {
  const L = state.lookups;
  modal(c.id ? 'تعديل القضية' : 'قيد قضية جديدة', `
    <form id="mform" class="grid md:grid-cols-2 gap-x-3">
      ${field('رقم الدعوى *', 'case_no', 'text', c.case_no || '', 'required')}
      ${field('السنة *', 'year', 'number', c.year || new Date().getFullYear(), 'required')}
      <div class="md:col-span-2">${field('العنوان / الموضوع المختصر *', 'title', 'text', c.title || '', 'required')}</div>
      ${field('الموكل *', 'client_id', 'select', '', opt(L.clients, 'id', 'name', c.client_id))}
      ${field('نوع القضية', 'case_type_id', 'select', '', opt(L.case_types, 'id', 'name', c.case_type_id))}
      ${field('المحكمة', 'court_id', 'select', '', opt(L.courts, 'id', 'name', c.court_id))}
      ${field('الدائرة', 'circuit', 'text', c.circuit || '')}
      ${field('الدرجة', 'degree', 'select', '', ['ابتدائي', 'استئناف', 'نقض', 'إداري', 'تحكيم', 'تنفيذ'].map((x) => `<option ${(c.degree || 'ابتدائي') === x ? 'selected' : ''}>${x}</option>`).join(''))}
      ${field('الحالة', 'status', 'select', '', ['متداولة', 'محجوزة للحكم', 'موقوفة', 'منتهية'].map((x) => `<option ${(c.status || 'متداولة') === x ? 'selected' : ''}>${x}</option>`).join(''))}
      ${field('الأولوية', 'priority', 'select', '', ['عادية', 'عالية', 'عاجلة', 'منخفضة'].map((x) => `<option ${(c.priority || 'عادية') === x ? 'selected' : ''}>${x}</option>`).join(''))}
      ${field('المحامي المسؤول', 'lead_lawyer_id', 'select', '', opt(L.users, 'id', 'name', c.lead_lawyer_id || state.user?.id))}
      ${field('الخصم', 'opposing_name', 'text', c.opposing_name || '')}
      ${field('محامي الخصم', 'opposing_lawyer', 'text', c.opposing_lawyer || '')}
      ${field('قيمة المطالبة', 'claim_value', 'number', c.claim_value || 0)}
      ${field('تاريخ القيد', 'filing_date', 'date', (c.filing_date || todayISO()).slice(0, 10))}
      <div class="md:col-span-2">${field('موضوع الدعوى', 'subject', 'textarea', c.subject || '')}</div>
      <div class="md:col-span-2">${field('الإجراء التالي', 'next_action', 'text', c.next_action || '')}</div>
    </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);
  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.case_no || !b.year || !b.title || !b.client_id) {
      toast('يرجى استيفاء الحقول الإجبارية (الرقم، السنة، العنوان، الموكل)', 'err');
      return;
    }
    b.year = Number(b.year);
    b.claim_value = Number(b.claim_value || 0);
    try {
      if (c.id) {
        await api('/api/cases/' + c.id, { method: 'PUT', body: b });
        state.cache.casesMini = null;
        toast('تم تحديث القضية بنجاح');
      } else {
        const r = await api('/api/cases', { method: 'POST', body: b });
        state.cache.casesMini = null;
        toast('تم قيد القضية بنجاح');
        closeModal();
        go('case', { id: r.id });
        return;
      }
      closeModal();
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function clientForm(c = {}) {
  const L = state.lookups;
  modal(c.id ? 'تعديل الموكل' : 'موكل جديد', `
    <form id="mform" class="grid md:grid-cols-2 gap-x-3">
      ${field('النوع', 'type', 'select', '', `<option value="individual" ${(c.type || 'individual') !== 'company' ? 'selected' : ''}>شخص طبيعي</option><option value="company" ${c.type === 'company' ? 'selected' : ''}>شخص اعتباري</option>`)}
      ${field('التصنيف', 'status', 'select', '', `<option value="active" ${(c.status || 'active') === 'active' ? 'selected' : ''}>نشط</option><option value="vip" ${c.status === 'vip' ? 'selected' : ''}>استراتيجي</option><option value="inactive" ${c.status === 'inactive' ? 'selected' : ''}>غير نشط</option>`)}
      <div class="md:col-span-2">${field('الاسم *', 'name', 'text', c.name || '', 'required')}</div>
      ${field('الهاتف', 'phone', 'text', c.phone || '')}
      ${field('هاتف 2', 'phone2', 'text', c.phone2 || '')}
      ${field('البريد', 'email', 'email', c.email || '')}
      ${field('المدينة', 'city', 'text', c.city || '')}
      ${field('الرقم القومي', 'national_id', 'text', c.national_id || '')}
      ${field('الرقم الضريبي', 'tax_id', 'text', c.tax_id || '')}
      ${field('السجل التجاري', 'commercial_reg', 'text', c.commercial_reg || '')}
      ${field('المهنة / النشاط', 'occupation', 'text', c.occupation || '')}
      ${field('الممثل', 'company_rep', 'text', c.company_rep || '')}
      ${field('المحامي', 'assigned_lawyer_id', 'select', '', opt(L.users, 'id', 'name', c.assigned_lawyer_id))}
      <div class="md:col-span-2">${field('العنوان', 'address', 'text', c.address || '')}</div>
      <div class="md:col-span-2">${field('ملاحظات', 'notes', 'textarea', c.notes || '')}</div>
    </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);
  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.name?.trim()) {
      toast('اسم الموكل مطلوب', 'err');
      return;
    }
    try {
      if (c.id) {
        await api('/api/clients/' + c.id, { method: 'PUT', body: b });
      } else {
        const r = await api('/api/clients', { method: 'POST', body: b });
        state.lookups = await api('/api/lookups');
        closeModal();
        toast('تم قيد الموكل بنجاح');
        go('client', { id: r.id });
        return;
      }
      state.lookups = await api('/api/lookups');
      closeModal();
      toast('تم الحفظ');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function hearingForm(h = {}) {
  const L = state.lookups;
  modal('قيد جلسة', `
    <form id="mform" class="grid md:grid-cols-2 gap-x-3">
      ${field('القضية *', 'case_id', 'select', '', opt(state.cache.casesMini || [], 'id', 'title', h.case_id || state.params.id))}
      ${field('التاريخ *', 'hearing_date', 'date', h.hearing_date || todayISO(), 'required')}
      ${field('الوقت', 'hearing_time', 'time', h.hearing_time || '09:30')}
      ${field('المحكمة', 'court_id', 'select', '', opt(L.courts, 'id', 'name', h.court_id))}
      ${field('الدائرة', 'circuit', 'text', h.circuit || '')}
      ${field('النوع', 'type', 'select', '', ['مرافعة', 'حكم', 'تحقيق', 'خبرة', 'صلح', 'تنفيذ'].map((x) => `<option>${x}</option>`).join(''))}
      ${field('المحامي', 'lawyer_id', 'select', '', opt(L.users, 'id', 'name', h.lawyer_id || state.user?.id))}
      <div class="md:col-span-2">${field('الغرض', 'purpose', 'text', h.purpose || '')}</div>
      <div class="md:col-span-2">${field('ملاحظات', 'notes', 'textarea', h.notes || '')}</div>
    </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);
  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.case_id || !b.hearing_date) {
      toast('القضية وتاريخ الجلسة مطلوبان', 'err');
      return;
    }
    try {
      await api('/api/hearings', { method: 'POST', body: b });
      closeModal();
      toast('أُضيفت الجلسة بنجاح');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

async function ensureCasesMini() {
  if (!state.cache.casesMini) {
    if (state.lookups?.cases?.length) {
      state.cache.casesMini = state.lookups.cases.map((c) => ({ id: c.id, title: `${c.case_no}/${c.year} — ${c.title}` }));
    } else {
      const list = await api('/api/cases');
      state.cache.casesMini = list.map((c) => ({ id: c.id, title: `${c.case_no}/${c.year} — ${c.title}` }));
    }
  }
}

function taskForm() {
  const L = state.lookups;
  modal('مهمة جديدة', `
    <form id="mform">
      ${field('العنوان *', 'title', 'text', '', 'required')}
      ${field('الوصف', 'description', 'textarea')}
      ${field('المكلّف', 'assignee_id', 'select', '', opt(L.users, 'id', 'name', state.user?.id))}
      ${field('القضية', 'case_id', 'select', '', opt(state.cache.casesMini || [], 'id', 'title', state.params.id))}
      ${field('الاستحقاق', 'due_date', 'date', todayISO())}
      ${field('الأولوية', 'priority', 'select', '', ['عادية', 'عالية', 'عاجلة', 'منخفضة'].map((x) => `<option>${x}</option>`).join(''))}
      ${field('التصنيف', 'category', 'select', '', ['مرافعة', 'بحث', 'صياغة', 'إعلان', 'تنفيذ', 'إداري'].map((x) => `<option>${x}</option>`).join(''))}
    </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);
  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.title?.trim()) {
      toast('عنوان المهمة مطلوب', 'err');
      return;
    }
    try {
      await api('/api/tasks', { method: 'POST', body: b });
      closeModal();
      toast('أُضيفت المهمة بنجاح');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function poaForm(preset = {}) {
  const L = state.lookups;
  const defClient = preset.client_id || (state.route === 'client' ? state.params.id : (state.activeCase?.client_id || ''));
  modal('توكيل جديد', `<form id="mform" class="grid md:grid-cols-2 gap-x-3">
    <div class="md:col-span-2">${field('رقم التوكيل *', 'poa_no', 'text', preset.poa_no || '', 'required')}</div>
    ${field('الموكل *', 'client_id', 'select', '', opt(L.clients, 'id', 'name', defClient))}
    ${field('المحامي', 'lawyer_id', 'select', '', opt(L.users, 'id', 'name', preset.lawyer_id || state.user?.id))}
    ${field('النوع', 'type', 'select', '', ['عام قضايا', 'رسمي عام', 'خاص', 'إداري'].map((x) => `<option ${preset.type === x ? 'selected' : ''}>${x}</option>`).join(''))}
    ${field('مكتب التوثيق', 'notary_office', 'text', preset.notary_office || '')}
    ${field('تاريخ الإصدار', 'issue_date', 'date', preset.issue_date || todayISO())}
    ${field('تاريخ الانتهاء', 'expiry_date', 'date', preset.expiry_date || '')}
    <div class="md:col-span-2">${field('النطاق', 'scope', 'textarea', preset.scope || 'الحضور والمرافعة أمام جميع المحاكم')}</div>
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);
  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.poa_no?.trim() || !b.client_id) {
      toast('رقم التوكيل والموكل حقول إجبارية', 'err');
      return;
    }
    try {
      await api('/api/poas', { method: 'POST', body: b });
      closeModal();
      toast('تم قيد التوكيل بنجاح');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function docForm(preset = {}) {
  const L = state.lookups;
  const defCase = preset.case_id || (state.route === 'case' ? state.params.id : '');
  const defClient = preset.client_id || (state.route === 'client' ? state.params.id : (state.activeCase?.client_id || ''));
  modal('قيد مستند', `<form id="mform">
    ${field('العنوان *', 'title', 'text', preset.title || '', 'required')}
    ${field('النوع', 'doc_type', 'select', '', ['صحيفة', 'مذكرة', 'حكم', 'توكيل', 'عقد', 'إنذار', 'أخرى'].map((x) => `<option>${x}</option>`).join(''))}
    ${field('القضية', 'case_id', 'select', '', opt(state.cache.casesMini || [], 'id', 'title', defCase))}
    ${field('الموكل', 'client_id', 'select', '', opt(L.clients, 'id', 'name', defClient))}
    ${field('الرقم المرجعي', 'ref_no', 'text', preset.ref_no || '')}
    ${field('تاريخ المستند', 'date_issued', 'date', preset.date_issued || todayISO())}
    ${field('عدد الصفحات', 'pages', 'number', preset.pages || '')}
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);
  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.title?.trim()) {
      toast('عنوان المستند مطلوب', 'err');
      return;
    }
    try {
      await api('/api/documents', { method: 'POST', body: b });
      closeModal();
      toast('تم حفظ المستند');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function invoiceForm(preset = {}) {
  const L = state.lookups;
  const defClient = preset.client_id || (state.route === 'client' ? state.params.id : (state.activeCase?.client_id || ''));
  const defCase = preset.case_id || (state.route === 'case' ? state.params.id : '');
  modal('فاتورة أتعاب', `<form id="mform">
    ${field('الموكل *', 'client_id', 'select', '', opt(L.clients, 'id', 'name', defClient))}
    ${field('القضية (اختياري)', 'case_id', 'select', '', opt(state.cache.casesMini || [], 'id', 'title', defCase))}
    ${field('تاريخ الإصدار', 'issue_date', 'date', preset.issue_date || todayISO())}
    ${field('الاستحقاق', 'due_date', 'date', preset.due_date || '')}
    ${field('بيان البند', 'desc', 'text', preset.desc || 'أتعاب مهنية')}
    ${field('المبلغ (ج.م) *', 'amount', 'number', preset.amount || '0')}
    ${field('ملاحظات', 'notes', 'textarea', preset.notes || '')}
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">إصدار</button>`);
  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.client_id) {
      toast('يرجى اختيار الموكل', 'err');
      return;
    }
    const amount = Number(b.amount || 0);
    b.items = [{ description: b.desc || 'أتعاب مهنية', qty: 1, unit_price: amount, amount: amount }];
    try {
      const r = await api('/api/invoices', { method: 'POST', body: b });
      closeModal();
      toast('صدرت الفاتورة ' + r.invoice_no);
      go('invoice', { id: r.id });
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function paymentForm(preset = {}) {
  const L = state.lookups;
  modal('قيد تحصيل', `<form id="mform">
    ${field('الموكل *', 'client_id', 'select', '', opt(L.clients, 'id', 'name', preset.client_id))}
    ${field('رقم الفاتورة الداخلي', 'invoice_id', 'number', preset.invoice_id || '')}
    ${field('المبلغ (ج.م) *', 'amount', 'number', preset.amount || '', 'required min="1"')}
    ${field('الوسيلة', 'method', 'select', '', ['تحويل', 'شيك', 'نقدي', 'بطاقة'].map((x) => `<option>${x}</option>`).join(''))}
    ${field('التاريخ', 'paid_at', 'date', todayISO())}
    ${field('المرجع', 'reference', 'text')}
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);
  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    b.amount = Number(b.amount);
    if (!b.amount || b.amount <= 0) {
      toast('مبلغ التحصيل يجب أن يكون أكبر من صفر', 'err');
      return;
    }
    try {
      await api('/api/payments', { method: 'POST', body: b });
      closeModal();
      toast('تم قيد التحصيل بنجاح');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function expenseForm() {
  modal('مصروف قضائي', `<form id="mform">
    ${field('البيان *', 'title', 'text', '', 'required')}
    ${field('التصنيف', 'category', 'select', '', ['رسوم محكمة', 'إعلانات', 'خبرة', 'انتقالات', 'تصوير', 'ترجمة', 'أخرى'].map((x) => `<option>${x}</option>`).join(''))}
    ${field('المبلغ (ج.م) *', 'amount', 'number', '', 'required min="1"')}
    ${field('التاريخ', 'expense_date', 'date', todayISO())}
    ${field('القضية', 'case_id', 'select', '', opt(state.cache.casesMini || [], 'id', 'title', state.params.id))}
    ${field('الجهة', 'vendor', 'text')}
    <label class="text-sm cursor-pointer flex items-center gap-2 mt-2"><input type="checkbox" name="billable" checked/> قابل للترحيل على الموكل</label>
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);
  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    b.amount = Number(b.amount);
    if (!b.title?.trim() || !b.amount || b.amount <= 0) {
      toast('بيان المصروف ومبلغ صالح مطلوبان', 'err');
      return;
    }
    b.billable = $('#mform [name=billable]').checked ? 1 : 0;
    try {
      await api('/api/expenses', { method: 'POST', body: b });
      closeModal();
      toast('تم قيد المصروف');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function timeForm() {
  modal('تسجيل ساعات', `<form id="mform">
    ${field('التاريخ', 'work_date', 'date', todayISO())}
    ${field('الساعات *', 'hours', 'number', '1', 'step="0.5" min="0.5" required')}
    ${field('القضية', 'case_id', 'select', '', opt(state.cache.casesMini || [], 'id', 'title', state.params.id))}
    ${field('الوصف', 'description', 'textarea')}
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);
  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    b.hours = Number(b.hours);
    if (!b.hours || b.hours <= 0) {
      toast('عدد الساعات يجب أن يكون أكبر من صفر', 'err');
      return;
    }
    try {
      await api('/api/time', { method: 'POST', body: b });
      closeModal();
      toast('سُجّلت الساعات بنجاح');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function userForm(u = {}) {
  modal(u.id ? 'تعديل بيانات المستخدم' : 'إضافة عضو جديد للفريق', `
    <form id="mform" class="grid md:grid-cols-2 gap-x-3">
      ${field('الاسم بالكامل *', 'name', 'text', u.name || '', 'required')}
      ${field('البريد الإلكتروني *', 'email', 'email', u.email || '', 'required')}
      ${field('المسمى الوظيفي', 'title', 'text', u.title || '')}
      ${field('الدور / الصلاحية', 'role', 'select', '', Object.entries(ROLE).map(([k, v]) => `<option value="${k}" ${(u.role || 'lawyer') === k ? 'selected' : ''}>${v}</option>`).join(''))}
      ${field('الهاتف', 'phone', 'text', u.phone || '')}
      ${field('القسم', 'department', 'text', u.department || '')}
      ${field('رقم القيد بالنقابة', 'bar_number', 'text', u.bar_number || '')}
      ${field('سنة القيد', 'bar_year', 'number', u.bar_year || '')}
      ${field('سعر الساعة (ج.م)', 'hourly_rate', 'number', u.hourly_rate || 0)}
      ${field('كلمة المرور' + (u.id ? ' (اتركها فارغة إذا لم ترد التغيير)' : ' *'), 'password', 'password', '', u.id ? '' : 'required minlength="6"')}
      <div class="md:col-span-2">${field('نبذة تعريفية', 'bio', 'textarea', u.bio || '')}</div>
    </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);
  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.name?.trim() || !b.email?.trim()) {
      toast('الاسم والبريد حقول إجبارية', 'err');
      return;
    }
    if (!u.id && (!b.password || b.password.length < 6)) {
      toast('كلمة المرور مطلوبة ويجب ألا تقل عن 6 أحرف', 'err');
      return;
    }
    if (b.bar_year) b.bar_year = Number(b.bar_year);
    if (b.hourly_rate) b.hourly_rate = Number(b.hourly_rate);
    try {
      if (u.id) {
        await api('/api/users/' + u.id, { method: 'PUT', body: b });
        toast('تم تحديث بيانات العضو');
      } else {
        await api('/api/users', { method: 'POST', body: b });
        toast('تم إضافة العضو بنجاح');
      }
      closeModal();
      state.lookups = await api('/api/lookups');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function contractForm(preset = {}) {
  const L = state.lookups;
  const defClient = preset.client_id || (state.route === 'client' ? state.params.id : (state.activeCase?.client_id || ''));
  modal('عقد أتعاب', `<form id="mform">
    ${field('العنوان *', 'title', 'text', preset.title || '', 'required')}
    ${field('الموكل *', 'client_id', 'select', '', opt(L.clients, 'id', 'name', defClient))}
    ${field('النوع', 'type', 'select', '', ['أتعاب', 'استشارة', 'أخرى'].map((x) => `<option ${preset.type === x ? 'selected' : ''}>${x}</option>`).join(''))}
    ${field('البداية', 'start_date', 'date', preset.start_date || todayISO())}
    ${field('النهاية', 'end_date', 'date', preset.end_date || '')}
    ${field('القيمة (ج.م)', 'value', 'number', preset.value || '')}
    ${field('ملاحظات', 'notes', 'textarea', preset.notes || '')}
  </form>`, `<button class="btn-ghost" id="modal-x2">إلغاء</button><button class="btn-gold" id="msave">حفظ</button>`);
  $('#modal-x2').onclick = closeModal;
  $('#msave').onclick = async () => {
    const b = formTo($('#mform'));
    if (!b.title?.trim() || !b.client_id) {
      toast('عنوان العقد والموكل حقول إجبارية', 'err');
      return;
    }
    try {
      await api('/api/contracts', { method: 'POST', body: b });
      closeModal();
      toast('تم حفظ العقد');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

/* ───────────── Render ───────────── */
const VIEWS = {
  dashboard: viewDashboard,
  cases: viewCases,
  case: viewCase,
  hearings: viewHearings,
  clients: viewClients,
  client: viewClient,
  tasks: viewTasks,
  poas: viewPoas,
  documents: viewDocuments,
  billing: viewBilling,
  invoice: viewInvoice,
  finance: viewFinance,
  time: viewTime,
  team: viewTeam,
  contracts: viewContracts,
};

async function render() {
  const root = $('#app');
  if (!state.user) {
    state._shellMounted = false;
    root.innerHTML = loginView();
    bindLogin();
    return;
  }
  const { route, params } = parseHash();
  state.route = VIEWS[route] ? route : 'dashboard';
  state.params = params;

  const sidebar = $('#sidebar');
  if (!sidebar || !state._shellMounted) {
    root.innerHTML = shell(`<div class="flex items-center justify-center py-24 text-navy-700/40"><i class="fas fa-scale-balanced fa-spin text-2xl"></i></div>`);
    bindShell();
    state._shellMounted = true;
  } else {
    // Zero-flicker active tab switching
    $$('#sidebar .nav-item').forEach((b) => {
      const id = b.dataset.go;
      const isActive = state.route === id || (id === 'cases' && state.route === 'case') || (id === 'clients' && state.route === 'client') || (id === 'billing' && state.route === 'invoice');
      b.className = `nav-item w-full text-right flex items-center gap-3 px-3 py-2.5 rounded-md text-[13.5px] ${isActive ? 'active text-gold-400' : 'text-ivory/75'}`;
    });
    $$('.mobile-bottom-item').forEach((b) => {
      const id = b.dataset.go;
      const isActive = state.route === id || (id === 'cases' && state.route === 'case') || (id === 'clients' && state.route === 'client');
      b.classList.toggle('active', !!isActive);
    });
  }

  const mainEl = $('main');
  if (mainEl) {
    mainEl.innerHTML = `<div class="flex items-center justify-center py-20 text-navy-700/40"><i class="fas fa-scale-balanced fa-spin text-2xl"></i></div>`;
  }

  try {
    if (!state.lookups.users.length) state.lookups = await api('/api/lookups');
    const html = await VIEWS[state.route]();
    if (mainEl) mainEl.innerHTML = html;
    bindView();
    if (state.route === 'dashboard' && state._dashboardData) {
      drawTypeChart(state._dashboardData);
    }
    if (state.route === 'finance' && state._financeData) {
      drawFin(state._financeData);
    }
  } catch (e) {
    if (mainEl) mainEl.innerHTML = empty('fa-triangle-exclamation', 'تعذّر التحميل', e.message);
  }
}

function bindLogin() {
  $('#fill-demo')?.addEventListener('click', () => {
    const emailInput = $('#login-email');
    const passInput = $('#login-pass');
    if (emailInput) emailInput.value = 'ahmed@alsharif.law';
    if (passInput) passInput.value = 'sharif2026';
    toast('تم ملء بيانات الدخول التجريبية');
  });

  $('#login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api('/api/login', { method: 'POST', body: { email: fd.get('email'), password: fd.get('password') } });
      state.user = r.user;
      location.hash = '#/';
      render();
    } catch (err) {
      const p = $('#login-err');
      p.textContent = err.message;
      p.classList.remove('hidden');
    }
  });
}

function bindShell() {
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

  $$('#sidebar [data-go], header [data-go], .mobile-bottom-item[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go, b.dataset.id ? { id: b.dataset.id } : {})));
  $('#logout-btn')?.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    state.user = null;
    state.activeCase = null;
    state._shellMounted = false;
    location.hash = '#/';
    render();
  });

  const box = $('#global-search');
  const res = $('#search-results');
  let t;
  state._searchCache = state._searchCache || {};
  box?.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const q = box.value.trim();
      if (q.length < 2) { res.classList.add('hidden'); return; }
      let data = state._searchCache[q];
      if (!data) {
        data = await api('/api/search?q=' + encodeURIComponent(q));
        state._searchCache[q] = data;
      }
      res.classList.remove('hidden');
      res.innerHTML = [
        ...(data.cases || []).map((c) => `<button data-go="case" data-id="${c.id}" class="block w-full text-right px-4 py-2 hover:bg-navy-900/5 text-sm transition"><b>${caseRef(c)}</b> ${esc(c.title)}<div class="text-[11px] text-navy-700/50">${esc(c.client_name)}</div></button>`),
        ...(data.clients || []).map((c) => `<button data-go="client" data-id="${c.id}" class="block w-full text-right px-4 py-2 hover:bg-navy-900/5 text-sm transition">${esc(c.name)}</button>`),
        ...(data.poas || []).map((p) => `<div class="px-4 py-2 text-xs text-navy-700/60">${esc(p.poa_no)} · ${esc(p.client_name)}</div>`),
      ].join('') || `<div class="px-4 py-3 text-sm text-navy-700/50">لا توجد نتائج مطابقة</div>`;
      $$('[data-go]', res).forEach((b) => b.addEventListener('click', () => { res.classList.add('hidden'); go(b.dataset.go, b.dataset.id ? { id: b.dataset.id } : {}); }));
    }, 200);
  });
  if (!state._docClickBound) {
    document.addEventListener('click', (e) => { if (!e.target.closest('#global-search') && !e.target.closest('#search-results')) $('#search-results')?.classList.add('hidden'); });
    state._docClickBound = true;
  }
}

function bindView() {
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go, b.dataset.id ? { id: b.dataset.id } : {})));
  $('#new-case')?.addEventListener('click', () => caseForm());
  $('#edit-case')?.addEventListener('click', async () => caseForm(await api('/api/cases/' + state.params.id)));
  $('#new-client')?.addEventListener('click', () => clientForm());
  $('#edit-client')?.addEventListener('click', async () => clientForm(await api('/api/clients/' + state.params.id)));
  ;['new-hearing', 'add-hearing'].forEach((id) => $('#' + id)?.addEventListener('click', async () => { await ensureCasesMini(); hearingForm({ case_id: state.params.id }); }));
  $('#new-task')?.addEventListener('click', async () => { await ensureCasesMini(); taskForm(); });
  $('#new-poa')?.addEventListener('click', () => {
    const preset = (state.route === 'case' && state.activeCase)
      ? { client_id: state.activeCase.client_id }
      : (state.route === 'client' ? { client_id: state.params.id } : {});
    poaForm(preset);
  });
  $('#add-doc')?.addEventListener('click', async () => {
    await ensureCasesMini();
    const preset = (state.route === 'case' && state.activeCase)
      ? { case_id: state.activeCase.id, client_id: state.activeCase.client_id }
      : (state.route === 'client' ? { client_id: state.params.id } : {});
    docForm(preset);
  });
  $('#new-invoice')?.addEventListener('click', async () => {
    await ensureCasesMini();
    const preset = (state.route === 'case' && state.activeCase)
      ? { case_id: state.activeCase.id, client_id: state.activeCase.client_id }
      : (state.route === 'client' ? { client_id: state.params.id } : {});
    invoiceForm(preset);
  });
  $('#new-payment')?.addEventListener('click', () => paymentForm());
  $('#pay-this')?.addEventListener('click', async () => {
    const i = await api('/api/invoices/' + state.params.id);
    paymentForm({ client_id: i.client_id, invoice_id: i.id, amount: Math.max(0, Number(i.total) - Number(i.paid)) });
  });
  $('#new-expense')?.addEventListener('click', async () => {
    await ensureCasesMini();
    expenseForm();
  });
  $('#new-time')?.addEventListener('click', async () => {
    await ensureCasesMini();
    timeForm();
  });
  $('#new-contract')?.addEventListener('click', () => {
    const preset = (state.route === 'case' && state.activeCase)
      ? { client_id: state.activeCase.client_id }
      : (state.route === 'client' ? { client_id: state.params.id } : {});
    contractForm(preset);
  });
  $('#new-user')?.addEventListener('click', () => userForm());

  // Zero-lag tab switcher for case details
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    state.params.tab = b.dataset.tab;
    if (state.activeCase && state.route === 'case') {
      $$('[data-tab]').forEach((btn) => {
        const isActive = btn.dataset.tab === state.params.tab;
        btn.className = `px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition whitespace-nowrap ${isActive ? 'bg-navy-900 text-ivory' : 'bg-white border gold-hairline hover:bg-navy-900/5'}`;
      });
      const tabEl = $('#case-tab');
      if (tabEl) {
        tabEl.innerHTML = caseTab(state.activeCase, state.params.tab);
        bindTabSubEvents();
      }
      return;
    }
    render();
  }));

  function bindTabSubEvents() {
    $('#note-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = e.target.content.value;
      if (!content.trim()) return;
      try {
        await api('/api/notes', { method: 'POST', body: { case_id: state.params.id, content } });
        toast('أُضيفت الملاحظة');
        const updated = await api('/api/cases/' + state.params.id);
        state.activeCase = updated;
        const tabEl = $('#case-tab');
        if (tabEl) tabEl.innerHTML = caseTab(state.activeCase, 'notes');
        const badge = $('[data-tab="notes"] span');
        if (badge) badge.textContent = `(${updated.notes.length})`;
        bindTabSubEvents();
      } catch (err) {
        toast(err.message, 'err');
      }
    });
    $('#add-doc')?.addEventListener('click', async () => { await ensureCasesMini(); docForm(); });
  }
  bindTabSubEvents();

  $$('[data-start]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.start;
    try {
      await api('/api/tasks/' + id, { method: 'PUT', body: { status: 'جارية' } });
      toast('تم تحويل المهمة إلى جارية');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  }));

  $$('[data-done]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.done;
    try {
      await api('/api/tasks/' + id, { method: 'PUT', body: { status: 'مكتملة' } });
      toast('أُنجزت المهمة');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  }));

  const fq = $('#f-q');
  if (fq) {
    const run = async () => {
      const p = new URLSearchParams();
      if ($('#f-q').value) p.set('q', $('#f-q').value);
      if ($('#f-status').value) p.set('status', $('#f-status').value);
      if ($('#f-pri').value) p.set('priority', $('#f-pri').value);
      if ($('#f-lawyer').value) p.set('lawyer', $('#f-lawyer').value);
      if ($('#f-type').value) p.set('type', $('#f-type').value);
      const list = await api('/api/cases?' + p.toString());
      $('#cases-table').innerHTML = casesTable(list);
      $$('#cases-table [data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go, { id: b.dataset.id })));
    };
    ['f-q', 'f-status', 'f-pri', 'f-lawyer', 'f-type'].forEach((id) => $('#' + id)?.addEventListener('change', run));
    $('#f-q')?.addEventListener('input', () => { clearTimeout(state._ft); state._ft = setTimeout(run, 250); });
  }

  $('#client-q')?.addEventListener('input', (e) => {
    clearTimeout(state._clientDebounce);
    state._clientDebounce = setTimeout(async () => {
      const list = await api('/api/clients?q=' + encodeURIComponent(e.target.value.trim()));
      $('#client-grid').innerHTML = clientCards(list);
      $$('#client-grid [data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go, { id: b.dataset.id })));
    }, 200);
  });

  $$('[data-inv-f]').forEach((b) => b.addEventListener('click', async () => {
    const s = b.dataset.invF;
    const list = await api('/api/invoices' + (s ? '?status=' + encodeURIComponent(s) : ''));
    $('#inv-table').innerHTML = invTable(list);
    $$('#inv-table [data-go]').forEach((x) => x.addEventListener('click', () => go(x.dataset.go, { id: x.dataset.id })));
  }));
}

window.addEventListener('hashchange', () => { if (state.user) render(); });

(async function boot() {
  try {
    const me = await api('/api/me');
    state.user = me.user;
  } catch { state.user = null; }
  render();
})();
