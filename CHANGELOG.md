# Changelog

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
