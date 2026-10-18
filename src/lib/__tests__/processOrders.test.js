import { describe, expect, it } from "vitest";
import { emptyProcess, emptyStep, processBody, processErrorText, processToForm, stepLabel, stepsFromLast, validateProcess } from "../processOrders";

const form = (over = {}) => ({
  ...emptyProcess("2026-10-19"),
  finishedId: "fin", qty: "100",
  materials: [{ stockId: "raw", qty: "100" }],
  steps: [{ ...emptyStep(), name: "Bending", assigneeId: "u1" }, { ...emptyStep(), name: "Painting", mode: "job_work", jobWorkerId: "v1" }],
  ...over,
});

describe("process order form", () => {
  it("a complete form passes; the product, quantity and at least one named step are required", () => {
    expect(validateProcess(form())).toEqual({});
    const e = validateProcess(form({ finishedId: "", qty: "0", steps: [emptyStep()] }));
    expect(Object.keys(e).sort()).toEqual(["finishedId", "qty", "steps"]);
  });

  it("a job-work step needs a job worker, and a material to send", () => {
    expect(validateProcess(form({ steps: [{ ...emptyStep(), name: "Painting", mode: "job_work" }] }))["steps.0.jobWorkerId"]).toBe("Choose the job worker");
    expect(validateProcess(form({ materials: [{ stockId: "", qty: "" }] }))["steps.1.jobWorkerId"]).toMatch(/add the material first/);
  });

  it("a material cannot be the product itself, and a half-filled step must be named", () => {
    expect(validateProcess(form({ materials: [{ stockId: "fin", qty: "1" }] }))["materials.0.stockId"]).toMatch(/itself/);
    expect(validateProcess(form({ steps: [{ ...emptyStep(), dueDate: "2026-10-20" }] }))["steps.0.name"]).toBe("Name the step");
  });

  it("the body leaves out blank lines and sends a person for in-house steps, a vendor for job work", () => {
    const body = processBody(form({ materials: [{ stockId: "raw", qty: "100" }, { stockId: "", qty: "" }], steps: [...form().steps, emptyStep()] }));
    expect(body.finished).toEqual({ stockId: "fin", qty: 100 });
    expect(body.materials).toEqual([{ stockId: "raw", qty: 100 }]);
    expect(body.steps).toEqual([
      { name: "Bending", mode: "in_house", assigneeId: "u1", dueDate: undefined },
      { name: "Painting", mode: "job_work", jobWorkerId: "v1", dueDate: undefined },
    ]);
  });

  it("an order read back fills the form, and the last order's steps copy without dates", () => {
    const f = processToForm({ date: "2026-10-19T00:00:00Z", dueDate: "2026-10-25T00:00:00Z", finished: { stockId: "fin", qty: 10 }, materials: [{ stockId: "raw", qty: 10 }], steps: [{ name: "Bending", mode: "in_house", assigneeId: "u1", dueDate: "2026-10-20T00:00:00Z" }] });
    expect(f.dueDate).toBe("2026-10-25");
    expect(f.steps[0]).toMatchObject({ name: "Bending", assigneeId: "u1", dueDate: "2026-10-20" });
    expect(stepsFromLast([{ name: "Painting", mode: "job_work", jobWorkerId: "v1" }])).toEqual([{ ...emptyStep(), name: "Painting", mode: "job_work", assigneeId: "", jobWorkerId: "v1" }]);
  });
});

describe("words", () => {
  it("a job-work step reads as at the job worker, in house as in progress", () => {
    expect(stepLabel({ status: "IN_PROGRESS", mode: "job_work" }).label).toBe("At job worker");
    expect(stepLabel({ status: "IN_PROGRESS", mode: "in_house" }).label).toBe("In progress");
    expect(stepLabel({ status: "READY", mode: "job_work" }).label).toBe("Ready to send");
    expect(stepLabel({ status: "WAITING" }).label).toBe("Waiting");
  });

  it("refusals read in plain words", () => {
    expect(processErrorText({ code: "PROCESS_AT_JOB_WORKER", message: "x" })).toMatch(/out with a job worker/);
    expect(processErrorText({ code: "SOMETHING", message: "Server said" })).toBe("Server said");
    expect(processErrorText(null)).toBe("");
  });
});
