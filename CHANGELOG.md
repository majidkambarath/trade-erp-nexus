# Changelog

## Unreleased — Zarvia AI

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
