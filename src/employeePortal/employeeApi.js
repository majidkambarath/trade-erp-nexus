import axios from "axios";
import { API_BASE_URL } from "../axios/axios";
import { clearEmployeeSession, getEmployeeToken, setEmployeeSession } from "./employeeSession";

// The employee portal's own HTTP client - deliberately NOT the ERP's shared axios instance (that one
// carries an Admin's token and renews it through a DIFFERENT cookie; an employee token must never reach
// it, and the reverse). Its own base path, its own refresh-retry, its own session.
const client = axios.create({ baseURL: `${API_BASE_URL}/employee`, withCredentials: true, headers: { "Content-Type": "application/json" } });

const AUTH_PATH = /\/(login|refresh-token|logout)$/;
let refreshing = null;

function refresh() {
  if (!refreshing) {
    refreshing = axios
      .post(`${API_BASE_URL}/employee/refresh-token`, {}, { withCredentials: true })
      .then(({ data }) => {
        if (!data?.success || !data.data?.accessToken) throw new Error("Invalid refresh response");
        setEmployeeSession({ accessToken: data.data.accessToken });
        return data.data;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

client.interceptors.request.use((config) => {
  const token = getEmployeeToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const unauthorized = error.response?.status === 401;
    if (!unauthorized || !original || original._retry || AUTH_PATH.test(original.url || "")) return Promise.reject(error);
    original._retry = true;
    try {
      await refresh();
      original.headers.Authorization = `Bearer ${getEmployeeToken()}`;
      return client(original);
    } catch (refreshError) {
      clearEmployeeSession();
      return Promise.reject(refreshError);
    }
  }
);

const data = (response) => response.data.data;
export const employeeError = (error) => error?.response?.data?.message || error?.message || "Something went wrong";

export const employeeApi = {
  async login(phone, password) {
    const result = data(await client.post("/login", { phone, password }));
    setEmployeeSession({ accessToken: result.accessToken, user: result.user });
    return result.user;
  },
  async logout() {
    try { await client.post("/logout"); } finally { clearEmployeeSession(); }
  },
  async changePassword(currentPassword, newPassword) {
    const result = data(await client.put("/change-password", { currentPassword, newPassword }));
    setEmployeeSession({ accessToken: result.accessToken, user: result.user });
    return result.user;
  },
  me: () => data(client.get("/me")),
  todayAttendance: () => data(client.get("/attendance/today")),
  punch: (body) => data(client.post("/punch", body)),
  leaveTypes: () => data(client.get("/leave-types")),
  leaveRequests: (status) => data(client.get("/leave-requests", { params: { status } })),
  leaveBalance: (leaveTypeId) => data(client.get("/leave-requests/balance", { params: { leaveTypeId } })),
  submitLeaveRequest: (body) => data(client.post("/leave-requests", body)),
  cancelLeaveRequest: (id) => data(client.post(`/leave-requests/${id}/cancel`)),
  payslips: () => data(client.get("/payslips")),
};
