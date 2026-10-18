import { $, $$, state, egp, esc, avatar, pageHead } from '../core/state.js'
import { api } from '../core/api.js'
import { userForm } from '../components/Forms.js'

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

export const TeamView = {
  async render() {
    const list = await api('/api/users');
    const isPrivileged = state.user && ['managing_partner', 'partner', 'admin'].includes(state.user.role);

    return `
      ${pageHead('شركاء المكتب وفريقه', 'النقض، الاستئناف، والأسرة، والإدارة.', isPrivileged ? `
        <button id="new-user" class="btn-gold"><i class="fas fa-user-plus ml-1"></i> عضو جديد</button>
      ` : '')}
      <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        ${(list || []).map((u) => `
          <article class="paper-card rounded-xl overflow-hidden">
            <div class="h-2" style="background:${/^#[0-9a-fA-F]{3,8}$/.test(u.color || '') ? u.color : '#1F4E79'}"></div>
            <div class="p-4 md:p-5">
              <div class="flex gap-3 items-center">
                ${avatar(u, 52)}
                <div>
                  <div class="font-amiri text-lg md:text-xl leading-tight font-bold text-navy-950">${esc(u.name)}</div>
                  <div class="text-xs text-gold-700">${esc(u.title || '')}</div>
                </div>
              </div>
              <p class="text-xs md:text-sm text-navy-700/70 mt-3 leading-6 md:leading-7">${esc(u.bio || '')}</p>
              <div class="text-xs mt-3 text-navy-700/50">
                ${u.bar_number ? 'نقابة ' + esc(u.bar_number) + ' · ' + (u.bar_year ? esc(u.bar_year) : '') : esc(ROLE[u.role] || u.role)}
                ${u.hourly_rate ? '<br/>سعر الساعة ' + egp(u.hourly_rate) : ''}
              </div>
            </div>
          </article>
        `).join('')}
      </div>`;
  },

  mount(container, router) {
    $('#new-user')?.addEventListener('click', () => {
      userForm();
    });

    $$('[data-go]', container).forEach((b) => {
      b.addEventListener('click', () => router.navigate(b.dataset.go, { id: b.dataset.id }));
    });
  },

  destroy() {
    // cleanup
  }
};
