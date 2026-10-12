import { describe, it, expect, beforeEach } from "vitest";
import { classify, enterTarget, findNewTarget, findSaveTarget, isTyping, topDialog } from "../shortcuts";

const page = (html) => {
  document.body.innerHTML = html;
};
const key = (k, over = {}) => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over });

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("classify", () => {
  it("reads the three Ctrl combinations and the question mark", () => {
    expect(classify(key("Enter", { ctrlKey: true }))).toBe("enter");
    expect(classify(key("Enter", { metaKey: true }))).toBe("enter");
    expect(classify(key("s", { ctrlKey: true }))).toBe("save");
    expect(classify(key("S", { ctrlKey: true, shiftKey: true }))).toBe("saveNew");
    expect(classify(key("?", { shiftKey: true }))).toBe("help");
  });

  it("leaves everything else alone, and never steals a question mark from a text field", () => {
    expect(classify(key("Enter"))).toBeNull();
    expect(classify(key("s"))).toBeNull();
    expect(classify(key("k", { ctrlKey: true }))).toBeNull(); // search is handled by the shell
    expect(classify(key("?"), { typing: true })).toBeNull();
    expect(classify(key("s", { ctrlKey: true, altKey: true }))).toBeNull();
  });

  it("knows a text field", () => {
    page('<input id="a"><select id="b"></select><button id="c"></button>');
    expect(isTyping(document.getElementById("a"))).toBe(true);
    expect(isTyping(document.getElementById("b"))).toBe(true);
    expect(isTyping(document.getElementById("c"))).toBe(false);
  });
});

describe("findNewTarget", () => {
  it("finds the page's New button, not a line button", () => {
    page('<main><button>Add line</button><button id="n">New sales invoice</button></main>');
    expect(findNewTarget().id).toBe("n");
  });

  it("an explicit data-shortcut wins", () => {
    page('<main><button>New something</button><button id="m" data-shortcut="new">Start</button></main>');
    expect(findNewTarget().id).toBe("m");
  });

  it("is nothing while a dialog or a form is open: that press means save", () => {
    page('<main><button>New receipt</button></main><div role="dialog"><button>Cancel</button></div>');
    expect(findNewTarget()).toBeNull();
    page('<main><form><button type="submit">Save</button></form><button>New receipt</button></main>');
    expect(findNewTarget()).toBeNull();
  });

  it("ignores a disabled or hidden button", () => {
    page('<main><button disabled>New order</button><div aria-hidden="true"><button>New quote</button></div></main>');
    expect(findNewTarget()).toBeNull();
  });
});

describe("findSaveTarget", () => {
  it("in a dialog it is the confirm button, after Cancel", () => {
    page('<main><button>New receipt</button></main><div role="dialog"><button>Cancel</button><button id="ok">Create and approve invoice</button></div>');
    expect(findSaveTarget().id).toBe("ok");
    expect(topDialog()).not.toBeNull();
  });

  it("the topmost dialog is the one that counts", () => {
    page('<div role="dialog"><button id="under">Save</button></div><div role="dialog"><button id="over">Confirm order</button></div>');
    expect(findSaveTarget().id).toBe("over");
  });

  it("on a form page it is the form's submit button", () => {
    page('<main><form id="f"><button type="submit" id="s">Save as draft</button></form><button>Back</button></main>');
    expect(findSaveTarget().id).toBe("s");
  });

  it("on a list it never presses an action that merely sounds like saving", () => {
    page("<main><button>Create invoice</button><button>Confirm</button></main>");
    expect(findSaveTarget()).toBeNull();
  });

  it("a disabled save is not pressed", () => {
    page('<main><form><button type="submit" disabled>Save</button></form></main>');
    expect(findSaveTarget()).toBeNull();
  });
});

describe("enterTarget", () => {
  it("opens a new one on a list and saves in a form", () => {
    page('<main><button id="n">New purchase order</button></main>');
    expect(enterTarget()).toMatchObject({ kind: "new" });
    page('<main><form><button type="submit" id="s">Save</button></form></main>');
    expect(enterTarget()).toMatchObject({ kind: "save" });
    page('<main></main><div role="dialog"><button id="c">Confirm</button></div>');
    expect(enterTarget()).toMatchObject({ kind: "save" });
  });

  it("is nothing on a page with neither", () => {
    page("<main><p>Nothing to do</p></main>");
    expect(enterTarget()).toBeNull();
  });
});
