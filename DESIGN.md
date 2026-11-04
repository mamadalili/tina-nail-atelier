# Tina Hosseinzadeh, nail atelier

Reading this as: a Persian nail atelier and appointment website with a cinematic, hand-led editorial identity. Light gray dominates, supported by imperial green and burgundy. ENERGY 3 / RHYTHM 3 / MOTION 2.

## Current direction — revision 6

### Appointment administration, 4 November 2026

The owner asks for a very simple separate management page. This is an operational calendar rather than a marketing page: ENERGY 1 / RHYTHM 1 / MOTION 1. Reuse the existing gray, imperial green, burgundy and Vazirmatn so the two applications belong together. A Persian month calendar sits beside four chronological daily slots on desktop and stacks above them on phones. Green identifies selection and active bookings; labelled burgundy actions identify cancellation. Flat bordered rows distinguish free, occupied and closed hours without decorative charts or metrics. A native day selector replaces the seven-column grid on very small phones so taps remain usable. The edit dialog keeps the current guest/day/time together; cancellation names the exact guest and time before freeing the slot.

### Confirmed appointment pass, 4 November 2026

The owner now chooses automatic confirmation for empty slots and backend-only notifications. The older manual-request/WhatsApp handoff notes below are superseded. A confirmed server response renders a keepable ticket with an imperial-green masthead, large Persian date, guest/service details and full tracking reference. A perforated stub and edge cutouts communicate a saved appointment pass; no decorative QR or barcode pretends to verify it. Native print produces only the ticket on one A5 page. The separately gated sample is visibly labeled and never creates a booking. Provider setup and message delivery remain server concerns.

### Booking refinement, 4 November 2026

The appointment section now uses a compact introduction and a wide, flat selection panel instead of a tall sidebar. Service, calendar and time occupy distinct columns on wide screens; intermediate screens put service selection above the calendar/time pair. Phones stack the task with 10px outer gutters and 12px inner padding. A persistent-in-the-form recap makes the selected day and time visible beside the continuation action. Selection states use the existing green; the next action retains burgundy. These choices give the appointment task more room without adding imagery, effects, packages or claims of real-time availability.

Design and verification: `docs/superpowers/specs/2026-11-04-booking-panel-design.md`, `docs/verification-booking-panel.md`.

The owner's latest rebranding brief supersedes the earlier face-led and dark-hero requirements below. Use the five new website screenshots as composition references, not source assets.

- Light gray `#e9ebe8` is the main canvas; soft white `#f7f8f6` defines the appointment surface. Imperial green `#164c3c` carries the identity, selection states and contact chapter. Burgundy `#75283e` identifies primary booking actions and lacquer.
- A large original conceptual campaign photograph centers the hand and manicure. Cropping, silver light, restrained grain and a subdued face establish the cinematic mood. It is not a portrait of Tina and is not client work. The original owner portrait remains unchanged for future use.
- The gray hero combines Persian hierarchy with a large Cormorant photographic caption. The header, appointment section, services and footer share flat surfaces, fine rules and consistent controls.
- Keep local Persian typography, comfortable reading sizes, visible focus, RTL direction and 44px minimum interaction targets. Small phones use a native date selector when seven 44px day targets will not fit.
- Booking follows the hero immediately. Name the two steps, keep selections visible and retain honest request/confirmation semantics.
- Remove looping CTA sheen, traveling border light and stacked glass treatments. Reserve optical effects for imagery and brief motion for meaningful feedback. Respect reduced-motion preferences.
- The interactive color study previews the same green, burgundy and pearl-gray palette. The existing supporting still life is converted to WebP without visual changes.

Applied guidance and implementation boundaries are recorded in [the rebrand spec](docs/superpowers/specs/2026-11-03-editorial-rebrand-design.md). Earlier revisions below are historical context, not current visual requirements.

## Owner's brief

- Tina Hosseinzadeh, تینا حسین زاده.
- Nails, manicure and pedicure, explicitly confirmed by the owner.
- Phone, SMS and WhatsApp: 09353155852.
- Address: ستارخان، حبیب‌الله شمالی. No building number, map pin or business hours have been supplied.
- Use the supplied personal photographs and supplied website references as inspiration.
- Hero: recognizable portrait of Tina, black and white, one hand against her face and selectively coloured nails.
- Use TypeScript and Next.js with an independent future VPS deployment.

## Design decisions

### Revision 5, the owner's exact image and a softer photographic hero

- Use the exact newly supplied PNG as the image source. Convert it to a versioned 1122 × 1402 WebP at quality 92, preserving the full source dimensions. Keep an untouched private copy. Do not regenerate the face, hand or pose.
- The owner points to the personal site's contact page as a composition reference: portrait emerging into its surroundings, restrained optical treatment and fewer visible frames. Its page was visually inspected; retain Tina's burgundy/charcoal identity rather than copying that site's colours or content.
- Keep the earlier 310:537 tall crop, including on phones, but feather its edges into the background. Put gentle shade/soft focus toward the hand and keep the visible eye readable. Reduce nail saturation slightly in the live composition. This is a photographic treatment of the original asset, not new generated imagery.
- Remove the portrait outline, offset shadow, overlaid signature, technical caption, hero watermark and hero divider rules. Let the header sit directly on the canvas. Functional booking frames, glass footer and appointment controls from revision 4 remain purposeful and intact.
- Keep the phone title and appointment action visible. A small overlap over the fully faded lower portrait brings the description closer without covering the eye or nails. Static optical layers replace pointer parallax, so the hero can render as a Server Component.

