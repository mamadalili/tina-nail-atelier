# Phone-first appointments and glass footer, 2026-11-03

This local revision implements the owner's two-service catalog, manicure choices, two-hour windows, phone-first hero, smaller liquid-glass footer and appointment motion. Prior version archives remain untouched.

## Evidence

- PASS `npm test`: 13 tests. New rules were tested failing before implementation, then passing. They cover required gel/extensions, irrelevant subtype removal for pedicure, four exact two-hour windows, Tehran clock expiry and treatment/time preservation in the prepared message.
- PASS `npm run typecheck`, `npx prisma validate` and the final `npm run build` including TypeScript and standalone asset packaging.
- PASS production smoke at port 18221: Home/privacy/health/robots 200, actual hero WebP 53,990 bytes at 640px/85, foreign Origin 403, disabled persistence 503.
- PASS browser flow: missing treatment/day/time produce actionable errors; switching manicure to pedicure removes subtype controls and clears the subtype; switching back requires a new choice.
- PASS browser flow: manicure/extensions, 13 Aban and 14–16 reached the summary and encoded WhatsApp message with all fields intact. Pedicure reuses the valid day/time without sending a manicure subtype. No external link was opened and no message was sent.
- PASS all four windows are enabled for a future day. Today's already-started windows were disabled; no fake live availability indicator is displayed.
- PASS production flow: manicure/gel, 14 Aban and 12–14 select correctly in the final build.
- PASS layouts at 320, 375, 390, 768, 1024 and 1280: no horizontal document overflow. Time choices are 48px tall; phone native date selection and text inputs use 16px fonts to avoid automatic iOS input zoom.
- PASS at 390 × 844: name appears above the portrait, the image is 311 × 389 and the main appointment action ends at y=744, above the fixed bar. The face uses lighter grading and reduced peripheral blur; desktop retains its tall frame.
- PASS measured height changes: desktop footer 118 → 89px; phone footer about 243 → 182px; fixed phone booking action 62 → 47px. Both footer surfaces have real backdrop filters and readable solid text colours. Safe-area spacing is reserved.
- PASS motion: the form SVG boundary changes dash phase and tracks the card's changing height across steps; action sheen is present. Decorative layers have no pointer input. With reduced motion, the boundary is hidden, its animation is none and button sheen is hidden. Temporary emulation settings were reset.
- PASS keyboard access to footer links and focus on the result heading. Production console returned no warning/error entries for the preview URL.

## Independent review

A read-only reviewer found one expiry gap: a prepared WhatsApp request could be opened after its window started. The final anchor now validates against a fresh clock on normal and auxiliary activation, prevents expired navigation and returns to time selection. Saved-request follow-up links remain usable. The reviewer verified this fix with controlled fresh/expired/saved handler checks and independently reran 13 passing tests. No remaining finding was reported in that fix.

## Scoped design/accessibility checks

The antislop/UI/mobile/motion checks apply during implementation, following the owner's saved session choice. Material effects support the explicitly requested glass footer; slow rim motion and intermittent sheen guide attention to appointment controls. The mobile image and action were recomposed for the owner's predominantly phone audience. Existing form semantics, labels, readable errors and reduced-motion rules remain in place. No invented reviews, prices, availability or results were added.

Contrast checker: ink `#211d1e` on a conservative pink glass backing `#dac5cc` 10.20:1; paper `#f4f0ec` on dark glass stop `#352834` 12.31:1; secondary label `#d5c0c8` on that stop 8.11:1. These are scoped pair checks, not a full accessibility/performance audit.

Screenshots: `artifacts/home-mobile-v4.png`, `artifacts/booking-mobile-v4.png`, `artifacts/footer-mobile-v4.png`, `artifacts/home-desktop-v4.png`.

## Publication boundary

The form is still a preferred-slot request, confirmed through coordination with Tina. Selecting a window does not guarantee live availability. Real database execution, reservation collision control, administration, Telegram/Calendar/SMS delivery and VPS/SSL remain launch work. The new nullable `manicureType` migration is included and must be applied to an existing database before enabling this build. No live database or external messaging was exercised here.
