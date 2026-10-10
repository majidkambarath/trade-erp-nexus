// Two-factor sign-in and "forgot my password": the rules the screens share, as plain functions with no React and no requests, so
// every one of them is a test. The server checks everything again and says so in its own words if this ever lets one through.
import { MIN_PASSWORD } from "./passwordForms";

// ---- the code box

const strip = (text) => String(text ?? "").replace(/[\s-]/g, "");

/**
 * One box takes either the six digits from the authenticator or a recovery code (ten letters and digits, as XXXXX-XXXXX), and the
 * server wants them under different names. Six digits is a code from the app; anything else of the right length is a recovery code.
 * -> { code } | { recoveryCode } | null (nothing to send yet)
 */
export function codePayload(text) {
  const clean = strip(text);
  if (/^\d{6}$/.test(clean)) return { code: clean };
  if (/^[0-9A-Za-z]{10}$/.test(clean)) return { recoveryCode: clean.toUpperCase() };
  return null;
}

/** What is wrong with what was typed into the code box, in words; "" when it can be sent. */
export function codeProblem(text, { allowRecovery = true } = {}) {
  const clean = strip(text);
  if (!clean) return allowRecovery ? "Enter the six-digit code from your app, or a recovery code" : "Enter the six-digit code from your app";
  if (/^\d+$/.test(clean) && clean.length !== 6) return "The code from your app is six digits";
  const payload = codePayload(clean);
  if (!payload) return allowRecovery ? "Enter six digits, or a recovery code of ten letters and digits" : "The code from your app is six digits";
  if (payload.recoveryCode && !allowRecovery) return "The code from your app is six digits";
  return "";
}

/** The six digits the person is typing, tidied as they type: digits only, at most six, shown as 123 456. */
export function typedDigits(text) {
  const digits = String(text ?? "").replace(/\D/g, "").slice(0, 6);
  return digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
}

// ---- what a refusal means

/**
 * The sentence for a refused second step, and what the screen should do about it:
 *   { text, restart }  `restart` = the challenge is over (it lasts five minutes): go back to the password.
 */
export function secondStepProblem(error) {
  const status = error?.response?.status;
  const code = error?.response?.data?.errorCode;
  const said = error?.response?.data?.message;
  if (code === "CHALLENGE_EXPIRED" || code === "CHALLENGE_INVALID") return { text: "Your sign-in took too long. Enter your password again.", restart: true };
  if (code === "ACCOUNT_LOCKED" || status === 423) return { text: said || "This account is locked for a few minutes after too many wrong attempts. Try again later.", restart: true };
  if (code === "TOO_MANY_ATTEMPTS" || status === 429) return { text: said || "Too many attempts from this address. Try again in a little while.", restart: false };
  if (code === "TWO_FACTOR_CODE_REUSED") return { text: "That code has already been used. Wait for your app to show the next one.", restart: false };
  if (code === "INVALID_TWO_FACTOR_CODE") return { text: "That code is not right. Check the six digits your app shows now, or use a recovery code.", restart: false };
  if (!error?.response) return { text: "Can't reach the server. Check your connection and try again.", restart: false };
  return { text: said || "Sign-in failed. Please try again.", restart: false };
}

// ---- choosing a new password from the emailed link

/** What is wrong with the two password boxes of the reset page; {} when it can be sent. */
export function validateNewPassword({ password = "", confirm = "" } = {}) {
  const found = {};
  if (password.length < MIN_PASSWORD) found.password = `Use at least ${MIN_PASSWORD} characters`;
  if (confirm !== password) found.confirm = "The two passwords do not match";
  return found;
}

/** The link in the email carries the token as ?token=; anything that is not the right shape is no link at all. */
export function tokenFromSearch(search) {
  const token = new URLSearchParams(search || "").get("token") || "";
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : "";
}

/** The sentence for a reset the server refused. `dead` = the link itself is finished (ask for a new one). */
export function resetProblem(error) {
  const code = error?.response?.data?.errorCode;
  const said = error?.response?.data?.message;
  if (code === "RESET_TOKEN_INVALID") return { text: "This link is no longer valid. Ask for a new one.", dead: true };
  if (code === "TOO_MANY_REQUESTS" || error?.response?.status === 429) return { text: said || "Too many attempts. Try again in a little while.", dead: false };
  if (!error?.response) return { text: "Can't reach the server. Check your connection and try again.", dead: false };
  return { text: said || "Something went wrong. Try again.", dead: false };
}

/** Is this an address worth sending? (The server answers the same for any; this only saves a typo.) */
export const looksLikeEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(text ?? "").trim());

// ---- enrolling

/** The recovery codes as a text file: the account, when they were made, and one code per line. */
export function recoveryCodesText(codes, { account = "", issuer = "Zarvia", date = "" } = {}) {
  return [
    `${issuer} recovery codes${account ? ` for ${account}` : ""}`,
    date ? `Made ${date}` : null,
    "",
    "Each code works once, in place of the code from your authenticator app.",
    "Keep this file somewhere safe and private. Anyone who has it and your password can sign in.",
    "",
    ...codes,
    "",
  ].filter((line) => line !== null).join("\n");
}

/** The file name the codes are saved under. */
export const recoveryCodesFileName = (account = "") => `recovery-codes${account ? `-${String(account).replace(/[^A-Za-z0-9._@-]+/g, "_")}` : ""}.txt`;

/** What the server said about a refused setup / enable / disable / new-codes call, in words. */
export function manageProblem(error) {
  const code = error?.response?.data?.errorCode;
  const said = error?.response?.data?.message;
  if (code === "PASSWORD_INCORRECT") return "That password is not right.";
  if (code === "INVALID_TWO_FACTOR_CODE") return "That code is not right. Check the six digits your app shows now.";
  if (code === "TWO_FACTOR_CODE_REUSED") return "That code has already been used. Wait for your app to show the next one.";
  if (code === "ACCOUNT_LOCKED" || error?.response?.status === 423) return said || "This account is locked for a few minutes after too many wrong attempts.";
  if (code === "TWO_FACTOR_REQUIRED_BY_POLICY") return "Your organisation requires two-factor sign-in, so it cannot be turned off.";
  if (!error?.response) return error?.message || "Can't reach the server. Check your connection and try again.";
  return said || "Something went wrong. Try again.";
}
