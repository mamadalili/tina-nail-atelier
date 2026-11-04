# Shared-host booking implementation plan

**Goal:** Enable real, automatically confirmed appointments and the existing final receipt at `/tina-preview/`, without any notifications.

**Architecture:** Keep the Next.js application and PostgreSQL runtime. Add a separately deployable PHP/PDO SQLite adapter for the temporary cPanel host, using the same availability/request/receipt contract. Database and implementation files live outside `public_html`; only a small JSON entry point is public. SQLite transactions and a unique day/period constraint protect Tina's shared calendar.

**Approaches:** A separate Node server would reuse the existing backend but is not available on this host. Browser-only persistence would not reserve slots across visitors. A PHP adapter uses this host's existing runtime and provides real persistence; this is the implementation choice for the user's requested temporary deployment.

**Constraints:** Native Jalali calendar; Tehran timezone; 90-day booking window; four two-hour slots from 10 to 18; one shared schedule for both services; manicure requires gel/extensions; guest consent required; no SMS or WhatsApp sent; preserve existing site at domain root. Preserve private guest data outside web root and Git. No public list or receipt lookup.

**Review focus:** concurrent requests for the same slot, changed idempotent payloads, invalid/past dates and started slots, private data in availability/errors, and request retries after lost responses.

- [x] Write PHP integration tests for confirmation, persistence/replay, cross-service collisions, invalid data/dates, rate limits and a multi-process race; verify failure before implementation.
- [x] Implement `deploy/shared-host/runtime/BookingStore.php`, calendar anchors generated from the existing Jalali library, and `deploy/shared-host/public/booking.php` with bounded same-origin JSON requests and private storage. Run PHP tests and endpoint tests.
- [x] Add a tested booking endpoint resolver to `src/features/booking/transport.ts`; connect `BookingForm.tsx` to it without changing the receipt UI. Add request timeouts and preserve retry keys.
- [x] Add a reproducible shared-host export builder, keeping preview adaptations in an isolated staging tree. Build and run the project tests/typecheck plus local PHP HTTP flow.
- [x] Back up the current preview and publish without guest storage. Verify public health, private file permissions, POST validation and selection/contact UI; validate confirmation, persistence/collision and receipt on isolated local storage.
- [x] Commit/push verified source and deployment evidence to `main`, open the live booking section and provide the public link.

Execution ruling: automated approval rejected a separate auxiliary public verification API. It was not uploaded. The final host checks use only the application endpoint without registering a synthetic live appointment; real writes and the complete receipt flow were verified against isolated local PHP storage. No public test reservation needs removal.

Verification: 23/23 TypeScript tests including PostgreSQL integration; PHP durable storage/rate/date tests and six-process race; local HTTP and form-to-receipt checks; webpack production export and TypeScript; fresh read-only review verified the error-message fix. ZIP timestamps were corrected after matching new on-disk HTML against stale server responses; the public HTML then returned the current source marker.
