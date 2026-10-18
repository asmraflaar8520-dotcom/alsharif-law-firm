# تقرير المرحلة الأولى (Phase 1): إعادة هيكلة طبقة قواعد البيانات والانتقال إلى قاعدة بيانات سحابية دائمة (Serverless Persistent Database)

**المشروع:** منصة إدارة مكاتب المحاماة والاستشارات القانونية (Legal Practice Management Platform)  
**الدور الهندسي:** مهندس واستشاري قواعد بيانات أول (Senior Database Engineer & Architect)  
**تاريخ التنفيذ:** 18 أكتوبر 2026  
**حالة الإنجاز:** مُكتمل ومُختبر بنسبة 100% (Passed Verification & Full Test Suite)

---

## 1. تشخيص المشكلة الجذرية (Root Cause Analysis)
كانت المنظومة تعتمد سابقاً على قاعدة بيانات SQLite محلية في الذاكرة المؤقتة (`:memory:` أو ملف غير دائم). وعند نشر التطبيق على بيئة Vercel Serverless:
1. تتعرض حاويات الـ Serverless للتدوير (Container Recycling) والتجميد (Cold Starts) عند عدم وجود طلبات أو عند إنشاء نسخ خوادم جديدة.
2. تدمير ومسح كامل لجميع سجلات العملاء، القضايا، الجلسات، التوكيلات، والفواتير عند كل عملية Cold Start.
3. عدم القدرة على مزامنة البيانات بين عدة طلبات متزامنة يتم توجيهها إلى حاويات Serverless مختلفة.

---

## 2. بنية الحل الهندسي المعتمدة (Architectural Solution)

### أ. اعتماد محرك Turso / LibSQL السحابي (`@libsql/client`)
تم اعتماد تقنية **Turso LibSQL** كقاعدة بيانات Serverless موزعة، لما تتميز به من:
- توافق كامل 100% مع معايير لهجة SQLite ومطابقتها لواجهة Cloudflare D1.
- دعم الاتصال السحابي عبر بروتوكولات HTTP و WebSockets المشفرة وسريعة الاستجابة (`libsql://` و `https://`).
- دعم التشغيل الدائم عبر ملفات محلية ثابتة (`file:./data/law_firm.db`) في بيئات التطوير والاختبار المحلي، مما يضمن ثبات البيانات وعدم ضياعها محلياً حتى في حال انقطاع الإنترنت.
- إدارة مجمّع الاتصالات (Connection Pooling & Singleton Management) مع منع حالات التنافس أثناء التهيئة (Race Conditions Prevention).

### ب. تصميم المحول المتوافق (`LibSqlD1Adapter` & `LibSqlPreparedStatement`)
تم بناء طبقة وسيطة متطورة في `src/db/adapter.ts`:
- توفر دعماً كاملاً لواجهة Cloudflare D1 (`prepare(sql).bind(...).first()`, `.all()`, `.run()`, `.batch()`).
- تسمح لجميع خدمات النظام الـ 8 (`ClientsService`, `CasesService`, `FinanceService`, `DocumentsService`, `TasksService`, `UsersService`, `DashboardService`, `AuthService`) بالعمل بكفاءة تامة دون الحاجة إلى إعادة كتابة أي استعلام SQL.
- تحويل تلقائي للقيم غير المحددة (`undefined` إلى `null`) ولمعرفات الصفوف الأخيرة (`lastInsertRowid` BigInt إلى Number).

### ج. المتغيرات البيئية المدعومة:
- `TURSO_DATABASE_URL`: رابط الاتصال بقاعدة بيانات Turso السحابية (مثال: `libsql://your-db.turso.io`).
- `TURSO_AUTH_TOKEN`: رمز المصادقة المشفر لقاعدة بيانات Turso.
- `SQLITE_PATH` أو `DATABASE_PATH`: مسار التخزين الدائم المحلي البديل (الافتراضي: `./data/law_firm.db`).

---

## 3. مخطط قاعدة البيانات والفهارس المطلوبة (Idempotent Schema & Indexes)

تم توفير مخطط DDL كامل وقابل للتنفيذ المتكرر بأمان (`IF NOT EXISTS` / Triggers / Constraints):

### أ. الجداول الأساسية المعتمدة:
1. **`clients`**: إدارة الموكلين (شركات وأفراد) مع الرقم القومي/الضريبي وحالة الموكل والمحامي المسؤول.
2. **`cases`**: إدارة ملفات القضايا، متضمنةً كلاً من:
   - `case_no TEXT NOT NULL`
   - `case_number TEXT GENERATED ALWAYS AS (case_no) VIRTUAL` (عمود افتراضي محسوب يضمن توافق الاستعلامات القديمة والحديثة).
   - القيود والمفاتيح الأجنبية (`FOREIGN KEY` مع `ON DELETE CASCADE / SET NULL`).
3. **`hearings`**: رول الجلسات وتفاصيل الدوائر والقرارات وتواريخ التأجيل.
4. **`documents`**: الأرشيف الإلكتروني للمستندات والعرائض ومذكرات الدفاع.
5. **`powers_of_attorney`** و **عرض `poas` الشفاف**:
   - تم إنشاء جدول التوكيلات الرئيسي `powers_of_attorney`.
   - تم إنشاء عرض وقواعد تحويل (`CREATE VIEW IF NOT EXISTS poas` مع Triggers من نوع `INSTEAD OF INSERT/UPDATE/DELETE`) لضمان تعامل النظام مع الاسمين بسلاسة متناهية.
