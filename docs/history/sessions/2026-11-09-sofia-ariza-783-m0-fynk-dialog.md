---
date: 2026-11-09
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-83]
branch: feature/fynk-dialog
tool: Claude Code
pr: "#357"
status: done
---

# The Fynk dialog (QA review V8, part 1 of 2)

## Instruction

Part of "Lets fix all the visual problems at once", every pull request in one stack. V8: dialogs use the default Android dialog (`Alert.alert`); build a Fynk dialog with a white card (dark in dark mode), a title and a subtitle. This pull request adds the component; the next one moves the 19 callers to it.

## What was done

* `shared/ui/components/Dialog.tsx`:
  * `dialog.show(title, message?, buttons?, options?)` with the arguments of `Alert.alert`, so callers swap one for the other and tests spy on `dialog.show` as they did on `Alert.alert`.
  * `DialogHost`, mounted once in `app/AppRoot.tsx`, draws one dialog at a time from a small store read with `useSyncExternalStore`. A dialog asked for before the host mounts waits in the queue.
  * `DialogCard`: page color card with the card shadow, the 16 px card title, body text and the design's buttons (primary for an action, danger ghost for a destructive one, neutral ghost for cancel, which goes last). Scrim of the Dashboard + menu, fade and pop entrance, none with Reduce Motion.
  * The scrim and the back button close it only when there is a cancel button, a single button or `cancelable`; closing runs the cancel button or `onDismiss`.
* `strings.es-CO.ts`: "Entendido" (only button when none is given) and "Cerrar" (the scrim's label).
* `Dialog.test.tsx`: 9 tests (buttons and their order, danger color, "Entendido", closing from outside, queue before the host mounts, dark theme). Catalog stories for a confirmation, an info dialog and a live one.
* `docs/design/README.md`: the component is listed as new, needs design review.

## Result

* Tests: 2746 of 2746. Typecheck and ESLint clean.
* Pull request: #357, in stack #361 (#352 → #360).

## Decisions and problems

* ESLint rejects a `setState` inside an effect, so the queue lives outside React in a store. That is also what lets `dialog.show()` be called outside a component and before the host mounts.
* The buttons stack vertically: labels like "Aplicar a todos" do not fit side by side in a 360 px card.

## Next step

Move every `Alert.alert` caller to `dialog.show()` (part 2).
