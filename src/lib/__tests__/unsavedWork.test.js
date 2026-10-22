import { describe, expect, it } from "vitest";
import { blocksNavigation, leaveText } from "../unsavedWork";

// The rules behind "leave without saving?": when a move away is worth stopping, and what the
// question says. Pure, so the wording and the rule can be read without a browser.

describe("blocksNavigation", () => {
  const at = (pathname, search = "") => ({ pathname, search });

  it("lets everything through while there is nothing unsaved", () => {
    expect(blocksNavigation(false, at("/customer-creation"), at("/dashboard"))).toBe(false);
  });

  it("stops a move to another page while something is unsaved", () => {
    expect(blocksNavigation(true, at("/customer-creation"), at("/dashboard"))).toBe(true);
  });

  it("allows a changed query string on the same page: that is how this app opens a document or a tab, and it is usually the form's own doing", () => {
    expect(blocksNavigation(true, at("/sales-order", "?open=1"), at("/sales-order", "?open=2"))).toBe(false);
    expect(blocksNavigation(true, at("/goods-received"), at("/goods-received", "?status=UNINVOICED"))).toBe(false);
  });

  it("asks when there is no address to compare, rather than letting the work go", () => {
    expect(blocksNavigation(true, null, at("/dashboard"))).toBe(true);
    expect(blocksNavigation(true, at("/dashboard"), {})).toBe(true);
  });
});

describe("leaveText", () => {
  it("names the one form that has something in it", () => {
    expect(leaveText(["the “Add a customer” form"])).toMatch(/changes to the “Add a customer” form have not been saved/);
  });

  it("counts them when more than one is open", () => {
    expect(leaveText(["this purchase order", "the “Add an item” form"])).toMatch(/Changes in 2 open forms/);
  });

  it("still says what is at stake when a form did not name itself", () => {
    expect(leaveText([])).toMatch(/have not been saved/);
    expect(leaveText([""])).toMatch(/have not been saved/);
  });
});
