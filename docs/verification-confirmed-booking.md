# Confirmed appointment and ticket verification

4 November 2026. Scope: automatic, on-site confirmation; ticket receipt; backend notifications prepared for provider setup.

## Results

- `RUN_DB_INTEGRATION=true npm test`: 20 passed, 0 failed, 0 skipped.
- `npm run typecheck`: passed.
- `npm run build`: passed, including the appointment POST, availability API and gated receipt preview.
- `git diff --check`: passed.
- Four migrations applied successfully to an isolated local PGlite PostgreSQL socket runtime. Conventional production PostgreSQL remains a release-environment verification requirement.

## Database behavior

The integration test uses two different phone numbers attempting the same slot simultaneously. Exactly one appointment becomes confirmed; the other receives `SLOT_TAKEN`. It also verifies replay returns the original reference, changed payload with the same idempotency key is rejected, a late replay retrieves the existing receipt, there are exactly three pending notification events, and cancellation frees the slot.

Test data is removed by its explicitly generated idempotency keys. No production database was used.

## Browser flow

The actual Home flow selected manicure/gel, 14 Aban 1405, 12–14, and test contact details. POST returned 201; the same page rendered “وقتت رزرو شد.” and a server-created reference. No WhatsApp link remained inside the booking region. The date-only availability API then returned that period as taken and exposed no guest details.

The local record had status CONFIRMED and exactly three unsent outbox events. No provider accepted a message. This browser-test record and its events were removed after verification.

## Ticket and print

- On-site receipt contains the guest, service/treatment, Persian day, Tehran time, address and full unique reference.
- The separately gated preview is explicitly marked as a sample and does not insert a booking.
- 320px viewport: 305px client width and scroll width; ticket 281px wide, no horizontal overflow.
- 390px viewport: ticket is fully readable with phone-appropriate typography and cutout/perforation detail.
- Actual Home confirmation printed with browser PDF output: exactly one A5 page, 420 × 594.96pt. The first page was rendered and visually inspected. It contains only the ticket, with no blank homepage pages.
- `@media print` removes non-receipt layout instead of preserving invisible homepage heights. The named A5 page prevents the ticket from relying on a desktop screenshot.

## Review corrections

Independent read-only review found a potential blank-page print issue and stale WhatsApp confirmation copy. Both were corrected. Cancelled confirmation notifications now use `skippedAt`, preventing them being marked delivered or retried indefinitely. No further material reservation/idempotency/privacy issues were found in the reviewed diff.

## Notification limits

Provider request tests use local stub transports. They verify separate guest/manager SMS recipients and patterns, failure responses, the WhatsApp manager template and absence of implicit provider activation. Real Faraz credentials, approved patterns, WhatsApp credentials/template, Redis execution and actual delivery have not been tested. The owner explicitly confirmed that the SMS panel is not ready.

Only configured channels are dispatched; missing channels remain pending. The receipt never claims SMS delivery. Outbox persistence and replay were tested; no paid message or real calendar event was sent.

## antislop delivery gate

- Hard gate PASS within the changed flow: server-created confirmation only, no fake successful booking, semantic controls and actionable errors, no public receipt lookup, bounded mobile layout and working print action.
- Purpose gate PASS: perforation/cutouts identify a keepable ticket; monospace is limited to the real tracking reference; green indicates confirmation and burgundy distinguishes the date. No nonfunctional barcode or QR was added.
- Liveliness PASS: existing ENERGY 3 / RHYTHM 3 / MOTION 2 identity retained; the ticket is a distinct composition rather than another form card.
- Craftsmanship PASS: successful build/tests, real local transaction exercise, independent review fixes and inspected one-page print output. Missing production integrations are explicitly documented.
