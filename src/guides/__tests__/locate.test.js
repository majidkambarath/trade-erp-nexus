import { describe, it, expect, beforeEach } from "vitest";
import { locate, matches, placeCard, norm } from "../locate";

const mount = (html) => { document.body.innerHTML = html; return document.body; };

describe("matches", () => {
  it("compares a string whole, ignoring case, spacing and the required star", () => {
    expect(matches("Customer name *", "customer NAME")).toBe(true);
    expect(matches("Customer name extra", "customer name")).toBe(false);
  });
  it("takes a RegExp as written", () => {
    expect(matches("Add Customer", /^add customer$/i)).toBe(true);
    expect(matches("Add Customers", /^add customer$/i)).toBe(false);
  });
  it("never matches nothing", () => { expect(matches("x", null)).toBe(false); expect(norm(undefined)).toBe(""); });
});

describe("locate", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("finds a field through label[for] (the shared Field)", () => {
    const root = mount(`<label for="a">Customer name <span>*</span></label><input id="a" name="n">`);
    expect(locate(root, { field: /^customer name/i })?.id).toBe("a");
  });
  it("finds the input that sits under a plain label (older forms, no for=)", () => {
    const root = mount(`<div><label>Item Name *</label><input name="itemName"></div>`);
    expect(locate(root, { field: /^item name/i })?.getAttribute("name")).toBe("itemName");
  });
  it("finds a button by its visible words, and by aria-label", () => {
    const root = mount(`<button>Add Customer</button><button aria-label="Refresh data"></button>`);
    expect(locate(root, { button: /^add customer$/i })?.textContent).toBe("Add Customer");
    expect(locate(root, { button: "refresh data" })).not.toBeNull();
  });
  it("looks inside the dialog only when told to, so the list behind it is not found first", () => {
    const root = mount(`
      <label for="f">Category</label><select id="f"></select>
      <div role="dialog"><label for="d">Category</label><select id="d"></select></div>`);
    expect(locate(root, { field: /^category/i })?.id).toBe("f");
    expect(locate(root, { field: /^category/i, within: "[role='dialog']" })?.id).toBe("d");
  });
  it("finds by data-guide and by selector", () => {
    const root = mount(`<button data-guide="save">x</button><button form="party-form">Add Customer</button>`);
    expect(locate(root, { guide: "save" })?.textContent).toBe("x");
    expect(locate(root, { selector: "button[form='party-form']" })?.textContent).toBe("Add Customer");
  });
  it("skips what is hidden", () => {
    const root = mount(`<div aria-hidden="true"><button>Add Customer</button></div>`);
    expect(locate(root, { button: /add customer/i })).toBeNull();
  });
  it("answers null when it is not on the screen yet", () => {
    expect(locate(mount("<p>nothing</p>"), { button: /^add customer$/i })).toBeNull();
    expect(locate(mount("<p>nothing</p>"), { field: /^x/i, within: "[role='dialog']" })).toBeNull();
  });
});

describe("placeCard", () => {
  const view = { width: 1000, height: 700 };
  const card = { width: 340, height: 180 };
  it("goes below the control when there is room", () => {
    const p = placeCard({ top: 100, left: 400, width: 120, height: 40 }, card, view);
    expect(p.side).toBe("below"); expect(p.top).toBe(152);
  });
  it("goes above when the control is near the bottom", () => {
    expect(placeCard({ top: 620, left: 400, width: 120, height: 40 }, card, view).side).toBe("above");
  });
  it("stays inside the window sideways", () => {
    expect(placeCard({ top: 100, left: 990, width: 10, height: 40 }, card, view).left).toBe(1000 - 340 - 8);
    expect(placeCard({ top: 100, left: -50, width: 10, height: 40 }, card, view).left).toBe(8);
  });
  it("sits on the bottom edge when neither side fits", () => {
    expect(placeCard({ top: 150, left: 400, width: 120, height: 480 }, card, view).side).toBe("edge");
  });
});
