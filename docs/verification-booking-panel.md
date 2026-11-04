# Booking panel verification, 4 November 2026

## Scope

Presentation refinement of the existing appointment request form. Validation, business rules, dates, durations and server integration are unchanged. The new selection recap derives its content from the existing form state and only displays a time that is still upcoming.

## Commands

- `npm test`: 13 passed, 0 failed. Covers Jalali leap years, Tehran midnight, the 90-day limit, consent, Persian phone normalization, required manicure treatment, pedicure cleanup, four two-hour windows and expired windows.
- `npm run build`: passed, including TypeScript and standalone asset preparation.
- `git diff --check`: passed.
- Independent read-only code review: no material issues found.

## Responsive measurements

Widths are viewport CSS pixels. Client width is 15px smaller due to the desktop browser scrollbar.

| Viewport | Outer gutter per side | Layout | Day control | Horizontal overflow |
| --- | --- | --- | --- | --- |
| 320 | 10px | Single column, native date selector | Native selector | None |
| 360 | 10px | Single column, native date selector | Native selector | None |
| 390 | 10px | Single column | 47 × 44px | None |
| 820 | 32px | Services above date/time columns | 52.16 × 44px | None |
| 1440 | 32px | Service/date/time columns | 75.58 × 44px | None |

No form label or button crossed the client viewport boundary in these measurements. Temporary viewport overrides were reset after inspection.

## Interaction checks

- Incomplete selection displays actionable errors, stays on step one and focuses the invalid treatment input.
- Manicure treatment selection, next/previous month and selection of 14 Aban 1405 work.
- RTL calendar keyboard navigation: ArrowLeft moves focus from 14 to 15 Aban.
- Selecting 12–14 updates the recap; continuing opens contact details.
- Returning with “تغییر وقت” preserves service, treatment, date and time.
- Switching to pedicure removes the manicure controls and irrelevant treatment.
- Test contact details and consent prepare the WhatsApp review with the selected pedicure/date/time. No real message was sent and no external link was opened.
- Browser console: no errors observed during the flow.

## antislop delivery gate, scoped to this refinement

- Hard gate PASS: no fabricated availability, claims or assets; labels, error states, semantic fieldsets and native controls retained; no overflow in five measured widths; complete next/back/message preparation exercised.
- Purpose gate PASS: service cards distinguish selectable treatments; column rules separate consecutive decisions; green marks actual selection and burgundy the next action. No new decorative icons, glass, glow, animation loops or generic illustration.
- Liveliness PASS: page direction remains ENERGY 3 / RHYTHM 3 / MOTION 2. The booking panel has a clear task hierarchy; motion is restricted to brief existing selection feedback.
- Craftsmanship PASS: desktop, intermediate and mobile arrangements are distinct. State is preserved, manual-confirmation wording remains honest, visible focus remains available, and the production build passes.

Contrast measurements: green on selected soft green 8.10:1; secondary text on the form surface 5.45:1; CTA text on burgundy 9.26:1. Control boundaries on the form surface measure 3.29:1, above the 3:1 non-text minimum. Disabled dates are not represented as active choices.

Screenshots are kept in ignored local artifacts; they contain only the public interface and test selections.
