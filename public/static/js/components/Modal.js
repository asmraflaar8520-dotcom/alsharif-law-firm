import { $, esc } from '../core/state.js'

let _currentEscHandler = null;

/**
 * Closes and unmounts the active modal window and cleans keydown listeners
 */
export function closeModal() {
  const root = $('#modal-root');
  if (root) root.innerHTML = '';
  if (_currentEscHandler) {
    document.removeEventListener('keydown', _currentEscHandler);
    _currentEscHandler = null;
  }
}

/**
 * Renders and mounts a generic modal dialog
 */
export function modal(title, body, footer = '') {
  closeModal();
  let root = $('#modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <div class="modal-backdrop fixed inset-0 z-50 flex items-start justify-center p-2 md:p-4 overflow-y-auto" id="modal-bg">
      <div class="paper-card rounded-2xl w-full max-w-2xl my-4 md:my-10 p-5 md:p-6 fade-in shadow-2xl">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-amiri text-xl md:text-2xl text-navy-950">${esc(title)}</h3>
          <button id="modal-x" class="text-navy-700/60 hover:text-navy-950 p-2 rounded-full" aria-label="إغلاق"><i class="fas fa-xmark text-lg"></i></button>
        </div>
        ${body}
        <div class="mt-5 flex justify-end gap-2">${footer}</div>
      </div>
    </div>`;

  $('#modal-x').onclick = closeModal;
  $('#modal-bg').addEventListener('click', (e) => {
    if (e.target.id === 'modal-bg') closeModal();
  });

  _currentEscHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', _currentEscHandler);
}

/**
 * Displays file preview viewer modal (PDF embedded, Image preview, or Download action)
 */
export function previewModal(url, title, mimeType = '') {
  closeModal();
  let root = $('#modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }

  const isPdf = (mimeType || '').includes('pdf') || url.toLowerCase().includes('.pdf');
  const isImage = (mimeType || '').includes('image') || /\.(jpg|jpeg|png)$/i.test(url);

  let viewerHtml = '';
  if (isPdf) {
    viewerHtml = `<div class="relative w-full h-[70vh] bg-navy-950/5 rounded-xl overflow-hidden border gold-hairline">
      <iframe src="${url}" class="w-full h-full border-0" title="${esc(title)}"></iframe>
    </div>`;
  } else if (isImage) {
    viewerHtml = `<div class="flex justify-center items-center max-h-[70vh] bg-navy-950/5 rounded-xl p-4 overflow-auto border gold-hairline">
      <img src="${url}" alt="${esc(title)}" class="max-h-[65vh] max-w-full rounded shadow object-contain" />
    </div>`;
  } else {
    viewerHtml = `<div class="p-8 text-center bg-navy-950/5 rounded-xl border gold-hairline">
      <i class="fa fa-file text-4xl text-navy-700/40 mb-3"></i>
      <p class="text-sm text-navy-700 mb-4">لا تتوفر معاينة مباشرة لهذا النوع من الملفات</p>
      <a href="${url}?download=1" download class="btn-gold inline-flex items-center gap-2"><i class="fa fa-download"></i> تحميل الملف</a>
    </div>`;
  }

  root.innerHTML = `
    <div class="modal-backdrop fixed inset-0 z-50 flex items-start justify-center p-2 md:p-4 overflow-y-auto" id="modal-bg">
      <div class="paper-card rounded-2xl w-full max-w-4xl my-4 md:my-8 p-5 md:p-6 fade-in shadow-2xl">
        <div class="flex justify-between items-center mb-4">
          <div class="flex items-center gap-2 truncate">
            <i class="fa ${isPdf ? 'fa-file-pdf text-red-600' : isImage ? 'fa-file-image text-emerald-600' : 'fa-file text-navy-700'} text-xl"></i>
            <h3 class="font-amiri text-xl md:text-2xl text-navy-950 truncate">${esc(title)}</h3>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <a href="${url}" target="_blank" class="btn-ghost text-xs inline-flex items-center gap-1.5" title="فتح بنافذة جديدة"><i class="fas fa-external-link"></i> نافذة مستقلة</a>
            <a href="${url}?download=1" download class="btn-gold text-xs inline-flex items-center gap-1.5" title="تحميل"><i class="fas fa-download"></i> تحميل</a>
            <button id="modal-x" class="text-navy-700/60 hover:text-navy-950 p-2 rounded-full" aria-label="إغلاق"><i class="fas fa-xmark text-lg"></i></button>
          </div>
        </div>
        ${viewerHtml}
      </div>
    </div>`;

  $('#modal-x').onclick = closeModal;
  $('#modal-bg').addEventListener('click', (e) => {
    if (e.target.id === 'modal-bg') closeModal();
  });

  _currentEscHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', _currentEscHandler);
}

/**
 * Modal form input generator
 */
export function field(label, name, type = 'text', val = '', extra = '') {
  if (type === 'textarea') return `<label class="block mb-3 text-xs md:text-sm font-semibold">${label}<textarea name="${name}" class="input-lux mt-1" rows="3">${esc(val)}</textarea></label>`;
  if (type === 'select') return `<label class="block mb-3 text-xs md:text-sm font-semibold">${label}<select name="${name}" class="input-lux mt-1">${extra}</select></label>`;
  return `<label class="block mb-3 text-xs md:text-sm font-semibold">${label}<input name="${name}" type="${type}" value="${esc(val)}" class="input-lux mt-1" ${extra}/></label>`;
}

export function opt(list, valKey, labelKey, selected) {
  return `<option value="">—</option>` + (list || []).map((x) => `<option value="${x[valKey]}" ${String(x[valKey]) === String(selected) ? 'selected' : ''}>${esc(x[labelKey])}</option>`).join('');
}

export function formTo(fd) {
  const o = {};
  new FormData(fd).forEach((v, k) => {
    o[k] = v === '' ? null : v;
  });
  return o;
}
