---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-77, SCRUM-80]
branch: feature/ghost-card
tool: Claude Code
pr: "#335"
status: done
---

# GhostCard, the shared empty card of a section

## Instruction

Sofia asked to fix the Dashboard findings of the 7 Nov app review (#332): "In pr #332 theer are several visual and gestual changes, lets solve them. Most af them are small changes, lets start for Dashboard screen changes." V2 (no goals) and V5 (no accounts) both ask for an empty-card skeleton, and the review notes ask for one shared component. Asked which look to use, Sofia picked "Static ghost card".

## What was done

* `apps/mobile/src/shared/ui/components/States.tsx`: new `GhostCard`. A dashed outline with still gray shapes (a tile and three lines) and a small pill button with a plus in the middle. Props: `actionLabel`, `onAction`, `message` (read as the button's hint), `onPrimary` (translucent white shapes and a white button, for the blue header), `style` (size and radius of the card it stands in for).
* `__catalog__/States.stories.tsx`: stories `GhostCard` and `GhostCardOnBlue`, with their light and dark snapshots.
* `components.test.tsx`: only the button reaches screen readers, the button runs the action, nothing pulses, it takes the given size, and the blue variant.

## Result

* Tests: 302 of 302 in `shared/ui`, 128 snapshots (4 new). Typecheck, ESLint and Prettier clean.
* Pull request: #335. V2 and V5 are stacked on it.

## Decisions and problems

* Still, not pulsing: the loading `Skeleton` pulses, so an empty card that pulsed would read as loading.
* The design's buttons are 52 to 56 px high, too tall for a 104 to 112 px card, so the card has its own 36 px pill. New component, needs design review.
* The story group keeps its old title so the 6 existing snapshots do not change.

## Next step

Use it for V6 (recurring) and F4 (Billetera goals) too.
