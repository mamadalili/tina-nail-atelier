# Administration verification, 2026-11-04

- Complete TypeScript suite: 26 passed, including the isolated PostgreSQL integration.
- PHP storage tests: migration preserves a legacy guest; a consistent private backup retains the old schema/data; edit/move/cancel/free/rebook, stale versions, cancelled retries, blocked availability and history pass.
- Concurrent PHP tests: one booking wins among six competing reservations; six mixed booking/blocking workers cannot produce both a block and an active appointment for the same slot.
- PHP authentication tests: no account means closed access; one-time bootstrap imports and is consumed; an existing password is never implicitly reset; wrong password and throttling are enforced.
- Isolated HTTP integration: anonymous private reads401; foreign-origin and invalid-CSRF writes403; login rotates the cookie; scoped HttpOnly/SameSite cookie; authenticated block/edit/version/cancel/reopen and logout pass. Synthetic storage is removed after the test.
- Both production exports compile and pass TypeScript. The main archive excludes guest data and hashes; the separate owner bootstrap archive is private and never committed.
- Local browser: log in using an existing synthetic test account; select 15Aban with two sample bookings; reschedule one to 16Aban; cancel it with confirmation; close its released hour; the local public availability endpoint returns that closed hour. No messages sent.
- Mobile: 390px has no horizontal overflow; 320px has no overflow and shows the native day selector. Browser warning/error logs were empty. Local screenshot `artifacts/tina-admin-local-mobile.png` contains only synthetic data.
- Read-only review found stale-edit recovery retained an obsolete version in an open dialog. Fixed: stale/cancelled outcomes close the dialog and refresh; unknown network outcomes do not claim failure and require inspecting the refreshed record. Regression tests passed.
- Password setup preserves same-origin form submission and CSRF validation. No real credential is used by automated tests.

## Public-host publication

Application source `e054214` provides public booking at `/tina-preview/` and the separate manager login at `/tina-administrator/`. Both pages were opened and checked. The public booking page remains available; manager information requires sign-in. No notification provider was enabled.

Authenticated edit/cancel/block end-to-end tests used isolated synthetic guest fixtures. No actual customer booking was changed or synthetic production guest created. Deployment diagnostics and credential-related setup records are excluded from this public report.
