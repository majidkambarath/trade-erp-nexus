import { describe, it, expect } from "vitest";
import { MIN_PASSWORD, passwordHint, validatePasswordChange } from "../passwordForms";

describe("choosing a new password", () => {
  const good = { currentPassword: "temporary-1", newPassword: "my-own-password-1", confirmPassword: "my-own-password-1" };

  it("is good with the current password, a new one of enough length, and the same typed twice", () => {
    expect(validatePasswordChange(good)).toEqual({});
  });

  it("asks for the current password", () => {
    expect(validatePasswordChange({ ...good, currentPassword: "" }).currentPassword).toBeTruthy();
  });

  it("wants at least as many characters as the server does (8), and says the number", () => {
    expect(MIN_PASSWORD).toBe(8);
    expect(validatePasswordChange({ ...good, newPassword: "1234567", confirmPassword: "1234567" }).newPassword).toBe("Use at least 8 characters");
    expect(validatePasswordChange({ ...good, newPassword: "12345678", confirmPassword: "12345678" }).newPassword).toBeUndefined();
    expect(passwordHint).toMatch(/At least 8 characters/);
  });

  it("will not take the password already in use", () => {
    const same = { currentPassword: "temporary-1", newPassword: "temporary-1", confirmPassword: "temporary-1" };
    expect(validatePasswordChange(same).newPassword).toMatch(/not used/);
  });

  it("wants the two to match", () => {
    expect(validatePasswordChange({ ...good, confirmPassword: "different-one-1" }).confirmPassword).toMatch(/do not match/);
  });

  it("copes with nothing at all", () => {
    expect(Object.keys(validatePasswordChange())).toEqual(["currentPassword", "newPassword"]);
    expect(Object.keys(validatePasswordChange({}))).toEqual(["currentPassword", "newPassword"]);
  });
});
