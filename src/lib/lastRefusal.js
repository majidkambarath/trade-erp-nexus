// The last thing the API refused, remembered for one question.
//
// "It will not let me" is the commonest support question there is, and the API already answers every
// refusal with a structured errorCode. Recording the last one means Zarvia AI can explain THAT
// refusal from a written table rather than working out what might have happened.
//
// In memory only, like the access token: a refusal names what somebody was doing, and that does not
// belong in storage. One slot, not a log - the question is always about the last thing that failed.

let last = null;

/** Called by the axios response interceptor. Ignores anything that is not a refusal we can explain. */
export function noteRefusal(error) {
  const data = error?.response?.data;
  const code = data?.errorCode || data?.code || "";
  if (!code) return;
  last = {
    code: String(code),
    message: String(data?.message || ""),
    url: String(error?.config?.url || ""),
    at: Date.now(),
  };
}

// A refusal from ten minutes ago is not what they are asking about.
const FRESH_MS = 5 * 60 * 1000;

/** The refusal to send with a question, or null. */
export function recentRefusal(now = Date.now()) {
  if (!last) return null;
  if (now - last.at > FRESH_MS) return null;
  return { code: last.code, message: last.message };
}

/** Cleared at sign-out with the rest of the session, and after it has been asked about. */
export function clearRefusal() {
  last = null;
}
