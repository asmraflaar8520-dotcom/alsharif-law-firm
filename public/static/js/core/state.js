/**
 * Global Reactive State, Lookups & Visual Formatting Utilities
 */

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const state = {
  user: null,
  lookups: { courts: [], case_types: [], users: [], clients: [] },
  route: 'dashboard',
  params: {},
  cache: {},
  activeCase: null,
  toastTimer: null,
  charts: {},
  _shellMounted: false,
  _searchCache: {},
  _docClickBound: false,
  // Phase 3 Server-Side Pagination & Search State
  casesPage: 1,
  casesLimit: 20,
  casesFilters: {},
  clientsPage: 1,
  clientsLimit: 18,
  clientsSearch: '',
  docsPage: 1,
  docsLimit: 18,
  docsSearch: '',
  docsType: '',
  hearingsPage: 1,
  hearingsLimit: 20,
  hearingsSearch: '',
  hearingsStatus: '',
  hearingsTab: 'calendar',
};

export const ROLE = {
  managing_partner: 'الشريك المدير',
  partner: 'شريك',
  senior: 'محامٍ أول',
  lawyer: 'محامٍ',
  intern: 'تحت التمرين',
  secretary: 'سكرتارية',
  accountant: 'محاسب',
  admin: 'إدارة',
};

export const PRI = {
  عاجلة: 'badge-urgent',
  عالية: 'badge-high',
  عادية: 'badge-normal',
  منخفضة: 'badge-low',
};

export const CST = {
  متداولة: 'status-open', 'محجوزة للحكم': 'status-hold', موقوفة: 'status-stop', منتهية: 'status-done',
  قادمة: 'status-open', تمت: 'status-done', تأجيل: 'status-hold', شطب: 'status-late', 'حجز للحكم': 'status-hold',
  مسودة: 'status-draft', صادرة: 'status-open', جزئي: 'status-part', مسددة: 'status-paid', متأخرة: 'status-late', ملغاة: 'status-stop',
  ساري: 'status-paid', 'منتهٍ': 'status-late', ملغى: 'status-stop', مفتوحة: 'status-open', جارية: 'status-hold', مكتملة: 'status-done',
  vip: 'badge-high', active: 'status-open', inactive: 'status-stop',
};

export const NAV = [
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

export function formatNum(n) {
  return new Intl.NumberFormat('ar-EG').format(Number(n || 0));
}

export function egp(n) {
  const v = Number(n || 0);
  const num = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(v);
  return `${num} <span class="currency-label">ج.م</span>`;
}

export function arDate(d) {
  if (!d) return '—';
  const x = String(d).slice(0, 10);
  try { return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(x)); }
  catch { return x; }
}

export function arDateTime(d) {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(String(d).replace(' ', 'T'))); }
  catch { return d; }
}

export function todayISO(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function chip(status) {
  const cls = CST[status] || 'status-open';
  return `<span class="chip ${cls}">${esc(status || '—')}</span>`;
}

export function pchip(p) {
  return `<span class="chip ${PRI[p] || 'badge-normal'}">${esc(p || 'عادية')}</span>`;
}

export function avatar(u, size = 36) {
  const ini = esc(u?.initials || (u?.name || '?').slice(0, 2));
  const col = /^#[0-9a-fA-F]{3,8}$/.test(u?.color || '') ? u.color : '#1F4E79';
  return `<span class="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 shadow-sm" style="width:${size}px;height:${size}px;background:${col};font-size:${Math.round(size * 0.34)}px">${ini}</span>`;
}

export function caseRef(c) {
  return `${esc(c.case_no)} / ${esc(c.year)}`;
}

export function formatDocSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function empty(icon, title, desc) {
  return `
    <div class="empty-state text-center py-16">
      <div class="empty-state-icon mx-auto mb-3"><i class="fas ${icon}"></i></div>
      <h3 class="font-amiri text-2xl text-navy-950 mb-1">${esc(title)}</h3>
      <p class="text-sm text-navy-700/60 max-w-md mx-auto">${esc(desc)}</p>
    </div>
  `;
}

export function pageHead(title, sub = '', actions = '') {
  return `
    <div class="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <div class="text-[11px] tracking-[.25em] text-gold-700 font-semibold mb-1">AL-SHARIF & PARTNERS</div>
        <h1 class="font-amiri text-2xl md:text-4xl text-navy-900">${esc(title)}</h1>
        ${sub ? `<p class="text-xs md:text-sm text-navy-700/70 mt-1">${sub}</p>` : ''}
      </div>
      <div class="flex flex-wrap gap-2">${actions}</div>
    </div>
  `;
}

/**
 * Destroys all active Chart.js instances to prevent canvas memory leaks
 */
export function destroyCharts() {
  if (state.charts) {
    Object.keys(state.charts).forEach((k) => {
      if (state.charts[k] && typeof state.charts[k].destroy === 'function') {
        try { state.charts[k].destroy(); } catch {}
      }
    });
    state.charts = {};
  }
}
