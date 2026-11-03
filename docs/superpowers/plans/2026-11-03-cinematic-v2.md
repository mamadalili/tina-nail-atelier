# Cinematic atelier revision

**Goal:** Apply the owner's request for a substantially more artistic UI, a professional cinematic first portrait, no surname line in the Home heading and no two lower personal photos.

**Architecture:** Retain the existing Next.js/TypeScript app, native Jalali booking, contact data and server adapters. Public visual changes only. Reuse existing local fonts and the illustrative nail photograph. Keep the prior source ZIP and assets as a recovery point.

**Design:** DESIGN.md, Revision 2. Dark image-led hero, material-aware colour controls, editorial service list, text-only personal introduction, refined booking and oxblood contact finale.

- [x] Generate and inspect a new identity-preserving cinematic portrait; copy it to a new versioned asset.
- [x] Build the cinematic hero and refine header, service list, colour controls and photo-free introduction.
- [x] Replace the global visual system with coherent desktop, intermediate and mobile layouts. Reduced motion and focus states remain first-class.
- [x] Run existing tests/typecheck/build and updated image smoke checks. Verify controls, responsive layout, removed elements and real contact destinations in the browser.
- [x] Review the changed UI code independently, fix material findings, capture screenshots and package a new source version.

Evidence and fixed review findings: `docs/verification-v2.md`. The second source archive was checked for the new portrait, current source, lockfile and verification record; private references and runtime files are excluded.
