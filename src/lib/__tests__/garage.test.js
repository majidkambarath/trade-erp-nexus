import { describe, expect, it } from "vitest";
import { AGE_BAND_LABEL, AGE_BAND_TONE, CLAIM_AGE_BUCKET_LABEL, CLAIM_AGE_BUCKET_TONE, DUE_LABEL, DUE_TONE, JOB_STATUS, TASK_STATUS, defaultJobTab, garageErrorText, jobCardLabel, jobOverflowActions, jobPrimaryAction, lineDecisionLabel } from "../garage";

describe("garage words", () => {
  it("every job status and task status has a label and a tone", () => {
    for (const key of ["DRAFT", "AWAITING_APPROVAL", "IN_PROGRESS", "READY", "DELIVERED", "CLOSED", "CANCELLED"]) {
      expect(JOB_STATUS[key].label).toBeTruthy();
      expect(JOB_STATUS[key].tone).toBeTruthy();
    }
    for (const key of ["WAITING", "READY", "IN_PROGRESS", "DONE", "SKIPPED"]) {
      expect(TASK_STATUS[key].label).toBeTruthy();
      expect(TASK_STATUS[key].tone).toBeTruthy();
    }
  });

  it("the three due states each have a label and a danger-ordered tone", () => {
    expect(DUE_LABEL.overdue).toBe("Overdue");
    expect(DUE_TONE.overdue).toBe("danger");
    expect(DUE_TONE.today).toBe("warning");
    expect(DUE_TONE.tomorrow).toBe("info");
  });

  it("the four job-ageing bands and the four claim-ageing buckets each have a label and a danger-ordered tone", () => {
    for (const key of ["u5", "b5_9", "b10_14", "o15"]) {
      expect(AGE_BAND_LABEL[key]).toBeTruthy();
      expect(AGE_BAND_TONE[key]).toBeTruthy();
    }
    expect(AGE_BAND_TONE.o15).toBe("danger");
    expect(AGE_BAND_TONE.u5).toBe("neutral");
    for (const key of ["0-7", "8-14", "15-30", "30+"]) {
      expect(CLAIM_AGE_BUCKET_LABEL[key]).toBeTruthy();
      expect(CLAIM_AGE_BUCKET_TONE[key]).toBeTruthy();
    }
    expect(CLAIM_AGE_BUCKET_TONE["30+"]).toBe("danger");
  });

  it("a board card with no open task reads 'Ready to finish'; one with a task reads the task's own state", () => {
    expect(jobCardLabel({ taskName: null }).label).toBe("Ready to finish");
    expect(jobCardLabel({ taskName: "Oil change", taskStatus: "IN_PROGRESS" }).label).toBe("In progress");
    expect(jobCardLabel({ taskName: "Oil change", taskStatus: "READY" }).tone).toBe("info");
  });

  it("garageErrorText: a code with its own wording wins, otherwise the server's own message, never blank", () => {
    expect(garageErrorText(null)).toBe("");
    expect(garageErrorText({ code: "WORK_NOT_FINISHED" })).toMatch(/still open/);
    expect(garageErrorText({ code: "PAYMENT_DUE", details: { outstanding: 1065 } })).toMatch(/1065 is still owed/);
    expect(garageErrorText({ code: "SOMETHING_NEW", message: "a message from the server" })).toBe("a message from the server");
    expect(garageErrorText({ code: "SOMETHING_NEW" })).toBe("Something went wrong");
  });
});

