# Fynk design source

**The visual source for Fynk is the design artifact "Diseño App Fynk (Copy)", page "App azul y verde", owned by the team:**
https://claude.ai/artifact/DzjgXy5aVtdYQiTzq6gquk

The original "Diseño App Fynk" (https://claude.ai/artifact/8Kd485z9voJE5QjuUJodL7) belongs to another organization and cannot be read by our tools. All design changes are made in the copy.

Do not invent colors, fonts, spacing, icons or animations. When a screen is missing, build it from components that already appear in the design and ask the team before merging.

## What Claude Code reads, in this order

1. **The code of each screen, in `docs/design/source/`.** 28 files `Verde*.dc.html`, one per screen of "App azul y verde", plus `canvas.json` (screen titles, size 390 by 844, order). This is the real design: exact colors, fonts, sizes, radii, the SVG illustrations, icons and logo, the animations (`@keyframes`) and the transitions. Copy values and SVG paths from here, never guess them.
2. **The images of each screen, in `docs/design/screens/`.** 25 PNG files, to check that the built screen looks the same. Screens taller than the phone have a second image with the suffix `-2`.

The `.dc.html` files are design source, not a runnable app. They reference a design runtime (`support.js`, the `<x-dc>` tag and `{{...}}` placeholders) that is not in the repository. To see a screen running with its animations, open the artifact.

## How to bring a screen from the design into React Native

| In the design code | In the app |
| --- | --- |
| Inline `<svg>` (illustrations, icons, Fynk logo) | Copy the paths into a component with `react-native-svg` in `apps/mobile/src/shared/ui/` (icons and logo) or in the module's `ui/` (screen illustrations). Keep `viewBox` and colors |
| `@keyframes` and `animation` (floating cards, shine, coin drop, twinkle, rise on enter) | Reanimated with the same duration, delay, easing and loop. Example: `fk-float 6s ease-in-out infinite` becomes a `withRepeat(withTiming(...))` of 6000 ms with `Easing.inOut(Easing.ease)` |
| `transition` on hover | Pressed state (`Pressable`), with the same duration. Hover does not exist on phones |
| `@media (prefers-reduced-motion:reduce)` | `AccessibilityInfo.isReduceMotionEnabled()` turns animations off |
| `display: flex` layout, `gap`, `padding` | The same values in React Native styles (flexbox works the same, column is the default direction) |
| Google Fonts links | The same families loaded with `expo-font` (see tokens) |
| `href="VerdeX.dc.html"` links between screens | The navigation flow: which button opens which screen |
| `{{placeholders}}` and the `DCLogic` script | Small UI state examples (show password, expand a card). Rebuild them as component state |
| Sample data (Laura Gómez, amounts) | Only examples. Real data comes from the modules, and copy changes decided on 25 Oct 2026 apply (see inventory) |

## Updating the design

1. Edit the copy artifact.
2. Ask Claude (in claude.ai, or Claude Code with access to the team's claude.ai account): "Read the files of https://claude.ai/artifact/DzjgXy5aVtdYQiTzq6gquk and update `docs/design/source/` and `docs/design/screens/` with the screens that changed." Or use the artifact's Export menu (HTML for the full design, PNG for an image) and copy the files by hand.
3. Commit in a `docs/update-design` pull request. Modules whose screens changed get a Jira task.

## Design tokens

Taken from the design code. M0 copies them into `apps/mobile/src/shared/ui/tokens.ts`.

| Token | Value | Where it appears |
| --- | --- | --- |
| `color.primary` | `#2FA8D8` | Blue headers, primary buttons, focused input border |
| `color.primaryPressed` | `#279DCC` | Primary button pressed |
| `color.primaryDark` | `#1F93C2` | Input icons, icon strokes on tiles |
| `color.primaryDeep` | `#177FA9` | Blue links ("¿Olvidaste tu contraseña?") |
| `color.primaryLight` | `#50C1EB` | Avatar, balance card, account cards, second word of the Inicio title |
| `color.headerShapeA` | `#3AB3E3` | Rounded decorative squares on blue headers |
| `color.headerShapeB` | `#47B6E2` | Rounded decorative squares, tab hover |
| `color.surfaceBlue` | `#E4F5FC` | Icon tiles, input borders, soft boxes |
| `color.surfaceBlueSoft` | `#F4FBFE` | Input backgrounds, pressed rows |
| `color.focusRing` | `#B5E5F7` | Focus outline |
| `color.accent` | `#A8E03A` | Lime: "Empezar", lime band behind sheets, progress bars, step bar, unread dot |
| `color.accentPressed` | `#93CC26` | Lime button pressed |
| `color.accentSoft` | `#D4F294` | Lime chips and soft fills |
| `color.accentPale` | `#F4FBE3` | Lime pale backgrounds |
| `color.link` | `#6A9E12` | Green links ("Ver todos", "+ Conectar") |
| `color.linkStrong` | `#5A8A0C` | Green links on white sheets ("Regístrate") |
| `color.textPrimary` | `#0F2233` | Titles, body text, amounts |
| `color.textSecondary` | `#5E7482` | Subtitles, descriptions, dates |
| `color.textPlaceholder` | `#8A9BA6` | Placeholders, small separators text |
| `color.divider` | `#EDF1F4` | Progress track, dividers |
| `color.border` | `#E4ECF0` | Ghost button and divider lines |
| `color.danger` | `#C0392B` | Warning icon, "Eliminar cuenta" |
| `color.dangerSoft` | `#FDEAEA` | Warning icon tile |
| `color.background` | `#FFFFFF` | Page background |
| `font.body` | Plus Jakarta Sans 400, 500, 600, 700 | All body text and buttons |
| `font.heading` | Space Grotesk 500, 700 | Titles, logo text, avatar initials |
| `font.amount` | IBM Plex Mono 500, 600 | Every money value |
| `font.size` | 10, 11, 12, 13, 14, 15, 16, 17, 20, 22, 26, 28, 34 | Body 15, small 13, labels 14, screen titles 26 to 34 |
| `radius` | 999 (pills, avatar), 18 (cards), 16 (buttons), 14 (inputs), 10 to 12 (tiles), 24 to 32 (sheet top corners) | |
| `size.screen` | 390 by 844 | Every design screen |
| `size.button` | 56 high (primary), 52 (secondary), 48 (icon buttons), 44 (back button) | |
| `motion.easing` | `ease` for transitions (0.15 to 0.25 s), `ease-in-out` for loops (3 to 8 s), `ease-out` for entrances (0.5 to 0.7 s) | |

## Screen inventory

| # | Design screen | Code in `docs/design/source/` | Image in `docs/design/screens/` | Module | Changes decided on 25 Oct 2026 |
| --- | --- | --- | --- | --- | --- |
| 1 | Inicio | `VerdeInicio.dc.html` | `01-inicio.png` | M1 | None |
| 2 | Iniciar sesión | `VerdeLogin.dc.html` | `02-iniciar-sesion.png` | M1 | Rendered as the Keycloak login theme. The "Huella o Face ID" button moves to the native lock screen and only shows when biometrics were enabled |
| 3 | Crear cuenta | `VerdeRegistro.dc.html` | `03-crear-cuenta.png` | M1 | Rendered as the Keycloak registration theme. The cédula field is removed |
| 4 | Recuperar contraseña | `VerdeRecuperar.dc.html` | `04-recuperar-contrasena.png` | M1 | Keycloak sends a link, not a code. Copy: "te enviaremos un enlace" |
| 5 | Dashboard | `VerdeDashboard.dc.html` | `05-dashboard.png` | M6, M7, M8, M10 | None |
| 6 | Dashboard · Detalle de cuentas | `VerdeDashboardDetalles.dc.html` | `06-dashboard-detalle-cuentas.png` | M6 | Fictional bank names |
| 7 | Mi cuenta | `VerdeDetalleCuentas.dc.html` | `07-mi-cuenta.png`, `07-mi-cuenta-2.png` | M1, M2, M4, M6, M13 | "Mis tarjetas" becomes "Mis cuentas" and also lists credit cards. Adds "Dispositivos vinculados", "Código de recuperación" and "Consentimientos" |
| 8 | Notificaciones | `VerdeNotificaciones.dc.html` | `08-notificaciones.png` | M12 | Fictional bank names |
| 9 | Billetera | `VerdeBilletera.dc.html` | `09-billetera.png`, `09-billetera-2.png` | M6, M9 | Adds the price increase tag next to a subscription |
| 10 | Recomendaciones | `VerdeRecomendaciones.dc.html` | `10-recomendaciones.png`, `10-recomendaciones-2.png` | M11, M10 | "Ver plan" and the transport plan saving are removed. "Fijar tope" opens the caps form |
| 11 | Inversión | `VerdeInversion.dc.html` | `11-inversion.png`, `11-inversion-2.png` | M15 | "Tus inversiones" shows own CDTs in Banco Demo. "Explorar" is the same list for everyone with user filters. Calculator added. "+ Invertir" opens the Banco Demo portal |
| 12 | Configuración · Aviso | `VerdeOnbIntro.dc.html` | `12-config-aviso.png` | M3 | None |
| 13 | Configuración · 1 Nombre | `VerdeOnbNombre.dc.html` | `13-config-nombre.png` | M3 | None |
| 14 | Configuración · 2 Correo | `VerdeOnbCorreo.dc.html` | `14-config-correo.png` | M3, M1 | Link instead of a 6 digit code: "Te enviamos un enlace", buttons "Ya lo verifiqué" and "Reenviar" |
| 15 | Configuración · 3 Cuentas | `VerdeOnbCuentas.dc.html` | `15-config-cuentas.png` | M3, M5, M6 | Banco Demo and Billetera Demo instead of Bancolombia and Daviplata in the demo |
| 16 | Configuración · 4 Metas | `VerdeOnbMetas.dc.html` | `16-config-metas.png`, `16-config-metas-2.png` | M3, M8 | None |
| 17 | Configuración · 5 Gastos recurrentes | `VerdeOnbGastos.dc.html` | `17-config-recurrentes.png` | M3, M9 | None |
| 18 | Configuración · Listo | `VerdeOnbListo.dc.html` | `18-config-listo.png` | M3 | Shows a reminder to save the recovery code if it was not confirmed |
| 19 | Configuración · Omitir (advertencia) | `VerdeOnbOmitir.dc.html` | `19-config-omitir.png` | M3 | None |
| 20 | Conectar banco | `VerdeConectarBanco.dc.html` | `20-conectar-banco.png` | M4, M5 | Copy: "Se actualizan cada vez que abres Fynk o deslizas para actualizar" |
| 21 | Conectar banco copy | `VerdeConectarBanco-37ko.dc.html` | none | none | Variant of screen 20, use screen 20 |
| 22 | Suscripción · Promoción | `VerdeSubPromo.dc.html` | none yet | not planned | New in the design: Fynk Plus offer |
| 23 | Suscripción · Pago | `VerdeSubPago.dc.html` | none yet | not planned | New: plan and payment method |
| 24 | Suscripción · Procesando | `VerdeSubProcesando.dc.html` | none yet | not planned | New: payment in progress |
| 25 | Suscripción · Pago exitoso | `VerdeSubExito.dc.html` | none yet | not planned | New: success and receipt |
| 26 | Suscripción · Pago pendiente | `VerdeSubPendiente.dc.html` | none yet | not planned | New: payment pending verification |
| 27 | Suscripción · Pago rechazado | `VerdeSubRechazado.dc.html` | none yet | not planned | New: payment rejected |

Screens 22 to 27 (Fynk Plus) are in the design but not in Jira or in any module yet. Do not build them until the team adds them to the plan.

## Screens the design does not have yet

Build these from existing components. Each module prompt describes its own.

| Screen | Module | Reuse |
| --- | --- | --- |
| Lock screen with biometrics | M2 | Header of "Iniciar sesión", "Huella o Face ID" button |
| Recovery code (show once, confirm saved) | M2 | Card style of "Configuración · Listo" |
| Restore on a new phone (code or approval) | M2 | Code input of "Configuración · 2 Correo" |
| Approve a new device (old phone) | M2 | Notification card plus primary button |
| Linked devices | M1 | List style of "Gestión de cuenta" |
| Consent list and consent detail | M4 | Cards of "Conectar banco" |
| Account detail | M6 | Header of "Billetera" plus "Movimientos" list |
| All movements with filters and search | M7 | "Movimientos" list, chips of "Recomendaciones" |
| Spending by category and trends | M10 | Donut of "Recomendaciones", line chart of "Inversión" |
| Caps list and cap form | M10 | Inputs of "Configuración · 4 Metas" |
| Goal detail and add contribution | M8 | Goal card of the Dashboard |
| Subscription detail with usage and cancellation | M9 | Subscription row of "Billetera" |
| Privacy policy, my data, delete account | M13 | List style of "Mi cuenta" |
| Banco Demo portal (web) | M16 | Its own simple look, clearly marked as a simulated bank |
