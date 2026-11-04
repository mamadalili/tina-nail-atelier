# Confirmed appointments and a private ticket receipt

## Approved intent

The owner requests an entirely on-site booking flow, automatic confirmation when the two-hour slot is empty, backend SMS to the guest and manager, and a backend WhatsApp notification to the manager. The Faraz SMS panel is not ready: prepare the integration without claiming messages are sent. No customer WhatsApp handoff remains in booking.

## Approach

Keep Next.js, PostgreSQL, Prisma and the existing Redis/BullMQ outbox. A modal or frontend-only confirmation would not durably reserve time. The chosen approach commits the confirmed appointment and three independent notification events in a database transaction. A PostgreSQL partial unique index on Jalali day and period for confirmed appointments prevents two users booking Tina at once, across both services. Notification failure must not undo a reservation.

## API and privacy

- Existing POST endpoint validates origin, content, idempotency key, fields and upcoming time. It returns a server-created reference and confirmed receipt only after commit.
- Repeating the same idempotent request returns its existing receipt. Another guest taking the slot returns 409; refresh slot availability without losing contact details.
- A date-only availability endpoint exposes taken periods, never guest data. The database constraint remains authoritative.
- No public receipt lookup by short reference. The guest's receipt is returned by POST and is not placed in URLs or localStorage.
- Unconfigured storage returns an honest unavailable state, never a fake successful reservation.

## Notifications

Three outbox channels: SMS_USER, SMS_ADMIN, WHATSAPP_ADMIN. Configure approved IPPanel/Faraz patterns and a WhatsApp Cloud API template through server-only environment variables. Unconfigured channels remain pending; the worker dispatches only configured channels. Provider acceptance is recorded separately from actual delivery; no UI assertion that a message arrived. Never log credentials, message bodies or guest details.

## Receipt design

An original atelier appointment pass: imperial-green masthead, guest/service, large Persian day, exact two-hour time, address and unique reference; a perforated seam joins a separate ticket stub. Burgundy is reserved for a small date/identity accent. No decorative barcode or QR that pretends to verify a booking. The mobile ticket should fit a practical screenshot and print on its own. A print/save-PDF control is a real action. Explicitly labeled preview mode demonstrates the layout without registering a fake guest.

ENERGY 3 / RHYTHM 3 / MOTION 2 stays the page identity; only brief confirmation feedback, removed for reduced motion.

## Verification

Test timezone conversion, receipt validation, idempotency and concurrency against an isolated PostgreSQL instance where available, provider request formatting and failure handling with local stub transports, disabled/unconfigured storage, selected-slot invalidation and responsive receipt rendering. No paid messages or real calendar events are sent during testing. Record any untested external integration explicitly.
