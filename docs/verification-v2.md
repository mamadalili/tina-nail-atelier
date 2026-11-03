# Cinematic revision verification, 2026-11-03

Scope: the second local edition of Tina's nail atelier. This supersedes the visual observations in `verification.md`; that file records the first edition. No public deployment or external message was performed.

## Owner's changes

- The Home H1 renders only «تینا»; the separate surname line is removed. The full business name remains in factual metadata and the footer.
- A new identity-referenced, charcoal studio portrait replaces the first hero asset. Silver rim lighting and selective burgundy nails set the art direction.
- Both personal photographs in the lower introduction are removed from the page and public assets. Reference originals and the former generated hero are retained privately under `artifacts/reference-photos/`; the first source ZIP is also retained.
- The page now renders two relevant images: the cinematic hero and the captioned nail colour study. Both loaded with nonzero natural dimensions in the production browser.
- Services, colour selection, personal introduction, booking and contact received coordinated typography, spacing, surfaces and mobile layouts. The colour studio adds actual gloss/matte and almond/square/short controls.

## Command evidence

- PASS `npm test`: 9 tests, 0 failures, after the implementation and form-focus changes.
- PASS `npm run typecheck`: Prisma generation and TypeScript completed without errors.
- PASS `npm run build`: Next compiled, typechecked, generated six route outputs and prepared the standalone assets.
- PASS `node scripts/smoke-preview.mjs http://127.0.0.1:18221`: Home, privacy, health and robots returned 200; the new hero returned actual WebP, 53,990 bytes at width 640 / quality 85. Foreign Origin returned 403; disabled online registration returned 503.

## Browser evidence

- The new H1, portrait path and two-image page were checked on the production server at port 18221. The introduction contains zero image nodes.
- At viewport widths 320, 375, 390, 768, 1024 and 1280, document width stayed within the viewport. Phone and intermediate layouts reflowed without horizontal document scrolling.
- Colour title, selected control state, CSS lacquer colour and rendered nail shape were checked after changing colours, finish and shape. Production mocha/short and restored burgundy/almond were verified too.
- Mobile menu: Enter opens and focuses the first navigation link; Escape closes and restores focus to the menu disclosure.
- A local request using Persian-digit phone input reached the prepared-message screen. The result heading received focus at 24px from the viewport top; Tab reached its WhatsApp action. Editing restored focus to the contact-stage heading at the same visible position. No WhatsApp link was opened and no message was sent.
- Reduced motion: the portrait computed `transform: none` and reveals computed a zero-second transition. Temporary media and viewport overrides were used only for QA and screenshots and reset afterward.
- Contact recipients remain `tel:+989353155852`, `sms:+989353155852` and `https://wa.me/989353155852`, inspected without initiating contact.

An independent read-only review identified selected-day hover contrast and form-stage focus/scroll issues. Both were fixed. The selected hover state was verified as white text on `#581529`; step and result focus were observed in the browser.

## Contrast and scoped design gate

Computed using the antislop-human contrast checker:

| Pair | Ratio |
| --- | ---: |
| Ink `#211d1e` / paper `#f4f0ec` | 14.71:1 |
| Muted `#665e5b` / paper | 5.58:1 |
| Rose `#d6a3b0` / night `#121112` | 8.72:1 |
| Hero copy `#d2c5c6` / night | 11.25:1 |
| White / CTA `#7d2036` | 9.85:1 |
| White / selected hover `#581529` | 13.51:1 |
| Muted / colour section `#e5d9d2` | 4.58:1 |
| Contact note `#e0bcc6` / contact `#671d30` | 6.78:1 |

PASS for these text pairings; this is not a full WCAG audit or a measured performance score. Decorative lettering and material highlights do not carry essential information.

Scoped antislop/UI checks: PASS for responsive overflow, real actions and recipients, explicit labels and selected states, keyboard menu and form focus, short purposeful motion with reduced-motion support, honest illustrative image captions, no invented prices/statistics/reviews, and verified production output. The single translucent header has a navigation role; the remaining surfaces are solid. The colour studio uses gradients specifically for lacquer material and reflections. Motion is limited to entry, reveal, interaction feedback and subtle mouse depth; there is no perpetual decorative loop. Layout and motion reasons are recorded in `DESIGN.md`.

## Local visual evidence

Versioned screenshots under `artifacts/`: `home-desktop-v2.png`, `home-mobile-v2.png`, `colour-studio-v2.png`, `about-booking-v2.png`, `contact-v2.png`. First-edition screenshots and the first source ZIP remain unchanged. The screenshot backend could not capture the full-height page in one image; individual section captures were used instead.

## Unchanged publication limits

PostgreSQL/Redis, Telegram delivery, Google Calendar, Faraz SMS, an administration interface and VPS/SSL deployment were not tested or activated by this visual revision. Current default behaviour prepares a preferred-day request for the visitor to send in WhatsApp; it does not claim a confirmed appointment. See README for the deployment stages.
