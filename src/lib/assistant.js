// Zarvia AI, as the panel needs it. No React, no requests - so every rule is a test.
import { MODULES } from "../config/navigation.js";
import { normaliseProposals } from "./assistantProposals";

export const MAX_QUESTION = 2000;

/**
 * Every address the app actually has. Built from the navigation, which is also what the rail, the
 * palette and the mobile sweep are built from, so there is one answer to "is that a real screen".
 */
export function knownPaths(modules = MODULES) {
  const out = new Set();
  for (const m of modules || []) {
    for (const tab of m.tabs || []) {
      if (tab.to) out.add(tab.to);
      for (const extra of tab.match || []) out.add(extra);
    }
  }
  return out;
}

/**
 * The links an answer may offer.
 *
 * The server already refuses a path the documentation does not name, and this checks the same thing
 * again against the app's own routes. Two gates rather than one because a link is the one part of
 * an answer a person will click without reading: a button that goes nowhere is a bug, and a button
 * that goes somewhere unexpected is worse.
 */
export function safeLinks(links = [], modules = MODULES) {
  const known = knownPaths(modules);
  const seen = new Set();
  return (links || [])
    .filter((l) => l && typeof l.path === "string" && known.has(l.path))
    .filter((l) => (seen.has(l.path) ? false : seen.add(l.path)))
    .map((l) => ({ path: l.path, label: String(l.label || "Open").slice(0, 40) }));
}

/**
 * What a lookup showed ("list unpaid vendors"): the server's own table, written from the books. Taken as data and
 * cut to a sane size; its button goes only to a screen the app knows (the part before "?" must be a real path).
 */
export function normaliseTables(tables = [], modules = MODULES) {
  const known = knownPaths(modules);
  const text = (v, max = 120) => (v === null || v === undefined ? "" : String(v).slice(0, max));
  return (Array.isArray(tables) ? tables : [])
    .filter((t) => t && typeof t === "object" && Array.isArray(t.rows))
    .slice(0, 3)
    .map((t) => {
      const path = typeof t.link?.path === "string" ? t.link.path : "";
      const linkOk = path.startsWith("/") && !path.startsWith("//") && known.has(path.split("?")[0]);
      return {
        title: text(t.title, 80),
        rows: t.rows.slice(0, 25).map((r) => ({ label: text(r?.label), sub: text(r?.sub, 160), value: text(r?.value, 40), tone: r?.tone === "danger" ? "danger" : "" })),
        stats: (Array.isArray(t.stats) ? t.stats : []).slice(0, 4).map((x) => ({ label: text(x?.label, 30), value: text(x?.value, 40), tone: x?.tone === "danger" ? "danger" : x?.tone === "good" ? "good" : "" })),
        total: t.total && t.total.value !== undefined ? { label: text(t.total.label || "Total", 40), value: text(t.total.value, 40) } : null,
        more: Math.max(0, Number(t.more) || 0),
        link: linkOk ? { path, label: text(t.link.label || "Open", 40) } : null,
      };
    });
}

/** What the panel shows before anybody has asked anything. */
export function openingTip(screen, topics = []) {
  const titles = (topics || []).map((t) => t.title).filter(Boolean);
  if (!titles.length) return "";
  if (titles.length === 1) return `I can tell you about ${titles[0]}.`;
  return `I can tell you about ${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}.`;
}

/** Is this worth sending? Returns the reason it is not, or "". */
export function whyNotSend(text, { busy = false } = {}) {
  const q = String(text || "").trim();
  if (busy) return "Still working on the last one.";
  if (!q) return "";
  if (q.length > MAX_QUESTION) return `That is too long - ${MAX_QUESTION} characters at most.`;
  return "";
}

export const canSend = (text, state) => Boolean(String(text || "").trim()) && !whyNotSend(text, state);

/**
 * One exchange as the panel draws it. The server's own wording is used as it stands: it is written
 * for a person, and paraphrasing a refusal in the browser is how two explanations start to differ.
 */
export function toExchange(question, answer) {
  return {
    id: answer?.messageId || `local-${Date.now()}`,
    question: String(question || ""),
    answer: String(answer?.answer || ""),
    citations: (answer?.citations || []).map((c) => c.title).filter(Boolean),
    links: safeLinks(answer?.links),
    // Documents the assistant PREPARED: a card under the answer, confirmed by the person. Never saved by the assistant.
    proposals: normaliseProposals(answer?.proposals),
    // What a lookup in the person's own books showed: a small table under the answer, written by the server.
    tables: normaliseTables(answer?.tables),
    outcome: answer?.outcome || "answered",
    canEscalate: Boolean(answer?.canEscalate),
    escalated: Boolean(answer?.escalated || answer?.supportRequestId),
    // The stub provider is answering. Said plainly, because a canned answer that reads as real is
    // worse than no assistant - the same honesty as "Recorded only" on a document that was not sent.
    testMode: Boolean(answer?.testMode),
    helpful: null,
  };
}
