import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A feature the organisation did not buy must leave nothing behind. The plan gate is TAB-level
// (config/navigation.js canSee), so every cross-module link survives it on its own - which is how a
// sales invoice row went on offering "Delivery note" to an organisation without delivery notes, and
// how the dashboard went on linking to /batches for one without batches.
//
// A static scan, not a render test, and deliberately so: a render test covers only the screens
// somebody remembered to write one for, which is the failure mode that produced that list. It follows
// the shape of src/styles/__tests__/no-legacy-yellow.test.js.
//
// It scans for a LINK INTO A FEATURE'S OWN SCREEN, and nothing else. An earlier draft also matched
// field names like `batchNumber`, which fired on sixteen files that merely DISPLAY a batch somebody
// else recorded - a scan that noisy gets allowlisted until it means nothing.
//
// WHAT IT CANNOT DO, so nobody over-trusts it:
//   - it is FILE level, not site level: a file that already names the key can grow a second ungated
//     link without this noticing;
//   - it cannot see a capability passed down as a prop, which is why the two sales list views are
//     allowed below - the page withholds the callback instead;
//   - MESSAGING IS NOT HERE AT ALL: it has no tab and no route, so there is no address to scan for.
//     Its gate is <Can permission="sales.send" feature="messaging"> and mayUse(), and the render
//     tests in components/PurchaseOrder/sales/__tests__ and components/send/__tests__ are what hold it.
//
// Fixing a failure means gating the link. If the mention is genuinely not an offer, add the file to
// `allow` WITH THE REASON - that entry is the review record.

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const sourceFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : sourceFiles(full);
    return /\.jsx?$/.test(e.name) ? [full] : [];
  });

const rel = (f) => path.relative(srcDir, f).split(path.sep).join("/");

// A file is clean when it NAMES the feature key, however it gates on it: featureOn("x"),
// mayUse(..., "x"), feature="x", feature: "x", or status.features.x.
const names = (src, key) =>
  src.includes(`"${key}"`) || src.includes(`'${key}'`) || src.includes(`features.${key}`) || src.includes(`features?.${key}`);

const API_CLIENT = "the API client itself: every caller of it is gated, and the server refuses anyway";
const ROUTE_TABLE = "the route table; Layout answers an out-of-plan address with NotInPlan";

const SITES = [
  {
    feature: "deliveryNotes",
    hit: /\/delivery-notes/,
    allow: {
      "lib/salesDocumentsApi.js": API_CLIENT,
      "router/index.jsx": ROUTE_TABLE,
      "components/PurchaseOrder/sales/TableView.jsx": "gated by the onDeliveryNote callback SalesOrderPage withholds",
      "components/PurchaseOrder/sales/GridView.jsx": "gated by the onDeliveryNote callback SalesOrderPage withholds",
    },
  },
  {
    feature: "quotations",
    hit: /\/quotations/,
    allow: { "lib/salesDocumentsApi.js": API_CLIENT, "router/index.jsx": ROUTE_TABLE },
  },
  {
    feature: "batches",
    hit: /\/batches|tab=expiry/,
    allow: { "lib/accountingApi.js": API_CLIENT, "router/index.jsx": ROUTE_TABLE },
  },
];

describe("a switched-off feature leaves nothing behind", () => {
  const files = sourceFiles(srcDir);

  for (const site of SITES) {
    it(`every link into ${site.feature} names the feature, or is allowed with a reason`, () => {
      const offenders = files
        .filter((f) => !site.allow[rel(f)])
        .filter((f) => {
          const src = fs.readFileSync(f, "utf8");
          return site.hit.test(src) && !names(src, site.feature);
        })
        .map(rel);
      expect(offenders).toEqual([]);
    });
  }

  // An allowlist naming a file nobody touches any more is a reason nobody has read in a long time.
  it("allows no file that has since been deleted or renamed", () => {
    const known = new Set(files.map(rel));
    const stale = SITES.flatMap((s) => Object.keys(s.allow)).filter((f) => !known.has(f));
    expect(stale).toEqual([]);
  });
});
