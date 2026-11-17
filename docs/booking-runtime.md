# Appointment runtime and notifications

## Storage and confirmation

Use PostgreSQL and apply migrations before enabling `BOOKING_ENABLED=true`. New appointments are confirmed atomically. A partial unique index on staff, Jalali day and period for confirmed rows protects each staff member’s schedule, independently of frontend availability. Slots are fixed nonoverlapping two-hour windows.

Migrations preserve old requests and backfill unique references. Existing duplicate confirmed slots must be resolved deliberately before the unique index can be created; the migration does not delete guest records. Historical pending requests are not silently confirmed.

Use a correctly configured HTTPS `SITE_URL` in production. PostgreSQL and Redis remain private in the existing Compose architecture. A guest can reopen a receipt with a same-origin POST to `/api/receipt` using both the reference and the original request UUID. Only these credentials and the save time stay in browser storage. Reopening reads the current appointment from the database, including cancellations and reschedules.

## SMS patterns

Server-only configuration:

| Variable | Purpose |
| --- | --- |
| `IPPANEL_API_KEY` | API access key from the SMS panel |
| `IPPANEL_FROM_NUMBER` | Assigned sender in E.164 format |
| `SMS_USER_PATTERN` | Approved guest confirmation pattern |
| `SMS_ADMIN_PATTERN` | Approved manager notification pattern |
| `ADMIN_PHONE` | Manager's Iranian mobile number |

Both patterns must accept `name`, `service`, `date`, `time`, `reference`. Each pattern sends to exactly one recipient. Guest and manager messages have independent events and retry states. The adapter does not add recipients to a phonebook.

Suggested guest wording for panel approval: “{name}، نوبت {service} شما در آتلیهٔ تینا برای {date}، ساعت {time} رزرو شد. کد پیگیری: {reference}”. Manager wording should identify the new appointment with the same variables.

Implementation uses the current [IPPanel pattern endpoint](https://ippanelcom.github.io/Edge-Document/docs/send/pattern/) and [API key authentication](https://ippanelcom.github.io/Edge-Document/docs/auth/). The actual Faraz account, assigned line and approved pattern identifiers must be verified before enabling delivery.

## Manager WhatsApp

Configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`, `WHATSAPP_ADMIN_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE`, and `ADMIN_PHONE`. The API version is explicitly configured, not guessed by the application.

The approved template body has six positional text variables, in this order: guest name, service/treatment, Persian day, two-hour period, reference, guest phone in E.164 format. A missing template or other required variable leaves this channel pending. This is a server-to-server manager notification, not a guest link.

Protocol source: [Meta's official text-template example](https://www.postman.com/meta/whatsapp-business-platform/request/o65u5m5/send-message-template-text).

## Worker behavior

Start `npm run worker` with database and Redis settings. Only configured channels are dispatched. Redis jobs carry the outbox event ID; guest data remains in PostgreSQL. Accepted provider message IDs are recorded in PostgreSQL. Failures retry with backoff. Cancelled confirmations are retired using `skippedAt`, not marked sent.

Delivery is at least once: a crash after provider acceptance but before recording success can cause a duplicate notification. The same appointment reference makes these identifiable. No claim of exactly-once messaging or recipient delivery is made.
