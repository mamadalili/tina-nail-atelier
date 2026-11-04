# Booking panel refinement

The owner asks for a more professional booking section and smaller side margins. Existing approval to make routine design decisions and publish changes applies.

## Direction

Keep the atelier's gray, imperial green and burgundy identity. ENERGY 3 / RHYTHM 3 / MOTION 2 remains the page direction; the booking interaction itself stays calm.

- Replace the tall introductory sidebar and narrow form with a short section heading and one wide appointment panel. This gives the actual selection task the space.
- Considered keeping the sidebar, a modal booking flow, and an inline panel. Choose the inline panel: it uses the extra width and keeps dates accessible directly below the hero.
- At wide widths, arrange service, calendar and time selection in three readable columns. At intermediate widths, place service choices above calendar/time. On phones, use a single column with 10px outer gutters and 12px inner padding.
- Keep 44px minimum controls. Retain the native date fallback below 374px where a seven-day grid cannot fit comfortably.
- Use service cards with real treatment descriptions, a clearly selected green state, a calendar with a labeled today state, and four two-hour choices. Do not suggest live availability.
- A bottom review row repeats the selected service/day/time next to the continue action. The second step and WhatsApp review remain part of the same form.
- Preserve validation, Persian dates, Tehran time, expired-period checks, privacy consent and manual confirmation semantics. No dependencies or backend changes.

## Scope and verification

Modify Home booking markup, BookingForm presentation, JalaliCalendar labels and the existing stylesheet. Review mobile 390px and 360px, compact 320px, intermediate 820px and desktop 1440px. Exercise manicure and pedicure, month navigation, error handling, next/back, and message preparation without sending a real message. Run existing tests and the production build, then publish the verified source to main.
