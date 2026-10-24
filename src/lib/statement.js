// Pure rules behind Reports -> Account statement.
//
// Two things that screen needs and the server deliberately does not do for it: the picker's list of every
// account in the chart, filed under its own group, and the grouping of a long statement into months. Both
// live here rather than in the component so they are tested without rendering anything, as lib/dayReports.js
// and lib/yearEnd.js are.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The month a row falls in is the ORGANISATION's calendar month, never UTC's: a document is stored at UTC
// midnight of its day, which reads as the previous evening in a zone ahead of UTC, so a January invoice
// would file itself under December. `dayOf` (utils/orgLocale, through format.toInputDate) is what every
// other screen uses to turn a stored moment into the organisation's own day; it is passed in so this file
// stays pure and can be tested with a fixed zone.
export const monthKeyOf = (date, dayOf) => String(dayOf?.(date) || "").slice(0, 7);

// "2026-10" -> "October 2026". An unparseable key is shown as it stands rather than as "undefined NaN".
export const monthLabel = (key) => {
  const [year, month] = String(key || "").split("-");
  const name = MONTH_NAMES[Number(month) - 1];
  return name && year ? `${name} ${year}` : String(key || "");
};

// What prints as Dr / Cr. The server sends `net` - debit minus credit - on every row, opening and closing
// of every statement, whether it is a party's or an account's. An OLDER server sends only `balance`, which
// on a party's statement is that same figure signed for the party (positive = a customer owes us, and a
// vendor's is the other way round), so the fallback simply unflips it. A new field is read with `??` here
// for the same reason every other screen reads one with `?.`: a server behind this build must still work.
export const netOf = ({ net, balance } = {}, partyType) =>
  (Number.isFinite(net) ? net : (partyType === "Vendor" ? -(Number(balance) || 0) : (Number(balance) || 0)));

// Two fils of slack, the same rounding the server's round2 does, so a month's own total never shows the
// 0.30000000000000004 that adding fractions in binary produces.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// A statement cut into months, each with its own debits, credits and the balance it ended on.
//
// The running balance stays the SERVER's: a month's closing is the last row's balance, read off, never a
// re-addition of the rows above it. So the month line and the row line beside it cannot drift apart, and
// an opening balance carried in from before the period is already inside the first row's figure.
export function groupByMonth(rows = [], dayOf, partyType) {
  const months = [];
  const byKey = new Map();
  for (const row of rows) {
    const key = monthKeyOf(row.date, dayOf);
    let month = byKey.get(key);
    if (!month) {
      month = { key, label: monthLabel(key), rows: [], debit: 0, credit: 0, closing: 0, closingNet: 0 };
      byKey.set(key, month);
      months.push(month);
    }
    month.rows.push(row);
    month.debit = round2(month.debit + (Number(row.debit) || 0));
    month.credit = round2(month.credit + (Number(row.credit) || 0));
    month.closing = Number(row.balance) || 0;
    month.closingNet = netOf(row, partyType);
  }
  return months;
}


// Every account in the chart, filed under its group, for the picker. react-select draws a heading per
// group; the account CODE rides along as the hint, because "Travelling" and "Travelling - staff" are told
// apart by it, and the search matches the hint as well as the name (kit.jsx `matches`).
//
// Accounts with no group of their own are gathered at the end rather than dropped: an account that cannot
// be chosen is an account whose history cannot be read.
export function accountOptions(accounts = []) {
  const groups = new Map();
  for (const a of accounts) {
    const name = a.path || a.groupName || "Other accounts";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({
      value: String(a._id),
      label: a.accountName,
      hint: a.accountCode,
      searchText: `${a.accountCode || ""} ${a.groupName || ""} ${a.path || ""}`,
    });
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, options]) => ({ label, options: options.sort((x, y) => x.label.localeCompare(y.label)) }));
}

// The account behind an id, for the heading and the CSV name, without flattening the groups twice.
export const findAccount = (accounts = [], id) => accounts.find((a) => String(a._id) === String(id)) || null;
