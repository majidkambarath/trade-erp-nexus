// The garage: a vehicle comes in, an estimate is approved, the work is done, the car is invoiced and handed back.
// See masters.js for the step kinds. Every flow needs `garage.*` (the module is sold per organisation, so a company
// without it never sees these). The job-card guides continue on the newest job card, which is the first row of the list.

const dialog = "[role='dialog']";
const inDialog = (target) => ({ ...target, within: dialog });
const firstRow = { selector: "main table tbody tr" };
const rows = "main table tbody";
const tab = (name) => ({ button: name, within: "[role='tablist']" });

export const garageBoardTour = {
  id: "garage-board-tour",
  module: "garage",
  permission: "garage.view",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/garage/board" },
    { id: "count", kind: "info", target: { selector: "main h1, main h2" } },
    { id: "tiles", kind: "info", ifPresent: true, target: { selector: "ul[aria-label='Where the work stands']" } },
    { id: "chips", kind: "info", ifPresent: true, target: { selector: "[aria-label='Filter the board by status']" } },
    { id: "done", kind: "done", next: "add-vehicle" },
  ],
};

export const addVehicle = {
  id: "add-vehicle",
  module: "garage",
  permission: "garage.create",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/garage/vehicles" },
    { id: "new", kind: "click", target: { button: /^new vehicle$/i } },
    { id: "plate", kind: "fill", sample: "99887", target: inDialog({ field: /^plate number/i }) },
    { id: "make", kind: "fill", sample: "Toyota", target: inDialog({ field: /^make/i }) },
    { id: "model", kind: "fill", sample: "Hilux", target: inDialog({ field: /^model/i }) },
    { id: "owner", kind: "fill", optional: true, sample: "Al Madina", target: inDialog({ field: /^owner/i }) },
    { id: "odometer", kind: "fill", optional: true, sample: "45000", target: inDialog({ field: /^odometer/i }) },
    { id: "save", kind: "click", target: inDialog({ button: /^save$/i }) },
    { id: "done", kind: "done", next: "new-job-card" },
  ],
};

export const newJobCard = {
  id: "new-job-card",
  module: "garage",
  permission: "garage.create",
  minutes: 4,
  steps: [
    { id: "open", kind: "go", to: "/garage/job-cards" },
    { id: "new", kind: "click", target: { button: /^new job card$/i } },
    { id: "vehicle", kind: "fill", sample: "99887", target: { guide: "garage-vehicle" } },
    { id: "customer", kind: "fill", sample: "Al Madina", target: inDialog({ field: /^customer/i }) },
    { id: "jobtype", kind: "info", target: inDialog({ field: /^job type/i }) },
    { id: "odometer", kind: "fill", optional: true, sample: "45000", target: inDialog({ field: /^odometer in/i }) },
    { id: "concern", kind: "fill", sample: "Brakes squeal when stopping", target: { guide: "garage-concern" } },
    { id: "addline", kind: "click", target: inDialog({ button: /^add line$/i }) },
    { id: "line", kind: "info", target: { guide: "garage-line" } },
    { id: "lineitem", kind: "fill", sample: "Brake pads", target: { guide: "garage-line-item" } },
    { id: "addtask", kind: "click", target: inDialog({ button: /^add task$/i }) },
    { id: "task", kind: "fill", sample: "Replace brake pads", target: { guide: "garage-task-name" } },
    { id: "save", kind: "click", target: inDialog({ button: /^save$/i }) },
    { id: "done", kind: "done", next: "garage-estimate-approval" },
  ],
};

export const garageEstimateApproval = {
  id: "garage-estimate-approval",
  module: "garage",
  permission: "garage.approve",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/garage/job-cards" },
    { id: "row", kind: "click", target: firstRow, clickIn: rows },
    { id: "send", kind: "click", ifPresent: true, target: { button: /^send estimate$/i } },
    { id: "sendok", kind: "click", ifPresent: true, target: inDialog({ button: /^send$/i }) },
    { id: "close", kind: "click", ifPresent: true, target: inDialog({ button: /^(close|cancel)$/i }) },
    { id: "decide", kind: "click", target: { button: /^record decision$/i } },
    { id: "how", kind: "info", target: inDialog({ field: /^how it was given/i }) },
    { id: "lines", kind: "info", target: { guide: "garage-approval-lines" } },
    { id: "approve", kind: "click", target: inDialog({ button: /^record approval$/i }) },
    { id: "done", kind: "done", next: "garage-do-the-work" },
  ],
};

export const garageDoTheWork = {
  id: "garage-do-the-work",
  module: "garage",
  permission: "garage.edit",
  minutes: 4,
  steps: [
    { id: "open", kind: "go", to: "/garage/job-cards" },
    { id: "row", kind: "click", target: firstRow, clickIn: rows },
    { id: "worktab", kind: "click", target: tab(/^the work/i) },
    { id: "findings", kind: "click", target: { button: /^(record|edit) findings$/i } },
    { id: "item", kind: "fill", sample: "Front brake pads", target: inDialog({ field: /^what was checked/i }) },
    { id: "condition", kind: "info", target: inDialog({ field: /^condition/i }) },
    { id: "note", kind: "fill", optional: true, sample: "2 mm of pad left", target: inDialog({ field: /^note/i }) },
    { id: "savefindings", kind: "click", target: inDialog({ button: /^save inspection$/i }) },
    { id: "start", kind: "click", ifPresent: true, target: { button: /^start$/i } },
    { id: "complete", kind: "click", ifPresent: true, target: { button: /^done$/i } },
    { id: "hours", kind: "info", ifPresent: true, target: inDialog({ field: /^hours actually taken/i }) },
    { id: "markdone", kind: "click", ifPresent: true, target: inDialog({ button: /^mark done$/i }) },
    { id: "done", kind: "done", next: "garage-invoice-release" },
  ],
};

