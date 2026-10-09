import axiosInstance from "../axios/axios";

// The organisation's own branches: /api/v1/branches. Each call answers res.data.data.
const data = (response) => response.data.data;

export const branchesApi = {
  list: async () => data(await axiosInstance.get("/branches")),
  create: async (body) => data(await axiosInstance.post("/branches", body)),
  update: async (code, body) => data(await axiosInstance.patch(`/branches/${code}`, body)),
};
