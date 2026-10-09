import { describe, it, expect } from "vitest";
import { blankRow, changed, payloadFromRows, rowsFromPerson, serverMessage, summaryOf, validateRows } from "../branchRoleForms";

// the shape GET /access/users sends for each person
const role = (key, name) => ({ key, name, rank: 20, builtIn: true, active: true });
const person = (branchRoles = []) => ({ id: "u1", name: "Hana", role: role("manager", "Manager"), branchId: "main", branchRoles });
const BRANCHES = [
  { code: "main", name: "Head office" },
  { code: "shj", name: "Sharjah" },
  { code: "dxb", name: "Dubai" },
];

describe("the rows of a person", () => {
  it("are one per branch they hold another role in, with the role as its key", () => {
    const p = person([{ branchId: "shj", role: role("viewer", "Viewer") }, { branchId: "dxb", role: role("auditor", "Auditor") }]);
    expect(rowsFromPerson(p)).toEqual([{ branchId: "shj", role: "viewer" }, { branchId: "dxb", role: "auditor" }]);
  });

  it("are none for a person without any, or for someone the server sent no list for", () => {
    expect(rowsFromPerson(person([]))).toEqual([]);
    expect(rowsFromPerson({ id: "u2" })).toEqual([]);
    expect(rowsFromPerson(null)).toEqual([]);
  });

  it("also read the status route's shape ({ branchId, roleKey })", () => {
    expect(rowsFromPerson({ branchRoles: [{ branchId: "shj", roleKey: "viewer", roleName: "Viewer" }] })).toEqual([{ branchId: "shj", role: "viewer" }]);
  });
});

describe("what is sent", () => {
  it("is every row that says anything, as { branchId, role }, and nothing for a completely blank row", () => {
    expect(payloadFromRows([{ branchId: "shj", role: "viewer" }, blankRow(), { branchId: "dxb", role: "auditor" }])).toEqual([
      { branchId: "shj", role: "viewer" },
      { branchId: "dxb", role: "auditor" },
    ]);
    expect(payloadFromRows([blankRow(), blankRow()])).toEqual([]);
    expect(payloadFromRows(undefined)).toEqual([]);
  });

  it("keeps a half-filled row, so that validation (not silence) deals with it", () => {
    expect(payloadFromRows([{ branchId: "shj", role: "" }])).toEqual([{ branchId: "shj", role: "" }]);
  });

  it("drops fields the server did not ask for", () => {
    expect(payloadFromRows([{ branchId: "shj", role: "viewer", name: "Sharjah", extra: 1 }])).toEqual([{ branchId: "shj", role: "viewer" }]);
  });
});

describe("validating the rows", () => {
  it("accepts a clean list, an empty one, and a list with a blank line in it", () => {
    expect(validateRows([{ branchId: "shj", role: "viewer" }, { branchId: "dxb", role: "auditor" }], { branches: BRANCHES })).toEqual({});
    expect(validateRows([], { branches: BRANCHES })).toEqual({});
    expect(validateRows([blankRow(), { branchId: "shj", role: "viewer" }], { branches: BRANCHES })).toEqual({});
  });

  it("asks for a branch, and for a role, by row", () => {
    const errors = validateRows([{ branchId: "", role: "viewer" }, { branchId: "shj", role: "" }, { branchId: "dxb", role: "auditor" }], { branches: BRANCHES });
    expect(errors).toEqual({ 0: "Choose a branch", 1: "Choose a role" });
  });

  it("refuses a branch twice, naming the later row only", () => {
    const errors = validateRows([{ branchId: "shj", role: "viewer" }, { branchId: "dxb", role: "viewer" }, { branchId: "shj", role: "auditor" }], { branches: BRANCHES });
    expect(Object.keys(errors)).toEqual(["2"]);
    expect(errors[2]).toMatch(/already listed/);
    expect(errors[2]).toMatch(/one role in a branch/);
  });

  it("a blank line between two rows of the same branch does not hide the clash", () => {
    const errors = validateRows([{ branchId: "shj", role: "viewer" }, blankRow(), { branchId: "shj", role: "auditor" }], { branches: BRANCHES });
    expect(Object.keys(errors)).toEqual(["2"]);
  });

  it("refuses a branch that is not one of those offered", () => {
    expect(validateRows([{ branchId: "atlantis", role: "viewer" }], { branches: BRANCHES })).toEqual({ 0: "That branch is not available" });
  });

  it("does not judge the branch when it was not told which are known", () => {
    expect(validateRows([{ branchId: "atlantis", role: "viewer" }])).toEqual({});
    expect(validateRows([{ branchId: "atlantis", role: "" }])).toEqual({ 0: "Choose a role" });
  });
});

