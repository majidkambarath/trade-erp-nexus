import { describe, it, expect } from "vitest";
import {
  INSTALLATION, answeringNow, bodyFrom, choosePreset, formFrom, keyWillBeForgotten, presetFor, testOutcome, validate,
} from "../assistantSettingsForms";

const PRESETS = [
  { key: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"], needsKey: true },
  { key: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", models: [], needsKey: true },
  { key: "ollama", label: "Ollama", baseUrl: "http://localhost:11434/v1", models: ["qwen3:8b"], needsKey: false },
  { key: "custom", label: "Custom", baseUrl: "", models: [], needsKey: false },
];
const withInstall = { presets: PRESETS, installationOpen: { available: true, model: "openai/gpt-oss-120b", hasKey: true } };

describe("which preset an address belongs to", () => {
  it("no address means the installation's model when there is one, else Groq to start", () => {
    expect(presetFor("", PRESETS, true)).toBe(INSTALLATION);
    expect(presetFor("", PRESETS, false)).toBe("groq");
  });
  it("a known address, with or without its trailing slash", () => {
    expect(presetFor("https://api.groq.com/openai/v1/", PRESETS)).toBe("groq");
    expect(presetFor("https://openrouter.ai/api/v1", PRESETS)).toBe("openrouter");
  });
  it("an Ollama on another machine is still Ollama, anything else is custom", () => {
    expect(presetFor("http://192.168.1.20:11434/v1", PRESETS)).toBe("ollama");
    expect(presetFor("https://api.together.xyz/v1", PRESETS)).toBe("custom");
  });
});

describe("the form's starting state", () => {
  it("with nothing saved, the address and model start as the preset the box shows", () => {
    expect(formFrom({ provider: "echo", presets: PRESETS })).toMatchObject({ preset: "groq", openBaseUrl: "https://api.groq.com/openai/v1", openModel: "openai/gpt-oss-120b" });
  });
  it("with the installation's model on offer, nothing is filled in", () => {
    expect(formFrom({ provider: "openai", ...withInstall })).toMatchObject({ preset: INSTALLATION, openBaseUrl: "", openModel: "" });
  });
  it("what was saved is kept as it was", () => {
    expect(formFrom({ provider: "openai", openBaseUrl: "https://api.together.xyz/v1", openModel: "x/y", presets: PRESETS })).toMatchObject({ preset: "custom", openBaseUrl: "https://api.together.xyz/v1", openModel: "x/y" });
  });
});

describe("choosing a preset", () => {
  it("fills the address and the first suggested model", () => {
    const f = choosePreset(formFrom({ presets: PRESETS }), "groq", PRESETS);
    expect(f).toMatchObject({ preset: "groq", openBaseUrl: "https://api.groq.com/openai/v1", openModel: "openai/gpt-oss-120b" });
  });
  it("replaces another preset's suggestion but keeps a model somebody typed", () => {
    const fromGroq = choosePreset({ openModel: "openai/gpt-oss-120b" }, "ollama", PRESETS);
    expect(fromGroq.openModel).toBe("qwen3:8b");
    const typed = choosePreset({ openModel: "my-own-model" }, "ollama", PRESETS);
    expect(typed.openModel).toBe("my-own-model");
  });
  it("the installation's model empties the address and the model, which is how the server reads it", () => {
    expect(choosePreset({ openBaseUrl: "x", openModel: "y" }, INSTALLATION, PRESETS)).toMatchObject({ openBaseUrl: "", openModel: "" });
  });
});

describe("what would stop the save", () => {
  const open = (patch) => ({ provider: "openai", preset: "custom", openBaseUrl: "https://api.example.com/v1", openModel: "qwen3:8b", ...patch });
  it("nothing for a complete open model, or for the installation's", () => {
    expect(validate(open())).toEqual({});
    expect(validate({ provider: "openai", preset: INSTALLATION }, withInstall)).toEqual({});
  });
  it("an address and a model are needed", () => {
    expect(validate(open({ openBaseUrl: "" }))).toHaveProperty("openBaseUrl");
    expect(validate(open({ openModel: "" }))).toHaveProperty("openModel");
  });
  it("a key in the address is pointed at the key box", () => {
    expect(validate(open({ openBaseUrl: "https://me:pw@x.example/v1" })).openBaseUrl).toMatch(/API key box/);
    expect(validate(open({ openBaseUrl: "https://x.example/v1?key=1" })).openBaseUrl).toMatch(/API key box/);
    expect(validate(open({ openBaseUrl: "api.example.com" })).openBaseUrl).toMatch(/https/);
  });
  it("a model name with a space is refused, as the server would", () => {
    expect(validate(open({ openModel: "qwen 3" }))).toHaveProperty("openModel");
  });
  it("Claude and test mode have nothing here to check", () => {
    expect(validate({ provider: "anthropic" })).toEqual({});
    expect(validate({ provider: "echo" })).toEqual({});
  });
});

describe("the body sent to the server", () => {
  it("an open model sends the address, the model, and a key only when one was typed", () => {
    const f = { provider: "openai", preset: "groq", openBaseUrl: " https://api.groq.com/openai/v1 ", openModel: " openai/gpt-oss-20b ", openApiKey: "" };
    expect(bodyFrom(f)).toEqual({ provider: "openai", openBaseUrl: "https://api.groq.com/openai/v1", openModel: "openai/gpt-oss-20b" });
    expect(bodyFrom({ ...f, openApiKey: " gsk_1 " }).openApiKey).toBe("gsk_1");
  });
  it("the installation's model clears the organisation's own address and model", () => {
    expect(bodyFrom({ provider: "openai", preset: INSTALLATION, openBaseUrl: "x", openApiKey: "k" })).toEqual({ provider: "openai", openBaseUrl: "", openModel: "" });
  });
  it("Claude sends its model and a typed key, and never the open model's fields", () => {
    expect(bodyFrom({ provider: "anthropic", model: "claude-haiku-5-5", apiKey: "", openBaseUrl: "x" })).toEqual({ provider: "anthropic", model: "claude-haiku-5-5" });
  });
  it("test mode sends only the provider", () => {
    expect(bodyFrom({ provider: "echo", openBaseUrl: "x" })).toEqual({ provider: "echo" });
  });
});

describe("the stored key and a changed address", () => {
  const saved = { hasOpenApiKey: true, openBaseUrl: "https://api.groq.com/openai/v1" };
  it("is forgotten when the address changes and no new key is typed", () => {
    expect(keyWillBeForgotten({ provider: "openai", preset: "custom", openBaseUrl: "https://other.example/v1", openApiKey: "" }, saved)).toBe(true);
    expect(keyWillBeForgotten({ provider: "openai", preset: INSTALLATION, openApiKey: "" }, saved)).toBe(true);
  });
  it("is kept for the same address (slash or not), or replaced when a new key comes with it", () => {
    expect(keyWillBeForgotten({ provider: "openai", preset: "groq", openBaseUrl: "https://api.groq.com/openai/v1/", openApiKey: "" }, saved)).toBe(false);
    expect(keyWillBeForgotten({ provider: "openai", preset: "custom", openBaseUrl: "https://other.example/v1", openApiKey: "new" }, saved)).toBe(false);
  });
});

describe("plain words", () => {
  it("who answers today", () => {
    expect(answeringNow({ effective: { provider: "echo" } })).toMatch(/Test mode/);
    expect(answeringNow({ effective: { provider: "openai", model: "openai/gpt-oss-120b", source: "installation" } })).toBe("openai/gpt-oss-120b answers questions, through Zarvia's own free model.");
    expect(answeringNow({ effective: { provider: "openai", model: "qwen3:8b", baseUrl: "http://10.0.0.5:11434/v1", source: "organisation" } })).toMatch(/through 10\.0\.0\.5:11434/);
    expect(answeringNow({ enabled: false, effective: { provider: "anthropic" } })).toMatch(/switched off/);
  });
  it("a connection test, including a model that cannot use tools", () => {
    expect(testOutcome(null)).toBe(null);
    expect(testOutcome({ ok: true, toolCalling: true, model: "m", latencyMs: 1234 })).toMatchObject({ tone: "success", text: "m answered in 1.2 s and used the help search." });
    expect(testOutcome({ ok: true, toolCalling: false, message: "Choose another model." }).tone).toBe("warning");
    expect(testOutcome({ ok: false, message: "The AI service refused the key." })).toMatchObject({ tone: "danger", text: "The AI service refused the key." });
  });
});