### Revision 4, phone-first appointments and liquid glass

- Owner specifies two services only: manicure and pedicure. Manicure requires a gel-polish or extensions choice. Offer exactly four two-hour windows, 10–12, 12–14, 14–16 and 16–18, in Tehran time. Do not imply live availability or confirmed reservations while the runtime is unconfigured.
- Most visitors are on phones. Put the name above the portrait, use a shorter 4:5 mobile crop with lighter grading and less peripheral blur, and move the practical booking action into the first phone view. The tall desktop reference frame remains.
- Glass footer: reduce desktop footer from 118px to about 89px and the mobile fixed action from 62px to 47px. The mobile footer itself targets 182px instead of the measured 243px. Reserve safe-area space and keep all action targets at least 44px tall.
- Appointment motion: one slow SVG light travels around the real form boundary; a brief sheen crosses appointment actions intermittently. These guide attention to the main task, receive no pointer events and disappear for reduced-motion preferences. No layout animation or animated blur is used.
- Treat time selection as required and reject already-started windows at submission on both client and server. Persist the manicure type and include it in notification/WhatsApp text. Existing request/confirmation semantics remain explicit.

### Revision 3, portrait framing and appointment order

- The owner supplied a tightly cropped, tall rectangular portrait reference. Use a 310:537 image frame, with the face/hand cropped near its edges, instead of the previous full-bleed hero image.
- Apply optical effects in the live composition: soft focus limited to the image periphery, a low-key vignette, a restrained silver light reflection and a readable sharp eye/manicure. These layers describe photographic light, not generic background orbs. Keep them decorative and pointer-transparent. The original image asset stays intact.
- On phones the frame stays visibly separate from the page background, at a proportional width that preserves the face. No text covers the eye or hand. Keep the fixed appointment action usable.
- Put the complete Jalali appointment section immediately after the hero, before services, colour and introduction. Preserve its existing service/day selection and honest request semantics.

### Revision 2, owner feedback

- The first edition was too simple. Recompose the whole public page as a cinematic nail atelier: near-black hero, expressive type, pearl content and an oxblood contact finale.
- Hero heading is only «تینا». The surname remains in factual contact/privacy/metadata but is removed from the requested Home title.
- Replace the first hero with an identity-preserving low-key portrait, sculpted silver light and selectively coloured cherry nails. Keep the visible face readable.
- Remove both personal photos from the lower introduction; replace their composition with a typographic personal statement, not new photographs.
- Header floats as a compact translucent dark surface to remain readable over the cinematic image. No other glass stack.
- Colour selection becomes a large physical lacquer study: illustrated nail shapes respond to actual shade and finish controls. Gloss gradients describe material, not generic background decoration.
- Motion personality: Premium. Easing cubic-bezier(.4,0,.2,1), 160ms feedback, 420ms state changes, 650ms staged hero. Pointer depth is limited to 7px and disabled for reduced motion/coarse pointers. No endless ambient loop.
- ENERGY 3 / RHYTHM 3 / MOTION 2. The portrait, service index, interactive lacquer sheet, typographic introduction, booking sheet and dark-red contact surface must have genuinely different visual structures.

The original first-edition decisions below are historical context; this revision supersedes its split white hero and lower personal photo composition.

- Pearl white, near-black and oxblood: the quiet neutral page makes the selective nail colour the focal point.
- Vazirmatn: readable Persian letters and complete native RTL support; a local Cormorant serif wordmark adds the fashion-editorial voice without compromising Persian legibility.
- Split hero with a dominant vertical portrait: personal trust is the first message, with a direct appointment action beside it.
- Large editorial type, fine horizontal rules, flat surfaces and asymmetric editorial photographs: the references imply an authored portfolio rather than a generic salon template.
- Varied sections: hero, service index, colour study, personal introduction, appointment sheet and compact contact footer.
- Burgundy is reserved for booking, manicure colour and selected states. No decorative glows, fake metrics, fabricated testimonials or unverified portfolio.
- Motion: a single short hero entrance and interaction transitions; no looping movement or scroll hijack. Reduced-motion removes nonessential animation.
- Portraits are editorial image edits, not records of services performed. Generated manicure artwork must be labelled as an illustrative colour study.
- Mobile keeps the portrait prominent, reflows the header and appointment form, and reserves space for the bottom appointment action.

## Booking scope

Exact prices and real business availability are unknown. The owner has now specified two-hour appointment windows between 10 and 18. The form collects the selected service, treatment, day and window as an appointment request; availability and confirmation still require coordination. A working WhatsApp handoff is available. With PostgreSQL configured, the API stores requests and outbox records transactionally. Without it, the UI offers the WhatsApp route and does not claim server persistence.

Telegram, Google Calendar and Faraz SMS use server-only configuration at publication. Calendar creation requires a confirmed appointment and a configured duration. Nothing sends a real message or creates an external event during development.