export const garageInvoiceRelease = {
  id: "garage-invoice-release",
  module: "garage",
  permission: "garage.invoice",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/garage/job-cards" },
    { id: "row", kind: "click", target: firstRow, clickIn: rows },
    { id: "invoice", kind: "click", ifPresent: true, target: { button: /^raise invoice$/i } },
    { id: "serial", kind: "info", ifPresent: true, target: inDialog({ field: /^serial no/i }) },
    { id: "invoiceok", kind: "click", ifPresent: true, target: inDialog({ button: /^raise invoice$/i }) },
    { id: "release", kind: "click", ifPresent: true, permission: "garage.approve", target: { button: /^release vehicle$/i } },
    { id: "handed", kind: "fill", ifPresent: true, permission: "garage.approve", sample: "Khalid", target: inDialog({ field: /^handed to/i }) },
    { id: "releaseok", kind: "click", ifPresent: true, permission: "garage.approve", target: inDialog({ button: /^release$/i }) },
    { id: "print", kind: "info", ifPresent: true, target: { button: /^gate pass/i } },
    { id: "done", kind: "done", next: "garage-insurance-claim" },
  ],
};

export const garageInsuranceClaim = {
  id: "garage-insurance-claim",
  module: "garage",
  permission: "garage.create",
  minutes: 5,
  steps: [
    { id: "open", kind: "go", to: "/garage/job-cards" },
    { id: "type", kind: "fill", sample: "insurance", target: { field: /^job type/i, within: "main" } },
    { id: "alltime", kind: "click", ifPresent: true, target: { button: /^all time$/i } },
    { id: "row", kind: "click", target: firstRow, clickIn: rows },
    { id: "money", kind: "click", target: tab(/^money/i) },
    { id: "open-claim", kind: "click", ifPresent: true, target: { button: /^open insurance claim$/i } },
    { id: "insurer", kind: "fill", ifPresent: true, sample: "Orient", target: { guide: "garage-insurer" } },
    { id: "policy", kind: "fill", ifPresent: true, sample: "POL-2026-1180", target: inDialog({ field: /^policy number/i }) },
    { id: "claimok", kind: "click", ifPresent: true, target: inDialog({ button: /^open claim$/i }) },
    { id: "view", kind: "click", ifPresent: true, target: { button: /^view claim$/i } },
    { id: "submit", kind: "click", ifPresent: true, target: inDialog({ button: /^submit$/i }) },
    { id: "submitok", kind: "click", ifPresent: true, target: { button: /^submit$/i, within: "[role='alertdialog'], [role='dialog']" } },
    { id: "survey", kind: "click", ifPresent: true, target: inDialog({ button: /^record survey$/i }) },
    { id: "surveyor", kind: "fill", ifPresent: true, sample: "Rashid", target: inDialog({ field: /^surveyor/i }) },
    { id: "savesurvey", kind: "click", ifPresent: true, target: inDialog({ button: /^save survey$/i }) },
    { id: "decision", kind: "click", ifPresent: true, target: inDialog({ button: /^record decision$/i }) },
    { id: "lpo", kind: "fill", ifPresent: true, sample: "LPO-2026-5521", target: inDialog({ field: /^lpo/i }) },
    { id: "excess", kind: "fill", ifPresent: true, sample: "500", target: inDialog({ field: /^excess/i }) },
    { id: "savedecision", kind: "click", ifPresent: true, target: inDialog({ button: /^save decision$/i }) },
    { id: "done", kind: "done" },
  ],
};

export const garageStandardJob = {
  id: "garage-standard-job",
  module: "garage",
  permission: "garage.manage",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/garage/setup" },
    { id: "new", kind: "click", target: { button: /^new standard job$/i } },
    { id: "code", kind: "fill", sample: "SVC-40K", target: inDialog({ field: /^code/i }) },
    { id: "name", kind: "fill", sample: "40,000 km service", target: inDialog({ field: /^name/i }) },
    { id: "item", kind: "fill", sample: "Labour", target: inDialog({ field: /^service item/i }) },
    { id: "hours", kind: "fill", optional: true, sample: "2", target: inDialog({ field: /^standard hours/i }) },
    { id: "save", kind: "click", target: inDialog({ button: /^save$/i }) },
    { id: "done", kind: "done", next: "garage-bay" },
  ],
};

export const garageBay = {
  id: "garage-bay",
  module: "garage",
  permission: "garage.manage",
  minutes: 1,
  steps: [
    { id: "open", kind: "go", to: "/garage/setup" },
    { id: "baystab", kind: "click", target: tab(/^bays$/i) },
    { id: "new", kind: "click", target: { button: /^new bay$/i } },
    { id: "name", kind: "fill", sample: "Bay 4", target: inDialog({ field: /^name/i }) },
    { id: "kind", kind: "info", target: inDialog({ field: /^kind/i }) },
    { id: "save", kind: "click", target: inDialog({ button: /^save$/i }) },
    { id: "done", kind: "done" },
  ],
};

export const garageReportsTour = {
  id: "garage-reports-tour",
  module: "garage",
  permission: "garage.view",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/garage/reports" },
    { id: "tabs", kind: "info", target: { selector: "[aria-label='Which report']" } },
    { id: "period", kind: "info", ifPresent: true, target: { field: /^period/i } },
    { id: "export", kind: "info", ifPresent: true, target: { button: /^export$/i } },
    { id: "done", kind: "done" },
  ],
};

export const GARAGE_FLOWS = [garageBoardTour, addVehicle, newJobCard, garageEstimateApproval, garageDoTheWork, garageInvoiceRelease, garageInsuranceClaim, garageStandardJob, garageBay, garageReportsTour];
