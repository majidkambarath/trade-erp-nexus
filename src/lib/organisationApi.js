import axiosInstance from "../axios/axios";

// The organisation the signed-in person belongs to: its plan, what the plan switches on, its limits and use, and
// where its subscription stands. The one route that also answers an organisation whose subscription has ended.
export const getOrganisationStatus = async () => (await axiosInstance.get("/organisation/status")).data.data;
