# Portrait crop and booking order, 2026-11-03

Scope: the owner's tall-frame reference, photographic blur/light effects and moving the existing date selection directly below the hero. No booking business logic or external integration was changed.

- PASS final `npm run build`: compilation, TypeScript, six route outputs and standalone asset preparation completed with exit code 0.
- PASS production smoke on port 18221: Home/privacy/health/robots 200; optimized hero WebP 53,990 bytes at 640px/85; foreign Origin 403; disabled online persistence 503.
- PASS browser section order on production: hero, booking, services, colour, introduction, contact. Exactly one booking section remains.
- PASS frame proportions: 326 × 565 at desktop 1280, 299 × 518 at phone 390, 241 × 417 at phone 320; intermediate widths 768 and 1024 also fit. No horizontal document overflow was observed.
- PASS visual inspection of the desktop and mobile crop: the eye and manicure remain visible; masked peripheral backdrop blur, edge darkness and a silver reflection sit inside the rectangular frame. The original raster is unchanged. A mask-support fallback removes the blur layer where masking is unsupported. Decorative layers do not receive pointer input.
- PASS moved calendar interaction: manicure plus 13 Aban 1405 reached the contact stage with those selections preserved. Focus moved to the stage heading 24px below the viewport top. No personal details were submitted and no message was sent.
- PASS production console: no warning/error entries from the preview URL during this check.

Visual evidence: `artifacts/home-desktop-v3.png` and `artifacts/home-mobile-v3.png`. Temporary viewport overrides were reset. Previous screenshots and source archives are retained.

Scoped UI/antislop gate: photographic effects follow the owner's explicit reference and remain limited to the portrait; controls retain their labels, selection states and touch spacing; the mobile frame has its own layout; text remains outside the photograph; the existing reduced-motion rules disable nonessential animation. This record is not a full accessibility or performance audit. The deployment limitations in README remain unchanged.
