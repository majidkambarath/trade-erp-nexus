import { describe, it, expect, beforeEach } from "vitest";
import { fieldsIn, nextField } from "../fieldFlow";

const page = (html) => {
  document.body.innerHTML = html;
};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("fieldsIn", () => {
  it("lists what can be focused, in document order, and skips what cannot", () => {
    page(`
      <div id="scope">
        <input id="a" />
        <button id="b" disabled>Disabled</button>
        <select id="c"><option>x</option></select>
        <input id="d" tabindex="-1" />
        <div hidden><input id="e" /></div>
        <textarea id="f"></textarea>
      </div>
    `);
    const scope = document.getElementById("scope");
    expect(fieldsIn(scope).map((el) => el.id)).toEqual(["a", "c", "f"]);
  });

  it("is empty for no scope", () => {
    expect(fieldsIn(null)).toEqual([]);
  });

  it("an aria-disabled field does not count as reachable", () => {
    page(`<div id="scope"><input id="a" aria-disabled="true" /><input id="b" /></div>`);
    expect(fieldsIn(document.getElementById("scope")).map((el) => el.id)).toEqual(["b"]);
  });
});

describe("nextField", () => {
  it("returns the field right after the current one", () => {
    page(`<div id="scope"><input id="a" /><input id="b" /><input id="c" /></div>`);
    const scope = document.getElementById("scope");
    const a = document.getElementById("a");
    const b = document.getElementById("b");
    expect(nextField(scope, a).id).toBe("b");
    expect(nextField(scope, b).id).toBe("c");
  });

  it("is null after the last field", () => {
    page(`<div id="scope"><input id="a" /><input id="b" /></div>`);
    const scope = document.getElementById("scope");
    expect(nextField(scope, document.getElementById("b"))).toBeNull();
  });

  it("is null when the current element is not in the scope at all", () => {
    page(`<div id="scope"><input id="a" /></div><input id="outside" />`);
    const scope = document.getElementById("scope");
    expect(nextField(scope, document.getElementById("outside"))).toBeNull();
  });

  it("skips a disabled field in between", () => {
    page(`<div id="scope"><input id="a" /><input id="b" disabled /><input id="c" /></div>`);
    const scope = document.getElementById("scope");
    expect(nextField(scope, document.getElementById("a")).id).toBe("c");
  });
});
