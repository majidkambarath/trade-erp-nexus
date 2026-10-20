// The CRM's API (/api/v1/crm/...), over the shared axios instance's unwrapper: every method hands back `res.data.data`
// and throws an ApiError carrying the server's own errorCode, so a screen can say what the server said.
//
// Anything that changes what somebody owes fires CRM_WORK_CHANGED, which is what refreshes the "follow-ups" count
// beside the navigation tab (components/shell/NavBadges.jsx) without the badge having to poll faster. Same pattern as
// PROCESS_WORK_CHANGED in processOrderApi.js and APPROVALS_CHANGED in approvalsApi.js.
import { api } from "./accountingApi";

export const CRM_WORK_CHANGED = "crm-work-changed";

export function announceCrmWorkChanged() {
  try {
    window.dispatchEvent(new Event(CRM_WORK_CHANGED));
  } catch {
    /* no window: a test, or the server */
  }
}

const announced = (promise) =>
  promise.then((answer) => {
    announceCrmWorkChanged();
    return answer;
  });

export const crm = {
  // the module's own figures
  summary: () => api.get("/crm/summary"),
  analysis: (params) => api.get("/crm/analysis", params),
  pipeline: (params) => api.get("/crm/pipeline", params),
  owners: () => api.get("/crm/owners"),
  timeline: (params) => api.get("/crm/timeline", params),

  // the pipeline and the automation
  stages: () => api.get("/crm/stages"),
  saveStages: (stages) => announced(api.put("/crm/stages", { stages })),
  settings: () => api.get("/crm/settings"),
  saveSettings: (body) => api.put("/crm/settings", body),

  // leads
  leads: (params) => api.get("/crm/leads", params),
  leadSummary: () => api.get("/crm/leads/summary"),
  duplicates: (params) => api.get("/crm/leads/duplicates", params),
  lead: (id) => api.get(`/crm/leads/${id}`),
  leadActivity: (id) => api.get(`/crm/leads/${id}/activity`),
  createLead: (body) => announced(api.post("/crm/leads", body)),
  updateLead: (id, body) => announced(api.put(`/crm/leads/${id}`, body)),
  removeLead: (id) => announced(api.del(`/crm/leads/${id}`)),
  assignLead: (id, ownerId) => announced(api.post(`/crm/leads/${id}/assign`, { ownerId })),
  loseLead: (id, body) => announced(api.post(`/crm/leads/${id}/lose`, body)),
  qualifyLead: (id, body) => announced(api.post(`/crm/leads/${id}/qualify`, body)),

  // deals
  deals: (params) => api.get("/crm/opportunities", params),
  deal: (id) => api.get(`/crm/opportunities/${id}`),
  dealActivity: (id) => api.get(`/crm/opportunities/${id}/activity`),
  createDeal: (body) => announced(api.post("/crm/opportunities", body)),
  updateDeal: (id, body) => announced(api.put(`/crm/opportunities/${id}`, body)),
  removeDeal: (id) => announced(api.del(`/crm/opportunities/${id}`)),
  moveDeal: (id, body) => announced(api.post(`/crm/opportunities/${id}/stage`, body)),
  winDeal: (id, body) => announced(api.post(`/crm/opportunities/${id}/win`, body || {})),
  loseDeal: (id, body) => announced(api.post(`/crm/opportunities/${id}/lose`, body)),
  reopenDeal: (id) => announced(api.post(`/crm/opportunities/${id}/reopen`, {})),
  assignDeal: (id, ownerId) => announced(api.post(`/crm/opportunities/${id}/assign`, { ownerId })),

  // follow-ups
  followUps: (params) => api.get("/crm/follow-ups", params),
  followUpCount: () => api.get("/crm/follow-ups/count"),
  logActivity: (body) => announced(api.post("/crm/activities", body)),
  updateActivity: (id, body) => announced(api.put(`/crm/activities/${id}`, body)),
  completeActivity: (id, body) => announced(api.post(`/crm/activities/${id}/done`, body)),
  removeActivity: (id) => announced(api.del(`/crm/activities/${id}`)),
};

export default crm;
