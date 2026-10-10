const browserApi = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const serverApi = process.env.API_INTERNAL_URL || browserApi;

function baseApi(){ return typeof window === 'undefined' ? serverApi : browserApi; }

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const res = await fetch(`${baseApi()}${path}`, {
    ...init,
    headers: { ...(isForm ? {} : {'Content-Type':'application/json'}), ...(init.headers || {}) },
    credentials: 'include',
    cache: 'no-store'
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || 'حدث خطأ غير متوقع');
  return body as T;
}

export function authHeader() { return {}; }
export function assetUrl(path?: string | null){
  if(!path) return '';
  if(/^https?:\/\//.test(path)) return path;
  return `${browserApi.replace(/\/api\/v1\/?$/,'')}${path}`;
}

export type QuizSummary = {
  id:number; slug:string; title_ar:string; title_en:string; description_ar:string;
  duration_minutes:number; question_count:number; stage?:string; education_type?:string;
  grade?:string; max_attempts:number;
};
