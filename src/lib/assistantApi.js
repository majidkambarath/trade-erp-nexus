import axiosInstance from "../axios/axios";
import { api } from "./accountingApi";
import { bodyToSend, saveUrl } from "./assistantProposals";
import { recentRefusal } from "./lastRefusal";

// Zarvia AI (GET/POST /assistant/...). The assistant reads no business data: it answers from the
// product's own documentation and explains the refusal a person just hit, which is why the question
// is sent with the screen they are on and the last error code - see trade ERP node's
// services/assistant/assistantService.js.
export const assistant = {
  /**
   * Ask. `screen` is the path they are on, which is often more informative than their words, and
   * the refusal is picked up here rather than by the caller so every screen gets it for free.
   */
  ask: ({ question, screen = "", screenName = "", conversationId = "" }) => {
    const refusal = recentRefusal();
    return api.post("/assistant/ask", {
      question,
      screen,
      screenName,
      conversationId,
      errorCode: refusal?.code || "",
      errorMessage: refusal?.message || "",
    });
  },
  // What this screen is about, for the line the panel opens with
  screen: (screen) => api.get("/assistant/screen", { screen }),
  mine: (limit) => api.get("/assistant/mine", limit ? { limit } : undefined),
  helpful: (id, helpful) => api.post(`/assistant/messages/${id}/helpful`, { helpful }),
  // The button a person presses when the answer did not help
  escalate: (body) => api.post("/assistant/escalate", body),
  usage: (from, to) => api.get("/assistant/usage", { from, to }),
  settings: () => api.get("/assistant/settings"),
  saveSettings: (body) => api.put("/assistant/settings", body),
  // Save a document Zarvia AI PREPARED, through the product's own route with the person's own sign-in, so every rule
  // that applies to a typed document applies to this one. `X-Prepared-By` is only a label on the audit trail. Answers the
  // route's whole body ({ data, approval? }): a voucher held for approval is saved but posts nothing, and the card says so.
  saveProposal: (proposal, filled) =>
    axiosInstance.post(saveUrl(proposal), bodyToSend(proposal, filled), { headers: { "X-Prepared-By": "zarvia-ai" } }).then((r) => r.data),
  // Remember, on the person's own answer, that this prepared document was confirmed, so a reopened panel never offers it twice.
  proposalSaved: (messageId, proposalId, number) => api.post(`/assistant/messages/${messageId}/proposals/${proposalId}/saved`, { number }),
  // Tries the settings on the screen, saved or not, with one small question. Saves nothing.
  testSettings: (body) => api.post("/assistant/settings/test", body),
};
