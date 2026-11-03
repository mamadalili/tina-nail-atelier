# Verification, 2026-11-03

Scope: the local first version and production build of Tina's website, not a public VPS launch. Default booking mode prepares a real WhatsApp handoff. No external message was sent, no Calendar event created and no SMS sent during verification.

## Command evidence

- PASS `npm test`: 9 tests, 0 failures. Tehran midnight, leap Esfand, month/year rollover, allowed booking horizon, numeral normalization, form validation, WhatsApp recipient and origin rules.
- PASS `npm run typecheck`: Prisma generation and TypeScript with no errors.
- PASS `npm run build`: Next production build, six route outputs and standalone asset packaging.
- PASS `npx prisma validate`: schema valid.
- PASS `node scripts/smoke-preview.mjs http://127.0.0.1:18221`: Home, privacy, health and robots return 200; hero serves actual WebP (69,546 bytes at 640px / quality 85); foreign Origin returns 403; disabled server registration returns 503 without claiming success.
- PASS native Sharp dependency tracing: missing Windows DLLs identified and included; Linux native optional dependencies are also present in the lockfile.

## Browser interaction evidence

- PASS service index: manicure and pedicure open, their actions preselect the corresponding service in the booking form. Default nail panel and selection render correctly.
- PASS four colour controls: visible title and colour sample switch to pearl rose, mocha, ink and burgundy.
- PASS Jalali month navigation: next shows Azar 1405 and previous returns to Aban. Past-day buttons are disabled.
- PASS empty day: Continue shows a specific date error. Empty contact submission shows name, mobile and consent errors.
- PASS Persian-digit mobile input: valid submission creates a review screen and encoded WhatsApp URL for `989353155852`; the text preserves service, preferred date and period. No message was actually sent.
- PASS edit before WhatsApp handoff: returns to details; change day preserves selected service and values.
- PASS mobile menu: Enter opens and focuses the first link; Escape closes and restores focus to the disclosure.
- PASS contact destinations: `tel:+989353155852`, `sms:+989353155852`, `https://wa.me/989353155852`. Schemes and recipients inspected without starting calls or sending messages.
- PASS all four header section targets exist. About and Contact navigation showed the corresponding content. Privacy navigation opened the actual privacy page; its return action restored Home.
- PASS mobile sizes 320, 375 and 390; tablet 768; laptop 1024; default desktop 1280. No document overflow or off-screen content was observed. At 375, calendar day targets measure 46 by 44px; below 370, a native labelled day selector replaces the narrow grid.
- PASS reduced motion: hero and copy computed `animation-name: none`. Temporary viewport and media overrides were reset.
- PASS production console: no error or warning entries from the production URL during the recorded browser pass.
- PASS all four photographs loaded with nonzero natural dimensions. Hero is server-rendered and high-priority; lower images lazy-load with reserved dimensions.

Screenshots in the local `artifacts/` folder: `home-desktop.png`, `home-mobile.png`, `site-desktop-full.png`.

## Contrast evidence

Computed with the antislop-human contrast checker:

- PASS muted text `#655e5d` on paper `#f7f5f2`: 5.83:1.
- PASS burgundy text `#78182e` on paper: 9.80:1.
- PASS white on burgundy CTA: 10.67:1.
- PASS light body text `#d1c5c4` on booking black `#211d1e`: 9.92:1.
- PASS blush `#dfb8c0` on booking black: 9.34:1.
- PASS muted text on the colour section `#ebe5e2`: 5.08:1.
- PASS input boundary `#91837d` on `#fffdfa`: 3.60:1 against the non-text 3:1 threshold.
- PASS white selection icon on pearl rose: 3.46:1 against the non-text 3:1 threshold.
- PASS bottom-bar secondary text on burgundy: 7.94:1.

Inactive past-day controls are disabled, not low-contrast active text. The decorative portrait signature is a logotype, labelled aria-hidden because the owner is already identified by heading and image alt. No claim of a full WCAG conformance audit or measured Core Web Vitals is made.

## Scoped antislop delivery gate

Each status applies to the implemented local experience. Future service integrations are documented below rather than represented as working features.

