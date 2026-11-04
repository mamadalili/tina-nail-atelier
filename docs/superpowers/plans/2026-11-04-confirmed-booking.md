# Confirmed booking implementation plan

**Goal:** Reserve an empty slot in the backend and show a screenshot-friendly receipt without a WhatsApp redirect.

**Architecture:** PostgreSQL atomic slot constraint and idempotent creation; durable outbox; independent notification adapters; receipt rendered from server-confirmed data.

**Tech stack:** Existing Next.js/React/TypeScript/Prisma/PostgreSQL/Redis/BullMQ. No production dependency changes.

**Spec:** `docs/superpowers/specs/2026-11-04-confirmed-booking-design.md`.

## Tasks

- [x] Write failing tests for slot timestamps, receipts and notification payloads.
- [x] Add migration, booking service, idempotent POST and private availability response.
- [x] Implement IPPanel and WhatsApp manager adapters; preserve optional legacy Telegram events and dispatch only configured channels.
- [x] Replace frontend handoff with POST, taken-slot handling and a ticket receipt; add an explicitly gated visual preview.
- [x] Verify local PGlite/PostgreSQL transactions, browser flow/receipt/mobile, tests, TypeScript, build and source diff. Conventional PostgreSQL/Redis/provider execution remains a deployment check.
- [x] Record provider/runtime limitations and open local receipt preview.
- [x] Prepare verified source for main; publishing is verified by the Git push result.

## Review focus

Concurrent clients must not share a confirmed slot; a retried POST must not book twice; customer WhatsApp links must be absent; network failure must not invent a receipt; queued messages must not be represented as delivered; the ticket must not expose a public path to guest details.
