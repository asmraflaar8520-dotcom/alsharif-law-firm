import { $, formatDocSize } from '../core/state.js'

/**
 * File Uploader Widget with drag-and-drop, progress indication,
 * file validation, and automatic metadata hidden input binding.
 */
export function fileUploaderComponent(folder = 'documents') {
  return `
    <div class="file-uploader-box mt-3 mb-4 p-4 border-2 border-dashed border-gold-500/40 hover:border-gold-500 rounded-xl transition cursor-pointer text-center" id="drop-zone">
      <input type="file" id="file-input" class="hidden" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" />
      <div id="drop-prompt">
        <div class="w-12 h-12 mx-auto rounded-full bg-gold-500/10 text-gold-700 flex items-center justify-center mb-2">
          <i class="fas fa-cloud-arrow-up text-xl"></i>
        </div>
        <p class="text-sm font-semibold text-navy-950">اسحب الملف وأفلته هنا، أو <span class="text-gold-700 underline">تصفح من جهازك</span></p>
        <p class="text-xs text-navy-700/60 mt-1">يدعم ملفات PDF والصور (JPG, PNG) حتى 15 ميجابايت</p>
      </div>
      <div id="upload-progress-container" class="hidden text-right">
        <div class="flex justify-between items-center text-xs mb-1">
          <span id="uploading-file-name" class="font-semibold text-navy-950 truncate max-w-[70%]"></span>
          <span id="upload-percent" class="font-mono text-gold-700">0%</span>
        </div>
        <div class="w-full bg-navy-900/10 rounded-full h-2 overflow-hidden">
          <div id="upload-progress-bar" class="bg-gold-500 h-2 rounded-full transition-all duration-150" style="width: 0%"></div>
        </div>
      </div>
      <div id="upload-success" class="hidden text-right bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-emerald-800 text-xs md:text-sm font-semibold truncate">
            <i class="fas fa-circle-check text-emerald-600 text-base"></i>
            <span id="uploaded-file-label" class="truncate"></span>
            <span id="uploaded-file-size" class="text-xs font-mono text-emerald-600 shrink-0"></span>
          </div>
          <button type="button" id="remove-file-btn" class="text-xs text-red-600 hover:text-red-800 hover:underline shrink-0 mr-2">إزالة</button>
        </div>
      </div>
      <div id="upload-error" class="hidden text-right bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 font-semibold mt-2">
        <i class="fas fa-circle-exclamation text-rose-600 ml-1"></i> <span id="upload-error-msg"></span>
      </div>
    </div>
    <input type="hidden" name="file_url" id="f-file-url" />
    <input type="hidden" name="file_name" id="f-file-name" />
    <input type="hidden" name="file_size" id="f-file-size" />
    <input type="hidden" name="mime_type" id="f-mime-type" />
    <input type="hidden" name="storage_key" id="f-storage-key" />
  `;
}

export function bindFileUploader(folder = 'documents') {
  const dropZone = $('#drop-zone');
  const fileInput = $('#file-input');
  const promptEl = $('#drop-prompt');
  const progressBox = $('#upload-progress-container');
  const progressBar = $('#upload-progress-bar');
  const percentEl = $('#upload-percent');
  const successBox = $('#upload-success');
  const errorBox = $('#upload-error');
  const errorMsg = $('#upload-error-msg');
  const fileLabel = $('#uploaded-file-label');
  const fileSizeEl = $('#uploaded-file-size');
  const removeBtn = $('#remove-file-btn');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('#remove-file-btn') || e.target.closest('#upload-success')) return;
    fileInput.click();
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt?.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFileUpload(fileInput.files[0]);
    }
  });

  removeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.value = '';
    $('#f-file-url').value = '';
    $('#f-file-name').value = '';
    $('#f-file-size').value = '';
    $('#f-mime-type').value = '';
    $('#f-storage-key').value = '';
    successBox.classList.add('hidden');
    progressBox.classList.add('hidden');
    errorBox.classList.add('hidden');
    promptEl.classList.remove('hidden');
  });

  function handleFileUpload(file) {
    errorBox.classList.add('hidden');

    const maxBytes = 15 * 1024 * 1024;
    if (file.size > maxBytes) {
      errorMsg.textContent = 'حجم الملف يتجاوز الحد الأقصى المسموح به (15 ميجابايت)';
      errorBox.classList.remove('hidden');
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
    if (!allowedExts.includes(ext)) {
      errorMsg.textContent = 'نوع الملف غير مدعوم. الصيغ المسموحة: PDF, JPG, PNG';
      errorBox.classList.remove('hidden');
      return;
    }

    promptEl.classList.add('hidden');
    progressBox.classList.remove('hidden');
    successBox.classList.add('hidden');
    $('#uploading-file-name').textContent = file.name;
    progressBar.style.width = '0%';
    percentEl.textContent = '0%';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = pct + '%';
        percentEl.textContent = pct + '%';
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          $('#f-file-url').value = res.file_url || '';
          $('#f-file-name').value = res.file_name || file.name;
          $('#f-file-size').value = res.file_size || file.size;
          $('#f-mime-type').value = res.mime_type || file.type;
          $('#f-storage-key').value = res.storage_key || '';

          progressBox.classList.add('hidden');
          fileLabel.textContent = res.file_name || file.name;
          fileSizeEl.textContent = `(${formatDocSize(res.file_size || file.size)})`;
          successBox.classList.remove('hidden');
        } catch {
          showUploadError('فشل قراءة رد الخادم');
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          showUploadError(res.error || 'فشل رفع الملف');
        } catch {
          showUploadError(`خطأ في رفع الملف (${xhr.status})`);
        }
      }
    };

    xhr.onerror = () => {
      showUploadError('تعذر الاتصال بالخادم لرفع الملف');
    };

    xhr.send(formData);
  }

  function showUploadError(msg) {
    progressBox.classList.add('hidden');
    promptEl.classList.remove('hidden');
    errorMsg.textContent = msg;
    errorBox.classList.remove('hidden');
  }
}
