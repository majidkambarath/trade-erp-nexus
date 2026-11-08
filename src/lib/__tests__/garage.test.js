import { describe, expect, it } from "vitest";
import { AGE_BAND_LABEL, AGE_BAND_TONE, CLAIM_AGE_BUCKET_LABEL, CLAIM_AGE_BUCKET_TONE, DUE_LABEL, DUE_TONE, JOB_STATUS, TASK_STATUS, garageErrorText, jobCardLabel } from "../garage";

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
