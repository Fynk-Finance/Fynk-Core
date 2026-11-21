---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: feature/restore-without-code
tool: Claude Code
pr: none
status: done
---

# "No tengo ninguno de los dos": start from zero

## Instruction

Build the last way out of the restore screen (HU-045): a person with neither the old phone nor the recovery code can start an empty vault after proving it is them with the email code password reset. The server decides (`POST /backup/reset`); the phone explains, calls it, and sets itself up as a first phone.

## What was done

* **`adapters/api/backupResetApi.ts`:** `reset()` posts with `X-Device-Id` and no body. It maps 204 to ok, 403 `reset_not_allowed` to `notAllowed`, 403 `device_not_active` to `notActive`, a lost connection to `offline`. Contract tests cover each.
* **`application/resetBackup.ts`:** turns the API errors into `ok`, `notAllowed`, `notActive`, `offline` or `failed`.
* **`lockController.ts`:** `resetBackup()` calls it from a pending device and, on `ok`, runs `unlock()`. The phone is now active and the recovery key is gone, so `setUpFirstPhone` makes a new DEK and shows a new recovery code. A controller test checks the whole path.
* **UI:** the option "No tengo ninguno de los dos" opens `ResetExplanation` with the three paragraphs, "Empezar de cero" and "Volver". `notAllowed` shows the message and swaps the primary button for "Restablecer contraseña", which signs out through identity.
* **Tests:** the screen in light and dark, the flow with the controller, the API and the use case.

## Result

* `make lint-mobile`, `make test-mobile` and `make format-check` pass.
* Pull request: not opened yet. This branch is stacked on `feature/restore-with-approval`.

## Decisions and problems

* **"Empezar de cero" calls the server first**, because the person may have just done the email reset. Only `notAllowed` sends them to the password reset.
* **No direct reset-credentials entry in identity.** `changePassword` needs a session. So "Restablecer contraseña" calls `signOut()`; the person lands on Inicio and Keycloak's login page, which has "¿Olvidaste tu contraseña?". After the reset and a new sign in the phone returns to this screen, and "Empezar de cero" succeeds.
* **The option is shown to pending and active phones**, since both can be stuck without a key.
* **Only a phone can check:** the real Keycloak round trip, the 10 minute window, and that the new session counts as started after the reset.

## Next step

Open the M2 pull requests in order and check both restore paths on two real phones.
