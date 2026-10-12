# Changelog

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
- **The e2e runs can no longer write to the live Cloudinary account.** They spawn the real server with the
  real `.env` and do not go through `utils/testSetup.js`, so a flow that stored a file would have put it among
  the clients' own documents. Nothing uploads one today — a trap closed before it was stepped in.