describe("the job card's tabs and its one loud action", () => {
  it("defaultJobTab: lands on the tab that matches what the status needs next", () => {
    expect(defaultJobTab("DRAFT")).toBe("estimate");
    expect(defaultJobTab("AWAITING_APPROVAL")).toBe("estimate");
    expect(defaultJobTab("IN_PROGRESS")).toBe("work");
    expect(defaultJobTab("READY")).toBe("money");
    expect(defaultJobTab("DELIVERED")).toBe("money");
    expect(defaultJobTab("CLOSED")).toBe("money");
    expect(defaultJobTab("CANCELLED")).toBe("job");
  });

  it("lineDecisionLabel: a version-1 line past approval can only be declined; a later line stays Pending", () => {
    expect(lineDecisionLabel({ approved: false, addedInVersion: 1 }, "IN_PROGRESS").label).toBe("Declined");
    expect(lineDecisionLabel({ approved: false, addedInVersion: 2 }, "IN_PROGRESS").label).toBe("Pending");
    expect(lineDecisionLabel({ approved: false }, "AWAITING_APPROVAL").label).toBe("Pending");
    expect(lineDecisionLabel({ approved: true }, "IN_PROGRESS").label).toBe("Approved");
    expect(lineDecisionLabel({ approved: true, invoiced: true }, "DELIVERED").label).toBe("Invoiced");
  });

  it("jobPrimaryAction: one button per status, matching the server's own action flags", () => {
    const base = { actions: { edit: false, delete: false, checkIn: true, sendEstimate: false, recordApproval: false, reviseEstimate: false, createInvoice: false, release: false, cancel: true } };
    // DRAFT with no lines yet: Edit, not Send estimate.
    expect(jobPrimaryAction({ ...base, status: "DRAFT", actions: { ...base.actions, edit: true }, lines: [] }).key).toBe("edit");
    // DRAFT with lines: Send estimate leads.
    expect(jobPrimaryAction({ ...base, status: "DRAFT", actions: { ...base.actions, edit: true, sendEstimate: true }, lines: [{}] }).key).toBe("sendEstimate");
    expect(jobPrimaryAction({ ...base, status: "AWAITING_APPROVAL", actions: { ...base.actions, recordApproval: true } }).key).toBe("recordApproval");
    // IN_PROGRESS, every task settled, nothing left to decide: Raise invoice.
    expect(
      jobPrimaryAction({
        ...base, status: "IN_PROGRESS", actions: { ...base.actions, recordApproval: true, createInvoice: true },
        lines: [{ approved: true }], tasks: [{ status: "DONE" }, { status: "SKIPPED" }],
      }).key
    ).toBe("createInvoice");
    // IN_PROGRESS with a supplementary line still undecided: Record decision outranks billing.
    expect(
      jobPrimaryAction({
        ...base, status: "IN_PROGRESS", actions: { ...base.actions, recordApproval: true, createInvoice: true },
        lines: [{ approved: false, addedInVersion: 2 }], tasks: [{ status: "DONE" }],
      }).key
    ).toBe("recordApproval");
    // IN_PROGRESS with work still open and nothing to decide: no primary at all.
    expect(jobPrimaryAction({ ...base, status: "IN_PROGRESS", lines: [], tasks: [{ status: "IN_PROGRESS" }] })).toBe(null);
    // READY: invoice before release, so the board's own "Delivered, not invoiced" tile is never self-made.
    expect(jobPrimaryAction({ ...base, status: "READY", actions: { ...base.actions, createInvoice: true, release: true } }).key).toBe("createInvoice");
    expect(jobPrimaryAction({ ...base, status: "READY", actions: { ...base.actions, release: true } }).key).toBe("release");
    expect(jobPrimaryAction({ ...base, status: "DELIVERED", actions: { ...base.actions, createInvoice: true } }).key).toBe("createInvoice");
    expect(jobPrimaryAction({ ...base, status: "CLOSED" })).toBe(null);
    expect(jobPrimaryAction({ ...base, status: "CANCELLED" })).toBe(null);
  });

  it("jobOverflowActions: every true action the primary did not take, Delete last and marked danger", () => {
    const card = {
      status: "IN_PROGRESS",
      actions: { edit: false, delete: true, checkIn: true, sendEstimate: false, recordApproval: true, reviseEstimate: true, createInvoice: true, release: true, cancel: true },
      lines: [{ approved: false, addedInVersion: 2 }], tasks: [{ status: "DONE" }],
    };
    // The primary here is recordApproval (an undecided supplementary line) - it must not also appear in the overflow.
    const overflow = jobOverflowActions(card);
    expect(overflow.map((o) => o.key)).toEqual(["reviseEstimate", "createInvoice", "release", "checkIn", "cancel", "delete"]);
    expect(overflow.at(-1)).toEqual({ key: "delete", label: "Delete", permission: "garage.delete", danger: true });
  });
});
