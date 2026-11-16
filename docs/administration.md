# Appointment administration

Public booking: `/tina-preview/`. Private calendar UI: `/tina-administrator/`. The URL is reachable publicly, but every guest-data read and management action requires a valid authenticated server session.

## Everyday use

Use **پنل مدیریت** in the public site header, select Tina or Sonia, and enter the password. Each account opens its own calendar. Both managers can select either calendar, then choose a Persian month and day. Occupied rows show guest details and edit/cancel controls. Free rows can be closed; closed rows can be reopened. Cancellation asks for confirmation, retains the original record and releases its time. Editing can change guest details, service, note, date or time; conflicts never silently overwrite another appointment. The guest phone link opens a call. No SMS or messenger notice is sent.

The calendar can inspect previous months. New/moved appointments and closures use the same Tehran time and 90-day window as public booking. Past guest details can be corrected without moving the appointment. On narrow screens the calendar and daily list stack; below 360px a native day selector replaces the grid. Use Logout on a shared device.

## Private data and upgrades

Both applications share `tina-booking-runtime/data/appointments.sqlite`, outside the public web root. The first upgrade from the former schema creates a consistent private SQLite snapshot with `VACUUM INTO`, then migrates within an immediate transaction. Every existing row, request key and reference is preserved. Active-slot uniqueness uses a partial unique index; cancelled records no longer occupy a slot. The source hash for original request retries remains unchanged, while successful retries return the current receipt. Cancelled retries return an explicit cancellation error.

Calendar changes use serialized transactions. Updates/cancellation require the current version to prevent one open tab overwriting another. Blocks and appointments cannot occupy the same active slot. History records changes without exposing them through the public API. The main archive rejects all data directories, database files and `.hash` files, so future source deployments do not replace guest storage or credentials.

## Staff sign-in and password changes

Run the loopback-only `scripts/setup-admin-password.php` form to prepare the shared password for Tina and Sonia. For a scripted setup, pass it on standard input to `php scripts/setup-admin-password.php --accounts`. Both routes write independently salted bcrypt hashes to the ignored private file `artifacts/admin-bootstrap.hash`. For a later rotation, move aside the previous local hash file before preparing a new one.

`python3 scripts/package-admin-bootstrap.py` packages the credential file alone. After building and packaging the application, add `--with-release` to produce a single private ZIP containing the application and the credentials. Extract it in the cPanel account's **Home** directory, one level above `public_html`. On the first panel request the server imports both hashes in one transaction and consumes the file. Changing the password invalidates existing sessions. Re-extracting a previously applied archive cannot undo a later password change. Legacy single-hash bootstraps can only initialize Tina's original account.

Authentication state is stored separately in private `data/admin.sqlite`. [PHP password verification](https://www.php.net/manual/en/function.password-verify.php) checks the stored hash. Login attempts are throttled by keyed client address and a global window. [Server sessions](https://www.php.net/manual/en/book.session.php) rotate at login, expire after one idle hour or eight total hours, and use Secure, HttpOnly, SameSite=Strict cookies scoped to `/tina-administrator/`. All POST requests require the exact HTTPS origin, JSON and a session CSRF token. The only HTTP exception is the loopback development PHP server. No customer record, password, hash or token belongs in application logs.

## Build and checks

`node scripts/build-shared-host.mjs` exports both Next.js/React applications in separate staging trees, includes their PHP entry points and private runtime source, and leaves the main Node/PostgreSQL runtime intact. `python scripts/package-shared-host.py` packages only the two named public folders plus private source. It uses fresh ZIP timestamps to prevent stale static-file caches. The standard source archive excludes credentials.

Tests: `shared-host-admin.php` covers migration/backup, edits, cancelled retries, versions, blocking and booking-versus-close races; `shared-host-auth.php` covers closed bootstrap, password verification and throttling; `shared-host-admin-http.ts` starts an isolated local PHP server and checks authentication, session rotation/cookies, CSRF/origin, public availability and all management operations. `admin-calendar.test.ts` covers daily states, month/leap changes and stale/unknown result recovery. `scripts/preview-admin.mjs` prepares synthetic local UI fixtures only; its test credential and data must never be deployed. No synthetic guest needs to occupy the production calendar.

Before publishing: run the complete test suite/typecheck, build both exports, back up the current preview in private storage, extract the release and provision the staff credentials from the private account home. Verify unauthenticated month requests return401 and public availability reveals only occupied slot IDs. Inspect the actual UI at phone and desktop widths. Migration from shared-host SQLite to a future PostgreSQL server must preserve all active appointments and closed slots before switching traffic.
