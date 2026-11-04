# Booking panel implementation plan

**Goal:** Give the appointment task a wider, deliberate responsive layout.

**Architecture:** Keep existing client state, validation and server integration. Recompose the JSX and edit the stylesheet's original booking rules and breakpoint rules in place.

**Tech stack:** Existing Next.js, React and TypeScript. No new packages.

**Spec:** `docs/superpowers/specs/2026-11-04-booking-panel-design.md`.

## Work

- [x] Recompose the Home booking intro as a compact heading with phone fallback.
- [x] Lay out service, date and time sections; add a live selection recap and retain the existing two-step flow.
- [x] Refine calendar navigation, current-day key, selected state and responsive spacing.
- [x] Check phone, compact phone, intermediate and desktop widths; verify keyboard, errors and next/back with no external submission.
- [x] Run existing tests, production build and diff check.
- [x] Restart the local preview and record final browser evidence.
- [ ] Push the verified refinement to main.

## Review focus

- A phone must retain usable day targets and have no horizontal overflow.
- Changing service must still clear the manicure type for pedicure.
- An incomplete or expired selection must not advance.
- Returning from contact details must retain the selection.
- Displayed slots remain requests, not claims of confirmed availability.

No new unit tests for presentation-only rearrangement; existing model tests cover the preserved business rules, and the browser verifies the new layout and flow.
