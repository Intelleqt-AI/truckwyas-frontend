import axios from 'axios';
import { tokenStorage } from '@/lib/tokenStorage';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
  }
  return config;
});

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
    return response.data; // + your 201 success body
  } catch (error) {
    // Axios errors carry status here
    throw error;
  }
};

// export const deleteData = async ({ url }) => {
//   if (!url) throw new Error('No URL provided');
//   try {
//     const response = await api.delete(url);
//     return response.data;
//   } catch (error) {
//     handleError(error);
//   }
// };

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
  return res.data; // { token, refresh, user }
};

/** Flag to prevent multiple concurrent refresh attempts */
let isRefreshing = false;
/** Queue of requests waiting for the refresh to complete */
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

const forceLogout = () => {
  tokenStorage.clearAll();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // If the request that failed WAS the refresh request → logout immediately (prevent loop)
    if (originalRequest.url?.includes('api/auth/token/refresh/')) {
      forceLogout();
      return Promise.reject(error);
    }

    // If 401 and not retried yet → attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // If another refresh is already in progress, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = `Token ${token}`;
          return api(originalRequest);
        });
      }

      const refresh = tokenStorage.getRefreshToken();

      // No refresh token available → force logout
      if (!refresh) {
        forceLogout();
        return Promise.reject(error);
      }

      isRefreshing = true;

      try {
        const res = await api.post('api/auth/token/refresh/', { refresh });
        const newToken = res.data.token || res.data.access;

        tokenStorage.setToken(newToken);

        // If a new refresh token is returned, store it too
        if (res.data.refresh) {
          tokenStorage.setRefreshToken(res.data.refresh);
        }

        processQueue(null, newToken);

        // Retry original request with new token
        originalRequest.headers['Authorization'] = `Token ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        forceLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
