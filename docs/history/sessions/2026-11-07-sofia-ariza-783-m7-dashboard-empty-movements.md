---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-85]
branch: feature/dashboard-empty-movements
tool: Claude Code
pr: none
status: done
---

# A grayscale illustration for the empty Dashboard movements (QA review V10)

## Instruction

Sofia asked to go on with the Dashboard findings of the 7 Nov app review: "Continuee with the next changes. Stack everything is related with the same screen." This session covers V10: with no movements, the Dashboard shows only a message; add a grayscale vector illustration, centered in the free space, above the message.

## What was done

* `transactions/ui/EmptyMovementsIllustration.tsx` (new): a 160 × 128 SVG, a movement card with two empty rows over a tilted card, and a round badge with up and down arrows. Only neutral theme colors (`divider`, `border`, `trackOff`, `controlBorder`, `background`), so it follows light and dark. Hidden from screen readers.
* `transactions/ui/TransactionPreview.tsx`: with no movements the section grows and centers the illustration above "Aún no tienes movimientos.".
* Tests: the empty block grows and centers, the illustration comes before the message and is silent, in light and dark; with movements the section keeps its height. In M6, the Dashboard's page content can fill the screen.
* `docs/design/README.md`: inventory row 5 lists the illustration.

## Result

* Tests: 2,705 of 2,705 in the app, 128 snapshots. Typecheck, ESLint and Prettier clean.
* Pull request: not opened yet. Stacked on #340 (stack #338).

## Decisions and problems

* Built after G3 instead of before it: G3 gave the Dashboard its own scroll with content that can stretch, so no change to the shared `Screen` was needed.
* The illustration lives in M7 next to the preview; nothing else uses it yet, so it is not in `shared/ui`.

## Next step

Check it on a phone with an account with no movements, light and dark. Then G1.
