import { describe, it, expect } from "vitest";
import {
  codePayload, codeProblem, looksLikeEmail, manageProblem, recoveryCodesFileName, recoveryCodesText, resetProblem,
  secondStepProblem, tokenFromSearch, typedDigits, validateNewPassword,
} from "../twoFactorForms";

const refused = (status, errorCode, message) => ({ response: { status, data: { errorCode, message } } });

describe("the code box takes the app's six digits or a recovery code, and says which", () => {
  it("six digits, however they are spaced, are the app's code", () => {
    expect(codePayload("123456")).toEqual({ code: "123456" });
    expect(codePayload(" 123 456 ")).toEqual({ code: "123456" });
    expect(codePayload("123-456")).toEqual({ code: "123456" });
  });

  it("ten letters and digits, with or without the hyphen, are a recovery code, shouted", () => {
    expect(codePayload("abcde-fghjk")).toEqual({ recoveryCode: "ABCDEFGHJK" });
    expect(codePayload("ABCDE FGHJK")).toEqual({ recoveryCode: "ABCDEFGHJK" });
    expect(codePayload("0123456789")).toEqual({ recoveryCode: "0123456789" }); // ten digits is not six
  });

  it("anything else is nothing to send", () => {
    for (const bad of ["", "12345", "1234567", "abc", "abcde-fghj", "abcde-fghjkl", null, undefined]) expect(codePayload(bad)).toBeNull();
  });

  it("explains what is missing, and refuses a recovery code where only the app's will do", () => {
    expect(codeProblem("")).toMatch(/six-digit code .* or a recovery code/);
    expect(codeProblem("", { allowRecovery: false })).toBe("Enter the six-digit code from your app");
    expect(codeProblem("12345")).toBe("The code from your app is six digits");
    expect(codeProblem("123456")).toBe("");
    expect(codeProblem("abcde-fghjk")).toBe("");
    expect(codeProblem("abcde-fghjk", { allowRecovery: false })).toBe("The code from your app is six digits");
    expect(codeProblem("abc")).toMatch(/recovery code of ten/);
  });

  it("tidies the digits as they are typed: digits only, six at most, grouped in threes", () => {
    expect(typedDigits("1")).toBe("1");
    expect(typedDigits("123")).toBe("123");
    expect(typedDigits("1234")).toBe("123 4");
    expect(typedDigits("12a3-45 6789")).toBe("123 456");
    expect(typedDigits(undefined)).toBe("");
  });
});

