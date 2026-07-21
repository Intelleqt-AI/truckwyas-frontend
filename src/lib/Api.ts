import axios from 'axios';
import { toast } from './toast';

// Resolve the API base URL defensively. The committed dev env files point at
// http://localhost:8001/, so a PRODUCTION build that forgot to set VITE_API_URL
// would send every request (login, copilot, proposals) to the END USER's own
// localhost — a silent, browser-only outage. In a prod build that isn't actually
// running on localhost, fall back to same-origin and log loudly instead.
function resolveApiBaseUrl(): string | undefined {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  const isLocal = (u?: string) => !u || /localhost|127\.0\.0\.1/.test(u);
  if (typeof window !== 'undefined' && import.meta.env.PROD) {
    const onLocalhost = /localhost|127\.0\.0\.1/.test(window.location.hostname);
    if (isLocal(configured) && !onLocalhost) {
      // eslint-disable-next-line no-console
      console.error(
        '[TruckWys] VITE_API_URL is unset or points at localhost in a production build. ' +
        'Falling back to same-origin — set VITE_API_URL at build time to the real backend URL.'
      );
      return window.location.origin + '/';
    }
  }
  return configured;
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

// Inject token on every request
api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access');
    if (token) config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// 401 → redirect to login (except on the auth endpoints themselves, where a 401
// just means "wrong credentials" — not an expired session)
api.interceptors.response.use(
  res => res,
  error => {
    const reqUrl: string = error.config?.url || '';
    // A 401 on login/register means "wrong credentials"; on logout it means the
    // session is already gone — none of these are an expired-session-mid-use event.
    const isAuthEndpoint = reqUrl.includes('auth/login') || reqUrl.includes('auth/register') || reqUrl.includes('auth/logout');

    if (error.response?.status === 401 && !isAuthEndpoint) {
      toast.error('Session expired');
      localStorage.removeItem('access');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    // Surface a human-readable message from the backend when one is present
    // (DRF returns {error}, {detail}, or per-field {field: [msg]} shapes).
    const data = error.response?.data;
    let serverMsg: string | undefined;
    if (typeof data === 'string') {
      // Never surface raw HTML (Django debug pages, nginx error pages, etc.)
      serverMsg = data.trim().startsWith('<') ? undefined : data;
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, any>;
      const firstField = obj.error ?? obj.detail ?? obj[Object.keys(obj)[0]];
      serverMsg = Array.isArray(firstField) ? firstField[0] : firstField;
    }

    const err = error.response
      ? new Error(serverMsg || `HTTP error! status: ${error.response.status}`)
      : new Error(error.message);
    (err as any).status = error.response?.status;
    (err as any).data = error.response?.data;
    throw err;
  }
);

const handleError = (error: any) => { throw error; };

export const fetchData = async (url: string) => {
  if (!url) throw new Error('No URL provided');
  const response = await api.get(url);
  return response.data;
};

export const postData = async ({ url, data, config = {} }: { url: string; data?: any; config?: any }) => {
  if (!url) throw new Error('No post URL provided');
  const response = await api.post(url, data, config);
  return response.data;
};

export const deleteData = async ({ url, data }: { url: string; data?: any }) => {
  if (!url) throw new Error('No URL provided');
  const response = await api.delete(url, data ? { data } : undefined);
  return response.data;
};

export const putData = async ({ url, data }: { url: string; data: any }) => {
  if (!url) throw new Error('No put URL provided');
  const response = await api.put(url, data);
  return response.data;
};

export const patchData = async ({ url, data, config = {} }: { url: string; data: any; config?: any }) => {
  if (!url) throw new Error('No patch URL provided');
  const response = await api.patch(url, data, config);
  return response.data;
};

export const loginUser = async ({ username, password }: { username: string; password: string }) => {
  const res = await api.post('api/v1/auth/login/', { username, password });
  return res.data;
};

export const downloadBlob = async (url: string): Promise<Blob> => {
  if (!url) throw new Error('No URL provided');
  const response = await api.get(url, { responseType: 'blob' });
  return response.data;
};
