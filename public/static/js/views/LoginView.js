import { $, state } from '../core/state.js'
import { api } from '../core/api.js'

export const LoginView = {
  render() {
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
              <label class="block text-sm mb-1 font-semibold" for="login-email">البريد الإلكتروني</label>
              <input id="login-email" name="email" type="email" required placeholder="name@alsharif.law" class="input-lux mb-4" autocomplete="username"/>
              <label class="block text-sm mb-1 font-semibold" for="login-pass">كلمة المرور</label>
              <input id="login-pass" name="password" type="password" required placeholder="••••••••" class="input-lux mb-6" autocomplete="current-password"/>
              <button type="submit" class="btn-gold w-full py-3 text-base font-bold shadow-md hover:shadow-lg transition">دخول النظام</button>
              
              <div class="mt-5 p-3.5 bg-navy-900/5 rounded-xl border border-gold-500/30 text-xs text-navy-800 flex items-center justify-between">
                <div>
                  <span class="font-bold text-navy-900 flex items-center gap-1.5"><i class="fa-solid fa-shield-halved text-gold-500"></i> حساب التقييم الفني:</span>
                  <div class="font-mono text-[11px] text-navy-700 mt-0.5">ahmed@alsharif.law</div>
                </div>
                <button type="button" id="btn-fill-demo" class="px-3 py-1.5 bg-gold-500/20 hover:bg-gold-500/40 text-navy-950 font-bold rounded-lg text-xs transition border border-gold-500/40 flex items-center gap-1.5 shadow-sm">
                  <i class="fa-solid fa-wand-magic-sparkles text-gold-700 text-[11px]"></i> تجربة فورية
                </button>
              </div>

              <p id="login-err" class="text-red-800 text-sm mt-3 text-center hidden"></p>
            </form>
          </div>
        </div>
      </div>`;
  },

  mount(container, router) {
    $('#btn-fill-demo')?.addEventListener('click', () => {
      const emailInput = $('#login-email');
      const passInput = $('#login-pass');
      if (emailInput && passInput) {
        emailInput.value = 'ahmed@alsharif.law';
        passInput.value = 'sharif2026';
        $('#login-form')?.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });

    $('#login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const errEl = $('#login-err');
      if (errEl) errEl.classList.add('hidden');

      try {
        const r = await api('/api/login', {
          method: 'POST',
          body: { email: fd.get('email'), password: fd.get('password') }
        });
        state.user = r.user;
        router.navigate('dashboard');
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || 'فشل تسجيل الدخول';
          errEl.classList.remove('hidden');
        }
      }
    });
  },

  destroy() {
    // cleanup
  }
};
