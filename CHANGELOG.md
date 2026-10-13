# Changelog

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
