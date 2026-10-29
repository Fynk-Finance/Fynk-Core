---
date: 2026-10-28
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-20]
branch: feature/connect-bank-consent-ui
tool: Claude Code
pr: none
status: done
---

# Consent cards and authorization of Conectar banco (M4 step 3, part 2)

## Instruction

Same session as part 1 (`2026-10-28-juanleal05-m4-connect-bank-consent-data.md`). Key sentence: "Fine, let's start with the first task at hand which is M4 step 3." The work was split into a `gh stack`, and this branch is the second layer.

## What was done

* **`ui/ConsentScopeCard.tsx`**, from `ConectarBanco.html`:
  * "<Entidad> compartirá con Fynk" with one row per scope the entity shares: Saldos, Movimientos and Datos de la cuenta, each with its 32/10 tile and the design's icon;
  * the line "Finalidad: … Vigencia: 12 meses." under the rows;
  * "Fynk nunca podrá" with its two items;
  * the footer.
* **`ui/ConsentCheckbox.tsx`:**
  * "Autorizo a Fynk a consultar y tratar estos datos según la Política de privacidad.";
  * unchecked by default, and tapping the text also toggles it;
  * the checked look (filled with the primary blue) comes from the `ConectarBanco-37ko` variant.
* **`ui/ConsentAcceptance.tsx`:**
  * the checkbox and "Ir al portal de <Entidad>", disabled until the box is checked;
  * the button records the consent and hands it to the host (M5), which will open the portal;
  * a new entity or a changed text clears the box.
* **`ui/strings.es-CO.ts`** and **`index.ts`**: export `ConsentScopeCard`, `ConsentCheckbox` and `ConsentAcceptance`.
* **Tests:** 16 in `consentUi.test.tsx`:
  * HU-006 "alcance y duración": rows, purpose and term, only the scopes the entity shares;
  * HU-006 "registrar explícitamente": unchecked by default, the button follows the box, the request carries exactly what was shown with the text hash, and a new entity asks again;
  * errors: `device_required`, `unsupported_provider`, offline, a changed text;
  * the light and dark colors.

## Result

* Tests: `make lint` and `make test` pass (776 mobile tests, 55 of them in this module).
* Pull request: not opened yet.
* **Not checked on a phone or next to the PNGs.** The components are not on a screen until M5's Conectar banco host, stacked above, which will carry the side-by-side check.

## Decisions and problems

* **Footer copy:** the decided text (M04 prompt, HU-011) replaces the design's "Los datos se actualizan cada día."
* **Values that differ slightly from the design, for M0:**
  * The checkbox ring uses `controlBorder`, which the token table names as the checkbox ring. The design has `#B9C7D0` in light and `#4B5F6C` in dark, while `controlBorder` is `#C9D6DE` in both, so the ring is lighter than designed in dark.
  * The disabled button is the shared `PrimaryButton` at half opacity, instead of the design's `#B9DFF0` (light) and `#1D4A5F` (dark).
  * The "external link" icon after "Ir al portal" is missing: the shared button draws icons only before the label, and the icon is not in the set.
  * The three scope icons are drawn in the module with the design's paths, because they are not in the shared icon set.
* **"Política de privacidad"** is a link only when the host gives `onPressPolicy`. The policy screen is M13's (Phase 4).
* **Open question for the team:** the full consent text (`bodyMd`) is not shown anywhere on the screen, yet its hash is sent as evidence of what was accepted. The recommendation is a "Ver autorización completa" link that shows it. Not built; it needs a team decision.
* "¿No encuentras tu entidad? Agrégala manualmente" belongs to the host screen (M5, with M6's cash account), not to this part.

## Next step

M5's first `ConnectBankScreen`, stacked on this branch: the header, the entity selector from `GET /providers` with the "Simulado" badge, these cards and the button, stopping after the consent is created. Then check it next to `ConectarBanco.png` in both themes.
