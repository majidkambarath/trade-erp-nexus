import { describe, it, expect, beforeEach, vi } from "vitest";
import axiosInstance from "../axios";
import { getSelectedBranch, setSelectedBranch } from "../session";
import { BRANCH_RESET_EVENT } from "../../lib/organisation";

// A person chose to work in a branch, then lost their role there (or the branch was switched off). Every request names the
// branch and every request is refused - the status read that would put things right included - so the tab must forget the
// choice itself. The refused request is never sent again without the branch: a document would land in the home branch.
let sent;
let refuse;
const answer = (config, status, data) => {
  const response = { status, data, headers: {}, config, statusText: "" };
  return Promise.reject(Object.assign(new Error(`Request failed with status code ${status}`), { config, response, isAxiosError: true }));
};

beforeEach(() => {
  sessionStorage.clear();
  setSelectedBranch(null);
  sent = [];
  refuse = null;
  axiosInstance.defaults.adapter = (config) => {
    sent.push({ url: config.url, branch: config.headers["X-Branch"] || null });
    if (refuse && config.headers["X-Branch"]) return answer(config, 403, refuse);
    return Promise.resolve({ status: 200, data: { success: true }, headers: {}, config, statusText: "OK" });
  };
});

describe("a branch the person may no longer work in", () => {
  it.each([
    ["BRANCH_NOT_ALLOWED", "You can only work in the branches you have been given"],
    ["BRANCH_NOT_FOUND", "That branch was not found"],
    ["BRANCH_INACTIVE", "That branch has been switched off. Please contact your administrator."],
  ])("%s: forgets the remembered branch, says so to the shell, and shows the server's own words", async (errorCode, message) => {
    setSelectedBranch("shj");
    refuse = { success: false, errorCode, message };
    const heard = vi.fn();
    window.addEventListener(BRANCH_RESET_EVENT, heard);
    const error = await axiosInstance.get("/organisation/status").then(() => null, (e) => e);
    window.removeEventListener(BRANCH_RESET_EVENT, heard);

    expect(error.response.status).toBe(403);
    expect(error.message).toBe(message);
    expect(getSelectedBranch()).toBeNull();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("does not send the refused request again without the branch", async () => {
    setSelectedBranch("shj");
    refuse = { success: false, errorCode: "BRANCH_NOT_ALLOWED", message: "no" };
    await axiosInstance.post("/transactions/transactions", {}).catch(() => {});
    expect(sent).toEqual([{ url: "/transactions/transactions", branch: "shj" }]);
  });

  it("the next request works, without the branch", async () => {
    setSelectedBranch("shj");
    refuse = { success: false, errorCode: "BRANCH_NOT_ALLOWED", message: "no" };
    await axiosInstance.get("/organisation/status").catch(() => {});
    const next = await axiosInstance.get("/organisation/status");
    expect(next.status).toBe(200);
    expect(sent.at(-1).branch).toBeNull();
  });

  it("leaves the choice alone for any other refusal", async () => {
    setSelectedBranch("shj");
    refuse = { success: false, errorCode: "PERMISSION_DENIED", message: "Your role does not allow this." };
    const heard = vi.fn();
    window.addEventListener(BRANCH_RESET_EVENT, heard);
    await axiosInstance.get("/customers/customers").catch(() => {});
    window.removeEventListener(BRANCH_RESET_EVENT, heard);
    expect(getSelectedBranch()).toBe("shj");
    expect(heard).not.toHaveBeenCalled();
  });

  it("does nothing about a branch refusal on a request that named no branch", async () => {
    refuse = null;
    axiosInstance.defaults.adapter = (config) => answer(config, 403, { success: false, errorCode: "BRANCH_INACTIVE", message: "Your branch has been switched off." });
    setSelectedBranch(null);
    const heard = vi.fn();
    window.addEventListener(BRANCH_RESET_EVENT, heard);
    const error = await axiosInstance.get("/organisation/status").then(() => null, (e) => e);
    window.removeEventListener(BRANCH_RESET_EVENT, heard);
    expect(error.message).toBe("Your branch has been switched off.");
    expect(heard).not.toHaveBeenCalled();
  });
});
