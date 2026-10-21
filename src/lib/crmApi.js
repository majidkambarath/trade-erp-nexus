// The CRM's API (/api/v1/crm/...), over the shared axios instance's unwrapper: every method hands back `res.data.data`
// and throws an ApiError carrying the server's own errorCode, so a screen can say what the server said.
//
// Anything that changes what somebody owes fires CRM_WORK_CHANGED, which is what refreshes the "follow-ups" count
// beside the navigation tab (components/shell/NavBadges.jsx) without the badge having to poll faster. Same pattern as
// PROCESS_WORK_CHANGED in processOrderApi.js and APPROVALS_CHANGED in approvalsApi.js.
import axiosInstance from "../axios/axios";
import { api, unwrap } from "./accountingApi";

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
  dashboard: () => api.get("/crm/dashboard"),
  // The named reports. Aging is an "as at today" picture and takes no range; the rest read a period.
  // The calendar reads a range of days (a month grid is about six weeks) and answers one flat list.
  calendar: (params) => api.get("/crm/calendar", params),
  aging: () => api.get("/crm/reports/aging"),
  activityReport: (params) => api.get("/crm/reports/activity", params),
  // Every activity ever logged, newest first: the communications LOG, as against followUps (the worklist).
  activities: (params) => api.get("/crm/activities", params),

  contacts: (params) => api.get("/crm/contacts", params),
  contact: (id) => api.get(`/crm/contacts/${id}`),
  createContact: (body) => announced(api.post("/crm/contacts", body)),
  updateContact: (id, body) => announced(api.put(`/crm/contacts/${id}`, body)),
  removeContact: (id) => announced(api.delete(`/crm/contacts/${id}`)),
  importContacts: (body) => api.post("/crm/contacts/import", body),

  summary: () => api.get("/crm/summary"),
  analysis: (params) => api.get("/crm/analysis", params),
  pipeline: (params) => api.get("/crm/pipeline", params),
  owners: () => api.get("/crm/owners"),
  // The customers a deal can be opened on: an id, a name and a code. The CRM's own narrow read, so choosing one needs no Sales key.
  customers: (params) => api.get("/crm/customers", params),
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
  // A spreadsheet of enquiries. `dryRun: false` writes; anything else is the preview. Only a real import changes what is owed.
  importLeads: (body) => (body?.dryRun === false ? announced(api.post("/crm/leads/import", body)) : api.post("/crm/leads/import", body)),

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

  // a person's own Google account, for a real Meet link and the event in their own Google Calendar
  googleStatus: () => api.get("/crm/google/status"),
  googleStart: () => api.post("/crm/google/start", {}),
  googleConnect: (body) => api.post("/crm/google/connect", body),
  googleDisconnect: () => api.post("/crm/google/disconnect", {}),

  // meetings: a follow-up with a time, attendees and an invitation. Each one changes what somebody is owed, so they
  // all announce it (the follow-up badge counts a meeting like any other open thing).
  meetingsOnDay: (params) => api.get("/crm/meetings/day", params),
  scheduleMeeting: (body) => announced(api.post("/crm/meetings", body)),
  rescheduleMeeting: (id, body) => announced(api.put(`/crm/meetings/${id}`, body)),
  cancelMeeting: (id, body) => announced(api.post(`/crm/meetings/${id}/cancel`, body || {})),
  inviteToMeeting: (id, body) => api.post(`/crm/meetings/${id}/invite`, body || {}),
  recordRsvp: (id, body) => api.post(`/crm/meetings/${id}/rsvp`, body),

  // follow-ups
  followUps: (params) => api.get("/crm/follow-ups", params),
  followUpCount: () => api.get("/crm/follow-ups/count"),
  logActivity: (body) => announced(api.post("/crm/activities", body)),
  updateActivity: (id, body) => announced(api.put(`/crm/activities/${id}`, body)),
  completeActivity: (id, body) => announced(api.post(`/crm/activities/${id}/done`, body)),
  removeActivity: (id) => announced(api.del(`/crm/activities/${id}`)),
};

// Files on a lead or a deal, in the shape components/accounting/AttachmentPanel.jsx takes as its `source`: list, upload,
// remove and download, so the one panel serves both the accounting documents and these. `kind` is "lead" or "deal".
// An upload sets its own multipart content type: the shared axios instance defaults to JSON and would flatten the file.
export function filesFor(kind, id) {
  const base = kind === "deal" ? `/crm/opportunities/${id}/attachments` : `/crm/leads/${id}/attachments`;
  return {
    list: () => api.get(base),
    upload: (file, label) => {
      const form = new FormData();
      form.append("file", file);
      if (label) form.append("label", label);
      return unwrap(axiosInstance.post(base, form, { headers: { "Content-Type": "multipart/form-data" } }));
    },
    remove: (item) => api.del(`/crm/attachments/${item.attachmentId}`),
    // through the authenticated API (a plain link would carry no token), then handed to the browser as a blob
    download: async (item) => {
      const res = await axiosInstance.get(`/crm/attachments/${item.attachmentId}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}

export default crm;
