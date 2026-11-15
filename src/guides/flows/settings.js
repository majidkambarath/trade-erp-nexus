// Settings and people: a tour of each Settings tab, adding a colleague and the roles screen.
// The tours point and read; they never save a setting on their own. Adding a colleague is the one guide that types.
const tabs = "[role='tablist']";
const tab = (name) => ({ button: name, within: tabs });

export const setUpCompany = {
  id: "set-up-company",
  module: "settings",
  permission: "settings.view",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/settings" },
    { id: "name", kind: "info", target: { field: /^company name/i } },
    { id: "address", kind: "info", ifPresent: true, target: { field: /^address line 1/i } },
    { id: "logo", kind: "info", ifPresent: true, target: { text: /^company logo$|^logo$/i } },
    { id: "save", kind: "info", ifPresent: true, target: { button: /^save changes$/i } },
    { id: "done", kind: "done", next: "tax-identity-tour" },
  ],
};

export const taxIdentityTour = {
  id: "tax-identity-tour",
  module: "settings",
  permission: "settings.view",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/settings" },
    { id: "tab", kind: "click", target: tab(/^business rules$/i) },
    { id: "panel", kind: "info", ifPresent: true, target: { text: /^tax identity$/i } },
    { id: "number", kind: "info", ifPresent: true, target: { field: /tax registration number|gstin|tax no|vat no/i } },
    { id: "done", kind: "done", next: "credit-and-approvals-tour" },
  ],
};

export const creditAndApprovalsTour = {
  id: "credit-and-approvals-tour",
  module: "settings",
  permission: "settings.view",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/settings" },
    { id: "tab", kind: "click", target: tab(/^business rules$/i) },
    { id: "credit", kind: "info", ifPresent: true, target: { text: /^credit control$/i } },
    { id: "returns", kind: "info", ifPresent: true, target: { text: /^returns$/i } },
    { id: "approvals", kind: "info", ifPresent: true, target: { text: /^approvals$/i } },
    { id: "done", kind: "done", next: "invoice-bank-details" },
  ],
};

export const invoiceBankDetails = {
  id: "invoice-bank-details",
  module: "settings",
  permission: "settings.view",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/settings" },
    { id: "tab", kind: "click", target: tab(/^invoice bank details$/i) },
    { id: "bank", kind: "info", ifPresent: true, target: { field: /^bank name$/i } },
    { id: "iban", kind: "info", ifPresent: true, target: { field: /^iban$/i } },
    { id: "save", kind: "info", ifPresent: true, target: { button: /^save changes$/i } },
    { id: "done", kind: "done", next: "preferences-tour" },
  ],
};

export const preferencesTour = {
  id: "preferences-tour",
  module: "settings",
  permission: "settings.view",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/settings" },
    { id: "tab", kind: "click", target: tab(/^preferences$/i) },
    { id: "theme", kind: "info", ifPresent: true, target: { selector: "[role='radiogroup'][aria-label='Theme']" } },
    { id: "time", kind: "info", ifPresent: true, target: { field: /^time format$/i } },
    { id: "done", kind: "done", next: "security-tour" },
  ],
};

export const securityTour = {
  id: "security-tour",
  module: "settings",
  permission: "settings.view",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/settings" },
    { id: "tab", kind: "click", target: tab(/^security$/i) },
    { id: "password", kind: "info", ifPresent: true, target: { text: /^(change )?password$/i } },
    { id: "twofactor", kind: "info", ifPresent: true, target: { text: /^two-factor|^two-step/i } },
    { id: "done", kind: "done", next: "sending-setup-tour" },
  ],
};

export const sendingSetupTour = {
  id: "sending-setup-tour",
  module: "settings",
  permission: "settings.view",
  feature: "messaging",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/settings" },
    { id: "tab", kind: "click", target: tab(/^sending$/i) },
    { id: "connection", kind: "info", ifPresent: true, target: { text: /^email connection$/i } },
    { id: "sender", kind: "info", ifPresent: true, target: { field: /^sender address$/i } },
    { id: "checklist", kind: "info", ifPresent: true, target: { selector: "[aria-label='Setup checklist']" } },
    { id: "done", kind: "done" },
  ],
};

export const branchesTour = {
  id: "branches-tour",
  module: "settings",
  permission: "settings.view",
  feature: "multiBranch",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/settings" },
    { id: "tab", kind: "click", target: tab(/^branches$/i) },
    { id: "list", kind: "info", ifPresent: true, target: { text: /^branches$/i } },
    { id: "done", kind: "done" },
  ],
};

export const addColleague = {
  id: "add-colleague",
  module: "users",
  permission: "users.manage",
  minutes: 3,
  steps: [
    { id: "open", kind: "go", to: "/users" },
    { id: "add", kind: "click", target: { button: /^add a person$/i } },
    { id: "name", kind: "fill", sample: "Walk Colleague", target: { field: /^name/i, within: "[role='dialog']" } },
    { id: "email", kind: "fill", sample: "walk.colleague@example.com", target: { field: /^email/i, within: "[role='dialog']" } },
    { id: "role", kind: "info", target: { field: /^role/i, within: "[role='dialog']" } },
    { id: "save", kind: "click", target: { button: /^add person$/i, within: "[role='dialog']" } },
    { id: "done", kind: "done", next: "roles-tour" },
  ],
};

export const rolesTour = {
  id: "roles-tour",
  module: "users",
  permission: "users.view",
  minutes: 2,
  steps: [
    { id: "open", kind: "go", to: "/users" },
    { id: "tab", kind: "click", target: tab(/^roles$/i) },
    { id: "new", kind: "info", ifPresent: true, target: { button: /^new role$/i } },
    { id: "done", kind: "done" },
  ],
};
