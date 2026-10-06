import test from 'node:test'
import assert from 'node:assert/strict'
import { FinanceService } from '../../src/services/finance.service.ts'
import { createSqliteD1 } from '../../src/utils/d1-sqlite.ts'

test('FinanceService Unit Test Suite', async (t) => {
  let db

  t.beforeEach(() => {
    db = createSqliteD1(':memory:', true)
  })

  await t.test('generateInvoiceNumber increments sequence for year', async () => {
    const no1 = await FinanceService.generateInvoiceNumber(db, 2026)
    assert.match(no1, /^INV-2026-\d{3}$/)

    const noFuture = await FinanceService.generateInvoiceNumber(db, 2030)
    assert.equal(noFuture, 'INV-2030-001')
  })

  await t.test('createInvoice calculates VAT, discount, and batch inserts line items', async () => {
    const res = await FinanceService.createInvoice(
      db,
      {
        client_id: 1,
        case_id: 1,
        items: [
          { description: 'أتعاب استئناف', qty: 1, unit_price: 20000, amount: 20000 },
          { description: 'مصاريف ترجمة قانونية', qty: 2, unit_price: 2500, amount: 5000 }
        ],
        discount: 1000
      },
      1
    )

    assert.ok(res.id)
    assert.ok(res.invoice_no)

    const invoice = await FinanceService.getInvoiceById(db, res.id)
    assert.equal(invoice.subtotal, 25000)
    assert.equal(invoice.tax, 3500) // 14% of 25000
    assert.equal(invoice.discount, 1000)
    assert.equal(invoice.total, 27500) // 25000 + 3500 - 1000
    assert.equal(invoice.paid, 0)
    assert.equal(invoice.status, 'صادرة')
    assert.equal(invoice.items.length, 2)
  })

  await t.test('createInvoice rejects missing client_id', async () => {
    await assert.rejects(
      async () => {
        await FinanceService.createInvoice(db, { amount: 5000 }, 1)
      },
      { message: 'الموكل مطلوب لإصدار الفاتورة' }
    )
  })

  await t.test('getInvoices filters by status', async () => {
    const invoices = await FinanceService.getInvoices(db)
    assert.ok(Array.isArray(invoices))
    assert.ok(invoices.length > 0)

    const paidInvoices = await FinanceService.getInvoices(db, 'مسددة')
    assert.ok(paidInvoices.every((i) => i.status === 'مسددة'))
  })

  await t.test('getInvoiceById returns null for invalid invoice', async () => {
    const invoice = await FinanceService.getInvoiceById(db, 99999)
    assert.equal(invoice, null)
  })

  await t.test('recordPayment validates amount and updates invoice paid balance and status', async () => {
    // Invoice 2 in seed: total 458800, paid 250000, status 'جزئي'
    const invoiceBefore = await FinanceService.getInvoiceById(db, 2)
    assert.equal(invoiceBefore.status, 'جزئي')
    assert.equal(invoiceBefore.paid, 250000)

    // Pay remaining 208800
    const paymentId = await FinanceService.recordPayment(
      db,
      {
        invoice_id: 2,
        amount: 208800,
        method: 'تحويل',
        reference: 'TRX-9988'
      },
      1
    )

    assert.ok(paymentId)
    const invoiceAfter = await FinanceService.getInvoiceById(db, 2)
    assert.equal(invoiceAfter.paid, 458800)
    assert.equal(invoiceAfter.status, 'مسددة')
  })

  await t.test('recordPayment rejects non-positive amount and invalid invoice', async () => {
    await assert.rejects(
      async () => {
        await FinanceService.recordPayment(db, { amount: -500, client_id: 1 }, 1)
      },
      { message: 'مبلغ التحصيل يجب أن يكون رقماً موجباً' }
    )

    await assert.rejects(
      async () => {
        await FinanceService.recordPayment(db, { amount: 500, invoice_id: 99999 }, 1)
      },
      { message: 'الفاتورة المحددة غير موجودة' }
    )
  })

  await t.test('createExpense and getExpenses track court outlays', async () => {
    const expId = await FinanceService.createExpense(
      db,
      {
        case_id: 1,
        title: 'رسوم خبير حسابي',
        amount: 4500,
        category: 'خبرة',
        billable: true
      },
      1
    )

    assert.ok(expId)
    const expenses = await FinanceService.getExpenses(db)
    assert.ok(expenses.some((e) => e.id === expId && e.amount === 4500))
  })

  await t.test('logTime enforces RBAC: non-privileged users cannot log for others', async () => {
    const lawyerUser = { id: 6, role: 'lawyer', hourly_rate: 1500 }
    const partnerUser = { id: 1, role: 'managing_partner', hourly_rate: 4500 }

    // Lawyer logs for self -> succeeds
    const tId1 = await FinanceService.logTime(
      db,
      { case_id: 1, hours: 3.5, description: 'بحث سوابق' },
      lawyerUser
    )
    assert.ok(tId1)

    // Lawyer logs for another user -> forbidden
    await assert.rejects(
      async () => {
        await FinanceService.logTime(
          db,
          { user_id: 2, case_id: 1, hours: 3.5 },
          lawyerUser
        )
      },
      { message: 'غير مصرح — لا يمكنك تسجيل ساعات لمستخدم آخر' }
    )

    // Partner logs for another user -> succeeds
    const tId2 = await FinanceService.logTime(
      db,
      { user_id: 7, case_id: 1, hours: 2.0 },
      partnerUser
    )
    assert.ok(tId2)
  })

  await t.test('createContract and getContracts manage retainer agreements', async () => {
    const cId = await FinanceService.createContract(db, {
      title: 'عقد استشارات سنوي',
      client_id: 1,
      value: 150000,
      type: 'استشارة'
    })

    assert.ok(cId)
    const contracts = await FinanceService.getContracts(db)
    assert.ok(contracts.some((c) => c.id === cId && c.value === 150000))
  })

  await t.test('getFinanceReport aggregates billing, collections, and unbilled work', async () => {
    const report = await FinanceService.getFinanceReport(db)
    assert.ok(report)
    assert.ok(Array.isArray(report.months))
    assert.ok(Array.isArray(report.by_client))
    assert.ok(report.unbilled)
    assert.ok(typeof report.unbilled.time_value === 'number')
    assert.ok(typeof report.unbilled.exp_value === 'number')
  })
})
