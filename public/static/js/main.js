/**
 * Al-Sharif & Partners — Application Main Entry Point
 * Phase 4: Modular Frontend Architecture
 */
import { state } from './core/state.js'
import { api } from './core/api.js'
import { router } from './core/router.js'

// Import all modular views
import { LoginView } from './views/LoginView.js'
import { DashboardView } from './views/DashboardView.js'
import { CasesView } from './views/CasesView.js'
import { CaseDetailView } from './views/CaseDetailView.js'
import { HearingsView } from './views/HearingsView.js'
import { ClientsView } from './views/ClientsView.js'
import { ClientDetailView } from './views/ClientDetailView.js'
import { DocumentsView } from './views/DocumentsView.js'
import { TasksView } from './views/TasksView.js'
import { POAsView } from './views/POAsView.js'
import { TimeView } from './views/TimeView.js'
import { ContractsView } from './views/ContractsView.js'
import { TeamView } from './views/TeamView.js'
import { BillingView } from './views/BillingView.js'
import { InvoiceDetailView } from './views/InvoiceDetailView.js'
import { FinanceView } from './views/FinanceView.js'

// Register routes in router
router
  .setLoginView(LoginView)
  .register('dashboard', DashboardView)
  .register('cases', CasesView)
  .register('case', CaseDetailView)
  .register('hearings', HearingsView)
  .register('clients', ClientsView)
  .register('client', ClientDetailView)
  .register('documents', DocumentsView)
  .register('tasks', TasksView)
  .register('poas', POAsView)
  .register('time', TimeView)
  .register('contracts', ContractsView)
  .register('team', TeamView)
  .register('billing', BillingView)
  .register('invoice', InvoiceDetailView)
  .register('finance', FinanceView);

// Expose global router for legacy handlers if any
window.router = router;
window.go = (route, params = {}) => router.navigate(route, params);

/**
 * Bootstraps the application:
 * Verifies active session via /api/me and launches the router
 */
export async function bootstrap() {
  if (!state.user) {
    try {
      const me = await api('/api/me');
      state.user = me.user;
    } catch {
      state.user = null;
    }
  }

  await router.init();
}

// Auto-run bootstrap when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