- R-02 PASS: authored UI copy contains no em dash; source scan found none.
- R-03 PASS: the recorded phone/tablet/laptop checks show no horizontal overflow; native compact date selection handles the narrowest phone.
- R-17 PASS: no invented statistics, prices, durations or business hours are displayed.
- R-18 PASS: no testimonial or invented customer is displayed.
- R-23 PASS: owner explicitly supplied personal images, pose/design references and requested artistic portrait creation; identity assets trace to those references.
- R-24 PASS: every section target exists; privacy is a real route.
- R-25 PASS: scoped text, selection and field pairings were computed above; no full audit is claimed.
- R-26 PASS: service disclosure, colour selection, date selection, form progression and WhatsApp preparation were exercised; external call/SMS/message recipients inspected without sending.
- R-27 PASS: missing day, invalid contact details, pending submission, unavailable persistence and prepared/saved request states have explicit text and an available next action.
- R-28 PASS: no generic FAQ was added.
- R-32 PASS: menu focus, Escape restoration, native calendar/form controls and explicit focus rings are implemented; keyboard menu behavior was observed.
- R-33 PASS: application source/CSS was edited directly with patches; no source-rewriting script was introduced.
- R-34 PASS: one fixed editorial light theme with a dark booking section; no broken alternate theme control is exposed.
- R-35 PASS: production build, server HTTP smoke and actual browser click-through recorded above.
- R-36 PASS: no fabricated security, performance, customer or results claim appears; the WebP byte count was measured.
- R-37 PASS: explicit owner references and the Design Read in DESIGN.md preceded the visual implementation.
- R-38 PASS: services are owner-confirmed; generated manicure image is captioned as art rather than client work; unavailable rates and times are not invented.
- R-39 PASS: native named controls, labels, semantic landmarks, Persian language, text errors and reduced motion are present. Temporary test settings were cleared.
- R-40 PASS: image dimensions and responsive sizing reserve space; hero has high priority; no blocking external script is used; image optimization was verified on the actual standalone server.
- R-01 PASS: neutral editorial surfaces and one burgundy accent derive from the portrait; no default gradient background.
- R-04 PASS: the few icons denote actual phone, SMS, WhatsApp, date, expand, confirm or navigation actions.
- R-06 PASS: locally served Vazirmatn supports Persian readability; Cormorant supplies the editorial wordmark. Reasons in DESIGN.md.
- R-07 PASS: no grid or patterned technical backdrop was introduced.
- R-08 PASS: arrows denote scroll/progression; they are not applied to every action.
- R-09 PASS: no decorative badge or live-status dot is used.
- R-10 PASS: no glass stack is used; surfaces remain readable and solid.
- R-12 PASS: elevation is limited to the mobile menu, fixed booking bar and booking sheet; purpose is overlay/interaction hierarchy.
- R-13 PASS: no decorative glow is used.
- R-14 PASS: services use an editorial index; no uniform feature-card filler section.
- R-19 PASS: short hero introduction and state feedback serve hierarchy; no endless motion; reduced motion was observed.
- R-22 PASS: imagery is relevant to the owner and manicure; no generic illustration stands in for product content.
- Liveliness PASS: ENERGY 3 / RHYTHM 3 / MOTION 2 declared; portrait, service index, colour study, overlapping owner photos and appointment sheet have distinct compositions.
- C-1 PASS: major visual decisions have written reasons in DESIGN.md.
- C-2 PASS: implemented controls have observed actions or verified external destinations.
- C-3 PASS: sections follow artist introduction, service choice, colour preference, personal context, appointment and contact.
- C-4 PASS: recorded phone, intermediate and desktop layouts; keyboard disclosure; field errors; reduced-motion behavior.
- C-5 PASS: no unsupported evidence or testimonial.
- R-05 PASS: content-led editorial composition, not a default feature grid or invented social-proof layout.
- R-11 PASS: flat editorial imagery, modest field/button corners, circular swatches and the single nail shape have distinct roles.
- R-15 PASS: actions name booking, service choice, contacting or submitting the actual request.
- R-16 PASS: no AI marketing capability claims or empty superlatives.
- R-20 PASS: owner portrait, personal name and selective-colour manicure create the site's identity.
- R-21 PASS: fixed light editorial treatment follows the supplied fashion/portfolio direction; dark booking sheet separates the practical task.
- R-29 PASS: near-black and paper neutrals with burgundy accent; secondary colours appear only in the explicitly chosen nail palette.
- R-30 PASS: composition takes inspiration from the supplied references; no reference website's markup, identity or person was copied.
- R-31 PASS: palette, type, layout, spacing, imagery and motion purposes documented.

## Limits and next publication phase

No live PostgreSQL/Redis runtime is installed on this device, so database persistence, migrations on a real database, Telegram delivery, VPS Docker execution and certificate issuance were not exercised. Google Calendar, Faraz SMS and a protected administration/confirmation interface are not active in this first version. README distinguishes these future tasks from the working local site. No site was published and no GitHub repository was selected or modified.
