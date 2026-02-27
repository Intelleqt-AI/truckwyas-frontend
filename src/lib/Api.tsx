import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Attach token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// If 401 → auto-login and retry once
let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        if (!refreshing) {
          refreshing = axios
            .post(`${import.meta.env.VITE_API_URL}api/auth/login/`, { username: 'admin', password: 'admin123' })
            .then(r => { localStorage.setItem('access', r.data.token); refreshing = null; return r.data.token; });
        }
        const token = await refreshing;
        original.headers.Authorization = `Token ${token}`;
        return api(original);
      } catch {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  }
);

const handleError = error => {
  throw new Error(error.response ? `HTTP error! status: ${error.response.status}` : error.message);
};

export const fetchData = async url => {
  if (!url) throw new Error('No URL provided');
  try {
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

export const postData = async ({ url, data, config = {} }: { url: string; data?: any; config?: any }) => {
  if (!url) throw new Error('No post URL provided');
  try {
    const response = await api.post(url, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteData = async ({ url, data }) => {
  if (!url) throw new Error('No URL provided');
  try {
    const response = await api.delete(url, data ? { data } : undefined);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

export const putData = async ({ url, data }) => {
  if (!url) throw new Error('No put URL provided');
  try {
    const response = await api.put(url, data);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

export const patchData = async ({ url, data }) => {
  if (!url) throw new Error('No patch URL provided');
  try {
    const response = await api.patch(url, data);
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

export const loginUser = async ({ username, password }: { username: string; password: string }) => {
  const res = await api.post('api/auth/login/', { username, password });
  return res.data;
};
