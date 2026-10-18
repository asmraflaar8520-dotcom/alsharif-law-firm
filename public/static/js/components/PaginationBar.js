import { formatNum } from '../core/state.js'

/**
 * Normalizes backend responses (either legacy flat array or standardized envelope)
 */
export function normalizePaginated(res, defaultLimit = 20) {
  if (Array.isArray(res)) {
    return {
      data: res,
      pagination: {
        total: res.length,
        page: 1,
        limit: defaultLimit,
        totalPages: Math.ceil(res.length / defaultLimit) || 1,
        hasMore: false,
      }
    };
  }
  return {
    data: res?.data || [],
    pagination: res?.pagination || {
      total: 0,
      page: 1,
      limit: defaultLimit,
      totalPages: 0,
      hasMore: false,
    }
  };
}

/**
 * Renders standard pagination bar HTML with dynamic ellipsis & page buttons
 */
export function paginationBar(pagination, target) {
  if (!pagination || pagination.total === 0) return '';
  const { page, totalPages, total, limit } = pagination;
  if (totalPages <= 1) {
    return `
      <div class="pagination-container" data-pagination-target="${target}">
        <div class="pagination-info">إجمالي السجلات: <b>${formatNum(total)}</b></div>
      </div>
    `;
  }
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const pages = [];
  const delta = 1;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return `
    <div class="pagination-container" data-pagination-target="${target}">
      <div class="pagination-info">
        عرض <b>${formatNum(startItem)} - ${formatNum(endItem)}</b> من إجمالي <b>${formatNum(total)}</b>
      </div>
      <div class="pagination-pages">
        <button type="button" class="pagination-btn" data-page-btn="${page - 1}" ${page <= 1 ? 'disabled' : ''} title="الصفحة السابقة">
          <i class="fas fa-chevron-right ml-1"></i> السابق
        </button>
        ${pages.map((p) => {
          if (p === '...') return `<span class="pagination-ellipsis">...</span>`;
          return `<button type="button" class="pagination-btn ${p === page ? 'active' : ''}" data-page-btn="${p}">${p}</button>`;
        }).join('')}
        <button type="button" class="pagination-btn" data-page-btn="${page + 1}" ${page >= totalPages ? 'disabled' : ''} title="الصفحة التالية">
          التالي <i class="fas fa-chevron-left mr-1"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Attaches click delegation to a pagination container
 */
export function bindPaginationEvents(container, target, onPageChange) {
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest(`[data-pagination-target="${target}"] [data-page-btn]`);
    if (btn && !btn.disabled) {
      const targetPage = parseInt(btn.dataset.pageBtn, 10);
      if (targetPage && !isNaN(targetPage)) {
        onPageChange(targetPage);
      }
    }
  });
}
