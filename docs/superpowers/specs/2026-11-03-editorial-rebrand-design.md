# Tina — the art of detail

## Intent

Rebrand the existing Persian appointment website as a contemporary independent nail atelier. The owner's new brief supersedes the earlier dark, face-led hero: light gray dominates, supported by imperial green and burgundy. The supplied screenshots establish cinematic photography, deliberate cropping, editorial hierarchy and generous space; they are references, not assets to copy.

## Direction and alternatives

Chosen implementation direction: a light editorial canvas with one immersive, hand-led campaign image, restrained Persian typography and a serif Latin signature. A full dark fashion cover would conflict with the requested dominant light gray. A conventional salon card layout would miss the requested artistic composition. These are implementation judgments under the owner's rebranding request, not additional owner statements.

## System

- Canvas `#e9ebe8`; surface `#f7f8f6`; inset `#dce1dc`.
- Imperial green `#164c3c`: identity, selected controls, contact chapter.
- Burgundy `#75283e`: primary appointment actions and lacquer.
- Ink `#233c32`; muted `#5d6860`; line `#c4cdc5`.
- Keep local Vazirmatn for Persian; Cormorant Garamond for Latin display. No new UI dependencies.
- Flat surfaces, fine rules, modest control corners, no running light borders, glass footer or looping CTA sheen.
- Minimum 44px interaction targets, visible focus, readable body copy, reduced-motion support and complete RTL layouts.

## Composition

1. Quiet header with direct appointment action and mobile navigation.
2. Large cinematic conceptual photograph: natural hand and burgundy manicure; obscured face, silver light, optical softness and gray background. It does not impersonate Tina or represent client results. Keep the owner's original portrait available unchanged.
3. Appointment form immediately after the hero. Light surface, explicit two-step progress, selection summary, honest request/confirmation copy.
4. Flat treatment index; interactive color study in the brand palette; personal introduction; compact green contact chapter and neutral footer.
5. Mobile preserves a visible booking action and deliberate image crop. The fixed action respects the safe area and does not obscure content.

## Functional boundaries

Retain two services, required gel/extensions for manicure, the Jalali calendar, Tehran time, 10–12 / 12–14 / 14–16 / 16–18 periods, server validation, request persistence, idempotency and user-initiated WhatsApp handoff. No fabricated prices, reviews, availability or business claims. No database or notification configuration changes, and no development messages to external recipients.

## Verification

Existing unit tests, typecheck and production build on Node 24.11. Local production smoke check; desktop/tablet/phone review; invalid form, back-navigation, service handoff, color controls, menu keyboard behavior, reduced motion and WhatsApp preparation without sending. Document limitations honestly. Deliver an isolated Git branch and reviewable pull request; preserve the repository's VPS deployment model.

## Applied source guidance

- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills/ui-ux-pro-max): queried beauty/service design, RTL and Next.js implementation guidance. Use accessibility and responsive guidance; owner palette and existing Persian fonts override the generic pastel/Latin recommendations. No testimonials are invented.
- [MengTo editorial service booking](https://github.com/MengTo/Skills/tree/main/agent-skills/web-design/editorial-service-booking): image-led composition, treatment browsing and persistent honest booking states.
- [MengTo no design slop](https://github.com/MengTo/Skills/tree/main/agent-skills/ui/no-ai-design-slop): one focal image, purposeful effects, inspect actual responsive output.
- [AI UI Design System](https://github.com/dhananjaym182/ai-ui-design-skills/tree/main/skills/ui-ux-design-system): neutral-first tokens and consistent interaction states. The owner's light editorial brief overrides this source's default dark SaaS styling.

Selected source skills were downloaded into the task workspace and read directly for this implementation; no global skill installation is required to run the website.
