import test from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3000'

test('Law Office Web Application Integration & Security Test Suite', async (t) => {
  let authCookie = ''
  let loggedInUser = null

  // 1. Authentication
  await t.test('Auth: Reject invalid credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ahmed@alsharif.law', password: 'wrongpassword' }),
    })
    assert.equal(res.status, 401)
    const data = await res.json()
    assert.match(data.error, /غير صحيحة/)
  })

  await t.test('Auth: Reject missing credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' }),
    })
    assert.equal(res.status, 400)
  })

  await t.test('Auth: Login successfully with valid credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ahmed@alsharif.law', password: 'sharif2026' }),
    })
    assert.equal(res.status, 200)
    const setCookie = res.headers.get('set-cookie')
    assert.ok(setCookie, 'Set-Cookie header should be present')
    authCookie = setCookie.split(';')[0]
    const data = await res.json()
    assert.ok(data.user, 'User object should be returned')
    assert.equal(data.user.email, 'ahmed@alsharif.law')
    assert.equal(data.user.password_hash, undefined, 'password_hash must never be leaked')
    loggedInUser = data.user
  })

  await t.test('Auth: /api/me returns active user', async () => {
    const res = await fetch(`${BASE_URL}/api/me`, {
      headers: { Cookie: authCookie },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.user?.id, loggedInUser.id)
    assert.equal(data.user?.password_hash, undefined)
  })

  await t.test('Security: Protected routes reject unauthenticated requests', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard`)
    assert.equal(res.status, 401)
  })

  // 2. Dashboard, Lookups & Search
  await t.test('Dashboard: Fetch KPIs, agenda, and activity', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: authCookie },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(data.kpis, 'KPIs should be present')
    assert.ok(typeof data.kpis.total_cases === 'number')
    assert.ok(Array.isArray(data.upcoming_hearings))
    assert.ok(Array.isArray(data.by_status))
    assert.ok(Array.isArray(data.by_type))
    assert.ok(Array.isArray(data.team))
  })

  await t.test('Lookups: Fetch system courts, case types, users, and clients', async () => {
    const res = await fetch(`${BASE_URL}/api/lookups`, {
      headers: { Cookie: authCookie },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data.courts) && data.courts.length > 0)
    assert.ok(Array.isArray(data.case_types) && data.case_types.length > 0)
    assert.ok(Array.isArray(data.users) && data.users.length > 0)
    assert.ok(Array.isArray(data.clients) && data.clients.length > 0)
  })

  await t.test('Search: Consistent response format for queries', async () => {
    const shortRes = await fetch(`${BASE_URL}/api/search?q=x`, {
      headers: { Cookie: authCookie },
    })
    assert.equal(shortRes.status, 200)
    const shortData = await shortRes.json()
    assert.ok(Array.isArray(shortData.cases))
    assert.ok(Array.isArray(shortData.clients))
    assert.ok(Array.isArray(shortData.poas))

    const searchRes = await fetch(`${BASE_URL}/api/search?q=الشريف`, {
      headers: { Cookie: authCookie },
    })
    assert.equal(searchRes.status, 200)
    const searchData = await searchRes.json()
    assert.ok(Array.isArray(searchData.cases))
    assert.ok(Array.isArray(searchData.clients))
    assert.ok(Array.isArray(searchData.poas))
  })

  // 3. Clients Management
  let testClientId = null
  await t.test('Clients: Validation and creation', async () => {
    // Missing name validation
    const badRes = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ phone: '01000000000' }),
    })
    assert.equal(badRes.status, 400)

    // Valid creation
    const okRes = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        name: 'مجموعة الأهرام للإنشاءات الهندسية',
        type: 'company',
        commercial_reg: '987654',
        tax_id: '123-456-789',
        phone: '01099887766',
        city: 'القاهرة',
        status: 'vip',
      }),
    })
    assert.equal(okRes.status, 200)
    const okData = await okRes.json()
    assert.ok(okData.id)
    testClientId = okData.id
  })

  await t.test('Clients: Fetch details with linked relations', async () => {
    const res = await fetch(`${BASE_URL}/api/clients/${testClientId}`, {
      headers: { Cookie: authCookie },
    })
    assert.equal(res.status, 200)
    const cl = await res.json()
    assert.equal(cl.name, 'مجموعة الأهرام للإنشاءات الهندسية')
    assert.equal(cl.status, 'vip')
    assert.ok(Array.isArray(cl.cases))
    assert.ok(Array.isArray(cl.invoices))
    assert.ok(Array.isArray(cl.poas))
    assert.ok(Array.isArray(cl.notes))
  })

  await t.test('Clients: Safe partial update', async () => {
    const updateRes = await fetch(`${BASE_URL}/api/clients/${testClientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ city: 'الجيزة' }),
    })
    assert.equal(updateRes.status, 200)

    const checkRes = await fetch(`${BASE_URL}/api/clients/${testClientId}`, {
      headers: { Cookie: authCookie },
    })
    const checkData = await checkRes.json()
    assert.equal(checkData.city, 'الجيزة')
    assert.equal(checkData.name, 'مجموعة الأهرام للإنشاءات الهندسية') // name preserved
    assert.equal(checkData.phone, '01099887766') // phone preserved
  })

  // 4. Cases & Hearings
  let createdCaseId = null
  await t.test('Cases: Validate input on POST /api/cases', async () => {
    const res = await fetch(`${BASE_URL}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ title: 'قضية ناقصة' }),
    })
    assert.equal(res.status, 400)
  })

  await t.test('Cases: Create and update case safely', async () => {
    const createRes = await fetch(`${BASE_URL}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        case_no: '8888',
        year: 2026,
        title: 'دعوى تجارية ضد شركة المقاولون المتحدون',
        client_id: testClientId,
        degree: 'استئناف',
        priority: 'عالية',
        claim_value: 1250000,
        currency: 'EGP',
        lead_lawyer_id: loggedInUser.id,
      }),
    })
    assert.equal(createRes.status, 200)
    const createData = await createRes.json()
    assert.ok(createData.id)
    createdCaseId = createData.id

    // Test partial update
    const updateRes = await fetch(`${BASE_URL}/api/cases/${createdCaseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ next_action: 'حضور جلسة الخبراء' }),
    })
    assert.equal(updateRes.status, 200)

    const checkRes = await fetch(`${BASE_URL}/api/cases/${createdCaseId}`, {
      headers: { Cookie: authCookie },
    })
    const checkData = await checkRes.json()
    assert.equal(checkData.case_no, '8888')
    assert.equal(checkData.title, 'دعوى تجارية ضد شركة المقاولون المتحدون')
    assert.equal(checkData.next_action, 'حضور جلسة الخبراء')
  })

  let hearingId = null
  await t.test('Hearings: Schedule and update hearing', async () => {
    // Validation
    const badRes = await fetch(`${BASE_URL}/api/hearings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ case_id: createdCaseId }),
    })
    assert.equal(badRes.status, 400)

    // Valid scheduling
    const okRes = await fetch(`${BASE_URL}/api/hearings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        case_id: createdCaseId,
        hearing_date: '2026-10-15',
        hearing_time: '10:00',
        court_id: 1,
        type: 'مرافعة',
        purpose: 'تقديم مذكرات الدفاع الختامية',
        lawyer_id: loggedInUser.id,
      }),
    })
    assert.equal(okRes.status, 200)
    const okData = await okRes.json()
    assert.ok(okData.id)
    hearingId = okData.id

    // Update hearing
    const putRes = await fetch(`${BASE_URL}/api/hearings/${hearingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        result: 'حجزت للحكم لجلسة الشهر القادم',
        status: 'حجز للحكم',
      }),
    })
    assert.equal(putRes.status, 200)
  })

  // 5. Tasks
  await t.test('Tasks: Create and update task status', async () => {
    const postRes = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        title: 'إيداع حافظة مستندات أصلية',
        case_id: createdCaseId,
        priority: 'عاجلة',
        status: 'مفتوحة',
      }),
    })
    assert.equal(postRes.status, 200)
    const postData = await postRes.json()
    const taskId = postData.id

    const putRes = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ status: 'مكتملة' }),
    })
    assert.equal(putRes.status, 200)
  })

  // 6. Documents & POAs & Notes
  await t.test('Documents & POAs: Register POA, doc and note', async () => {
    // POA
    const poaRes = await fetch(`${BASE_URL}/api/poas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        poa_no: '12345 / ب',
        client_id: testClientId,
        case_id: createdCaseId,
        type: 'عام قضايا وبنوك',
        notary_office: 'توثيق الأهرام النموذجي',
        issue_date: '2026-01-10',
        expiry_date: '2027-01-10',
      }),
    })
    assert.equal(poaRes.status, 200)
    const poaData = await poaRes.json()
    assert.ok(poaData.id)

    // Document
    const docRes = await fetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        case_id: createdCaseId,
        client_id: testClientId,
        title: 'عقد الاتفاق الأصلي المودع بالحافظة',
        doc_type: 'عقد',
        pages: 8,
      }),
    })
    assert.equal(docRes.status, 200)
    const docData = await docRes.json()
    assert.ok(docData.id)

    // Note
    const noteRes = await fetch(`${BASE_URL}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        case_id: createdCaseId,
        content: 'تم التنبيه على الموكل بسداد باقي أمانة الخبير القضائي',
        pinned: 1,
      }),
    })
    assert.equal(noteRes.status, 200)
    const noteData = await noteRes.json()
    assert.ok(noteData.id)
  })

  // 7. Finance, Billing & Expenses
  await t.test('Billing: Invoice creation, VAT calculation and payment application', async () => {
    const invRes = await fetch(`${BASE_URL}/api/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        client_id: testClientId,
        case_id: createdCaseId,
        amount: 20000,
        desc: 'أتعاب مرحلة الاستئناف وإعداد صحيفة الدعوى',
      }),
    })
    assert.equal(invRes.status, 200)
    const invData = await invRes.json()
    assert.ok(invData.id)
    assert.ok(invData.invoice_no)

    // Verify invoice calculation
    const getInv = await fetch(`${BASE_URL}/api/invoices/${invData.id}`, {
      headers: { Cookie: authCookie },
    })
    const inv = await getInv.json()
    assert.equal(inv.subtotal, 20000)
    assert.equal(inv.tax, 2800) // 14% VAT
    assert.equal(inv.total, 22800)
    assert.equal(inv.paid, 0)
    assert.equal(inv.status, 'صادرة')

    // Partial payment
    const payRes1 = await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        invoice_id: invData.id,
        client_id: testClientId,
        amount: 10000,
        method: 'تحويل',
      }),
    })
    assert.equal(payRes1.status, 200)

    const partialInv = await (await fetch(`${BASE_URL}/api/invoices/${invData.id}`, { headers: { Cookie: authCookie } })).json()
    assert.equal(partialInv.paid, 10000)
    assert.equal(partialInv.status, 'جزئي')

    // Remaining payment
    await fetch(`${BASE_URL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        invoice_id: invData.id,
        client_id: testClientId,
        amount: 12800,
        method: 'تحويل',
      }),
    })

    const settledInv = await (await fetch(`${BASE_URL}/api/invoices/${invData.id}`, { headers: { Cookie: authCookie } })).json()
    assert.equal(settledInv.paid, 22800)
    assert.equal(settledInv.status, 'مسددة')
  })

  await t.test('Expenses & Time Entries: Register case expenses and billable hours', async () => {
    // Judicial expense
    const expRes = await fetch(`${BASE_URL}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        case_id: createdCaseId,
        title: 'رسوم قيد الاستئناف وإعلانات المحضرين',
        amount: 3500,
        category: 'رسوم محكمة',
      }),
    })
    assert.equal(expRes.status, 200)
    const expData = await expRes.json()
    assert.ok(expData.id)

    // Billable time entry
    const timeRes = await fetch(`${BASE_URL}/api/time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        case_id: createdCaseId,
        hours: 4.5,
        description: 'دراسة مستندات الخصم وصياغة المذكرة الختامية',
        rate: 1500,
      }),
    })
    assert.equal(timeRes.status, 200)
    const timeData = await timeRes.json()
    assert.ok(timeData.id)

    // Legal contract
    const contractRes = await fetch(`${BASE_URL}/api/contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        title: 'عقد استشارات سنوي مع مجموعة الأهرام',
        client_id: testClientId,
        type: 'استشارة',
        value: 120000,
      }),
    })
    assert.equal(contractRes.status, 200)
    const contractData = await contractRes.json()
    assert.ok(contractData.id)
  })

  await t.test('Finance: Report calculation endpoint', async () => {
    const res = await fetch(`${BASE_URL}/api/reports/finance`, {
      headers: { Cookie: authCookie },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data.months))
    assert.ok(Array.isArray(data.by_client))
    assert.ok(data.unbilled)
  })

  // 8. Users & Security RBAC
  await t.test('Security & RBAC: User creation and profile update', async () => {
    const uniqueEmail = `lawyer_audit_${Date.now()}@alsharif.law`
    const createRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        name: 'محامٍ أول مراجع',
        email: uniqueEmail,
        role: 'senior',
        hourly_rate: 1200,
      }),
    })
    assert.equal(createRes.status, 200)
    const newUserData = await createRes.json()
    assert.ok(newUserData.id)

    // Update user
    const putRes = await fetch(`${BASE_URL}/api/users/${newUserData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ title: 'رئيس قسم الشركات' }),
    })
    assert.equal(putRes.status, 200)
  })

  // 9. Session Termination
  await t.test('Auth: Logout cleanly terminates session', async () => {
    const res = await fetch(`${BASE_URL}/api/logout`, {
      method: 'POST',
      headers: { Cookie: authCookie },
    })
    assert.equal(res.status, 200)

    const checkMe = await fetch(`${BASE_URL}/api/me`, {
      headers: { Cookie: authCookie },
    })
    const data = await checkMe.json()
    assert.equal(data.user, null, 'User session must be destroyed')
  })
})
