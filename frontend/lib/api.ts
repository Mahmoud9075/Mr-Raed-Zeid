const externalApi = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8100/api/v1';
const internalApi = process.env.API_INTERNAL_URL || externalApi;

function browserApi() {
  if (typeof window === 'undefined') return internalApi;
  return '/api/v1';
}

async function request(path: string, init: RequestInit = {}) {
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(`${browserApi()}${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(init.headers || {})
      },
      signal: init.signal || controller.signal,
      credentials: 'include',
      cache: 'no-store'
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('الخادم لم يستجب في الوقت المتوقع. تأكد أن الـ Backend يعمل ثم حاول مرة أخرى.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!refreshPromise) {
    refreshPromise = request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({})
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await request(path, init);

    // Access tokens intentionally expire quickly. Refresh the session once and
    // replay the original request so saves/pages do not suddenly stop after 15 min.
    const canRefresh = !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh') && !path.startsWith('/auth/admin-otp');
    if (response.status === 401 && canRefresh && await refreshSession()) {
      response = await request(path, init);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('الخادم لم يستجب')) throw error;
    throw new Error('تعذر الاتصال بالخادم. تأكد أن الـ Backend يعمل ثم حاول مرة أخرى.');
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : 'تعذر تنفيذ الطلب. حاول مرة أخرى.';
    throw new Error(detail);
  }
  return body as T;
}

export function authHeader() { return {}; }

export function assetUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  if (typeof window !== 'undefined') return path;
  return `${internalApi.replace(/\/api\/v1\/?$/, '')}${path}`;
}

export type QuizSummary = {
  id: number;
  slug: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  duration_minutes: number;
  question_count: number;
  stage?: string;
  education_type?: string;
  grade?: string;
  max_attempts: number;
};
