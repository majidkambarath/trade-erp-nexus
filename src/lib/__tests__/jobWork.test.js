import { describe, expect, it } from "vitest";
import { emptyJob, jobBody, jobErrorText, jobToForm, receiveBody, receiveRows, setReceiveRow, validateJob, validateReceive } from "../jobWork";
import { buildJobWorkChallan } from "../../components/Inventory/jobWork/challan";

const job = {
  _id: "j1", jobWorkNo: "JWC-2026-0001", status: "SENT", date: "2026-10-18T00:00:00.000Z", returnBy: "2027-10-18T00:00:00.000Z",
  purpose: "Powder coating", vehicleNo: "MH12AB1234",
  jobWorker: { name: "Shine Powder Coaters", code: "V1", address: "Plot 4, MIDC", taxId: "27ABCDE1234F1Z5", phone: "+91 98200 00000" },
  lines: [{ _id: "L1", rawStockId: "raw", rawItemId: "KH-RAW", rawName: "Car keychain holder (raw)", qtySent: 10, unitValue: 50, finishedStockId: "fin", finishedName: "Car keychain holder", finishedPerRaw: 1 }],
  progress: { lines: [{ lineId: "L1", atWorker: 4, finished: 6 }] },
};

describe("job work forms", () => {
  it("validates a send: a job worker, and an item that comes back as a different item", () => {
    const f = { ...emptyJob("2026-10-18"), jobWorkerId: "v1", lines: [{ rawStockId: "raw", qtySent: "10", finishedStockId: "fin", finishedPerRaw: "1" }] };
    expect(validateJob(f)).toEqual({});
    expect(validateJob(emptyJob("2026-10-18"))).toMatchObject({ jobWorkerId: expect.any(String), lines: expect.any(String) });
    expect(validateJob({ ...f, lines: [{ ...f.lines[0], finishedStockId: "raw" }] })["lines.0.finishedStockId"]).toMatch(/different item/);
    expect(jobBody({ ...f, purpose: " Coating ", lines: [...f.lines, { rawStockId: "", qtySent: "", finishedStockId: "", finishedPerRaw: "1" }] })).toEqual({
      jobWorkerId: "v1", date: "2026-10-18", purpose: "Coating", vehicleNo: undefined, notes: undefined,
      lines: [{ rawStockId: "raw", finishedStockId: "fin", qtySent: 10, finishedPerRaw: 1 }],
    });
    expect(jobToForm(job).lines).toEqual([{ rawStockId: "raw", qtySent: "10", finishedStockId: "fin", finishedPerRaw: "1" }]);
  });

  it("receive: the parts used follow the finished quantity until typed, and never more than is out", () => {
    let [row] = receiveRows(job);
    expect(row.atWorker).toBe(4);
    row = setReceiveRow(row, { finishedQty: "3" });
    expect(row.rawConsumed).toBe("3");
    row = setReceiveRow(row, { rawConsumed: "2" });
    row = setReceiveRow(row, { finishedQty: "4" });
    expect(row.rawConsumed).toBe("2", "typed by the person: kept");
    expect(validateReceive([setReceiveRow(row, { rawReturned: "3" })])["rows.0"]).toMatch(/Only 4/);
    expect(validateReceive(receiveRows(job)).rows).toBe("Enter what came back");
    expect(receiveBody({ rows: [row], date: "2026-10-20", workerRef: " SPC/1 ", costs: [{ accountId: "coat", amount: "240", narration: "" }, { accountId: "", amount: "5" }] })).toEqual({
      date: "2026-10-20", workerRef: "SPC/1",
      lines: [{ lineId: "L1", finishedQty: 4, rawConsumed: 2, rawReturned: 0 }],
      costs: [{ accountId: "coat", amount: 240 }],
    });
    expect(jobErrorText({ code: "JOB_WORK_NOT_CANCELLABLE" })).toMatch(/Reverse that receipt/);
  });
});

describe("the challan", () => {
  const company = { companyName: "Brivox Production", addressLine1: "Pune", vatNumber: "27AAACB1234C1Z5" };
  it("India: a Rule 55 job-work delivery challan in triplicate, with both GSTINs, the value and the return-by day", () => {
    const { sheet, copies } = buildJobWorkChallan(job, company, { country: "IN", currency: "INR" });
    expect(sheet.title).toBe("Delivery challan - job work");
    expect(sheet.number).toEqual({ label: "Challan no.", value: "JWC-2026-0001" });
    expect(sheet.company.taxLabel).toBe("GSTIN");
    expect([sheet.party.taxLabel, sheet.party.taxId]).toEqual(["GSTIN", "27ABCDE1234F1Z5"]);
    expect(Object.fromEntries(sheet.meta)).toMatchObject({ Purpose: "Powder coating", "Value of goods": "INR 500.00", Vehicle: "MH12AB1234" });
    expect(sheet.notice).toMatch(/Section 143 of the CGST Act, 2017/);
    expect(sheet.notice).toMatch(/Rule 55/);
    expect(sheet.showPrices).toBe(false);
    expect(copies).toEqual(["Original for the job worker", "Duplicate for the transporter", "Triplicate for us"]);
    expect(sheet.lines[0]).toMatchObject({ code: "KH-RAW", qty: 10 });
    expect(sheet.lines[0].description).toMatch(/Returns as Car keychain holder/);
  });

  it("elsewhere: a subcontracting dispatch note, no Indian law on it", () => {
    const { sheet, copies } = buildJobWorkChallan({ ...job, returnBy: null }, company, { country: "AE", currency: "AED" });
    expect(sheet.title).toBe("Subcontracting dispatch note");
    expect(sheet.company.taxLabel).toBe("TRN");
    expect(sheet.notice).not.toMatch(/CGST/);
    expect(copies).toEqual(["Job worker copy", "Office copy"]);
  });
});
