import { Hono } from 'hono'
import { requireUser } from '../middleware/auth'
import { FinanceService } from '../services/finance.service'
import { AppContext, User } from '../types'

export const financeRoutes = new Hono<AppContext>()

/**
 * GET /api/invoices
 * Controller listing invoices with status filtering
 */
financeRoutes.get('/invoices', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const invoices = await FinanceService.getInvoices(c.env.DB, c.req.query('status'))
  return c.json(invoices)
})

/**
 * GET /api/invoices/:id
 * Controller fetching invoice details with items and payments
 */
financeRoutes.get('/invoices/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const invoice = await FinanceService.getInvoiceById(c.env.DB, c.req.param('id'))
  if (!invoice) return c.json({ error: 'الفاتورة غير موجودة' }, 404)
  return c.json(invoice)
})

/**
 * POST /api/invoices
 * Controller issuing a new legal fee invoice
 */
financeRoutes.post('/invoices', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const result = await FinanceService.createInvoice(c.env.DB, body, (user as User).id)
    return c.json(result)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * PUT /api/invoices/:id
 * Controller updating invoice status, notes, or due date
 */
financeRoutes.put('/invoices/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    await FinanceService.updateInvoice(c.env.DB, c.req.param('id'), body)
    return c.json({ ok: true })
  } catch (err: any) {
    const status: 400 | 404 = err.message === 'الفاتورة غير موجودة' ? 404 : 400
    return c.json({ error: err.message }, status)
  }
})

/**
 * GET /api/payments
 * Controller listing fee collections
 */
financeRoutes.get('/payments', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const payments = await FinanceService.getPayments(c.env.DB)
  return c.json(payments)
})

/**
 * POST /api/payments
 * Controller recording payment voucher and reconciling invoice balance
 */
financeRoutes.post('/payments', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await FinanceService.recordPayment(c.env.DB, body, (user as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * GET /api/expenses
 * Controller listing case judicial expenses and outlays
 */
financeRoutes.get('/expenses', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const expenses = await FinanceService.getExpenses(c.env.DB)
  return c.json(expenses)
})

/**
 * POST /api/expenses
 * Controller recording a new case expense
 */
financeRoutes.post('/expenses', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await FinanceService.createExpense(c.env.DB, body, (user as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * GET /api/time
 * Controller listing lawyer billable time entries
 */
financeRoutes.get('/time', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const timeEntries = await FinanceService.getTimeEntries(c.env.DB)
  return c.json(timeEntries)
})

/**
 * POST /api/time
 * Controller recording billable time
 */
financeRoutes.post('/time', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await FinanceService.logTime(c.env.DB, body, user as User)
    return c.json({ id })
  } catch (err: any) {
    const status: 400 | 403 = err.message.includes('غير مصرح') ? 403 : 400
    return c.json({ error: err.message }, status)
  }
})

/**
 * GET /api/contracts
 * Controller listing annual retainers and agreements
 */
financeRoutes.get('/contracts', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const contracts = await FinanceService.getContracts(c.env.DB)
  return c.json(contracts)
})

/**
 * POST /api/contracts
 * Controller registering a new legal retainer agreement
 */
financeRoutes.post('/contracts', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await FinanceService.createContract(c.env.DB, body)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

/**
 * GET /api/reports/finance
 * Controller computing monthly billing, collections, and due balances
 */
financeRoutes.get('/reports/finance', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const report = await FinanceService.getFinanceReport(c.env.DB)
  return c.json(report)
})
