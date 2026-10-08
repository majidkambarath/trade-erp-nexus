// The developer console's sign-in, kept apart from the product's: its own key, its own token, never sent to the
// product's API and never accepted by it. Held in sessionStorage like the product's own token, so closing the tab
// ends it (the server also ends it after eight hours).
const KEY = "zarvia.console";

const read = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
};

export const getConsoleToken = () => read()?.token || null;
export const getConsoleUser = () => read()?.user || null;

export const setConsoleSession = ({ token, user }) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ token, user }));
  } catch {
    // storage unavailable: the session lasts until the page is reloaded
  }
};

export const clearConsoleSession = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
};
