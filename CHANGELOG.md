# Changelog

## 1.8.0.0 — 26 October 2026

The first industry vertical: Garage, a workshop module sold per organisation like the CRM. Board,
Job cards, Vehicles, Claims, Reports and Setup, reached from their own rail item - never offered to
an organisation that has not bought the module. Frontend 1.8.0.0.

### Added

- **Board** (`/garage/board`): counts, a health ring, a column per task every live job is currently
  held up by (waiting for approval, a named task, ready for collection, delivered but not invoiced),
  and a "My work" panel for a technician's own tasks with one-tap Start/Done.
- **Job cards**: the full register, and the job card itself - check-in (a body-diagram walk-around,
  what the customer had with them, photos, a signature), the 3 Cs (concern/cause/correction) per
  complaint, one estimate of parts/labour/sublet/consumable priced live from the item master, the
  customer's or insurer's decision (whole or in part, with how it was given), supplementary estimates
  once teardown finds more, tasks with Start/Done, raising the invoice, and the gate pass. A part
  short of stock is shown with its usual vendor and a **Raise purchase order** button that opens a
  real draft purchase order under Purchase > Orders. **Comeback**: opening a new job on a vehicle
  still under an earlier job's warranty offers to mark it against that job. A standard job from Setup
  fills the estimate and tasks in one tap.
- **Print**: Job card, Estimate and Gate pass each print and download as a PDF from inside the job
  card, on the same printed-sheet layout a delivery note already uses - no separate screen.
- **Vehicles**: the organisation's own master, found again by plate or chassis however either is
  typed; opening one shows its real service history (every job, newest first), when it is next due,
  total spend and past owners - the reason a workshop buys this in the first place. Make/model
  suggestions from what is already on file (a datalist, never a forced correction).
- **Claims**: the insurer side of an accident job - survey, the insurer's decision with the excess and
  depreciation, and the two invoices it raises.
- **Setup** (`/garage/setup`, `garage.manage`): the service menu (standard jobs) and bays, both as
  plain lists with an add/edit dialog.
- **Reports**: revenue by stream, hours taken by technician, and the workshop's own figures
  (turnaround, on-time rate, comeback rate, effective labour rate).

### Fixed

- **`RankTip`** (the shared `Dashborad/FlowCharts.jsx` tooltip, used by the Dashboard, the CRM and now
  Garage Reports) crashed when a caller passed no `describe` function; it now degrades to showing just
  the name.
- **`FormSelect`** (Stock Items) drew a required-field asterisk on every label regardless of whether
  the field actually was required; it now takes a `required` prop.
