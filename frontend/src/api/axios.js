// ONE axios instance for the whole app.
// Auth rides on the httpOnly session cookie the API sets at login: the browser
// sends it automatically (same origin via the Vite proxy / nginx), and no
// script - ours or an injected one - can read it. Nothing is kept in storage.
import axios from 'axios';

const api = axios.create({ baseURL: '/api' }); // Vite dev proxy / nginx in prod

// Session expired or revoked mid-use -> back to the login page, in one place.
// /auth/me is excluded: a 401 there just means "not signed in yet" and is
// handled by AuthContext without a reload.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !url.startsWith('/auth/') && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Small helper: extract the API's error message for display.
export const errMsg = (e) =>
  e.response?.data?.errors?.map((x) => x.message).join(', ') ||
  e.response?.data?.message ||
  'Something went wrong';

export default api;
