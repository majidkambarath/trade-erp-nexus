import { api } from "./accountingApi";

// The in-app notification feed (GET/POST /notifications/...): a person's own feed, filtered by the server to
// whatever their grants make visible - see trade ERP node's services/core/notificationService.js.
export const notifications = {
  // { items, counts: { total, unread }, capped }
  list: (unreadOnly) => api.get("/notifications", unreadOnly ? { unreadOnly: 1 } : undefined),
  // { count, capped }: the same answer without the rows, cheap enough to ask for a badge
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
};

// Read elsewhere (another tab, a job finishing) tells the bell its badge may be stale.
export const NOTIFICATIONS_CHANGED = "notifications-changed";
export function announceNotificationsChanged() {
  try {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  } catch {
    /* no window (a test of something else): nothing to tell */
  }
}
