// ONE axios instance for the whole app.
// - request interceptor: attach the JWT automatically
// - response interceptor: expired/invalid token -> force logout, in one place
import axios from 'axios';

const api = axios.create({ baseURL: '/api' }); // Vite dev proxy / nginx in prod

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Small helper: extract the API's error message for display.
export const errMsg = (e) =>
  e.response?.data?.message ||
  e.response?.data?.errors?.map((x) => x.message).join(', ') ||
  'Something went wrong';

export default api;
