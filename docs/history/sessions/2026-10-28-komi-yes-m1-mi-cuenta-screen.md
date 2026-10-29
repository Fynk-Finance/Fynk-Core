---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: feature/mi-cuenta-screen
tool: Claude Code
pr: none
status: done
---

# Replace M0's Mi cuenta placeholder with the real screen

## Instruction

This is part of the plan to "finish M1 by finishing the pending task that we left until sofia's PRs were merged". Sofia's themed `HeaderBlue`, `Avatar`, `ListRow` and `APPEARANCE_ROUTE` are in `develop`, and #75 adds the `Badge` icon. So Mi cuenta (`DetalleCuentas`, light and dark) can be built. Claude Code (Opus) planned and reviewed the work. A Sonnet subagent wrote it, and Claude Code fixed one privacy issue and ran the checks again itself.

## What was done

* **The route:** `identity.Account` keeps its name and the path `cuenta`, so the existing links keep working. A placeholder `identity.Security` at `cuenta/seguridad` waits for the next branch.
* **`ui/MiCuentaHeader.tsx`:** the blue header of the design. It has:
  * the squares and the shine;
  * the back button and the title;
  * the 88 px avatar with its ring and the initials (a generic icon when there is no name, never letters from the email);
  * the name;
  * "Perfil verificado" with the new `Badge` size and icon, shown only when the email is verified.

  It is exported from `index.ts`, so other modules reuse it.
* **`ui/MiCuentaScreen.tsx`:**
  * "Información Básica" with the masked "Correo de recuperación" and "Miembro desde";
  * "Gestión de cuenta" with the rows of `ui/miCuentaRows.ts`: Seguridad, Apariencia (new, needs design review) and Cerrar sesión, with a confirmation;
  * skeletons while loading, and the shared error state with a retry.
* **Data:**
  * `adapters/profileApi.ts` calls `GET /me`;
  * `application/useProfile.ts` uses React Query;
  * `domain/profile.ts` has the pure `initialsOf`, `displayNameOf` and `memberSince`, shown in Bogotá time.
* **`profile_not_found` (404):** the app signs out once and does not retry. Other errors show the retry.
* **The profile leaves the cache when no screen shows it** (`gcTime: 0`).

## Result

* `make lint-mobile`, `make test-mobile` (506 tests) and `make format-check` pass.
* Not checked on a phone.

## Decisions and problems

* **Nothing clears React Query's cache on sign out.** The app client keeps data for 30 seconds. Without `gcTime: 0`, a second account signing in on the same phone could see the first person's profile for a moment. The PR asks M0 to clear the whole cache on sign out.
* **"Información Básica" has the accent.** The design source says "Basica".
* **"Cerrar sesión" is a normal row,** as in the design.
* **The rows of other modules are not added.** Notificaciones (M12), Privacidad y datos and Eliminar cuenta (M13) and Centro de ayuda (open item) add their own rows in `miCuentaRows.ts` through M1's review.
* **Route names are written as strings.** The PR asks M0 for shared route constants.

## Next step

`feature/linked-devices-screen`: Seguridad, with "Cambiar contraseña" and the linked devices.
