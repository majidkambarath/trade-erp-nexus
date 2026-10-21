import { api } from "./accountingApi";
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
};
