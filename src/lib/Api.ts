import axios from 'axios';
import { toast } from './toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
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
    const isAuthEndpoint = reqUrl.includes('auth/login') || reqUrl.includes('auth/register');

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
      serverMsg = data;
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

export const patchData = async ({ url, data }: { url: string; data: any }) => {
  if (!url) throw new Error('No patch URL provided');
  const response = await api.patch(url, data);
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
