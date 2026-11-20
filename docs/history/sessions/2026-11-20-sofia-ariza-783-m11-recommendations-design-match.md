---
date: 2026-11-20
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M11
jira: [SCRUM-39]
branch: fix/recommendations-design-match
tool: Claude Code
pr: #438
status: done
---

# Recomendaciones tab matches the design again

## Instruction

Sofia asked to check whether the AI recommendations tab follows its design and requirements, then:
"Fix the current visual gaps to follow the original design. The team decided I should fix this
error." M11 belongs to Julián, who reviews the pull request.

## What was done

* Review of `RecommendationsScreen.tsx` against `docs/design/sources/{light,dark}/Recomendaciones.html`
  and the PNGs, and of the M11 criteria (HU-024, HU-025, HU-026).
* `ui/RecommendationsScreen.tsx`:
  * "Mayor impacto" card gets the design's three rounded squares (`cardShapeLight`,
    `cardShapeLighter`, `headerShapeB`) and the shared `Shine`, as Billetera does.
  * Step number circle and tag colored by type: green for Gastos (`accent`, `accentTint`, `link`),
    blue for Ahorro and Suscripciones (`surfaceBlue`, `primaryDark`), the same in dark.
  * Chevrons of 16 px and stroke 2.8 on the card and the step buttons (the buttons used an arrow).
  * Step icons of 16 px, step titles in bold (700).
  * Filter chips scroll to the screen edges (design `margin: 0 -16px; padding: 0 16px`).
* `domain/steps.ts`: the subscriptions step uses the play icon of the design instead of the TV.
* Tests: subscriptions and contribution icons; number and tag colors in light and dark against the
  design's hex values; the decorative layer of "Mayor impacto".

## Result

* Tests: 30 of 30 pass in `src/modules/recommendations` (4 new). The 4 new tests fail on the old code.
  `tsc`, ESLint and Prettier clean.
* Pull request: #438, screenshots in both themes still to add.
* Not checked on a device: the visual result still needs a look in Claro and Oscuro next to the PNGs.

## Decisions and problems

* Colors and sizes come only from tokens that already exist. No new token and no shared file changed.
* Tests compare against the design's hex values, because ESLint forbids importing the palettes in
  modules, as other module tests do.
* The design draws the timeline line under the last step too. Left hidden after the last step, as it
  was, because it ends on nothing.
* Found during the review and left out of this branch: the "Recomendaciones con IA" switch in
  Privacidad y datos (`modules/compliance/ui/PrivacyScreen.tsx`, M13) is local state only and does
  not turn the AI snapshot off. Needs its own fix with the M13 owner.

## Next step

Open the pull request for Julián's review with screenshots in both themes next to the design PNGs.