describe("the summary in the list", () => {
  it("says it in words, with the branch's name", () => {
    expect(summaryOf(person([{ branchId: "shj", role: role("viewer", "Viewer") }]), BRANCHES)).toBe("Viewer in Sharjah");
  });

  it("lists several, in the order the server sent them", () => {
    const p = person([{ branchId: "shj", role: role("viewer", "Viewer") }, { branchId: "dxb", role: role("auditor", "Auditor") }]);
    expect(summaryOf(p, BRANCHES)).toBe("Viewer in Sharjah, Auditor in Dubai");
  });

  it("is empty for a person who holds their own role everywhere", () => {
    expect(summaryOf(person([]), BRANCHES)).toBe("");
    expect(summaryOf({ id: "u" }, BRANCHES)).toBe("");
    expect(summaryOf(null)).toBe("");
  });

  it("falls back to the code when the branch is not in the list, and to the head office's name for main", () => {
    expect(summaryOf(person([{ branchId: "ajm", role: role("viewer", "Viewer") }]), BRANCHES)).toBe("Viewer in ajm");
    expect(summaryOf(person([{ branchId: "shj", role: role("viewer", "Viewer") }]))).toBe("Viewer in shj");
    expect(summaryOf(person([{ branchId: "main", role: role("viewer", "Viewer") }]))).toBe("Viewer in Head office");
  });

  it("falls back to the role's key when it has no name", () => {
    expect(summaryOf(person([{ branchId: "shj", role: { key: "night_shift" } }]), BRANCHES)).toBe("night_shift in Sharjah");
  });
});

describe("has anything changed", () => {
  const held = person([{ branchId: "shj", role: role("viewer", "Viewer") }, { branchId: "dxb", role: role("auditor", "Auditor") }]);

  it("is no when the rows are what the person has, in any order", () => {
    expect(changed(rowsFromPerson(held), held)).toBe(false);
    expect(changed([{ branchId: "dxb", role: "auditor" }, { branchId: "shj", role: "viewer" }], held)).toBe(false);
  });

  it("is no when the only difference is a blank line", () => {
    expect(changed([...rowsFromPerson(held), blankRow()], held)).toBe(false);
  });

  it("is yes for a different role, a different branch, one more, or one fewer", () => {
    expect(changed([{ branchId: "shj", role: "auditor" }, { branchId: "dxb", role: "auditor" }], held)).toBe(true);
    expect(changed([{ branchId: "ajm", role: "viewer" }, { branchId: "dxb", role: "auditor" }], held)).toBe(true);
    expect(changed([...rowsFromPerson(held), { branchId: "ajm", role: "viewer" }], held)).toBe(true);
    expect(changed([{ branchId: "shj", role: "viewer" }], held)).toBe(true);
  });

  it("is yes when every row is taken away from someone who had some", () => {
    expect(changed([], held)).toBe(true);
    expect(changed([blankRow()], held)).toBe(true);
  });

  it("for a new person (nobody yet) is yes only if a row says something", () => {
    expect(changed([], null)).toBe(false);
    expect(changed([blankRow()], null)).toBe(false);
    expect(changed([{ branchId: "shj", role: "viewer" }], null)).toBe(true);
  });

  it("is no for a person with none and no rows", () => {
    expect(changed([], person([]))).toBe(false);
  });
});

describe("a refusal", () => {
  it("shows the server's own sentence when there is one", () => {
    expect(serverMessage({ message: "Request failed with status code 400", response: { data: { message: "That branch does not exist" } } })).toBe("That branch does not exist");
  });

  it("falls back to the request's message, then to something plain", () => {
    expect(serverMessage(new Error("Network Error"))).toBe("Network Error");
    expect(serverMessage(null)).toBe("Something went wrong");
  });
});
