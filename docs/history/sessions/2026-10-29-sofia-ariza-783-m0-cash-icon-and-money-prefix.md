---
date: 2026-10-29
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-71]
branch: feature/shared-cash-icon-and-money-prefix
tool: Claude Code
pr: none
status: done
---

# Cash icon and "$" prefix for money fields in the design system

## Instruction

Part of the M6 session ("follow the work plan" of the M6 prompt). The cash field of OnbCuentas ("¿Cuánto tienes en efectivo?") needs an icon and a `$` before the value that `@shared/ui` did not have, so they were added in their own M0 pull request, stacked under the M6 cash branch.

## What was done

* `shared/ui/icons/paths.ts`: `cash` icon, path copied from OnbCuentas.
* `shared/ui/components/TextField.tsx`: optional `prefix` shown in IBM Plex Mono 15 semibold, secondary text color, as in OnbCuentas, OnbGastos and OnbMetas. Hidden from screen readers, because the label already names the field.
* Catalog story `TextField / Money` and a test for the prefix.

## Result

* Tests: 278 of 278 in `shared/ui`, catalog snapshots updated with the new story. Lint and typecheck clean.
* Pull request: in the M6 stack, under `feature/manual-cash-account`.

## Decisions and problems

* The field icon stays at 18 px like the other `TextField` icons. The design draws field icons at 16 px (OnbNombre, OnbCuentas, OnbGastos, OnbMetas); that applies to every field and is left for a separate M0 fix.

## Next step

Use `TextField` with `icon="cash"` and `prefix="$"` in M6's `CashInput`.