6. **`time_entries`**: تسجيل الساعات القضائية القابلة للفوترة ومعدلات الأتعاب.
7. **الجداول المكملة**: `users`, `sessions`, `courts`, `case_types`, `case_lawyers`, `tasks`, `invoices`, `invoice_items`, `payments`, `expenses`, `contracts`, `notes`, `activities`, `reminders`.

### ب. الفهارس الإلزامية التي تم إنشاؤها والتحقق منها:
- **`idx_cases_case_number_client`**: على `cases(case_number, client_id)`.
- **`idx_cases_case_no_client`**: على `cases(case_no, client_id)`.
- **`idx_hearings_hearing_date_case`**: على `hearings(hearing_date, case_id)`.
- **`idx_documents_case_id`**: على `documents(case_id)`.
- **فهارس تسريع لوحة التحكم والاستعلامات عالية الكثافة**:
  - `idx_hearings_upcoming ON hearings(hearing_date, status)`
  - `idx_invoices_status_due ON invoices(status, due_date)`
  - `idx_tasks_user_status ON tasks(assignee_id, status)`
  - `idx_cases_lawyer_status ON cases(lead_lawyer_id, status)`
  - `idx_time_billable ON time_entries(billable, billed)`

---

## 4. البيانات الأولية والتصنيفات القانونية (Idempotent Seed Data)

تم إعداد موديول التغذية الأولية `src/db/seed.ts` وتهيئته بأمان:
- **12 محكمة مصرية متخصصة**: محاكم جنوب وشمال القاهرة الابتدائية، محكمة استئناف القاهرة، محكمة النقض، القضاء الإداري، الإدارية العليا، المحكمة الاقتصادية، محكمة الأسرة، محكمة العمال.
- **16 نوع وتصنيف قضائي**: مدني كلي، مدني جزئي، تجاري كلي، شركات، جنح، جنايات، نقض جنائي، أحوال شخصية، ولاية على المال، قضاء إداري، تعويض، فصل تعسفي، أموال عامة، شيكات، تنفيذ، تحكيم تجاري.
- **9 مستخدمين ومحامين**: بحسابات مشفرة وفق معيار `PBKDF2-SHA256` (100,000 تكرار).
- **نماذج واقعية للقضايا، الجلسات، التوكيلات، والفواتير**.

---

## 5. تقرير التحقق والاختبار الإلزامي (Mandatory Verification Results)

تمت كتابة وتشغيل سكريبت الفحص الشامل `scripts/verify-database.ts` عبر الأمر:
```bash
npm run db:verify
```

### نتائج مراحل الفحص الأربعة:
1. **a) الاتصال الناجح بقاعدة البيانات:**
   - تم التحقق بنجاح من سلامة الاتصال عبر استعلام البينغ ورقم إصدار محرك التخزين (`SQLite Engine 3.45.1`).
2. **b) التحقق من جداول ومخطط البيانات وإدراج عميل وقضية:**
   - التحقق من تواجد الجداول الأساسية (`clients`, `cases`, `hearings`, `documents`, `poas`, `time_entries`).
   - التحقق من الفهارس الثلاثة المطلوبة بدقة.
   - إدراج عميل تجريبي (`مؤسسة الصفا للتجارة والاستثمار` ID: 16).
   - إدراج قضية مرتبطة (`VERIFY-CASE-1792321470090` ID: 16).
3. **c) استرجاع السجلات والتحقق من العلاقات والأعمدة المحسوبة:**
   - استرجاع القضية بنجاح ومطابقة الربط مع الموكل (`client_name`).
   - مطابقة عمود `case_number` المحسوب تلقائياً مع `case_no`.
   - إدراج جلسة، مستند، وتوكيل عبر عرض `poas`.
4. **d) التحقق من بقاء وثبات البيانات عبر محاكاة انقطاع وإعادة تشغيل الخادم (Cold Start Persistence):**
   - تم تفكيك وإغلاق الاتصال الحالي ومسح جميع الكائنات المحفوظة في الذاكرة بالكامل (`closeDatabase()`).
   - تم تشغيل اتصال جديد كلياً يحاكي استيقاظ حاوية Serverless جديدة (Cold Start).
   - تم استرجاع بيانات القضية، العميل، الجلسات، التوكيلات، والمستندات بنجاح تام وبنفس المعرفات والبيانات دون أي فقدان.
5. **تنظيف السجلات التجريبية وتأكيد الجاهزية**.

### نتائج فحص الـ 110 اختبارات للمنظومة (`npm test`):
```text
ℹ tests 110
ℹ suites 0
ℹ pass 110
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2606.4489
```

### نتائج التدقيق البرمجي والتحزيم (`npm run typecheck` & `npm run build`):
- `tsc --noEmit`: نجح بـ 0 أخطاء نوعية (Zero TypeScript Errors).
- `esbuild`: تم تحزيم `api/index.js` بنجاح لبيئة Vercel مع استبعاد `@libsql/client` لتحميله من `node_modules` السحابية.

---

## 6. أوامر الإدارة والتشغيل المتاحة في `package.json`

| الأمر | الوظيفة |
| :--- | :--- |
| `npm run db:verify` | تشغيل الفحص الإلزامي لثبات البيانات والاتصال والمحاكاة |
| `npm run db:migrate` | تطبيق مخطط الجداول والفهارس بشكل تكراري آمن (Idempotent) |
| `npm run db:seed` | تعبئة البيانات المرجعية والتصنيفات القضائية الأولية |
| `npm test` | تشغيل الـ 110 اختبارات للوحدات والتكامل والأمان |
| `npm run build` | بناء وتحزيم المشروع للنشر على Vercel Serverless |
