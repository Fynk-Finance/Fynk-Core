---
date: 2026-10-27
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: docs/update-design
tool: Claude Code
pr: #11
status: done
---

# New design export with dark mode, gestures and 36 screens

## Instruction

Sofia pasted the new design export (36 screens, light and dark) into `docs/design/` and asked to "update the plan with the new screens. Now it includes darkmode. Several screens have two navigation methods: buttons and gestures, consider it in the plan. All transitions between screens must be smooth animations and allow gesture navigation. Manage a default and allow specifications when the user indicates them. Review the current design tokens and components to follow the new screen specifications."

She chose: defaults with overrides for both the theme and the transitions, docs plus M0 code in small pull requests, tabs that also switch with a swipe, and updating the claude.ai plan doc if it can be opened. This branch is the first of those pull requests: the design files and the design docs.

## What was done

* `docs/design/source/` (26 `Verde*.dc.html` and `canvas.json`) and the 25 numbered PNGs replaced by `docs/design/sources/{light,dark}/<Screen>.html` and `docs/design/screens/{light,dark}/<Screen>.png`: 36 screens, 9 of them new (CuentaDetalle, Movimientos, Estadisticas, Metas, CfgSeguridad, CfgNotificaciones, CfgPrivacidad, CfgAyuda, CfgEliminar).
* `docs/design/README.md` rewritten:
  * the light and dark rules (follow the phone, override in Apariencia);
  * navigation and gestures: default per kind of screen, gestures inside screens, and a button for every gesture;
  * new conversion rows for dark colors, pan gestures, snap carousels, scroll-driven styles and sheets;
  * a token table with light and dark values;
  * an inventory of all 36 screens with module, transition, buttons and decided changes;
  * the list of missing screens updated.
* `CLAUDE.md` (Before you start, Design source, open item 6) and `docs/developer-kit.md` point to the new folders.
* `scripts/design-color-pairs.mjs` with 5 `node:test` tests, plus `make design-colors`: it pairs every light color with its dark twin by position across all screens.

## Result

* Tests: `node --test scripts/*.test.mjs`, 26 pass, 0 fail. Prettier is clean on the new script.
* The 36 inventory rows point to files that exist in all four folders.
* Pull request: #11.

## Decisions and problems

* The light and dark files have the same markup, so dark mode is a second palette on the same token names. Pairing them shows that some light colors play two roles in dark. `#E4F5FC` is `#1A3444` as a background and `#223746` as a border, so the token table gains `borderBlue`. `#FFFFFF` is the page (`#13212D`), the frame behind it (`#0B1620`) and text on blue (stays white), so the table has `background`, `canvas` and `onPrimary`.
* Dashboard, DashboardDetalles and Recuperar have one or two more colors in one theme than in the other, so the script leaves them out and says so.
* Dashboard · Detalle de cuentas is specified as an in-place expansion of the Dashboard header, not a route. Detalle de cuenta and Configuración · Omitir are modals. Configuración · Listo has no back gesture. Every other screen uses the default of its kind.
* The onboarding order changed in the design: Correo is now step 1 and Nombre step 2. M3 must follow it.
* CI failed on this pull request: `tokens.test.ts` on `develop` reads the README color table and expected exactly 24 rows, while the new table has 42 (dark values and new tokens that only reach the code with the theme, #14). The test now checks that every color the code already has keeps the README light value. #14 checks every row in both themes again.
* Rules the new screens break, written in the inventory: real bank names; "Se descuenta de Bancolombia" in Metas (Fynk never moves money); anonymous usage statistics and Fynk Plus offers in Privacidad; WhatsApp support in Centro de ayuda. The last two wait for the team.

## Next step

Branch `docs/dark-mode-and-gestures-plan`: the UI contracts (theme and screen transitions) in `00-shared-contracts.md`, M0 step 7, the design line of every module prompt, the Gate A checklist and the new decisions and open items in `CLAUDE.md`.
