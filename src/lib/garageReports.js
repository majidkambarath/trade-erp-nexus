// Pure CSV shapers for the Garage reports (trade ERP node/services/garage/garageReportService.js) - one
// per table, the same pattern as the CRM's agingCsv/dealsCsv (lib/crm.js): a plain function from the
// server's rows to { headers, rows }, kept out of the component so it is testable with no rendering.

export const wipCsv = (rows = []) => ({
  headers: ["Job", "Status", "Job type", "Plate", "Vehicle", "Customer", "Days in workshop", "Value", "Owed", "Invoicing"],
  rows: rows.map((r) => [r.jobNo, r.status, r.jobType || "", r.plate || "", r.vehicle || "", r.customer || "", r.daysIn ?? "", r.value, r.owed, r.invoiceStatus]),
});

export const onHoldCsv = (rows = []) => ({
  headers: ["Job", "Task", "Held for", "Days in workshop"],
  rows: rows.map((r) => [r.jobNo, r.taskName || "", r.holdReason || "", r.daysIn ?? ""]),
});

export const profitStreamsCsv = (rows = []) => ({
  headers: ["Stream", "Revenue", "Cost", "Margin", "Basis"],
  rows: rows.map((r) => [r.label, r.revenue, r.cost ?? "", r.margin ?? "", r.basis || ""]),
});

export const peopleCsv = (rows = []) => ({
  headers: ["Person", "Jobs done", "Hours sold", "Hours taken", "Efficiency %", "Waiting hours"],
  rows: rows.map((r) => [r.label, r.done, r.hoursSold, r.hoursTaken, r.efficiencyPct ?? "", r.waitHours ?? ""]),
});

export const baysCsv = (rows = []) => ({
  headers: ["Bay", "Kind", "Jobs done", "Hours sold", "Hours taken", "Efficiency %"],
  rows: rows.map((r) => [r.name, r.kind || "", r.jobsDone, r.hoursSold, r.hoursTaken, r.efficiencyPct ?? ""]),
});

export const customersCsv = (rows = []) => ({
  headers: ["Customer", "Jobs", "Estimated", "Invoiced", "Average repair order", "Repeat customer", "First visit", "Last visit"],
  rows: rows.map((r) => [r.name, r.jobs, r.estimated, r.invoiced, r.avgInvoice ?? "", r.repeat ? "Yes" : "", r.first || "", r.last || ""]),
});

export const topVisitedCsv = (rows = []) => ({
  headers: ["Plate", "Make", "Model", "Customer", "Visits", "Value", "Last visit"],
  rows: rows.map((r) => [r.plate, r.make, r.model, r.customer, r.jobs, r.value, r.lastVisit || ""]),
});

export const registrationExpiringCsv = (rows = []) => ({
  headers: ["Plate", "Customer", "Expires", "Days left", "State"],
  rows: rows.map((r) => [r.plate, r.customer || "", r.day, r.daysLeft, r.state]),
});

export const policyExpiringCsv = (rows = []) => ({
  headers: ["Plate", "Customer", "Insurer", "Expires", "Days left", "State"],
  rows: rows.map((r) => [r.plate, r.customer || "", r.insurer || "", r.day, r.daysLeft, r.state]),
});

export const serviceDueCsv = (rows = []) => ({
  headers: ["Plate", "Customer", "Due day", "Due odometer", "Current odometer", "Overdue"],
  rows: rows.map((r) => [r.plate, r.customer || "", r.dueDay || "", r.dueOdometer ?? "", r.odometer ?? "", r.overdue ? "Yes" : ""]),
});

export const insurersCsv = (rows = []) => ({
  headers: ["Insurer", "Claims", "Claimed", "Approved", "Shortfall", "Rejected", "Rejected %", "Rejected value", "Excess", "Depreciation", "Outstanding", "Avg days to decide"],
  rows: rows.map((r) => [r.insurer, r.claims, r.claimed, r.approved, r.shortfall, r.rejected, r.rejectedPct ?? "", r.rejectedValue, r.excess, r.depreciation, r.outstanding, r.avgDaysToDecide ?? ""]),
});

export const jobRowsCsv = (rows = []) => ({
  headers: ["Job", "Plate", "Vehicle", "Customer", "Delivered", "Hours sold", "Hours taken", "On time", "Comeback", "Total"],
  rows: rows.map((r) => [r.jobNo, r.plate || "", r.vehicle || "", r.customer || "", r.deliveredAt || "", r.hoursSold, r.hoursTaken, r.onTime === null ? "" : r.onTime ? "Yes" : "No", r.comeback ? "Yes" : "", r.total]),
});
