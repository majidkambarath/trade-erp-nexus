import { describe, expect, it } from "vitest";
import { validateEmployeeForm, employeeFormData, validateContractForm, contractSummary } from "../hr";

describe("validateEmployeeForm", () => {
  it("needs a name, designation, contact, ID and joining date", () => {
    expect(Object.keys(validateEmployeeForm({}))).toEqual(
      expect.arrayContaining(["name", "designation", "contactNo", "idNo", "joiningDate"])
    );
  });

  it("passes a complete form", () => {
    expect(validateEmployeeForm({ name: "Ravi", designation: "Fabricator", contactNo: "0501234567", idNo: "784X", joiningDate: "2026-01-01" })).toEqual({});
  });
});

describe("employeeFormData", () => {
  it("builds a FormData with only the fields given", () => {
    const fd = employeeFormData({ name: "Ravi", designation: "Fabricator", contactNo: "0501234567", idNo: "784X", joiningDate: "2026-01-01", nationality: "in" });
    expect(fd.get("name")).toBe("Ravi");
    expect(fd.get("nationality")).toBe("IN");
    expect(fd.get("department")).toBeNull();
  });

  it("sends an explicit empty exitDate when the field is present but cleared", () => {
    const fd = employeeFormData({ exitDate: "" });
    expect(fd.get("exitDate")).toBe("");
  });

  it("leaves exitDate out entirely when the caller never mentioned it", () => {
    const fd = employeeFormData({ name: "Ravi" });
    expect(fd.get("exitDate")).toBeNull();
  });
});

describe("validateContractForm", () => {
  it("needs a start day", () => {
    expect(validateContractForm({}).effectiveFrom).toBeTruthy();
  });

  it("refuses a last day before the first day", () => {
    expect(validateContractForm({ effectiveFrom: "2026-06-01", effectiveTo: "2026-01-01" }).effectiveTo).toBeTruthy();
  });

  it("refuses negative money", () => {
    expect(validateContractForm({ effectiveFrom: "2026-01-01", basicPay: -1 }).basicPay).toBeTruthy();
  });

  it("passes a plain cost-per-hour contract", () => {
    expect(validateContractForm({ effectiveFrom: "2026-01-01", costPerHour: 25 })).toEqual({});
  });
});

describe("contractSummary", () => {
  it("reads a row with pay as current with its figures", () => {
    const s = contractSummary({ effectiveFrom: "2026-01-01", effectiveTo: null, hourlyCost: 25, monthlyCost: 5200 });
    expect(s).toEqual({ current: true, from: "2026-01-01", to: null, hasPay: true, hourlyCost: 25, monthlyCost: 5200 });
  });

  it("reads a row with pay stripped as hidden, never as zero", () => {
    const s = contractSummary({ effectiveFrom: "2026-01-01", effectiveTo: null });
    expect(s.hasPay).toBe(false);
    expect(s.hourlyCost).toBeNull();
  });

  it("returns null for nothing", () => {
    expect(contractSummary(null)).toBeNull();
  });
});
