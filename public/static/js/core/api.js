import { state } from './state.js'
import { toast } from '../components/Toast.js'

/**
 * Enterprise API Client for Al-Sharif Law Firm Platform
 * Handles credentials, standardized JSON envelopes, HTTP 400 validation issues,
 * and session expiration with user-friendly toast alerts.
 */
export async function api(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {})
  };

  let res;
  try {
    res = await fetch(path, {
      credentials: 'include',
      headers,
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (netErr) {
    toast('تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت', 'err');
    throw new Error('فشل الاتصال بالشبكة');
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    state.user = null;
    if (state.route !== 'login') {
      window.dispatchEvent(new CustomEvent('app:unauthorized'));
    }
    throw new Error(data.error || 'غير مصرح أو انتهت الجلسة');
  }

  if (!res.ok) {
    let errorMsg = data.error || 'تعذّر تنفيذ الطلب';
    if (Array.isArray(data.details) && data.details.length > 0) {
      const fieldIssues = data.details.map((d) => d.message).join(' · ');
      errorMsg = `${errorMsg}: ${fieldIssues}`;
    }
    throw new Error(errorMsg);
  }

  return data;
}
