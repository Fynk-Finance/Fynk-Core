---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-9, SCRUM-6]
branch: feature/linked-devices-screen
tool: Claude Code
pr: none
status: done
---

# Build the Seguridad screen: change password and linked devices

## Instruction

This is part of the plan to "finish M1 by finishing the pending task that we left until sofia's PRs were merged". Mi cuenta's "Seguridad" row opened a placeholder. This branch draws `CfgSeguridad` in light and dark on top of the data from `feature/password-change-and-device-list`. Claude Code (Opus) planned and reviewed. A Sonnet subagent wrote the screen, and Claude Code checked it against the design code and ran the checks again.

## What was done

* **`ui/SecurityScreen.tsx`:**
  * **The header, as in the design:** the 56 px shield tile on the left, the 48 px back button on the right, the title and the subtitle.
  * **"Contraseña":** "Cambiar contraseña" with "Actualizada hace …". It opens Keycloak's themed change page (#78). The row is disabled while the browser is open. A failure shows an alert, and a cancel says nothing. Afterwards the profile and the devices are loaded again.
  * **M2's parts:** M2's `UnlockSetting` and `RecoveryCodeRow` are rendered from `@modules/vault`. They are still placeholders, and M2 draws its own "Desbloqueo" section.
  * **"Dispositivos activos":**
    * "N sesiones", with this phone first.
    * This phone has the "Este dispositivo" pill and no "Cerrar".
    * A pending device has "Pendiente".
    * The other devices have "Cerrar", with a confirmation.
    * "Cerrar todas las demás sesiones" asks first, and shows only when there are other devices.
    * Then the footer, plus skeletons, and an error with retry.
* **`ui/DeviceRow.tsx`:** one device row. No place is shown, because none is stored.
* **`index.ts`:**
  * `identity.Security` (`cuenta/seguridad`) gets the real screen, exported as `LinkedDevicesScreen`;
  * after a password change, `device.sync()` moves this phone's stored session to the new Keycloak session.
* The copy lives in the `security` block of `strings.es-CO.ts`.

## Result

* `make lint-mobile`, `make test-mobile` (613 tests, 18 of them on this screen, in light and dark) and `make format-check` pass.
* Not checked on a phone or against the PNG.

## Decisions and problems

* **Local styles from the design, with tokens only:**
  * The 12 px uppercase section titles: `SectionHeader` is 20 px.
  * The "Este dispositivo" pill: it is `Badge` `lg` but with `accentText`, while the `success` tone uses `link`.

  The PR asks M0 for a `SectionHeader` variant and a `Badge` tone.
* **Icons and the design:**
  * Every device has the phone icon. The design's laptop and tablet icons are not in the icon set.
  * The password row has a right chevron because it opens a browser, not a section.
* **Copy marked for design review:**
  * "Pendiente";
  * the confirm and error alerts;
  * the error state;
  * the accessibility labels.

## Next step

Check on a phone: the Keycloak round trip of "Cambiar contraseña", the sessions of the other devices ending, and the screen next to `CfgSeguridad.png` in both themes.
