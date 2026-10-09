import axios from "axios";
import { API_BASE_URL } from "../axios/axios";
import { clearConsoleSession, getConsoleToken, setConsoleSession } from "./platformSession";

// The developer console's own HTTP client. It is deliberately NOT the product's axios instance: that one carries a
// customer's token and renews it through a cookie, and a console token must never be sent there (nor a customer's here).
const client = axios.create({ baseURL: `${API_BASE_URL}/platform`, headers: { "Content-Type": "application/json" } });

client.interceptors.request.use((config) => {
  const token = getConsoleToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A console session has no renewal: when the server says it has ended, the person signs in again.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const isSignIn = /\/login$/.test(error.config?.url || "");
    if (error.response?.status === 401 && !isSignIn) {
      clearConsoleSession();
      window.dispatchEvent(new CustomEvent("console-signed-out"));
    }
    return Promise.reject(error);
  }
);

const data = (response) => response.data.data;

/** The server's sentence for a refusal, or ours when it did not answer. */
export const consoleError = (error) => error?.response?.data?.message || error?.message || "Something went wrong";
export const consoleErrorCode = (error) => error?.response?.data?.errorCode || null;

export const platform = {
  async login(email, password) {
    const result = data(await client.post("/login", { email, password }));
    setConsoleSession({ token: result.token, user: result.user });
    return result.user;
  },
  me: async () => data(await client.get("/me")),
  catalog: async () => data(await client.get("/catalog")),

  organisations: async (params) => data(await client.get("/organisations", { params })),
  createOrganisation: async (body) => data(await client.post("/organisations", body)),
  organisation: async (code) => data(await client.get(`/organisations/${code}`)),
  updateOrganisation: async (code, body) => data(await client.patch(`/organisations/${code}`, body)),
  extend: async (code, body) => data(await client.post(`/organisations/${code}/extend`, body)),
  setStatus: async (code, status) => data(await client.post(`/organisations/${code}/status`, { status })),
  provision: async (code) => data(await client.post(`/organisations/${code}/provision`)),
  saveProfile: async (code, body) => data(await client.put(`/organisations/${code}/profile`, body)),

  users: async (code) => data(await client.get(`/organisations/${code}/users`)),
  roles: async (code) => data(await client.get(`/organisations/${code}/roles`)),
  createUser: async (code, body) => data(await client.post(`/organisations/${code}/users`, body)),
  updateUser: async (code, id, body) => data(await client.patch(`/organisations/${code}/users/${id}`, body)),
  branches: async (code) => data(await client.get(`/organisations/${code}/branches`)),
  createBranch: async (code, body) => data(await client.post(`/organisations/${code}/branches`, body)),
  updateBranch: async (code, branch, body) => data(await client.patch(`/organisations/${code}/branches/${branch}`, body)),

  audit: async (params) => data(await client.get("/audit", { params })),
};