- Three `DateInput` fields across the garage screens (an insurance claim's accident date, a job card's
  promised date, a vehicle's registration expiry) were wired to receive the raw change EVENT instead
  of unwrapping its value, so the field silently never reached the form - found live, by typing a date
  and watching it not save.

## 1.7.0.0 — 26 October 2026

The balance sheet reads as a statement, the trial balance opens group-wise, and the reports that
list ledger accounts are all narrowed the same way and remember how. Backend 1.7.0.0.

### Added

- **Trial balance, group-wise.** It opens collapsed to its account groups - on a real set of books
  34 accounts read as 10 lines - and a group opens to the accounts under it. That is how a trial
  balance is read in Tally, and it is the difference between a report and a list of every ledger
  account. **Layout** switches back to account-wise.
- **Filters on the trial balance and the general ledger**: **Category**, **Group** (the payables,
  the receivables, the expenses), a **Rows** rule of *All accounts* / *With transactions in the
  period* / *With a closing balance*, and a search over the account, its code and its group. The
  last one matters more than it sounds: a customer who has paid in full has transactions and no
  balance, and on live books eight of thirteen receivable accounts were in exactly that state,
  taking a row each. A narrowed report says "Showing 4 of 34 accounts", recomputes its totals from
  what survived, and drops the balanced badge - a slice of a trial balance does not balance, and it
  must not claim to be out of balance either.
- **Saved views** on the trial balance, the general ledger and party balances: name a set of
  choices ("Payables only") and reopen it later, per person. The account statement deliberately has
  none - its subject and dates live in the address, which is already a shareable, reload-proof
  version of the same idea.
- **The balance sheet is a statement.** One vertical column in place of the old two: ASSETS with
  non-current and current sections and their subtotals, TOTAL ASSETS, then equity and liabilities,
  ruled subtotals and double-ruled totals, deductions in brackets rather than with a minus sign, and
  a header saying what it is, as at when, and in which currency - none of which was on the page.
  **Compare with** adds a column for a year or a month earlier; **Show each account** opens the
  groups. Clicking a line still opens its ledger, which the IFRS tab cannot do, and there is a CSV
  button where before this was the only tab on the screen with no export at all.
- **Money the owners took out is a named deduction** ("Less: Drawings") under the capital it
  reduces, instead of a negative line sitting among the positives.
- **The four reports remember their filters** while you visit another page, and share one filter
  row with the same control order, so a choice means the same thing wherever it is made.

### Fixed

- **Every report opened claiming it had changed.** The saved-view picker showed a "changed" pill and
  offered to save a view of the screen's own defaults, because `viewMatches` reads any truthy filter
  value as a change and the defaults were ordinary strings. "No filter" is `""` now, the value every
  filter control already uses, and the LAYOUT choice left the filters altogether - it hides no row,
  so it is not a filter.
- **The general ledger's Layout control contradicted the table under it**, reading "Groups only"
  while the accounts were drawn, because its default had no option of its own.
- **On a phone the figures were a screen and a half down.** The summary cards now come above the
  filter row, two controls share a phone row instead of one each, and two sentences of commentary
  wait for a wider screen. Desktop and tablet are unchanged.
- **The screenshot sweep had no stub for these reports**, so all four Statements tabs rendered
  nothing and `check:mobile` reported them ok. With the stubs in place it immediately caught the old
  balance sheet 502px wide on a 390px phone.

### Verified

- `lib/__tests__/trialBalance.test.js` (24 pure), `lib/__tests__/ledgerFilters.test.js` (13 pure),
  and new cases across `Reports/__tests__`. The report test files now clear the remembered filters
  between tests - they live in a tab-wide map, and one test was leaving the next looking at a
  narrowed report.
- Lint 0 errors, `audit:mobile` 0, and `check:mobile` clean at 390 / 820 / 1440 on
  `/financial-statements`, `/ledger-reports`, `/party-balances` and `/statement`.

## 1.6.0.1 — 24 October 2026

The statement of account reads any ledger account and groups a long one by month; a receipt can
leave an invoice out; and three screens no longer break on a record that is missing a field.
Backend 1.6.0.1.

### Added

- **Statement of account: a ledger account, not only a party.** "Statement of" now offers **Ledger
  account** beside Customer and Vendor - a bank, a cash box, a loan, VAT, an expense - with the
  picker filing every account under its own chart group and searching the account code as well as
  the name. The choice is only offered to somebody the server will answer (`accounts.view`,
  `reports.financial` or `finance.view`): a statement of any account is the general ledger by
  another name, and a typed `?partyType=Account` without those keys falls back to Customer instead
  of showing a door that would 403.
- **Group by month**, on by default: each month's debits, credits and the balance it closed on.
  A month's closing is the server's own running balance read off the last row, never a re-addition
  of the rows above it, so the month line and the row beside it cannot drift apart. The CSV exports
  what is on the screen, month subtotals and all, and now carries the narration column the page shows.
- **An invoice can be left out of a receipt or a payment.** The row's **X** takes it off this
  voucher - out of the grid, out of "oldest first" and out of the total below it - and it can be put
  back; the invoice itself stays open and untouched. Beside it, **Pay all** sets the amount to
  everything still listed, in the currency being paid in. Changing the party clears the list again.
- **Remove logo** on Settings → Company, beside Upload. Like every other change on that page it is
  applied on Save and can be undone first with "Keep the saved logo" or Discard.

### Fixed

- **One item with no name or no SKU took the whole stock screen down.** Typing a single character
  searched `item.itemName.toLowerCase()` on every row, and generating the next SKU sorted on
  `b.sku.localeCompare(...)`: either threw the moment such a row existed, and the page went to the
  error screen for the whole organisation. Both fields are required on the model, but
  `findOneAndUpdate` skips validators and rows written before they were required remain. Every field
  searched is now read the way `itemId` already was - a record missing one simply does not match -
  an item with no SKU is left out of the count-up rather than sorted, and a nameless row reads
  "UNNAMED ITEM".
- **Download gave every copy of a document in one file whatever the copy switch said.** Print has
  always followed that switch; the PDF now does too, so what is drawn, printed and downloaded cannot
  disagree.
- **A grouped picker read as empty although a value was set.** `SearchSelect` found the chosen option
  with a flat `find()`, so an option one level down inside a group (the statement's account picker)
  was never matched.
- The tax note's heading in the IFRS notes comes from the server, so it reads "Goods and services
  tax" for an Indian organisation; the literal is kept only for a server from before that.

## 1.6.0.0 — 23 October 2026

A screen for how documents are numbered, the answer to "why is there no invoice 41?", and a switch on
the invoice form that had been doing nothing for months. Backend 1.6.0.0.

### Added

- **Accounting setup -> Numbering**, a new tab with three views.
  **Voucher types** lists every kind of document grouped the way a person thinks about them - finance
  vouchers, sales and purchase, stock and production, CRM, and the ones the system writes itself - each
  showing the number it will produce. Editing one draws the number AS IT IS TYPED, including what a
  branch's will read, because a format is far easier to judge by reading one than by reading the fields
  that make it. A document that carries tax is marked as such and its re-use box is disabled with the
  reason, so the rule is visible rather than only enforced when you press Save. Choosing "never
  restarts" takes the year out of the number at the same moment and locks the box: the server refuses
  that combination, so the form does not let anybody walk into it.
  **Counters** shows where each counter stands, per branch and year. Read-only on purpose - winding one
  back by hand is the one way a number could reach two documents, and the register refuses it.
  **Deleted & gaps** is the answer to "why is there no invoice 41?": every number given out and then
  deleted, what happened to it (handed back, or retired for good) and the reason, and for one series
  whether its sequence is unbroken with each hole named.
- **A variant of a built-in type**, added from the same screen: "Petty cash payment" under Payment
  carries its own name, prefix and counter and posts exactly as its parent.
- Fiscal years keeps a one-line **Open Numbering** link where its read-only numbering table used to be,
  so anyone who looks for it there is sent to the real thing.

### Fixed

- **The Auto / Manual number switch on the sales invoice form did nothing.** It has been there since
  before the server started stripping a document number out of request bodies - rightly, a body must
  not choose a tax invoice's number - and nobody took the box away. A person could switch to Manual,
  type INV-500, save, and the invoice would be filed as SO-2026-0043 with no error and no notice.
  It is a real setting now: the switch and the editable box are ABSENT unless that document type is set
  to "Automatic, can be typed over" in Numbering, and what is typed actually reaches the server. Every
  type is automatic by default, so for a client who changes nothing the form simply loses a control
  that never worked. Never offered on an edit - an issued number identifies the document - and if the
  setting cannot be read it falls back to automatic, never to a box the server would refuse. The same
  rule now covers purchase invoices, both returns, quotations, delivery notes, trade orders and goods
  receipts, each reading its own type's setting.
- **A money cell announced the currency on every row.** Three grids built each cell's accessible name
  from its column HEADING, so when the heading gained the currency ("Debit" became "Debit (AED)") every
  cell's name silently became "Debit (AED), row 1" - and a screen reader repeated it down the whole
  journal, where the column header already says it once. Eight tests had been failing since. The
  heading and the accessible name are two jobs and are two fields now.

## 1.5.0.2 — 22 October 2026

A voucher can be copied into a new one, amounts and phone numbers are typed the way the
organisation's own country writes them, and a dialog no longer loses what was typed in it. Plus
corrections to what a document is called and to what a click on a row does. Backend 1.5.0.2.

### Added

- **Copy a voucher into a new one.** Every finance voucher list - journals, expenses, contra, debit
  and credit notes, receipts and payments - has a **Copy** action on the row. It opens a NEW, unsaved
  voucher carrying the old one's accounts, amounts and narration, with today's date and no number, so
  a recurring entry (the month's rent, the salaries, a coater's bill) is entered once and repeated in
  two taps. Nothing is written until Post is pressed: the copy is numbered and dated like any new
  voucher, and the original is not touched. It is therefore offered on vouchers Edit refuses - a
  cancelled one, or a cheque expense - because a copy only reads.
  What a copy deliberately leaves behind: the number, the status and the approvals; a receipt's
  invoice allocations and the invoice a credit note was set against (those settled the original's
  invoices, and this voucher is spread over what is open today); and the payment instrument - the
  cheque number, the transfer reference and its date, the card approval code - while the payment mode
  and the cash or bank account stay. That last one is not tidiness: the server refuses a cheque
  number already in the register as a duplicate. A foreign-currency receipt is copied in its own
  currency at its foreign amount, never the base equivalent at the old rate, and the rate is looked
  up again for today. A copy is the form filled in, not a server call.
- **An amount is typed with the organisation's own grouping.** `AmountInput` draws the grouping as
  the digits arrive - 20,000 in Dubai, **1,20,000 in India** - and reports the plain number, so a
  form that stores what it is handed needs no change. A native number input cannot hold a comma at
  all, which is why it is not one. Latin digits and a point for the decimal whatever the country, so
  a typed character cannot change meaning. Converted so far: the stock item form; the order line
  grid, the voucher grids and opening balances are still native number inputs.
- **A phone number is typed with its country's dialling code**, and stored as one compact
  `+971…` string. No backend change: it is a drop-in for a text field.
- **The company's own accounts at each bank** on the bank master: a count per bank that opens the
  chart accounts held there, and a way to add one (which needs `accounts.manage`, since a bank
  account is a chart account).

### Fixed

- **A dialog no longer loses what was typed in it.** Leaving a half-filled form - a rail link, the
  Back button, a reload - now asks first. Dirtiness is watched in `Modal` rather than snapshotted, so
  a dialog with nothing typed in it (an audit trail, a preview) stays as quiet as it always was, and
  no form had to grow a baseline of its own.
- **A document is titled as what it is, and "tax" follows the SELLER.** The buyer's registration used
  to decide, so the sales invoice page printed "SALES ORDER" for an unregistered customer on the one
  document that *is* the invoice, and the Orders tab printed "Tax invoice" on an order that had
  posted nothing. Now the sales invoice is a **Tax invoice** when the company has its own tax number
  and an **Invoice** when it has not; a purchase invoice follows the supplier's registration, since
  the seller there is the supplier; and an order sheet is always "Sales order" or "Purchase order".
  Both UAE and Indian law ask a registered supplier for a tax invoice whoever the buyer is, so this
  is also the law, not only the tidier reading.
- **A row action no longer opens the row as well.** `onRowClick` is the row, not what is in it: a
  click that lands on a button, a link, an input or a menu is left alone. Pressing Edit in the
  actions cell of the four finance voucher lists used to open the edit form *and* the row's view
  modal, stacked one over the other.
- **An invoice printed from a list row lost its header charges, its header discount and the
  round-off**, because the list rows did not carry the server's own figures. The four order lists now
  pass `charges` and `pricing` through, so a sheet printed from the list totals the same as one
  printed from the document.
- **The phone field's code box read "United" instead of "+971".** In a box that narrow the hint wins
  and the label collapses; the list inherited the control's width too, which would have clipped every
  country name in it. Found by looking at the screenshot - the sweep passed it, because nothing
  overflowed.

### Internal

- The mobile sweep opens the voucher copy dialog on the journal and expense screens: its title is far
  longer than the ordinary one ("New journal voucher, copied from JV-2026-0012") and that is what can
  overflow at 390px.

## 1.5.0.1 — 22 October 2026

A developer-console fix on top of 1.5.0.0. Backend unchanged (still 1.5.0.0).

### Fixed

- **An organisation's time zone could not be changed once it existed.** Only the New organisation form
  ever set it, and the detail page merely printed it, so an organisation made on the wrong clock — an
  Indian customer whose books were set to Asia/Dubai — stayed on it. The Company tab now has
  **Country, currency and time zone**: the country and the base currency are stated as the fixed facts
  they are (they decide the tax set and the ledger's currency), and the time zone is a picker that lists
  the organisation's own country's zones first, each with its offset and the clock there now. Save is
  dead until the zone really changes. The server already accepted the change and still refuses a zone
  west of UTC; what was missing was the field.

### Internal

- The version had drifted: 1.5.0.0 bumped `package.json` but left the service worker, `product.js` and
  the lockfile reading 1.4.0.0. All four now say the same thing.

## 1.5.0.0 — 21 October 2026

The CRM becomes something we can sell on its own, a salesperson can arrange a meeting and write to a
customer without leaving it, and an assistant answers questions about Zarvia from the product guide.
Backend 1.5.0.0.

### The CRM on its own

- **No ERP half to switch into** where no ERP module was bought: the workspace switcher is not drawn,
  and signing in lands on the CRM dashboard rather than an ERP dashboard of zeros.
- **Team** is a second tab under CRM Setup, because People lives in the ERP rail and the owner of a
  CRM-only organisation still has to add the colleagues who will use it.
- **Settings** hides Business rules, Invoice bank details and the tax-codes link from an organisation
  that makes no invoice; a typed `?tab=rules` falls back to Company.
- **Import a spreadsheet** of leads or of people: choose the file, match its columns, read the preview,
  then import. The preview is the server's own answer, and a file bigger than one request is sent in
  lots, one after another.
- **Files on a lead and on a deal**, reusing the attachment panel the documents already use.

### Arrange a meeting, and write to the customer

- **Arrange a meeting** beside Log a follow-up, on a lead and on a deal: a day, a time on the
  organisation's own clock, a length, where, the people, and a note. It warns about an overlap rather
  than refusing one, and says before you save when the organisation has not set its email up, so
  nothing would leave the building.
- **Connect your own Google account** in Settings - Security, beside your password and two-factor,
  and the meeting form then offers "Make a Google Meet link for me". The tick is shown only to somebody
  who has connected, so the form never promises a link it cannot make.
- **Write to the customer**: a template, the addresses we already hold offered as chips, a subject and
  a message, with the placeholders filled. It warns about a placeholder nothing can fill, and never
  replaces what you have typed without saying so.
- **Sent, recorded-only and failed never read the same.** With no mailbox set up the toast says the
  letter was recorded and NOT emailed, and the record says so for good.
- **Replies are not shown here**, and every screen says it: the customer's answer goes to your own
  mailbox.

### A bug worth recording

- **The To box seeded itself over an address somebody had already typed.** The guard has to live inside
  the state updater, not in the effect: the effect commits while the contact list is still arriving and
  its update lands afterwards, by which time the check it made is stale. Found by a test, not by a
  person losing an address.

### Zarvia AI

A panel that answers a person's questions about Zarvia, from the product guide, and can hand the
question to the Zarvia team. Opened from the bot button in the top bar on every screen, and hidden
where the organisation does not have the feature.

- **The question is sent with the screen they are on and the refusal they just hit.** The API already
  answers every refusal with a structured error code, so `src/lib/lastRefusal.js` keeps the last one -
  in memory only, one slot, cleared at sign-out, because a refusal names what somebody was doing. "Why
  did it say Posting is closed up to 31 Aug 2026" is then offered as a suggestion they can tap.
- **A link in an answer is checked against the app's own routes before it is drawn.** The server
  already refuses a path the documentation does not name; the browser checks again, from
  `config/navigation.js`, which is the same source the rail, the palette and the mobile sweep use. Two
  gates because a link is the one part of an answer somebody clicks without reading.
- **A thumbs-down is kept.** It is the list of help articles to write next.
- Drawn inside the shared `Modal` rather than a new overlay: that one already handles the device
  insets, the focus trap and the body scroll lock, and the mobile sweep already measures it.

## 1.4.0.0 — 21 October 2026

Three streams of work that had been sitting on branches since 17 October, plus the fixes from a security
review of the live deployment. Backend 1.4.0.0.

### Added

- **Production (Inventory → Production).** For a manufacturer: a **Board** the owner opens on, showing what is
  pending, in progress, late, due today or tomorrow and out with job workers; **Process orders** for a product
  made in several steps, each done in house by a named person or sent out; **Productions**, which move materials
  and expenses into a finished item's cost so its sale books the true cost of goods; **Job work**, which sends
  parts to an outside worker and prints the delivery challan (three copies and the Rule 55 notice in India, two
  elsewhere); saved **Routes** per product; and **Analysis** — lead time, on-time rate, yield, rejects and their
  reasons, per step and per worker. Sold as an opt-in feature: off unless an organisation is given it.
- **A CRM, as its own workspace.** A switcher in the header moves between the ERP and the CRM, each with its own
  rail. Leads, contacts (the same people as the party masters, sharing one id), a pipeline whose deals **move
  themselves** as quotations are sent and invoices approved, a follow-up worklist with a list and a drag-and-drop
  board, a calendar, a communications log, seven named reports, and a setup screen where the stages *are* the
  rules. Sold per organisation: not in the Standard or Trade-only plans.
- **Tax wording follows the organisation's country.** An Indian organisation reads GST and GSTIN, not VAT and
  TRN, down to the printed sheets; the UAE VAT return and e-invoicing are hidden outside the UAE.
- **The list platform, on the master lists.** Sorting, selection with a bulk bar, a column chooser, a density
  choice and saved views. All eight of the original hand-rolled screens — categories, items, stock detail, units,
  customers, vendors, staff, inventory — now use it. Saved views are kept per person in the browser until the
  server has a real store for them.
- **A notification bell**, backed by the new feed, with a live count.
- **A document screen's open record lives in the address**, so a quotation, delivery note, trade order, goods
  receipt or production can be linked to and survives a reload.
- **Quick-add pickers**: a master can be created from the picker that needed it, without leaving the form.
- **Console:** modules are sold per organisation as one switch each, with the optional features nested inside the
  module they belong to; choosing a country sets its time zone and usual currency.

### Security

Findings from a review of the live deployment on 21 October. See the backend changelog for the main one.

- **The customer's document page is no longer indexable.** `noindex` was set on the share API but not on the
  `/d/<token>` page the customer actually opens, so a link pasted anywhere a crawler reaches could be indexed
  with the document behind it. (Needs the matching header rule in the Render dashboard, which ignores this
  repository's `render.yaml`.)
- **`xlsx` moved to the fixed SheetJS build (0.20.3).** The version on npm has a prototype-pollution advisory
  with no fix published there, and it parses bank statements — the one file this app reads that arrives from
  outside the company, in the tab that holds the session.
- **`html2pdf.js` and `jspdf-autotable` removed.** Two critical advisories for packages that were imported
  nowhere. The production audit went from three vulnerabilities to one.
- **The access token must never reach browser storage**, now pinned by a test. It is held in memory on purpose,
  and the developer console's token — which is the higher-privilege one — is the exception that is documented
  rather than copied.

### Internal

- Node 22 pinned (`engines`, `.nvmrc`) and GitHub CI workflows added.
- An experiment that routed the API through this site to hide the backend's address was **reverted**: a
  static-site rewrite destroys the visitor's IP address, which every rate limit and audit row depends on.

## 1.3.0.1 — 13 October 2026

A phone fix on top of 1.3.0.0. Backend unchanged (still 1.3.0.0).

### Fixed

- **The entry form opened from an Add button was unusable on a phone.** Tapping New sales invoice (or purchase
  invoice, or either return) left the list's own header — title, description and a second **New ...** button —
  stacked above the form, and the form's header squeezed its title into a third of the screen beside **Back**,
  under four lines of keyboard shortcuts that no phone has keys for. The list header now stands down while a
  form or a document is open (Back brings it straight back), the form header stacks, Save runs the full width,
  and the shortcut line shows only where there is a keyboard.

- **"Please fix the highlighted fields" highlighted nothing on a phone.** Below md each line is a card, and the
  card read each line's error under the wrong key, so every line-level message — choose an item, enter a
  quantity, enter a price — was invisible. The messages show, and the cursor now lands in the field that was
  complained about, as it does on a wide screen.

- **The document number field no longer gets crushed** by the Auto / Manual toggle beside it at 390px and
  below: the toggle wraps underneath and the number keeps its width.

- **The invoice form said "Create sales order" and "Save SO".** Those pages became the invoice pages on
  12 October; the form now says invoice, and the number is labelled "Invoice no.", so it no longer reads as the
  separate Sales order screen next to it.

### Internal

- `npm run check:mobile` never opened the form behind an Add button — which is why none of the above was
  caught. All six order forms now have `form` and `form-add-line` steps. A page's own figures table, pinned
  first column and all, no longer reads as a bleed in a deep step (that rule is for dialogs, where there is
  nowhere to scroll to).

## 1.3.0.0 — 13 October 2026

Released alongside backend 1.3.0.0, which sells modules per organisation.

### Added

- **Choosing what a customer buys is one tick per module**, in the developer console. The plan sets the ticks;
  untick what they are not getting. A module left as the plan has it stores nothing, so changing their plan
  later still reaches it — and ticking "all of it" where the plan already gives all of it is therefore not an
  override either. Under each name sits the quieter answer: "as the plan has it", or **Follow the plan** once
  it has been changed.

  Selling part of a module — Reports without the financial statements — is behind **Choose what they can do**,
  out of the way until it is wanted. The actions no plan can take away are ticked and locked, because the
  server puts them back whatever is ticked. A part-sold module shows an indeterminate tick and reads "only
  view", and a pill says All / Part / Off at a glance.

- **It is on the New organisation form too**, shown straight away rather than behind a toggle: pick a plan, see
  what it gives, untick what this customer is not buying, and create them in one pass. A line above the list
  reads either "Everything the plan includes." or "Different from the plan: Finance."

- **"Not included in your plan" now covers whole modules.** A screen reached by a typed address or an old
  bookmark says so, instead of blaming the person's role for a door no administrator of theirs can open. The
  navigation needed no change: its tabs already hide what a person's permissions do not reach, and the server
  now caps those to what the organisation bought.

### Fixed

- **The console's Plan tab no longer throws away unsaved ticks.** It forgot its choices whenever the
  organisation was read again — it keyed that on the detail object's identity rather than on which organisation
  it was.

## 1.2.0.0 — 12 October 2026

Released alongside backend 1.2.0.0, which makes it safe to put two paying clients on one deployment.

### Added

- **A Developers screen in the developer console** (`/platform/developers`). The console had no way to add a
  second developer: `POST /platform/users` and the two-factor reset existed from the start but nothing called
  them, so one lost phone with two-factor on — or one forgotten password — shut the console for good, and with
  it every client's plan, subscription and support access.

  It lists who can open the console with their status, whether two-factor is on and when they last signed in;
  it adds one (with a suggested password shown exactly once, and the server's 12-character rule checked before
  sending), renames one, switches one off, and resets a colleague's two-factor behind a dialog that says what
  that means. Nothing is offered on your own row, which is the server's rule too.

### Fixed

- **The new console screen is in `check:mobile`.** Its page list is written by hand, so the screen would have
  gone unswept. The sweep then caught what a tablet would: the row buttons were 36px where a touch target is
  44. They are `h-11 lg:h-10` now, like the rest of the app.
- **Suggested passwords come from `crypto`, not `Math.random`.** `suggestPassword` already handed a password
  to a client's first administrator; since the Developers screen it also hands one to an account that can
  reach every organisation. A test pins the source, not just the shape. Raised as hardening by the security
  review of this release, which found nothing exploitable.
- **The e2e runs can no longer write to the live Cloudinary account.** They spawn the real server with the
  real `.env` and do not go through `utils/testSetup.js`, so a flow that stored a file would have put it among
  the clients' own documents. Nothing uploads one today — a trap closed before it was stepped in.
