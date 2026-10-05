import axios from "axios";

// One place for the API address. Set VITE_API_URL (e.g. in .env.local, or as a Render
// environment variable) to point the app at another backend; with nothing set it is the local
// server, as before.
const API_PATH = "/api/v1";

// Every route is mounted under /api/v1, but a deployment dashboard invites you to paste the bare
// host (https://trade-erp-nexus-nodejs.onrender.com), which would send each request to /login
// instead of /api/v1/login and 404 the whole app. Both forms are accepted, trailing slash or not.
export const resolveApiBaseUrl = (raw) => {
  const value = String(raw ?? "").trim().replace(/[/]+$/, "");
  if (!value) return `http://localhost:3000${API_PATH}`;
  return value.includes(API_PATH) ? value : `${value}${API_PATH}`;
};

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env?.VITE_API_URL);

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Request interceptor to add Bearer token from sessionStorage
axiosInstance.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh and errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/refresh-token`,
          {},
          { withCredentials: true }
        );
        if (data.success && data.data?.accessToken) {
          const newAccessToken = data.data.accessToken;
          sessionStorage.setItem("accessToken", newAccessToken); // Store in sessionStorage
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return axiosInstance(originalRequest);
        } else {
          throw new Error("Invalid refresh token response");
        }
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        sessionStorage.removeItem("accessToken"); // Clear from sessionStorage
        // Redirect to login on refresh failure
        window.location.href = "/";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;