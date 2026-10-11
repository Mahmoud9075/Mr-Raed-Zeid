const externalApi = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const internalApi = process.env.API_INTERNAL_URL || externalApi;

function browserApi() {
  if (typeof window === 'undefined') return internalApi;
  return '/api/v1';
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const response = await fetch(`${browserApi()}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers || {})
    },
    credentials: 'include',
    cache: 'no-store'
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || 'Request failed');
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
