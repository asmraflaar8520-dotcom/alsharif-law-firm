import { $, $$, state, formatNum, formatDocSize, esc, caseRef, pageHead, empty } from '../core/state.js'
import { api } from '../core/api.js'
import { normalizePaginated, paginationBar, bindPaginationEvents } from '../components/PaginationBar.js'
import { gridSkeleton } from '../components/Skeletons.js'
import { previewModal } from '../components/Modal.js'
import { docForm, ensureCasesMini } from '../components/Forms.js'

let _docsDebounceTimer = null;

export const DocumentsView = {
  async render() {
    const p = new URLSearchParams();
    p.set('page', state.docsPage || 1);
    p.set('limit', state.docsLimit || 18);
    if (state.docsSearch) p.set('search', state.docsSearch);
    if (state.docsType) p.set('category', state.docsType);

    const res = await api('/api/documents?' + p.toString());
    const norm = normalizePaginated(res, state.docsLimit || 18);
    const list = norm.data;
    const pagination = norm.pagination;

    return `
      ${pageHead('أرشيف المستندات', `${formatNum(pagination.total)} مستند محفوظ (صحف، مذكرات، أحكام، عقود).`, `
        <button id="add-doc" class="btn-gold"><i class="fas fa-plus ml-1"></i> قيد مستند</button>
      `)}
      <div class="paper-card rounded-xl p-3 md:p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input id="doc-q" class="input-lux sm:col-span-2" placeholder="بحث بعنوان المستند أو رقم الإشارة أو اسم القضية أو الموكل" value="${esc(state.docsSearch || '')}"/>
        <select id="doc-type-filter" class="input-lux">
          <option value="">كل أنواع المستندات</option>
          ${['صحيفة دعوى', 'مذكرة دفاع', 'حكم قضائي', 'عقد', 'مستند إثبات', 'محضر شرطة', 'تقرير خبير', 'أخرى'].map((t) => `<option value="${t}" ${state.docsType === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div id="docs-section">
        <div id="docs-grid" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">${DocumentsView.renderCards(list)}</div>
        ${paginationBar(pagination, 'docs')}
      </div>`;
  },

  renderCards(list) {
    if (!list || !list.length) {
      return empty('fa-folder-open', 'لا توجد مستندات بعد', 'غيّر عوامل التصفية أو قيد مستنداً جديداً.');
    }
    return list.map((d) => `
      <article class="paper-card rounded-xl p-4 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-gold-700 font-semibold">${esc(d.doc_type)}</span>
            ${d.file_url ? `<span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium"><i class="fas fa-paperclip ml-1"></i>مرفق ملف</span>` : `<span class="text-[11px] text-navy-700/40">بدون ملف</span>`}
          </div>
          <div class="font-semibold mt-1 text-navy-950">${esc(d.title)}</div>
          <div class="text-xs text-navy-700/60 mt-1">${d.case_no ? caseRef(d) + ' · ' : ''}${esc(d.client_name || '')}</div>
          ${d.file_name ? `<div class="text-xs text-navy-700/50 mt-2 truncate flex items-center gap-1"><i class="fas fa-file text-gold-600"></i> ${esc(d.file_name)} ${d.file_size ? `(${formatDocSize(d.file_size)})` : ''}</div>` : ''}
        </div>
        <div class="mt-4 pt-3 border-t gold-hairline flex items-center justify-between gap-2">
          ${d.file_url ? `
            <button type="button" class="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 text-navy-900" data-preview-url="${esc(d.file_url)}" data-preview-title="${esc(d.title)}" data-preview-mime="${esc(d.mime_type || '')}">
              <i class="fas fa-eye text-gold-600"></i> معاينة المستند
            </button>
            <a href="${esc(d.file_url)}?download=1" download class="btn-gold text-xs py-1.5 px-3 flex items-center gap-1.5" title="تحميل">
              <i class="fas fa-download"></i> تحميل
            </a>
          ` : `
            <span class="text-xs text-navy-700/40">لا يوجد ملف مرفق</span>
          `}
        </div>
      </article>`).join('');
  },

  mount(container, router) {
    $('#add-doc')?.addEventListener('click', async () => {
      await ensureCasesMini();
      docForm();
    });

    const docsSectionEl = $('#docs-section');
    const runDocs = async () => {
      const p = new URLSearchParams();
      p.set('page', state.docsPage || 1);
      p.set('limit', state.docsLimit || 18);
      if (state.docsSearch) p.set('search', state.docsSearch);
      if (state.docsType) p.set('category', state.docsType);

      const res = await api('/api/documents?' + p.toString());
      const norm = normalizePaginated(res, state.docsLimit || 18);
      const gridEl = $('#docs-grid');
      if (gridEl) {
        gridEl.innerHTML = DocumentsView.renderCards(norm.data);
      }
      const existingPagination = $('#docs-section .pagination-container');
      if (existingPagination) existingPagination.remove();
      const newPagHtml = paginationBar(norm.pagination, 'docs');
      if (newPagHtml && docsSectionEl) {
        const temp = document.createElement('div');
        temp.innerHTML = newPagHtml;
        docsSectionEl.appendChild(temp.firstElementChild);
      }

      $$('[data-preview-url]', docsSectionEl).forEach((btn) => {
        btn.addEventListener('click', () => {
          previewModal(btn.dataset.previewUrl, btn.dataset.previewTitle, btn.dataset.previewMime);
        });
      });
    };

    $('#doc-q')?.addEventListener('input', (e) => {
      clearTimeout(_docsDebounceTimer);
      _docsDebounceTimer = setTimeout(() => {
        state.docsPage = 1;
        state.docsSearch = e.target.value.trim();
        const gridEl = $('#docs-grid');
        if (gridEl) gridEl.innerHTML = gridSkeleton(6);
        runDocs();
      }, 300);
    });

    $('#doc-type-filter')?.addEventListener('change', (e) => {
      state.docsPage = 1;
      state.docsType = e.target.value;
      const gridEl = $('#docs-grid');
      if (gridEl) gridEl.innerHTML = gridSkeleton(6);
      runDocs();
    });

    if (docsSectionEl) {
      bindPaginationEvents(docsSectionEl, 'docs', async (targetPage) => {
        if (targetPage !== state.docsPage) {
          state.docsPage = targetPage;
          const gridEl = $('#docs-grid');
          if (gridEl) gridEl.innerHTML = gridSkeleton(6);
          await runDocs();
        }
      });

      $$('[data-preview-url]', docsSectionEl).forEach((btn) => {
        btn.addEventListener('click', () => {
          previewModal(btn.dataset.previewUrl, btn.dataset.previewTitle, btn.dataset.previewMime);
        });
      });
    }
  },

  destroy() {
    clearTimeout(_docsDebounceTimer);
    _docsDebounceTimer = null;
  }
};
