# Tina nail atelier implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation. No parallel implementation agents.

**Goal:** Build Tina's luxury Persian website with identity-preserving editorial images and an honest Jalali appointment-request flow.

**Architecture:** Next.js App Router with TypeScript. Public content is server rendered. The calendar and booking form are small client components. PostgreSQL/Prisma stores pending requests and an outbox; Redis and a separate worker support external notifications at deployment. Docker Compose and Nginx prepare the agreed independent VPS path.

**Tech stack:** Next.js, React, TypeScript, Prisma, PostgreSQL, Redis/BullMQ, Nginx, self-hosted fonts.

**Spec:** `DESIGN.md`, derived from the owner's references, confirmed services and agreed stack.

## Global constraints

- Work only in this new project, outside the infrastructure repository and previous personal site.
- Persian RTL, native Jalali day selection, Asia/Tehran dates.
- Real phone/contact destinations. No invented prices, hours, availability, reviews or professional results.
- Secrets stay in environment configuration and never enter client code or logs.
- No publishing to an unrelated existing host. Local review now, independent VPS later.

## Review focus

- Persian and Arabic digits normalize correctly; Iranian mobiles validate.
- Jalali month rollover, leap-year Esfand and past-day rejection.
- Requests never claim a confirmed slot; double submissions share one request id.
- Disconnected database or integration shows a useful fallback without false success.
- Mobile reflow, keyboard calendar, label associations, reduced motion and correct photo loading.

## Tasks

- [x] Create Next.js project configuration, shared salon data and local fonts.
- [x] Produce and inspect the requested portrait; keep originals intact. Integrate editorial assets.
- [x] Build the Home hero, service selector, illustrative colour study, personal introduction and real contact links.
- [x] Build the Jalali request form and WhatsApp handoff. Validate phone/date and preserve form data between steps.
- [x] Add Prisma schema, transactional API/outbox and environment-driven notification worker. Add VPS deployment files and setup documentation.
- [x] Run typecheck, date/validation tests and production build. Review real desktop/mobile browser interactions and capture evidence.

## Evidence and decisions

- Nine domain/security tests pass, typecheck and production build pass, Prisma schema validates.
- The standalone production server passed the HTTP smoke check, including actual WebP delivery, cross-origin rejection and honest 503 behavior with persistence disabled.
- Decision: preferred-day requests rather than invented availability, because service durations and hours are not provided. Confirmed booking administration, Google Calendar and Faraz remain publication-phase work as documented in README.
- Independent read-only review found stale-day validation, mobile menu focus order, edits to already-saved requests and certificate build-context exposure. All were corrected. Midnight regression test and browser keyboard checks prove the local fixes; server-edit guards and ignore files were inspected.
- The Windows standalone package originally omitted Sharp's companion DLLs and silently returned the original PNG. Explicit native dependency tracing corrected this; the production route now returns a 69,546-byte WebP at width 640 and quality 85. The failing smoke check is retained as regression coverage.
- Next's normalized internal request origin differed from the visible loopback Host. The origin validator now accepts explicit loopback previews and requires a configured origin for a public host; two regression tests and the HTTP smoke check pass.
- Browser evidence and the scoped design gate: `docs/verification.md`.
