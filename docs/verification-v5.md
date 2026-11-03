# Owner image and softer hero, 2026-11-03

The current hero uses the exact newly supplied image rather than another generated portrait. Its private source copy is retained. The public WebP keeps 1122 × 1402 dimensions at quality 92 and measures 248,546 bytes. Optical treatment and the crop are live CSS; the source face, hand and pose are not regenerated.

## Evidence

- PASS final `npm run build`: compilation, TypeScript, route generation and standalone asset copying completed with exit code 0.
- PASS updated production smoke: Home/privacy/health/robots 200; the new hero returned actual WebP, 61,420 bytes at width 640 / quality 85; foreign Origin 403; disabled persistence 503.
- PASS production DOM uses `tina-owner-portrait-v5.webp`. The previous generated hero is archived privately and no current source or script points to its public path.
- PASS desktop portrait computes a 0px border and no box shadow. Signature, technical caption, hero watermark and decorative dividers are absent. The header has no enclosing panel border.
- PASS mobile visual inspection: feathered edges and corner masking remove the photographic rectangle's outline; gentle shade and peripheral soft focus soften the hand while the visible eye remains readable. The supplied image itself is unchanged apart from format conversion.
- PASS at 320, 375, 390, 768, 1024 and 1280: no horizontal document overflow. The portrait's ratio remains approximately 0.5773, matching the requested 310:537 tall crop.
- PASS production at 390 × 844: the main action ends at y=755 and the fixed booking bar starts at y=789. The image loads with nonzero natural dimensions. Description text sits over the dark, faded lower edge rather than the face.
- PASS production click-through: Enter opens the phone menu and focuses Services; Escape closes it; the main hero action reaches `#booking`; empty continuation reports the required manicure type, day and time. Booking business logic and catalog remain unchanged from revision 4.

Visual evidence: `artifacts/home-mobile-v5.png`, `artifacts/home-desktop-v5.png`. The supplied personal contact page was opened and visually inspected as the owner's composition reference. Its images, text and colours were not copied. Temporary viewport settings were reset.

## Scoped UI delivery gate

- R-03/C-4 PASS: the recorded phone, intermediate and desktop dimensions have no overflow; the primary phone action stays above the fixed bar.
- R-23/R-38 PASS: the owner explicitly supplied and selected this exact image; direct WebP conversion preserves its geometry and private original.
- R-25 PASS for changed composition: text stays outside the visible face and on the existing dark hero surface; its existing light-on-dark pairings are unchanged. Decorative optical layers carry no essential text.
- R-26/R-32 PASS: native hero anchors and observed keyboard menu behavior remain functional, as does the booking error path.
- R-35/R-40 PASS: the production build and HTTP checks ran; the high-priority image reserves its dimensions and the actual optimized WebP was measured.
- R-01/R-10/R-19/C-1 PASS: static edge masks, lighting and soft focus follow the owner's explicit photographic request; the header panel, portrait border and offset shadow are removed. Pointer parallax is removed, allowing a Server Component. Nonessential entrance motion continues to respect reduced motion. Appointment motion and the glass footer from revision 4 are retained.
- R-20/R-31/C-3 PASS: the owner's face and muted burgundy nails provide the identity; the written direction specifies a softer photographic hero rather than technical captioning. ENERGY 3 / RHYTHM 3 / MOTION 2 remain the project dials.

This is a scoped visual revision, not a new full accessibility/performance audit. The deployment/confirmation boundaries and tested booking rules in the revision-4 record remain unchanged. No external message was sent and no site was published by this task.
