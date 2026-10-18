import { $, state } from '../core/state.js'

/**
 * Toast Notification Component
 */
export function toast(msg, type = 'ok') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-lg text-sm font-semibold shadow-2xl transition-all duration-300';
    document.body.appendChild(el);
  }

  el.style.background = type === 'err' ? '#7A1F1F' : (type === 'warn' ? '#8B6914' : '#0B1F3A');
  el.style.color = '#F6F1E7';
  el.style.border = '1px solid rgba(201,162,39,.45)';
  el.textContent = msg;
  el.style.display = 'block';

  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    el.style.display = 'none';
  }, 3200);
}
