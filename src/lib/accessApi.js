import axiosInstance from "../axios/axios";

// The people of the signed-in organisation and the roles they hold: /api/v1/access/*. Each call answers res.data.data.
const data = (response) => response.data.data;

export const access = {
  users: async (params) => data(await axiosInstance.get("/access/users", { params })),
  createUser: async (body) => data(await axiosInstance.post("/access/users", body)),
  updateUser: async (id, body) => data(await axiosInstance.patch(`/access/users/${id}`, body)),
  // clears someone else's two-factor (a lost phone); ends their sign-ins. Never one's own.
  resetTwoFactor: async (id) => data(await axiosInstance.post(`/access/users/${id}/2fa/reset`)),
  roles: async () => data(await axiosInstance.get("/access/roles")),
  createRole: async (body) => data(await axiosInstance.post("/access/roles", body)),
  updateRole: async (key, body) => data(await axiosInstance.patch(`/access/roles/${key}`, body)),
  removeRole: async (key) => data(await axiosInstance.delete(`/access/roles/${key}`)),
};
