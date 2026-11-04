# Editorial rebrand verification — revision 6

Checked on 2026-11-04, Asia/Tehran, using Node 24.11.0 and the repository's locked dependencies.

## Automated checks

- `npm run typecheck`: passed.
- `npm test`: 13 passed, 0 failed. Coverage includes Jalali leap/year boundaries, Tehran midnight, the 90-day window, mobile normalization, required consent/treatment, four two-hour periods, elapsed periods and origin validation.
- `npm run build`: passed, including the final control-border contrast adjustment. Standalone assets prepared successfully.
- `node scripts/smoke-preview.mjs http://127.0.0.1:18221`: passed against the production build. Home, privacy, health and robots returned 200; the new optimized hero returned WebP (24,796 bytes at width 640 / quality 85); foreign-origin POST returned 403; disabled registration returned 503 honestly.
- `git diff --check`: passed.
- Independent read-only review of the diff and new components: no actionable material findings.

## Browser checks

- Reviewed the actual hero at desktop, tablet and phone sizes. The manicure remains visible, the face is subdued, and the photograph blends into the gray canvas.
- No horizontal page overflow or clipped text was found at 320, 375, 390, 768 or 1440 CSS pixels.
- At 320px the calendar uses its native date selector. Visible calendar days measured 44.72 × 44px at 375px, 46.86 × 44px at 390px, and 49.06 × 44px at 768px.
- Mobile navigation opens, Escape closes it, and focus returns to the menu button.
- Verified manicure → gel → future Jalali day → 10–12 → contact → prepared WhatsApp request.
- Invalid contact submission originally left focus on the submit button. After correction, focus moves to the first invalid field (`name`), with a visible error summary and associated inline errors.
- Edited a prepared request, selected pedicure from the service index, and prepared a second request without re-entering contact information. The day and period persisted, and the irrelevant manicure treatment was removed from the summary.
- Verified green/burgundy/gray color selection, matte finish and short nail form.
- The floating mobile action originally duplicated the hero action. It is now hidden throughout the hero and appointment section and appears while browsing supporting sections.
- Repeated the successful appointment/edit/service-transfer flow on the production build. No browser console errors were observed. All entered contact data was synthetic; no WhatsApp link was opened and no message was sent.

## Color and assets

- Main text on canvas: 9.93:1.
- Muted text on canvas: 4.85:1.
- Light text on burgundy action: 9.26:1; on imperial green: 9.24:1.
- Contact secondary text on green: 7.03:1.
- Form-control border on its light surface: 3.29:1.
- Hero source WebP: 1122 × 1402, 98,740 bytes.
- Supporting still-life WebP: 1536 × 1024, 148,770 bytes, converted from the existing PNG without visual changes.
- The previous owner portrait and original supporting PNG are unchanged. The new hero is explicitly presented as conceptual imagery.

## Scope and limits

The deployed VPS/database and notification services were not configured or contacted. The local production preview exercised the existing WhatsApp-first mode and disabled-storage response. The rebrand does not alter storage, availability, idempotency or notification contracts.

Reduced-motion CSS was reviewed: nonessential animation and transitions are disabled and reveal content is shown. The browser's actual OS preference was no-preference; OS-level reduced-motion and strict 200% zoom emulation were not changed or separately automated. Browser screenshots and layout measurements cover the viewport sizes listed above.

Source changes are delivered on `codex/tina-editorial-rebrand` for review against `main`; this task does not change the project's VPS deployment model.

Delivery: [Pull request #1](https://github.com/mamadalili/tina-nail-atelier/pull/1). The application source commit is `144cfb6`; the subsequent commit records delivery documentation only.
