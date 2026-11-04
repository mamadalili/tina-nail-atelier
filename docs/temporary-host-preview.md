# Temporary preview, 2026-11-04

## Current release

Public preview: https://mrdalili.ir/tina-preview/

Sample receipt: https://mrdalili.ir/tina-preview/receipt-preview/

The temporary shared-host preview was rebuilt from application commit `d63a5eb50a3a93ea9c10c06d9ed91b982a408a60`. It contains the latest portrait, booking interface and ticket-style receipt. The source application on `main` retains its Node.js/PostgreSQL booking backend and notification outbox.

This public folder is a static Next.js export for design review. Real appointment registration, availability checks and SMS/WhatsApp delivery are disabled. The booking section says so and links to a clearly labelled sample receipt. It does not redirect a booking submission to WhatsApp or manufacture a confirmed appointment. General contact links remain available.

The current hosting panel does not expose Node.js, PostgreSQL or Redis controls. The full booking runtime needs separate server deployment and provider configuration; see `booking-runtime.md`. The Faraz SMS account is not yet configured. No notification was sent during publication.

The export was built in a separate staging copy, preserving the main application's runtime configuration. Preview-only adaptations are `output: export`, `basePath: /tina-preview`, trailing slashes, static Home/receipt/robots pages, disabled booking, prefixed public-image URLs and Home anchors, plus a sample-receipt link. The export build used `next build --webpack` and passed compilation and TypeScript checks.

The archive `tina-preview-public-20261104.zip` contains 78 public files exclusively beneath `tina-preview/`, with normal 0644 file permissions. It contains no environment file, database, source directory, dependency tree or private photo references. It was uploaded to private host storage and extracted into `public_html`, replacing only namespaced preview files. A backup of the previous preview, `tina-preview-before-20261104.zip`, was verified in private host storage before replacement.

Robots metadata and the folder's X-Robots-Tag are `noindex, nofollow`; directory listings are disabled. `preview-release.json` identifies the source revision and records `booking_live: false`. The HTML includes a `tina-preview-source` meta tag. No DNS or SSL settings were changed.

Verification:

- Local static export: current portrait loaded, booking-disabled notice and receipt link present; the receipt route rendered beneath the preview prefix.
- Public HTTPS Home: source meta tag is `d63a5eb`, the current WebP portrait loads, the disabled-booking notice and sample-receipt link are present, and robots metadata is `noindex, nofollow`.
- Public HTTPS receipt: the sample label, Persian date, service, two-hour period, address and sample reference render. At a 390px viewport the receipt has no horizontal overflow.
- The domain root still renders `خانه — محمدرضا دلیلی` after publication.

Receipt screenshot: `artifacts/tina-preview-receipt-live-20261104.png` (local verification artifact, not committed).

Rebuild this temporary export when the source changes. It does not follow GitHub or the local Node server automatically. This static folder remains a short-term design preview.

## Previous release, 2026-11-03 (superseded)

Public URL: https://mrdalili.ir/tina-preview/

The owner authorized publishing a temporary preview on the existing personal-site host. It is isolated under `public_html/tina-preview/`; the existing personal website remains at the domain root. The public root was checked afterward and still renders “خانه — محمدرضا دلیلی”.

This is a static Next export of revision 5 for shared hosting, not the final Node/PostgreSQL deployment. Main application runtime configuration is unchanged. The isolated build is in the sibling `tina-static-preview` directory; release files are in `tina-mobile-release/tina-preview`. A private host-home upload archive, `tina-preview-public-20261103.zip`, contains only 70 public export files under the `tina-preview/` prefix, with normal 0644 file permissions. It contains no environment file, database source, private photo references or node_modules.

Preview adaptations: `output: export`, `basePath: /tina-preview`, trailing slashes, prefixed public images/plain Home anchors, disabled server persistence and static page/robots generation. The colour still-life is converted to WebP for this preview. Next Link navigation preserves the preview prefix. Robots metadata is `noindex, nofollow`; the folder includes a matching X-Robots-Tag rule and disables directory listings. No domain/DNS/SSL configuration changed.

Verified before publication: static build including TypeScript; local static-hosted image, service/type/day/time selection, privacy navigation and Home return. Verified on the public HTTPS URL: Tina heading and exact current WebP, two services, manicure/extensions with 14 Aban and 14–16 preserved at the contact step, privacy navigation and Home return. At phone viewport 390 × 844, the portrait loaded with no horizontal overflow. Browser console contained no warnings/errors during this check. A direct command-line HTTP probe was unavailable due to the local network sandbox; public verification used the actual Chrome browser.

Public mobile screenshot: `artifacts/tina-preview-live-mobile.png`.

Booking continues through a visitor-prepared WhatsApp request and manual confirmation. No customer message was sent. This temporary export must be rebuilt from the current application when the design changes; it does not receive changes made to the local Node preview automatically. Its build-time calendar snapshot is refreshed by the client, but the static preview is intended for short-term review rather than permanent booking operations.
