---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-54]
branch: feature/billetera-recurring-section
tool: Claude Code
pr: none
status: done
---

# Recurring items in Billetera (third of three pull requests for SCRUM-54)

## Instruction

Same session as #152 and #153: SCRUM-54 split in three pull requests, opened from Karol's account.

## What was done

* `domain/card.ts`: what each card shows. The periodicity badge (Mensual, Semanal, Diario, Quincenal, Anual) and the schedule ("Día 1", "Cada lunes", "Lun a vie", "Lun y Jue", "Cada año · 15 mar"). The next charge: "Hoy", "Mañana", "En 2 días", "Pagado" (this month's charge passed) or the date, like "Lun 2".
* `ui/RecurringCard.tsx`: the 2 column card of the design (26 px tile, name, amount, badges). Tapping it opens the form with its id.
* `ui/BilleteraScreen.tsx`: the Billetera tab, replacing M0's placeholder.
  * The blue header shows "Gastos fijos de este mes" with the total. Its bell uses M12's `useUnreadCount` and opens the inbox; the avatar opens Mi cuenta.
  * "Gastos recurrentes" has "+ Agregar", a loading skeleton, an empty state and an error state.
* `ui/useRecurringItems.ts`: reloads on every change, and reads a locked vault as empty.
* `modules/notifications/index.ts` (M12, also Karol's): exports `NOTIFICATIONS_ROUTE`.
* `src/app/AppRoot.test.tsx` (M0): its tab test looked for the text of the Billetera placeholder. It now looks for the real Billetera. Same file Karol approved touching for #150; Sofia reviews.
* Tests: 6 for the card rules and 9 for the screen. They use the design's items on Saturday 24 Oct 2026: `$1.930.600`, "Pagado", and "En 2 días" for Servicios públicos, the gym and transport.

## Result

* Tests: 77 suites and 1024 tests of the app pass. ESLint, `tsc` and Prettier are clean.
* Pull request: opened from Karol's account, stacked on #153.

## Decisions and problems

* The header says "Hola, Invitado" like M0's placeholder: M1 exports no first name yet. M1 needs to add a hook for it (Dashboard needs it too).
* "Mis cuentas" (M6) is not there yet: M6 has no code in `develop`. It goes above "Gastos recurrentes" when it lands.
* The design's grey "Próximos" next to the title is left out, because `SectionHeader` shows either a note or a link, not both.
* The subscriptions section and the savings banner come with SCRUM-56.

## Next step

SCRUM-57 (payment reminders with M12), then SCRUM-56 (usage marks, subscriptions and the savings banner).
