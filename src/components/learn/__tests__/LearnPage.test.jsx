import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GuideContext } from "../../../guides/guideContext";
import en from "../../../guides/i18n/en";

vi.mock("../../../axios/axios", () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: { steps: [{ id: "customer", guide: "add-customer", done: true }, { id: "vendor", guide: "add-vendor", done: false }] } } })) },
}));
// two guides have videos: the vendor one in English and Malayalam, the dashboard one in English only
vi.mock("../../../guides/videos", () => {
  const VIDEOS = { "add-customer": ["en"], "add-vendor": ["en", "ml"], "read-dashboard": ["en"] };
  return {
    VIDEOS,
    videoUrl: (id, lang) => {
      const l = VIDEOS[id]; if (!l) return null;
      const use = l.includes(lang) ? lang : l.includes("en") ? "en" : null;
      return use ? { src: `/videos/${id}.${use}.mp4`, poster: `/videos/${id}.${use}.jpg`, lang: use } : null;
    },
  };
});
import LearnPage from "../LearnPage";

const flow = (id) => ({ id, minutes: 2, steps: [] });
const ctx = (over = {}) => ({
  flows: [flow("add-customer"), flow("add-vendor"), flow("add-item"), flow("read-dashboard")],
  start: vi.fn(), done: (id) => id === "add-customer", table: en, active: null, lang: "en", setLang: vi.fn(), ...over,
});
const view = (c) => render(<GuideContext.Provider value={c}><LearnPage /></GuideContext.Provider>);

describe("Learn page", () => {
  it("lists the guides by area with progress and starts one", () => {
    const c = ctx(); view(c);
    expect(screen.getByText("1 of 4 done")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Start guide: Add a vendor/ }));
    expect(c.start).toHaveBeenCalledWith("add-vendor");
  });
  it("filters by search and says when nothing matches", () => {
    view(ctx());
    fireEvent.change(screen.getByLabelText("Search guides"), { target: { value: "zzzz" } });
    expect(screen.getByText(/No guide matches/)).toBeTruthy();
  });
  it("changes the guide language", () => {
    const c = ctx(); view(c);
    fireEvent.click(screen.getByRole("button", { name: "العربية" }));
    expect(c.setLang).toHaveBeenCalledWith("ar");
  });
  it("shows the first-steps checklist from the books, with a start only on what is not done", async () => {
    view(ctx());
    await waitFor(() => expect(screen.getByText("Your first steps")).toBeTruthy());
    const list = screen.getByText("Your first steps").closest("section");
    expect(list.querySelectorAll("button").length).toBe(1); // only the vendor step is still to do
  });
  it("offers Watch only for a guide with a video, and plays it in the chosen language", () => {
    const c = ctx({ lang: "ml" }); view(c);
    expect(screen.queryByRole("button", { name: /Watch: Add a stock item/ })).toBeNull(); // no video for it
    fireEvent.click(screen.getByRole("button", { name: /Watch: Add a vendor/ }));
    const video = document.querySelector("video");
    expect(video.getAttribute("src")).toBe("/videos/add-vendor.ml.mp4");
    expect(screen.queryByText(/no video in your language/)).toBeNull();
  });
  it("falls back to the English video and says so, and Start from the player starts the guide", () => {
    const c = ctx({ lang: "ml" }); view(c);
    fireEvent.click(screen.getByRole("button", { name: /Watch: Read your dashboard/ }));
    expect(document.querySelector("video").getAttribute("src")).toBe("/videos/read-dashboard.en.mp4");
    expect(screen.getByText(/so this one is in English/)).toBeTruthy();
    const dialog = screen.getByRole("dialog");
    fireEvent.click([...dialog.querySelectorAll("button")].find((b) => b.textContent === "Start guide"));
    expect(c.start).toHaveBeenCalledWith("read-dashboard");
    expect(document.querySelector("video")).toBeNull();
  });
  it("opens a video with its poster picture, and fetches only the next one's header in the background", () => {
    view(ctx());
    fireEvent.click(screen.getByRole("button", { name: /Watch: Add a customer/ }));
    const [player, ahead] = document.querySelectorAll("video");
    expect(player.getAttribute("poster")).toBe("/videos/add-customer.en.jpg");
    expect(player.getAttribute("preload")).toBe("metadata");
    expect(ahead.getAttribute("src")).toBe("/videos/add-vendor.en.mp4"); // the next in the page's order
    expect(ahead.getAttribute("preload")).toBe("metadata");
    expect(ahead.hasAttribute("controls")).toBe(false);
  });
  it("goes to the next video in the order the guides are listed, and has none after the last", () => {
    view(ctx());
    fireEvent.click(screen.getByRole("button", { name: /Watch: Add a customer/ }));
    fireEvent.click(document.querySelector("[data-watch-next]"));
    expect(document.querySelector("video").getAttribute("src")).toBe("/videos/add-vendor.en.mp4");
    expect(screen.getByRole("dialog").textContent).toMatch(/Video: Add a vendor/);
    fireEvent.click(document.querySelector("[data-watch-next]"));
    expect(document.querySelector("video").getAttribute("src")).toBe("/videos/read-dashboard.en.mp4");
    expect(document.querySelector("[data-watch-next]")).toBeNull();
    expect(document.querySelectorAll("video").length).toBe(1); // nothing left to prepare
  });
  it("plays at the speed they choose, keeps it for the next video, and remembers it", () => {
    window.localStorage.removeItem("zarvia.videoSpeed");
    view(ctx());
    fireEvent.click(screen.getByRole("button", { name: /Watch: Add a customer/ }));
    const first = document.querySelector("video[controls]");
    fireEvent.click(document.querySelector('[data-speed="1.5"]'));
    expect(first.playbackRate).toBe(1.5);
    expect(document.querySelector('[data-speed="1.5"]').getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem("zarvia.videoSpeed")).toBe("1.5");
    fireEvent.click(document.querySelector("[data-watch-next]")); // the next video starts at the same speed
    const next = document.querySelector("video[controls]");
    fireEvent.loadedMetadata(next);
    expect(next.playbackRate).toBe(1.5);
  });
});
