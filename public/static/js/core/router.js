import { $, $$, state, destroyCharts, empty } from './state.js'
import { api } from './api.js'
import { shell, bindShellEvents, updateActiveNav } from '../components/Shell.js'

/**
 * Enterprise Client-Side Router
 * Manages view registration, URL hash parsing, shell layout rendering,
 * and component lifecycle (mount, destroy, and memory leak cleanup).
 */
class Router {
  constructor() {
    this.routes = {};
    this.currentView = null;
    this.loginView = null;
    this.isNavigating = false;
  }

  /**
   * Register a view controller under a route key
   * @param {string} route 
   * @param {object} viewObject - { render, mount, destroy }
   */
  register(route, viewObject) {
    this.routes[route] = viewObject;
    return this;
  }

  /**
   * Set special authentication view
   * @param {object} loginViewObject 
   */
  setLoginView(loginViewObject) {
    this.loginView = loginViewObject;
    return this;
  }

  /**
   * Parses current window.location.hash into route and key-value params
   * Supports: #/cases, #/cases/:id, #/case?id=123&tab=docs, #billing
   */
  parseHash() {
    const raw = (window.location.hash || '').replace(/^#\/?/, '');
    if (!raw) return { route: 'dashboard', params: {} };

    const [pathPart, queryPart] = raw.split('?');
    const segments = pathPart.split('/').filter(Boolean);
    const route = segments[0] || 'dashboard';
    const params = {};

    if (segments.length > 1) {
      params.id = segments[1];
    }

    if (queryPart) {
      const q = new URLSearchParams(queryPart);
      for (const [k, v] of q.entries()) {
        params[k] = v;
      }
    }

    return { route, params };
  }

  /**
   * Navigate to a target route with optional parameters
   */
  navigate(route, params = {}) {
    if (route === 'login') {
      window.location.hash = '#/login';
      return;
    }

    const q = new URLSearchParams();
    let path = `#/${route}`;

    if (params.id) {
      path += `/${encodeURIComponent(params.id)}`;
    }

    for (const [k, v] of Object.entries(params)) {
      if (k !== 'id' && v !== undefined && v !== null && v !== '') {
        q.set(k, String(v));
      }
    }

    const qs = q.toString();
    if (qs) {
      path += `?${qs}`;
    }

    if (window.location.hash === path) {
      this.handleRoute();
    } else {
      window.location.hash = path;
    }
  }

  /**
   * Reload current view without full page reload
   */
  async refresh() {
    await this.handleRoute();
  }

  /**
   * Lifecycle-aware route dispatcher
   */
  async handleRoute() {
    if (this.isNavigating) return;
    this.isNavigating = true;

    try {
      const root = $('#app');
      if (!root) return;

      // 1. Authentication Check
      if (!state.user) {
        if (this.currentView?.destroy) {
          try { this.currentView.destroy(); } catch (e) { console.error('View destroy error:', e); }
        }
        destroyCharts();
        state._shellMounted = false;
        this.currentView = this.loginView;

        if (this.loginView) {
          root.innerHTML = this.loginView.render();
          if (this.loginView.mount) {
            this.loginView.mount(root, this);
          }
        }
        return;
      }

      // If switching from LoginView, clean it up
      if (this.currentView === this.loginView && this.loginView?.destroy) {
        try { this.loginView.destroy(); } catch {}
      }

      // 2. Parse Target Route
      const { route, params } = this.parseHash();
      const targetRoute = this.routes[route] ? route : 'dashboard';
      state.route = targetRoute;
      state.params = params;

      // 3. Shell Frame Rendering (Zero Flicker)
      const sidebar = $('#sidebar');
      if (!sidebar || !state._shellMounted) {
        root.innerHTML = shell(`
          <div class="flex items-center justify-center py-24 text-navy-700/40">
            <i class="fas fa-scale-balanced fa-spin text-2xl"></i>
          </div>
        `);
        bindShellEvents(this);
        state._shellMounted = true;
      } else {
        updateActiveNav(targetRoute);
      }

      const mainEl = $('main');

      // 4. Teardown Previous View & Charts (Eliminate Memory Leaks)
      if (this.currentView && typeof this.currentView.destroy === 'function') {
        try {
          this.currentView.destroy();
        } catch (err) {
          console.error('Error during view destroy:', err);
        }
      }
      destroyCharts();

      // Show smooth inline loader in main content area
      if (mainEl) {
        mainEl.innerHTML = `
          <div class="flex items-center justify-center py-20 text-navy-700/40">
            <i class="fas fa-scale-balanced fa-spin text-2xl"></i>
          </div>
        `;
      }

      // 5. Ensure Core System Lookups
      if (!state.lookups?.users?.length) {
        try {
          state.lookups = await api('/api/lookups');
        } catch {
          state.lookups = { courts: [], case_types: [], users: [], clients: [] };
        }
      }

      // 6. Render Target View
      const targetView = this.routes[targetRoute] || this.routes['dashboard'];
      if (!targetView) {
        throw new Error(`Route not found: ${targetRoute}`);
      }

      const html = await targetView.render(state.params);
      if (mainEl) {
        mainEl.innerHTML = html;
        if (typeof targetView.mount === 'function') {
          targetView.mount(mainEl, this);
        }
      }
      this.currentView = targetView;

    } catch (error) {
      console.error('Router execution failed:', error);
      const mainEl = $('main');
      if (mainEl) {
        mainEl.innerHTML = empty('fa-triangle-exclamation', 'تعذّر التحميل', error.message || 'حدث خطأ أثناء تحميل الصفحة');
      }
    } finally {
      this.isNavigating = false;
    }
  }

  /**
   * Start router and listen for hash changes
   */
  init() {
    window.addEventListener('hashchange', () => {
      this.handleRoute();
    });
    return this.handleRoute();
  }
}

export const router = new Router();
