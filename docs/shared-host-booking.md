# Temporary shared-host booking

The cPanel preview can now use real server-side appointment storage without running Node.js. The frontend and receipt remain Next.js/React. `NEXT_PUBLIC_BOOKING_ADAPTER=shared-host` selects the separate PHP API; a normal Node deployment continues to use the existing PostgreSQL API and worker.

## Storage and request contract

`public_html/tina-preview/api/booking.php` loads the implementation from `tina-booking-runtime/` outside `public_html`. Guest data is stored at `tina-booking-runtime/data/appointments.sqlite`, created with private file permissions. Never upload this database into the public folder or commit it. The release packager rejects data directories and database files.

The PHP adapter uses [PDO SQLite](https://www.php.net/manual/en/ref.pdo-sqlite.php), parameterized queries, `BEGIN IMMEDIATE`, and a unique day/period constraint. Manicure and pedicure share one schedule. Durable request keys return the same receipt after a retry, including after the appointment's date; changing the payload for a used key is rejected. An opaque random reference is issued only after a successful commit. Guest receipt lookup requires the reference and original booking UUID together in a same-origin POST to `api/receipt.php`.

Validation checks consent, name, Iranian mobile formatting, hand or foot service, fixed two-hour periods, a valid Jalali day in the next 90 days, and the start time in Asia/Tehran. Calendar anchors for 1400–1500 are generated from the application's existing `jalaali-js` dependency. The API bounds JSON input, checks the exact HTTPS origin for writes, does not enable CORS, and limits each client address to eight new confirmations per hour. Client addresses are stored only as a keyed hash in rate-limit records. This is a basic abuse limit, not phone ownership verification.

Day availability returns the requested date and occupied periods. The booking form uses `api/options.php` for the bookable horizon, with staff, dates and period IDs and no guest details. Responses are not cached. This adapter has no notification provider calls and creates no notification events; SMS and WhatsApp are disabled. The receipt and privacy page say so.

## Build and install

1. Install project dependencies and run `node scripts/generate-host-calendar.mjs` if calendar anchors need regeneration.
2. Run `node scripts/build-shared-host.mjs`. It creates fresh staging/release directories beside the checkout and records their paths in ignored `artifacts/shared-host-release.json`. Main Next.js runtime configuration is unchanged.
3. Run `python scripts/package-shared-host.py`. The archive contains `public_html/tina-preview/`, `public_html/tina-administrator/` and the private runtime source. It deliberately excludes guest storage.
4. Back up the existing preview in private host storage. Upload the archive into the host home and extract it there. Do not extract it beneath `public_html`; it already contains that prefix. Existing private guest storage must remain in place on every update.
5. Verify HTTPS `/tina-preview/api/booking.php?action=health`, date availability, and the booking UI. The folder selects the host's existing `ea-php84` handler without changing PHP for the personal site at the domain root. PDO SQLite must be enabled. A missing runtime or database driver fails closed with HTTP 503.

The packager writes current ZIP timestamps. A fixed 1980 timestamp left the server serving stale cached HTML even though the new file was verified in File Manager; use a refreshed archive when replacing files. Do not overwrite guest storage while updating static assets.

The calendar refreshes its availability in the browser. The server checks staff working hours, leave, individual closures and existing bookings again when it saves a reservation or move. A guest can reopen the receipt in the same browser, move an upcoming appointment with the same artist, cancel it, or export a confirmed appointment as an iCalendar event. The receipt reference and original private request key authorize a change. The saved version prevents an old tab from overwriting a newer decision. A move keeps the original slot when the new one cannot be confirmed.

## Publishing from GitHub

The **Booking release** workflow tests the Node and PHP backends, builds both site exports and exercises the actual ZIP. It publishes the tested file as `tina-salon.zip` under the tag `booking-<full main commit>`. The package and live-site confirmation are separate jobs. The latter checks the full commit on the domain, both page versions, the booking service and the availability response.

On the cPanel account, add one **Cron Jobs** entry at `*/5 * * * *`. After extracting a release into Home, use this command.

```sh
/bin/sh "$HOME/tina-booking-runtime/tina-run-release.sh"
```

The release notes also provide a one-time setup command for an existing installation that does not yet contain the updater. It pins both initial scripts to the release commit and verifies their SHA-256. The launcher finds the system or CloudLinux Python runtime and uses the host's cURL TLS client through `TINA_RELEASE_CURL=1`. Certificate verification, per-redirect HTTPS host restrictions and response-size limits remain enforced. The last execution is recorded in owner-only `tina-booking-runtime/release-cron.log`, outside the public directory. The hosting account uses the public GitHub repository without sharing hosting credentials with GitHub.

The GitHub domain check tests the site before consulting GitHub for a superseding revision. That optional ref lookup uses the job token and cannot prevent an already healthy domain from being confirmed when the API quota is exhausted.

On each update, the installer compares the current main commit, the full commit in the package, the release asset digest, and the SHA-256 recorded by a successful main workflow job. A private lock serializes installations. Existing hashed assets stay available for open browser tabs. The live check verifies the deployed PHP APIs and storage code as well as the two page versions. A failed domain check restores the previous application files and an interrupted installation recovers on the next run. The installer never copies or restores booking databases, photos in SQLite, or account credentials. Keep the normal hosting backups for those records.

## Verification commands

- `npm test` runs the TypeScript suite; `RUN_DB_INTEGRATION=true` also exercises the isolated loopback PostgreSQL integration.
- `php -d extension=pdo_sqlite tests/shared-host-booking.php` exercises persistence, replay, cross-service collisions, validation, rate limits, leap dates, and six concurrent PHP processes.
- Run the release through a local PHP server, then `node node_modules/tsx/dist/cli.mjs tests/shared-host-http.ts` for the HTTP contract and final receipt schema. This writer accepts only loopback targets.

Use an isolated database for public-host verification. Never leave a synthetic confirmation occupying a real guest slot. The hosting owner can inspect/back up the private SQLite file through the authenticated hosting panel; there is no new public administration endpoint. Moving to the final PostgreSQL deployment requires deliberately migrating existing shared-host appointments before switching traffic, so confirmed slots are preserved.
