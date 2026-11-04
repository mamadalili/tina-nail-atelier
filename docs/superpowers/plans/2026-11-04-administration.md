# Tina appointment administration

**Goal:** Keep `/tina-preview/` public and provide a simple authenticated Persian calendar at `/tina-administrator/` for Tina to view, edit/reschedule, cancel and block time slots.

**Architecture:** Use the current shared-host PHP/SQLite runtime as the single calendar authority. Export a small separate Next.js/React administration app with the existing brand and local Persian font. Its same-origin PHP endpoint authenticates every private read/write; a private password hash is provisioned by the owner using a loopback-only setup page. No default password, registration endpoint, SMS or messenger integration.

**Approaches considered:** cPanel directory passwords would add a browser-level prompt and awkward logout; a separate booking service would duplicate current storage. App sessions on the existing private runtime give one simple password form and immediate calendar consistency.

**Design:** An operational phone-first calendar, ENERGY 1 / RHYTHM 1 / MOTION 1. Existing gray/green/burgundy and Vazirmatn; calendar and four chronological slots are the focal points. Green indicates selection, burgundy identifies confirmation/destructive intent through labelled controls; no illustrations, decorative metrics or ambient animation. On desktop the calendar sits beside the daily slots, on phones they stack. All actions have loading, failure and keyboard states.

**Data:** Migrate existing appointments atomically without dropping guest records. Keep cancelled appointments and original request keys, use a partial unique index for active slots, record a version and audit history. Rescheduling retains the reference, prevents collisions/blocked times and checks the submitted version. Cancellation releases the slot. Blocking a slot never cancels an existing appointment. Public availability combines active appointments and blocks without exposing guest details.

**Authentication:** Server sessions with Secure/HttpOnly/SameSite cookies scoped to the administrator path, idle/absolute expiry, rotation at login, CSRF checks and login throttling. Hash bootstrap stays outside public storage and Git and is consumed only if the account is unconfigured. The owner enters the new password themselves; the agent never enters or reads it. Admin endpoint remains locked if no password is configured.

**Review focus:** preserving legacy reservations, concurrent booking versus blocking/moving, stale edits, cancelled idempotent retries, unauthenticated/private responses, CSRF/origin checks, credential leaks and UTC/Tehran boundaries.

- [ ] Write failing migration/admin/auth tests, then implement transactions, versions, history and blocked slots; rerun the existing reservation/race tests.
- [ ] Build the loopback password setup page and ask the owner to enter the password while independent implementation continues.
- [ ] Implement authenticated API and a small React calendar/day list with edit/cancel/close/reopen controls; exercise the HTTP contract in isolated storage.
- [ ] Extend the staged exports and archive safeguards for both public folders, without including guest storage. Build, typecheck, run the complete test suite and review.
- [ ] Back up public assets and the existing private calendar, deploy verified source and private bootstrap, check locked/public responses and both UIs; have the owner perform production login with their password.
- [ ] Commit/push to `main`, preserve both public links and record exact verification and remaining limitations.
