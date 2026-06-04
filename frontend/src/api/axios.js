/**
 * api/axios.js — Axios instance with JWT interceptor
 */
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("hrms_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 globally — clear token and redirect unless it's a login request
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url && error.config.url.includes("/auth/login");
      if (!isLoginRequest) {
        sessionStorage.removeItem("hrms_token");
        sessionStorage.removeItem("hrms_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
