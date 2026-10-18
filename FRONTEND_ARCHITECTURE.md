# 🏛️ دليل البنية المعمارية للواجهة الأمامية (Phase 4: Frontend Architecture)
## Al-Sharif & Partners — Legal Practice Management Platform

تم تفكيك الملف الأحادي القديم (`public/static/app.js` ذو الـ 2,468 سطرًا) بالكامل وتحويله إلى بنية معمارية معيارية مبنية على **Native ES Modules**، مع فصل كامل للمسؤوليات، وإلغاء تام لتسريبات الذاكرة (Memory Leaks Elimination)، وإدارة دورة حياة واضحة للمكونات (Component Lifecycle).

---

## 📁 1. شجرة المجلدات المعمارية (Directory Structure)

```
public/static/
├── app.js                         # نقطة الدخول التوافقية (Legacy Compatibility Re-export)
└── js/
    ├── main.js                    # منسق التطبيق ونقطة الانطلاق (Bootstrap & View Registration)
    ├── core/
    │   ├── state.js               # إدارة الحالة المركزية، الدوال المساعدة، والمطابقات المحلية
    │   ├── api.js                 # عميل HTTP الموحد ومعالج أخطاء التحقق (400) والجلسات (401)
    │   └── router.js              # موجه التطبيق المدار بدورة الحياة (Mount/Destroy Lifecycle Router)
    ├── components/
    │   ├── Shell.js               # هيكل التطبيق (القائمة الجانبية، الرأس، البحث الشامل المباشر)
    │   ├── PaginationBar.js       # شريط الترقيم المعتمد على استجابة الباك إند
    │   ├── Modal.js               # النوافذ المنبثقة ومعاين الوثائق (PDF/Images Previewer)
    │   ├── Uploader.js            # رافع الملفات بالسحب والإفلات مع شريط تقدم حي
    │   ├── Skeletons.js           # هياكل التحميل المؤقتة (Table & Grid Skeletons)
    │   ├── Toast.js               # نظام التنبيهات المنبثقة التلقائية
    │   └── Forms.js               # نماذج الإدخال المعيارية لكافة الكيانات
    └── views/
        ├── DashboardView.js       # لوحة المؤشرات، جدول الجلسات، والرسم البياني
        ├── CasesView.js           # سجل القضايا مع الفرز، الترقيم، والبحث اللحظي
        ├── CaseDetailView.js      # ملف القضية الشامل وتبويب الجلسات والوثائق والملاحظات
        ├── HearingsView.js        # أجندة الجلسات (تبديل التقويم والجدول والترقيم)
        ├── ClientsView.js         # بطاقات الموكلين والبحث والترقيم
        ├── ClientDetailView.js    # ملف الموكل الشامل وربط القضايا والتوكيلات
        ├── DocumentsView.js       # أرشيف المستندات مع التصفية والمعاينة الفورية
        ├── POAsView.js            # سجل التوكيلات العامة والخاصة وتتبع الانتهاء
        ├── TasksView.js           # لوحة المهام (كانبان: مفتوحة، جارية، مكتملة)
        ├── BillingView.js         # الأتعاب والفواتير والتحصيلات والمصروفات
        ├── InvoiceDetailView.js   # فاتورة الأتعاب القابلة للطباعة وتطبيق الدفعات
        ├── FinanceView.js         # الموقف المالي للمكتب ورسم بياني للتحصيل
        ├── TimeView.js            # سجل ساعات العمل والمحامين
        ├── ContractsView.js       # سجل عقود الأتعاب السنوية والاستشارية
        ├── TeamView.js            # دليل فريق العمل والشركاء والصلاحيات
        └── LoginView.js           # شاشة تسجيل الدخول بتصميم رخامي راقٍ
```

---

## 🔄 2. دورة حياة الواجهات (View Lifecycle & Memory Management)

كل واجهة في النظام تطبق عقدًا صارمًا من ثلاث مراحل:

```javascript
export const MyView = {
  // 1. التوليد غير المتزامن لرمز HTML النقي
  async render(params) {
    const data = await api('/api/my-endpoint');
    return `<div>...</div>`;
  },

  // 2. ربط الأحداث وعناصر DOM بعد الإدراج
  mount(container, router) {
    $('#my-btn')?.addEventListener('click', () => { ... });
  },

  // 3. التنظيف التام قبل الانتقال لواجهة أخرى لمنع تسرب الذاكرة
  destroy() {
    clearTimeout(myDebounceTimer);
    myAbortController?.abort();
  }
};
```

### مزايا دورة الحياة:
1. **القضاء على تسريبات الذاكرة (Memory Leaks)**: عند كل انتقال في الـ Router، يُستدعى `destroy()` للواجهة السابقة ويتم إتلاف جميع كائنات `Chart.js` ومؤقتات الـ debounce تلقائياً.
2. **انعدام الوميض (Zero Flicker)**: يبقى إطار العمل الخارجي (Shell) ثابتاً وتتغير فئات التنشيط (Active Classes) في القوائم دون إعادة رسم كامل الصفحة.
3. **التكامل مع أخطاء التحقق (400 Toast Validation)**: يقوم `api.js` باستخراج رسائل التحقق الدقيقة من استجابات الباك إند وعرضها في نافذة تنبيه فورية.

---

## 🚀 3. كيف يضيف مطور جديد صفحة جديدة في 3 خطوات بسيطة؟

### الخطوة 1: إنشاء ملف الواجهة
أنشئ ملفاً جديداً في `public/static/js/views/ReportsView.js`:
```javascript
import { pageHead } from '../core/state.js'
import { api } from '../core/api.js'

export const ReportsView = {
  async render(params) {
    const data = await api('/api/reports');
    return `
      ${pageHead('التقارير الإدارية', 'متابعة أداء المكتب')}
      <div class="paper-card rounded-xl p-6">
        <button id="export-btn" class="btn-gold">تصدير التقرير</button>
      </div>
    `;
  },
  mount(container, router) {
    container.querySelector('#export-btn')?.addEventListener('click', () => {
      alert('تم التصدير بنجاح');
    });
  },
  destroy() {
    // أي تنظيف للمؤقتات أو الرسوم البيانية
  }
};
```

### الخطوة 2: تسجيل الواجهة في الموجه (`main.js`)
افتح `public/static/js/main.js` وسجل الواجهة:
```javascript
import { ReportsView } from './views/ReportsView.js'

router.register('reports', ReportsView);
```

### الخطوة 3: إضافة رابط القائمة في القائمة الجانبية (`state.js`)
افتح `public/static/js/core/state.js` وأضف العنصر إلى مصفوفة `NAV`:
```javascript
{ id: 'reports', label: 'التقارير', icon: 'fa-chart-pie' }
```

🎉 **مبروك!** الصفحة أصبحت مدمجة بالكامل، تدعم التنقل السريع، وإدارة دورة الحياة، والتحقق التلقائي من الأمان.