describe("what a refused second step means", () => {
  it("a wrong code stays on the code box", () => {
    expect(secondStepProblem(refused(401, "INVALID_TWO_FACTOR_CODE"))).toEqual({ text: expect.stringMatching(/not right/), restart: false });
  });
  it("a code already used says to wait for the next", () => {
    const r = secondStepProblem(refused(401, "TWO_FACTOR_CODE_REUSED"));
    expect(r.restart).toBe(false);
    expect(r.text).toMatch(/already been used/);
  });
  it("an expired challenge, or a locked account, sends the person back to the password", () => {
    expect(secondStepProblem(refused(401, "CHALLENGE_EXPIRED")).restart).toBe(true);
    expect(secondStepProblem(refused(401, "CHALLENGE_INVALID")).restart).toBe(true);
    const locked = secondStepProblem(refused(423, "ACCOUNT_LOCKED", "Account locked. Try after 14 minutes"));
    expect(locked).toEqual({ text: "Account locked. Try after 14 minutes", restart: true });
  });
  it("too many attempts from the address is said as the server said it, and stays", () => {
    expect(secondStepProblem(refused(429, "TOO_MANY_ATTEMPTS", "Too many failed sign-in attempts from this address. Try again in 14 minutes."))).toEqual({ text: "Too many failed sign-in attempts from this address. Try again in 14 minutes.", restart: false });
  });
  it("no answer at all is a connection problem", () => {
    expect(secondStepProblem({}).text).toMatch(/Can't reach the server/);
  });
});

describe("choosing a new password from the emailed link", () => {
  it("wants eight characters and the same twice", () => {
    expect(validateNewPassword({ password: "short", confirm: "short" })).toEqual({ password: "Use at least 8 characters" });
    expect(validateNewPassword({ password: "long-enough-1", confirm: "different-1" })).toEqual({ confirm: "The two passwords do not match" });
    expect(validateNewPassword({ password: "long-enough-1", confirm: "long-enough-1" })).toEqual({});
    expect(Object.keys(validateNewPassword())).toEqual(["password"]);
  });

  it("reads the token from the link, and only if it has the right shape", () => {
    const token = "A".repeat(43);
    expect(tokenFromSearch(`?token=${token}`)).toBe(token);
    expect(tokenFromSearch(`?x=1&token=${token}`)).toBe(token);
    for (const bad of ["", "?token=short", `?token=${token}x`, `?token=${"A".repeat(42)}!`, "?other=1", undefined]) expect(tokenFromSearch(bad)).toBe("");
  });

  it("a dead link says to ask again; a rate limit or a lost connection does not kill the link", () => {
    expect(resetProblem(refused(400, "RESET_TOKEN_INVALID"))).toEqual({ text: "This link is no longer valid. Ask for a new one.", dead: true });
    expect(resetProblem(refused(429, "TOO_MANY_REQUESTS", "Slow down")).dead).toBe(false);
    expect(resetProblem({}).dead).toBe(false);
    expect(resetProblem(refused(400, "WEAK_PASSWORD", "A password needs at least 8 characters"))).toEqual({ text: "A password needs at least 8 characters", dead: false });
  });

  it("an address is worth sending when it has an @ and a dot", () => {
    expect(looksLikeEmail(" a@b.co ")).toBe(true);
    for (const bad of ["", "a@b", "a b@c.de", "@b.co", undefined]) expect(looksLikeEmail(bad)).toBe(false);
  });
});

describe("the recovery codes file", () => {
  it("names the account, says each works once, and lists the codes one to a line", () => {
    const text = recoveryCodesText(["AAAAA-BBBBB", "CCCCC-DDDDD"], { account: "nadia@acme.test", issuer: "Zarvia", date: "9 Oct 2026" });
    const lines = text.split("\n");
    expect(lines[0]).toBe("Zarvia recovery codes for nadia@acme.test");
    expect(lines[1]).toBe("Made 9 Oct 2026");
    expect(text).toMatch(/works once/);
    expect(lines).toContain("AAAAA-BBBBB");
    expect(lines).toContain("CCCCC-DDDDD");
  });
  it("has a safe file name", () => {
    expect(recoveryCodesFileName("nadia@acme.test")).toBe("recovery-codes-nadia@acme.test.txt");
    expect(recoveryCodesFileName("a b/c")).toBe("recovery-codes-a_b_c.txt");
    expect(recoveryCodesFileName()).toBe("recovery-codes.txt");
  });
});

describe("what a refused management call means", () => {
  it("says it in words", () => {
    expect(manageProblem(refused(400, "PASSWORD_INCORRECT"))).toBe("That password is not right.");
    expect(manageProblem(refused(400, "INVALID_TWO_FACTOR_CODE"))).toMatch(/not right/);
    expect(manageProblem(refused(400, "TWO_FACTOR_CODE_REUSED"))).toMatch(/already been used/);
    expect(manageProblem(refused(403, "TWO_FACTOR_REQUIRED_BY_POLICY"))).toMatch(/requires two-factor/);
    expect(manageProblem(refused(423, "ACCOUNT_LOCKED", "Account locked. Try after 5 minutes"))).toBe("Account locked. Try after 5 minutes");
    expect(manageProblem(refused(500, "X", "Boom"))).toBe("Boom");
    expect(manageProblem({ message: "Network Error" })).toBe("Network Error");
  });
});
