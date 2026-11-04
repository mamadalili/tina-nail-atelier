# Shared-host booking implementation plan

**Goal:** Enable real, automatically confirmed appointments and the existing final receipt at `/tina-preview/`, without any notifications.

**Architecture:** Keep the Next.js application and PostgreSQL runtime. Add a separately deployable PHP/PDO SQLite adapter for the temporary cPanel host, using the same availability/request/receipt contract. Database and implementation files live outside `public_html`; only a small JSON entry point is public. SQLite transactions and a unique day/period constraint protect Tina's shared calendar.

**Approaches:** A separate Node server would reuse the existing backend but is not available on this host. Browser-only persistence would not reserve slots across visitors. A PHP adapter uses this host's existing runtime and provides real persistence; this is the implementation choice for the user's requested temporary deployment.

**Constraints:** Native Jalali calendar; Tehran timezone; 90-day booking window; four two-hour slots from 10 to 18; one shared schedule for both services; manicure requires gel/extensions; guest consent required; no SMS or WhatsApp sent; preserve existing site at domain root. Preserve private guest data outside web root and Git. No public list or receipt lookup.

**Review focus:** concurrent requests for the same slot, changed idempotent payloads, invalid/past dates and started slots, private data in availability/errors, and request retries after lost responses.

- [ ] Write PHP integration tests for confirmation, persistence/replay, cross-service collisions, invalid data/dates, rate limits and a multi-process race; verify failure before implementation.
- [ ] Implement `deploy/shared-host/runtime/BookingStore.php`, calendar anchors generated from the existing Jalali library, and `deploy/shared-host/public/booking.php` with bounded same-origin JSON requests and private storage. Run PHP tests and endpoint tests.
- [ ] Add a tested booking endpoint resolver to `src/features/booking/transport.ts`; connect `BookingForm.tsx` to it without changing the receipt UI. Add request timeouts and preserve retry keys.
- [ ] Add a reproducible shared-host export builder, keeping preview adaptations in an isolated staging tree. Build and run the project tests/typecheck plus local PHP HTTP flow.
- [ ] Back up the current preview, upload public export and private runtime separately from guest storage, verify a live disposable booking, persistence/collision and receipt, then remove only that test record through authenticated hosting tools.
- [ ] Commit/push verified source and deployment evidence to `main`, open the live booking section and provide the public link.
