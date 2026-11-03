# Temporary phone preview, 2026-11-03

Public URL: https://mrdalili.ir/tina-preview/

The owner authorized publishing a temporary preview on the existing personal-site host. It is isolated under `public_html/tina-preview/`; the existing personal website remains at the domain root. The public root was checked afterward and still renders “خانه — محمدرضا دلیلی”.

This is a static Next export of revision 5 for shared hosting, not the final Node/PostgreSQL deployment. Main application runtime configuration is unchanged. The isolated build is in the sibling `tina-static-preview` directory; release files are in `tina-mobile-release/tina-preview`. A private host-home upload archive, `tina-preview-public-20261103.zip`, contains only 70 public export files under the `tina-preview/` prefix, with normal 0644 file permissions. It contains no environment file, database source, private photo references or node_modules.

Preview adaptations: `output: export`, `basePath: /tina-preview`, trailing slashes, prefixed public images/plain Home anchors, disabled server persistence and static page/robots generation. The colour still-life is converted to WebP for this preview. Next Link navigation preserves the preview prefix. Robots metadata is `noindex, nofollow`; the folder includes a matching X-Robots-Tag rule and disables directory listings. No domain/DNS/SSL configuration changed.

Verified before publication: static build including TypeScript; local static-hosted image, service/type/day/time selection, privacy navigation and Home return. Verified on the public HTTPS URL: Tina heading and exact current WebP, two services, manicure/extensions with 14 Aban and 14–16 preserved at the contact step, privacy navigation and Home return. At phone viewport 390 × 844, the portrait loaded with no horizontal overflow. Browser console contained no warnings/errors during this check. A direct command-line HTTP probe was unavailable due to the local network sandbox; public verification used the actual Chrome browser.

Public mobile screenshot: `artifacts/tina-preview-live-mobile.png`.

Booking continues through a visitor-prepared WhatsApp request and manual confirmation. No customer message was sent. This temporary export must be rebuilt from the current application when the design changes; it does not receive changes made to the local Node preview automatically. Its build-time calendar snapshot is refreshed by the client, but the static preview is intended for short-term review rather than permanent booking operations.
