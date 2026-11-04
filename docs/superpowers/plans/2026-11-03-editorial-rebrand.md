# Tina Editorial Rebrand Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the owner's light-gray, imperial-green and burgundy rebrand with a cinematic hand-led hero and consistent booking UX.

**Architecture:** Retain the Next.js App Router, Server Component hero and existing client booking/service/color components. Centralize colors in the existing stylesheet; retain the API and date model.

**Tech Stack:** Next.js 16.4.4, React 19.3.1, TypeScript, local fonts, Sharp asset compression, Node 24.11.

**Spec:** `docs/superpowers/specs/2026-11-03-editorial-rebrand-design.md`

## Global Constraints

- Persian RTL, local fonts, minimum 44px targets and reduced motion.
- Gray `#e9ebe8`, green `#164c3c`, burgundy `#75283e`.
- Two services; retain manicure type, Jalali date, Tehran time and four two-hour periods.
- Request confirmation remains explicit; no fake availability or fabricated evidence.
- No new frontend dependencies or changes to the VPS deployment architecture.

## Review Focus

- Phone and 200% zoom: usable navigation, crop, calendar and fixed action without overflow.
- Back/forward between form steps: all selections and contact input remain intact.
- Invalid input: clear errors; no false saved/confirmed state.
- Offline/server error: truthful WhatsApp route and recoverable input.
- Reduced motion and failed media: content and booking controls remain available.

### Task 1: Editorial identity and hero

**Files:** `src/features/home/CinematicHero.tsx`, `src/components/Header.tsx`, `src/app/atelier.css`, `public/images/tina-editorial-hands-v6.webp`, `DESIGN.md`, `docs/image-provenance.md`.

**Interfaces:** Preserve `CinematicHero()` and `Header()` and the existing anchor destinations.

- [x] Run baseline unit tests and inspect Next's bundled image/style docs.
- [x] Optimize the original generated campaign image; preserve the owner's original image.
- [x] Implement flat header, composed hero, shared brand tokens and responsive styles.
- [x] Inspect actual desktop and phone renderings, image loading and reduced motion.

### Task 2: Consistent service and appointment experience

**Files:** `src/app/page.tsx`, `src/features/booking/BookingForm.tsx`, `src/components/BookingFrame.tsx`, `src/features/colour/ColourStudy.tsx`, `src/app/atelier.css`.

**Interfaces:** Preserve booking component props and `select-service` event; do not change API contracts.

- [x] Replace decorative moving borders with a calm surface; expose current form step in text.
- [x] Apply brand treatment to calendar selections, form summary, services, color controls, contact and footer.
- [x] Keep appointment section directly after hero and primary action available on phones.
- [x] Exercise service transfer, all form steps, validation, editing and WhatsApp preparation locally.

### Task 3: Verification and delivery

**Files:** `scripts/smoke-preview.mjs`, `README.md`, `docs/verification-v6.md`.

- [x] Update the existing smoke check to exercise the new optimized hero.
- [x] Run `npm test`, `npm run typecheck`, `npm run build` on Node 24.11; expect exit 0.
- [x] Run production smoke checks; review 320/390/768/1440 layouts, keyboard, motion and privacy page.
- [x] Record evidence and limitations, obtain independent code review and address material findings.
- [x] Commit and push `codex/tina-editorial-rebrand`, open a reviewable PR.

Visual/copy changes use browser verification rather than new tests that merely assert implementation strings. Existing business-logic tests remain the regression suite.

Execution notes: the fixed phone action now appears only outside the hero and booking section; invalid submission focuses the first invalid contact field and exposes a visible error summary. Both were reproduced before correction and verified in browser afterwards. Production booking/edit/service-transfer was also verified. Strict 200% zoom and OS reduced-motion emulation remain documented verification limits.

Delivery: [Pull request #1](https://github.com/mamadalili/tina-nail-atelier/pull/1), open against `main`.
