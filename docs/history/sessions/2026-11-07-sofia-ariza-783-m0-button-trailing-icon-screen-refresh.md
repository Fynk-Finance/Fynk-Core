---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: feature/button-trailing-icon-and-screen-refresh
tool: Claude Code
pr: none
status: done
---

# Icon after the button label and pull to refresh on Screen

## Instruction

From the follow-ups of the M4 and M5 end-to-end test: "In the 'Connect Bank' design, the 'Go to [Bank] portal...' button includes an external link icon after the text. Currently, `PrimaryButton` only supports an icon before the text, or an arrow. We need to add an option for an icon to appear after the text, specifically the 'externalLink' icon." M4 will use it. The Dashboard pull to refresh (M6, next branch in the stack) also needed `Screen` to accept a refresh.

## What was done

* `shared/ui/icons/paths.ts`: new `externalLink` icon, with the path from `ConectarBanco.html`.
* `shared/ui/components/Button.tsx`: `iconAfter` on every button. The icon is drawn after the label at 16 px with the arrow's stroke (2.4), and the gap is 8 px, as in the design. The catalog has a "PrimaryExternal" story.
* `shared/ui/components/Screen.tsx`: `refresh()` adds a RefreshControl with the same colors as Billetera's. It spins until the promise settles and stops on a failure too. The scroll view gets the test id `<testID>.scroll`.
* Tests in `components.test.tsx`: the trailing icon comes after the label with no arrow; Screen refreshes on a pull, spins until the promise settles, stops after a failure, and has no RefreshControl without `refresh`.

## Result

* Tests: 91 of 91 pass in `shared/ui/components` and `shared/ui/icons`. ESLint, Prettier and `tsc --noEmit` are clean.
* Pull request: not opened yet (bottom of a stack with the Dashboard branch).

## Decisions and problems

* `refresh` lives in `Screen` instead of each screen building its own ScrollView (as Billetera does). That way the Dashboard keeps Screen's padding and tab bar space, and the spinner colors are in one place.
* The local generated API types (`schema.gen.ts`) were stale, which made `tsc` fail in `investment` and `recurring`. `make generate-ts` fixed it; that file is not committed.

## Next step

M4 can use `<PrimaryButton label="Ir al portal de …" iconAfter="externalLink" />` on Conectar banco once this merges.
