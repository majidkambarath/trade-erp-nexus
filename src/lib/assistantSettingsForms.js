// The rules behind Settings > Zarvia AI, kept apart from the screen so they are tested without
// rendering. The server is the authority (trade ERP node's services/assistant/assistantService.js
// applyChanges): these only stop somebody saving into a refusal they could have seen coming, and
// the server's own words are shown when it refuses anyway.

// The ready-made starting points come from the server (`presets`), so a model list that changes
// needs no frontend release. "installation" is not a server preset: it is the free model the Zarvia
// server itself is set up with, offered only when there is one.
export const INSTALLATION = "installation";

export const PROVIDERS = [
  { value: "openai", label: "Open model", text: "Free or low-cost open-source models (Qwen, gpt-oss, Llama) through Groq, OpenRouter or your own server." },
  { value: "anthropic", label: "Claude", text: "Anthropic's Claude. The most capable, and paid per question." },
  { value: "echo", label: "Test mode", text: "Canned answers and no AI service, to try the panel. Never for real use." },
];

const trimSlash = (s) => String(s || "").trim().replace(/\/+$/, "");

/** Which preset an address belongs to: the installation's (no address), a known one, or "custom". */
export function presetFor(baseUrl, presets = [], installationAvailable = false) {
  const url = trimSlash(baseUrl);
  if (!url) return installationAvailable ? INSTALLATION : "groq";
  const hit = presets.find((p) => p.baseUrl && trimSlash(p.baseUrl) === url);
  if (hit) return hit.key;
  // An Ollama on another machine still looks like Ollama.
  if (/:11434\/v1$/.test(url)) return "ollama";
  return "custom";
}

/** The form's starting state from what the server holds. Keys are never in it: they are write-only. */
export function formFrom(s = {}) {
  const installationAvailable = Boolean(s.installationOpen?.available);
  const form = {
    provider: s.provider || "echo",
    preset: presetFor(s.openBaseUrl, s.presets || [], installationAvailable),
    openBaseUrl: s.openBaseUrl || "",
    openModel: s.openModel || "",
    openApiKey: "",
    model: s.model || (s.models || [])[0] || "",
    apiKey: "",
  };
  // Nothing saved yet and no installation model: the box starts on Groq, so the address and model
  // must start as Groq's too, or the screen would show one service and save an empty address.
  if (!form.openBaseUrl && form.preset !== INSTALLATION) return choosePreset(form, form.preset, s.presets || []);
  return form;
}

/** Choosing a preset fills the address and, when the model box is empty or was a suggestion of another preset, the first model. */
export function choosePreset(form, key, presets = []) {
  if (key === INSTALLATION) return { ...form, preset: key, openBaseUrl: "", openModel: "" };
  const p = presets.find((x) => x.key === key);
  if (!p) return { ...form, preset: key };
  const otherSuggestion = presets.some((x) => (x.models || []).includes(form.openModel));
  const openModel = !form.openModel || otherSuggestion ? (p.models || [])[0] || "" : form.openModel;
  return { ...form, preset: key, openBaseUrl: p.baseUrl || "", openModel };
}

/** What would stop the save, by field. Empty object when there is nothing. */
export function validate(form, s = {}) {
  const errors = {};
  if (form.provider !== "openai") return errors;
  const usingInstallation = form.preset === INSTALLATION && s.installationOpen?.available;
  if (usingInstallation) return errors;
  const url = String(form.openBaseUrl || "").trim();
  if (!url) errors.openBaseUrl = "Enter the address of the AI service.";
  else if (!/^https?:\/\/[^\s]+$/i.test(url)) errors.openBaseUrl = "The address starts with https://";
  else if (/^https?:\/\/[^/]*@/i.test(url) || /[?#]/.test(url)) errors.openBaseUrl = "Put the key in the API key box, not in the address.";
  const model = String(form.openModel || "").trim();
  if (!model) errors.openModel = "Enter the model's name, for example openai/gpt-oss-120b.";
  else if (!/^[\w.:/@+-]{1,200}$/.test(model)) errors.openModel = "A model name has no spaces or symbols other than . : / @ + -";
  return errors;
}

/**
 * The body for PUT /assistant/settings and POST /assistant/settings/test. A key goes only when one
 * was typed: empty means "keep what is stored", because the screen can never show it.
 */
export function bodyFrom(form) {
  const body = { provider: form.provider };
  if (form.provider === "openai") {
    if (form.preset === INSTALLATION) {
      body.openBaseUrl = "";
      body.openModel = "";
    } else {
      body.openBaseUrl = String(form.openBaseUrl || "").trim();
      body.openModel = String(form.openModel || "").trim();
      if (form.openApiKey) body.openApiKey = form.openApiKey.trim();
    }
  }
  if (form.provider === "anthropic") {
    if (form.model) body.model = form.model;
    if (form.apiKey) body.apiKey = form.apiKey.trim();
  }
  return body;
}

/** A changed address forgets the stored key on the server; the screen says so before it happens. */
export function keyWillBeForgotten(form, s = {}) {
  if (form.provider !== "openai" || !s.hasOpenApiKey || form.openApiKey) return false;
  const next = form.preset === INSTALLATION ? "" : trimSlash(form.openBaseUrl);
  return next !== trimSlash(s.openBaseUrl);
}

/** One plain line about who answers today, from the server's `effective`. */
export function answeringNow(s = {}) {
  const e = s.effective || {};
  if (s.enabled === false) return "Zarvia AI is switched off for your organisation.";
  if (e.provider === "echo") return "Test mode: the panel gives canned answers and no AI service is used.";
  if (e.provider === "anthropic") return `Claude (${e.model}) answers questions.`;
  if (e.provider === "openai") {
    const where = e.source === "installation" ? "Zarvia's own free model" : hostOf(e.baseUrl);
    return `${e.model || "An open model"} answers questions, through ${where}.`;
  }
  return "";
}

export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url || "the address you set";
  }
}

/** What to say about a connection test. `tone` is a Pill tone. */
export function testOutcome(r) {
  if (!r) return null;
  if (!r.ok) return { tone: "danger", title: "Not connected", text: r.message || "The AI service could not be reached." };
  if (r.testMode) return { tone: "warning", title: "Test mode", text: "No AI service is used in test mode, so there is nothing to connect to." };
  const secs = typeof r.latencyMs === "number" ? ` in ${(r.latencyMs / 1000).toFixed(1)} s` : "";
  if (!r.toolCalling) return { tone: "warning", title: "Connected, but this model cannot use the help search", text: `${r.message || ""}${secs ? ` Answered${secs}.` : ""}`.trim() };
  return { tone: "success", title: "Connected", text: `${r.model} answered${secs} and used the help search.` };
}
