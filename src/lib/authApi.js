import axiosInstance from "../axios/axios";

// A person's own sign-in security: /api/v1/auth/*. Each call answers res.data.data (or nothing, for the two public ones).
//
// The public calls (forgot / reset password, the second sign-in step) go through the shared axios instance too: its response
// handler leaves them alone (AUTH_PATH in axios/axios.js), so a wrong code is an error on the form, never a trip to the sign-in page.
const data = (response) => response.data.data;

export const auth = {
  // "forgot my password": the same answer whether or not the address has an account
  forgotPassword: async (email) => (await axiosInstance.post("/auth/forgot-password", { email })).data,
  resetPassword: async (token, password) => (await axiosInstance.post("/auth/reset-password", { token, password })).data,
  // step two of signing in: a code (or a recovery code) with the challenge the password earned
  loginTwoFactor: async (challengeToken, payload) => (await axiosInstance.post("/auth/login/2fa", { challengeToken, ...payload })).data,
};

export const twoFactor = {
  status: async () => data(await axiosInstance.get("/auth/2fa")),
  setup: async (password) => data(await axiosInstance.post("/auth/2fa/setup", { password })),
  enable: async (code) => data(await axiosInstance.post("/auth/2fa/enable", { code })),
  disable: async (input) => data(await axiosInstance.post("/auth/2fa/disable", input)),
  recoveryCodes: async (input) => data(await axiosInstance.post("/auth/2fa/recovery-codes", input)),
};

// The organisation's rule "everyone signs in with two-factor" (needs settings.manage)
export const securityPolicy = {
  save: async (body) => data(await axiosInstance.put("/auth/security-policy", body)),
};
