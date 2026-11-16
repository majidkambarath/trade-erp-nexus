import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import AssistantSettings from "../AssistantSettings";
import { assistant } from "../../../lib/assistantApi";

vi.mock("../../../lib/assistantApi", () => ({
  assistant: { settings: vi.fn(), saveSettings: vi.fn(), testSettings: vi.fn(), usage: vi.fn() },
}));

const PRESETS = [
  { key: "groq", label: "Groq (free plan)", baseUrl: "https://api.groq.com/openai/v1", models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"], needsKey: true, note: "Free key from console.groq.com." },
  { key: "ollama", label: "Ollama (your own server)", baseUrl: "http://localhost:11434/v1", models: ["qwen3:8b"], needsKey: false, note: "Runs on a machine you control." },
  { key: "custom", label: "Another OpenAI-compatible service", baseUrl: "", models: [], needsKey: false, note: "Any service." },
];
const BASE = {
  enabled: true, provider: "echo", model: "claude-opus-5-5", models: ["claude-opus-5-5", "claude-haiku-5-5"],
  openBaseUrl: "", openModel: "", hasOpenApiKey: false, hasApiKey: false, usesOurKey: false,
  installationOpen: { available: false, model: "", hasKey: false },
  effective: { provider: "echo", model: "", baseUrl: "", source: "installation" },
  presets: PRESETS, lastErrorCode: "",
};
const USAGE = { totals: { questions: 42, escalations: 3, failures: 1, costMicros: 0 }, days: [], unanswered: [] };

let notify;
const show = () => render(<AssistantSettings notify={notify} />);

beforeEach(() => {
  vi.clearAllMocks();
  notify = vi.fn();
  assistant.settings.mockResolvedValue(BASE);
  assistant.usage.mockResolvedValue(USAGE);
  assistant.saveSettings.mockResolvedValue(BASE);
});

describe("Settings, Zarvia AI", () => {
  it("says plainly when the panel is only in test mode", async () => {
    show();
    expect(await screen.findByTestId("answering-now")).toHaveTextContent(/Test mode/);
  });

  it("choosing an open model starts on Groq with its address and a suggested model filled", async () => {
    show();
    fireEvent.click(await screen.findByRole("radio", { name: /Open model/ }));
    expect(screen.getByRole("combobox", { name: "Where the model runs" })).toHaveValue("groq");
    expect(screen.getByLabelText("Address")).toHaveValue("https://api.groq.com/openai/v1");
    expect(screen.getByLabelText("Model")).toHaveValue("openai/gpt-oss-120b");
    expect(screen.getByText(/never your invoices or accounts/)).toBeInTheDocument();
  });

  it("saves the open model with the typed key, then says so", async () => {
    show();
    fireEvent.click(await screen.findByRole("radio", { name: /Open model/ }));
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "gsk_abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(assistant.saveSettings).toHaveBeenCalledWith({
        provider: "openai",
        openBaseUrl: "https://api.groq.com/openai/v1",
        openModel: "openai/gpt-oss-120b",
        openApiKey: "gsk_abc",
      })
    );
    expect(notify).toHaveBeenCalledWith("Zarvia AI settings saved");
  });

  it("an empty model is caught on the screen, before the server is asked", async () => {
    show();
    fireEvent.click(await screen.findByRole("radio", { name: /Open model/ }));
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Enter the model's name/)).toBeInTheDocument();
    expect(assistant.saveSettings).not.toHaveBeenCalled();
  });

  it("the server's refusal is shown in its own words", async () => {
    assistant.saveSettings.mockRejectedValue(Object.assign(new Error("An AI service on this machine or the private network cannot be used here."), { code: "AI_ENDPOINT_INVALID" }));
    show();
    fireEvent.click(await screen.findByRole("radio", { name: /Open model/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/private network cannot be used here/)).toBeInTheDocument();
  });

  it("the connection test names a model that cannot use the help search", async () => {
    assistant.testSettings.mockResolvedValue({ ok: true, toolCalling: false, model: "tiny", latencyMs: 800, message: "Connected, but the model did not use the help search when asked." });
    show();
    fireEvent.click(await screen.findByRole("radio", { name: /Open model/ }));
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByText("Connected, but this model cannot use the help search")).toBeInTheDocument();
    expect(assistant.testSettings).toHaveBeenCalledWith(expect.objectContaining({ provider: "openai", openModel: "openai/gpt-oss-120b" }));
    expect(assistant.saveSettings).not.toHaveBeenCalled();
  });

  it("a stored key is said to be stored, and a changed address warns it will be forgotten", async () => {
    assistant.settings.mockResolvedValue({ ...BASE, provider: "openai", openBaseUrl: "https://api.groq.com/openai/v1", openModel: "openai/gpt-oss-20b", hasOpenApiKey: true, effective: { provider: "openai", model: "openai/gpt-oss-20b", baseUrl: "https://api.groq.com/openai/v1", source: "organisation" } });
    show();
    expect(await screen.findByText(/Stored encrypted. It can never be shown again/)).toBeInTheDocument();
    expect(screen.getByLabelText("API key")).toHaveValue("");
    expect(screen.getByTestId("answering-now")).toHaveTextContent("openai/gpt-oss-20b answers questions, through api.groq.com.");
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "https://other.example/v1" } });
    expect(screen.getByText(/stored key will be forgotten/)).toBeInTheDocument();
  });

  it("the installation's own free model needs nothing typed", async () => {
    assistant.settings.mockResolvedValue({ ...BASE, provider: "openai", installationOpen: { available: true, model: "openai/gpt-oss-120b", hasKey: true }, effective: { provider: "openai", model: "openai/gpt-oss-120b", source: "installation" } });
    show();
    expect(await screen.findByRole("combobox", { name: "Where the model runs" })).toHaveValue("installation");
    expect(screen.queryByLabelText("Address")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(assistant.saveSettings).toHaveBeenCalledWith({ provider: "openai", openBaseUrl: "", openModel: "" }));
  });

  it("shows the last 30 days, and a free model costs nothing", async () => {
    show();
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(assistant.usage).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});
