# Fynk design source

**The visual source for Fynk is the design artifact "Diseño App Fynk (Copy)", page "App azul y verde", owned by the team:**
https://claude.ai/artifact/DzjgXy5aVtdYQiTzq6gquk

The original "Diseño App Fynk" (https://claude.ai/artifact/8Kd485z9voJE5QjuUJodL7) belongs to another organization and cannot be read by our tools. All design changes are made in the copy.

Do not invent colors, fonts, spacing, icons or animations. When a screen is missing, build it from components that already appear in the design and ask the team before merging.

## What Claude Code reads, in this order

1. **The code of each screen, in `docs/design/sources/`.** 36 screens, each in two files with the same markup: `light/<Screen>.html` and `dark/<Screen>.html`. Only the colors differ. This is the real design: exact colors, fonts, sizes, radii, the SVG illustrations, icons and logo, the animations (`@keyframes`) and the transitions. Copy values and SVG paths from here, never guess them.
2. **The images of each screen, in `docs/design/screens/`.** `light/<Screen>.png` and `dark/<Screen>.png`, 780 by 1688 (the 390 by 844 phone at 2x), to check that the built screen looks the same in both themes.
3. **The dark value of a color:** `node scripts/design-color-pairs.mjs '#e4f5fc'` pairs every light color with its dark twin across all screens (`--screen Metas` for one screen). Use it when a token is missing in the table below. It cannot pair Dashboard, DashboardDetalles and Recuperar (one theme has an extra color), so compare those two files by hand.

The `.html` files are static exports. Their event handlers (`onClick=""`, `onPointerDown=""`) are empty, so the behavior is described in this file (see Navigation and gestures) and in the module prompts. To see a screen running with its animations, open the artifact.

## Light and dark

* **Default:** the app follows the phone's appearance setting.
* **Override:** the person can choose Sistema, Claro or Oscuro in Mi cuenta › Apariencia. The choice is kept on the phone and applies at once, including on the lock screen.
* **Every screen works in both themes.** Take the light values from `sources/light/` and the dark values from `sources/dark/`. In code they come only from `useTheme()` of `apps/mobile/src/shared/ui/` (M0), never from a hardcoded color.
* The blue headers, the lime accent and the tab bar keep the same colors in dark. Pages, cards, text, borders, soft surfaces, links and the danger colors change (see tokens).

## Navigation and gestures

Several screens can be used with buttons and with gestures. **Every gesture has a button that does the same thing**, and an accessibility action for screen readers. Every screen uses the default for its kind. A screen differs only when the Transition column of the inventory says so.

| Kind | Opens with | Closes or goes back with | Transition (default) |
| --- | --- | --- | --- |
| Tab (Dashboard, Billetera, Recomendaciones, Inversión) | Tap on the tab bar, or a horizontal swipe on the page | Another tab | The pages slide side by side and the notch of the tab bar follows the finger. A carousel inside the page scrolls first and passes the swipe to the tabs at its edge |
| Pushed screen (`push`) | A button, row or link | The "Volver" button, an edge swipe (iOS), or the system back gesture (Android, predictive back) | Slides in from the right, the previous screen moves back |
| Modal (`modal`) | A button | The chevron button, or a swipe down | Slides up from the bottom |
| Bottom sheet (`sheet`) | A button (FAB, "Abonar", "Filtros") | Its button, a tap on the scrim, a drag down, or system back | Scrim `fb-scrim .2s ease-out`, sheet `fb-sheet .38s cubic-bezier(.22,1,.36,1)`, actions `fb-pop .25s cubic-bezier(.34,1.56,.64,1)` |
| Flow change (sign in, unlock, end of onboarding) | The app, when a gate opens or closes | Not possible: no gesture goes back to the login | Fade |

* With Reduce Motion on (`AccessibilityInfo.isReduceMotionEnabled()`), every transition becomes a fade and loops (shine, float, pulse) stop.
* Screens rendered by Keycloak in the system browser (Iniciar sesión, Crear cuenta, Recuperar contraseña) follow the browser, not these rules.

### Gestures inside screens

| Screen | Gesture | Button that does the same |
| --- | --- | --- |
| Dashboard and Dashboard · Detalle de cuentas | Drag the tab under the balance card down to show the accounts, up to hide them (`touch-action:none` on `.tab`) | Tap the tab ("Ver detalle de cuentas", "Ocultar detalle de cuentas") |
| Dashboard, Planes de ahorro | Horizontal carousel with snap (`.hscroll`, `scroll-snap-align:start`) | "Ver todos" opens Metas |
| Detalle de cuenta | Swipe the account card sideways to change account ("1 de 4", `.hero` with `cursor:grab`), swipe down to close | The page dots; the chevron "Volver a Billetera" |
| Estadísticas | The summary card shrinks as the page scrolls (`--p` from 0 to 1 drives `.st-card` and `.st-sum`) | none needed |
| Estadísticas, Inversión | Drag along the line chart to read a day | The period control ("3 días", "Semana", "Mes", "Año") |
| Movimientos, Dashboard, Billetera | Pull to refresh starts a sync (rule 4 of CLAUDE.md, 60 s cooldown) | none: the app also syncs on open |
| Metas, Centro de ayuda, Detalle de cuenta | Tap to expand a goal, a question or the movements list (`mt-open .28s ease-out`) | it is a button |
| Notificaciones, Billetera, Recomendaciones, Inversión | Horizontal chips or cards with snap | Each chip is a button |

## How to bring a screen from the design into React Native

| In the design code | In the app |
| --- | --- |
| Inline `<svg>` (illustrations, icons, Fynk logo) | Copy the paths into a component with `react-native-svg` in `apps/mobile/src/shared/ui/` (icons and logo) or in the module's `ui/` (screen illustrations). Keep `viewBox`. Colors come from the theme |
| A color in `light/X.html` and the same position in `dark/X.html` | One token with a light and a dark value, read with `useTheme()` |
| `@keyframes` and `animation` (floating cards, shine, coin drop, twinkle, rise on enter) | Reanimated with the same duration, delay, easing and loop. Example: `fk-float 6s ease-in-out infinite` becomes a `withRepeat(withTiming(...))` of 6000 ms with `Easing.inOut(Easing.ease)` |
| `cubic-bezier(a,b,c,d)` | `Easing.bezier(a, b, c, d)` with the same numbers |
| `transition` on hover | Pressed state (`Pressable`), with the same duration. Hover does not exist on phones |
| `touch-action:none`, `cursor:grab`, `onPointerDown/Move/Up` | A pan gesture with `react-native-gesture-handler`, animated with Reanimated |
| `.hscroll` with `scroll-snap-type:x mandatory` | Horizontal `ScrollView` or `FlatList` with `snapToInterval` (or the shared `Carousel`) |
| A CSS variable driven by scroll (`--p` in Estadísticas) | `useAnimatedScrollHandler` plus interpolated styles |
| `fb-scrim`, `fb-sheet`, `fb-toast` | The shared `BottomSheet` and `Toast` |
| `@media (prefers-reduced-motion:reduce)` | `AccessibilityInfo.isReduceMotionEnabled()` turns animations off |
| `display: flex` layout, `gap`, `padding` | The same values in React Native styles (flexbox works the same, column is the default direction) |
| Google Fonts links | The same families loaded with `expo-font` (see tokens) |
| `href="X.html"` links between screens | The navigation flow: which button opens which screen |
| Sample data (Laura Gómez, amounts, real bank names) | Only examples. Real data comes from the modules, and the copy changes in the inventory apply |

## Updating the design

1. Edit the copy artifact.
2. Export both themes of every changed screen: the HTML to `docs/design/sources/light/` and `dark/`, the PNG to `docs/design/screens/light/` and `dark/`, with the screen name as the file name (`Metas.html`, `Metas.png`). Ask Claude to do it with access to the team's claude.ai account, or use the artifact's Export menu.
3. Run `node scripts/design-color-pairs.mjs` and add any new color to the tokens table.
4. Commit in a `docs/update-design` pull request. Modules whose screens changed get a Jira task.

## Design tokens

Taken from the design code. M0 copies them into `apps/mobile/src/shared/ui/tokens.ts` as two palettes with the same keys. "Same" means the dark value equals the light one.

| Token | Light | Dark | Where it appears |
| --- | --- | --- | --- |
| `color.primary` | `#2FA8D8` | same | Blue headers, primary buttons, focused input border |
| `color.primaryPressed` | `#279DCC` | same | Primary button pressed |
| `color.primaryDark` | `#1F93C2` | `#62C8F0` | Input icons, icon strokes on tiles |
| `color.primaryDeep` | `#177FA9` | `#62C8F0` | Blue links ("¿Olvidaste tu contraseña?"), positive amounts |
| `color.primaryLight` | `#50C1EB` | same | Avatar, balance card, account cards, tab bar |
| `color.headerShapeA` | `#3AB3E3` | same | Rounded decorative squares on blue headers |
| `color.headerShapeB` | `#47B6E2` | same | Rounded decorative squares, tab hover |
| `color.headerDashboard` | `#2FA8D8` | `#428FAF` | Blue header of the Dashboard and Detalle de cuentas, muted in dark (`#4392B2` on Detalle de cuentas is the same tone, rounded to one value) |
| `color.pullTab` | `#47B6E2` | `#418EAE` | Tab under the balance card that opens Detalle de cuentas |
| `color.surfaceBlue` | `#E4F5FC` | `#1A3444` | Icon tiles, soft boxes (as a background) |
| `color.borderBlue` | `#E4F5FC` | `#223746` | Card and input borders (as a border) |
| `color.borderBlueStrong` | `#BFE6F6` | `#2B5267` | Selected or pressed chip border |
| `color.surfaceBlueSoft` | `#F4FBFE` | `#182A37` | Input backgrounds, pressed rows |
| `color.focusRing` | `#B5E5F7` | same | Focus outline |
| `color.focusRingOnPrimary` | `#DCF5A8` | same | Focus outline on blue (tab bar) |
| `color.accent` | `#A8E03A` | same | Lime: "Empezar", progress bars, step bar, unread dot |
| `color.accentPressed` | `#93CC26` | same | Lime button pressed |
| `color.accentStroke` | `#8FC426` | same | Lime icon strokes |
| `color.accentSoft` | `#D4F294` | same | Lime chips and soft fills |
| `color.accentPale` | `#F4FBE3` | same | Lime pale backgrounds |
| `color.accentTint` | `#F1FADF` | `#223318` | "Poco uso" and "Mayor impacto" chips |
| `color.accentSurface` | `#F8FDEE` | `#1E2C16` | Dashed "Conectar otra cuenta" card |
| `color.accentText` | `#4F7A0B` | `#B6E45A` | Green text on lime chips |
| `color.link` | `#6A9E12` | `#B6E45A` | Green links ("Ver todos", "+ Conectar") |
| `color.linkStrong` | `#5A8A0C` | `#B6E45A` | Green links on sheets ("Regístrate") |
| `color.textPrimary` | `#0F2233` | `#E8F1F6` | Titles, body text, amounts |
| `color.textBody` | `#33495A` | `#BCCBD4` | Long body text (Eliminar cuenta, Estadísticas) |
| `color.textSecondary` | `#5E7482` | `#97ABB8` | Subtitles, descriptions, dates |
| `color.textPlaceholder` | `#8A9BA6` | `#71889A` | Placeholders, small separators |
| `color.divider` | `#EDF1F4` | `#22313D` | Progress track, dividers |
| `color.border` | `#E4ECF0` | `#22313D` | Ghost button and divider lines |
| `color.trackOff` | `#C9D6DE` | `#344755` | Switch track when off |
| `color.danger` | `#C0392B` | `#FF7D6E` | Warning icon, "Eliminar cuenta" |
| `color.dangerPressed` | `#A93226` | same | Red button pressed |
| `color.dangerSoft` | `#FDEAEA` | `#3A1E20` | Warning icon tile |
| `color.dangerSurface` | `#FFF5F5` | `#2E1A1C` | "Eliminar cuenta" button background |
| `color.dangerBorder` | `#F3C7C7` | `#5A2A2A` | "Eliminar cuenta" button border |
| `color.background` | `#FFFFFF` | `#13212D` | Page background, cards, sheets |
| `color.canvas` | `#FFFFFF` | `#0B1620` | Behind the page: overscroll, under the tab bar |
| `color.onPrimary` | `#FFFFFF` | same | Text and icons on blue or lime |
| `color.shadow` | `#0F2233` | `#000000` | Shadow color (`rgba(15,34,51,a)` becomes `rgba(0,0,0,a)` with the same alpha) |
| `font.body` | Plus Jakarta Sans 400, 500, 600, 700 | | All body text and buttons |
| `font.heading` | Space Grotesk 500, 700 | | Titles, logo text, avatar initials |
| `font.amount` | IBM Plex Mono 500, 600 | | Every money value |
| `font.size` | 9 to 38 | | Body 15, small 13, labels 14, screen titles 26 to 34 |
| `radius` | 999 (pills, avatar), 20 (FAB, large cards), 18 (cards), 16 (buttons), 14 (inputs), 10 to 13 (tiles, sheet fields), 24 to 32 (sheet top corners) | | |
| `size.screen` | 390 by 844 | | Every design screen |
| `size.button` | 56 high (primary), 52 (secondary), 48 (icon buttons), 44 (back button), 64 (FAB) | | |
| `size.switch` | 48 by 28, knob 22 | | Toggles in Movimientos and the settings screens |
| `motion.easing` | `ease` for transitions (0.15 to 0.25 s), `ease-in-out` for loops (3 to 8 s), `ease-out` for entrances (0.28 to 0.7 s), `cubic-bezier(.22,1,.36,1)` for sheets and reveals (0.38 to 0.6 s), `cubic-bezier(.34,1.56,.64,1)` for springs (switch knob, FAB, pop) | | |

## Screen inventory

The file name is the same in all four folders: `sources/light/`, `sources/dark/`, `screens/light/` and `screens/dark/`. Transition `default` means the default of its kind (see Navigation and gestures).

| # | Design screen | File | Module | Kind and transition | Buttons and links | Changes decided |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Inicio | `Inicio` | M1 | First screen, default | "Iniciar sesión" opens Login | None |
| 2 | Iniciar sesión | `Login` | M1 | Keycloak theme in the system browser | Registro, Recuperar | Rendered as the Keycloak login theme. The "Huella o Face ID" button moves to the native lock screen and only shows when biometrics were enabled |
| 3 | Crear cuenta | `Registro` | M1 | Keycloak theme | Login, then onboarding | Rendered as the Keycloak registration theme. The cédula field is removed |
| 4 | Recuperar contraseña | `Recuperar` | M1 | Keycloak theme | "Volver a iniciar sesión" | Keycloak sends a link, not a code. Copy: "te enviaremos un enlace" |
| 5 | Dashboard | `Dashboard` | M6, M7, M8, M10 | Tab, default | Avatar → Mi cuenta, chart icon → Estadísticas, bell → Notificaciones, tab → Detalle de cuentas, "Ver todos" → Metas, "Ver todo" → Movimientos, FAB "Registrar gasto o ingreso" → sheet (M7) | Fictional bank names |
| 6 | Dashboard · Detalle de cuentas | `DashboardDetalles` | M6 | **Override:** not a route. The Dashboard header expands in place, by tap or drag on the tab | "Ocultar detalle de cuentas" | Fictional bank names |
| 7 | Mi cuenta | `DetalleCuentas` | M1, M2, M4, M6, M13 | Pushed, default | Seguridad, Notificaciones, Privacidad y datos, Centro de ayuda, Cerrar sesión, Eliminar cuenta | Adds an "Apariencia" row (new, needs design review). The recovery code goes under Seguridad (M2). Consents live in Privacidad y datos › Cuentas conectadas (M4) |
| 8 | Notificaciones | `Notificaciones` | M12 | Pushed, default | Cards open Billetera, Recomendaciones or Mi cuenta | Fictional bank names |
| 9 | Billetera | `Billetera` | M6, M9 | Tab, default | Account cards → Detalle de cuenta, "+ Conectar" → Conectar banco, saving card → Recomendaciones | Adds the price increase tag next to a subscription. Fictional bank names |
| 10 | Recomendaciones | `Recomendaciones` | M11, M10 | Tab, default | Cards open Billetera | "Ver plan" and the transport plan saving are removed. "Fijar tope" opens the caps form |
| 11 | Inversión | `Inversion` | M15 | Tab, default | Period control of the chart | "Tus inversiones" shows own CDTs in Banco Demo. "Explorar" is the same list for everyone with user filters. Calculator added. "+ Invertir" opens the Banco Demo portal |
| 12 | Detalle de cuenta | `CuentaDetalle` | M6, M7, M4 | **Override:** `modal` (chevron up, swipe down to close) | Page dots, Movimientos expand, Tarjetas asociadas, "Eliminar cuenta" | New. "Eliminar cuenta" here removes a connected account: it revokes the consent (M4) or deletes cash (M6). Fictional bank names |
| 13 | Movimientos | `Movimientos` | M7 | Pushed, default | Search, "Filtros" → sheet, rows → movement detail, "Cargar 20 más" | New. Fictional bank names |
| 14 | Estadísticas | `Estadisticas` | M10 | Pushed, default | Period control, "Volver" | New. Every number comes from the analytics module |
| 15 | Metas de ahorro | `Metas` | M8 | Pushed, default | Expand a goal, "Abonar" with amount chips, "Nueva meta" (extended FAB) → sheet | New. "Se descuenta de Bancolombia · Ahorros" changes: Fynk never moves money, an aporte is a record. Fictional bank names |
| 16 | Seguridad | `CfgSeguridad` | M1, M2 | Pushed, default | "Cambiar contraseña", Face ID o huella switch, close a session, "Cerrar todas las demás sesiones" | New. "Cambiar contraseña" opens Keycloak (M1). The switch is the biometric unlock (M2). "Dispositivos activos" are the linked devices (M1). Adds "Código de recuperación" (M2) |
| 17 | Ajustes de notificaciones | `CfgNotificaciones` | M12 | Pushed, default | Switches and option chips | New. Adds the "Gastos grandes" and "Saldo bajo" local alerts |
| 18 | Privacidad y datos | `CfgPrivacidad` | M13, M4, M11 | Pushed, default | Switches, "Revocar", "Descargar mis datos", policy and terms | New. "Revocar" revokes the consent at once (M4). "Recomendaciones con IA" turns the AI snapshot off (M11). "Mejorar Fynk" (anonymous statistics) and "Novedades y ofertas" (Fynk Plus) are hidden until the team decides (CLAUDE.md, open items). Fictional bank names |
| 19 | Centro de ayuda | `CfgAyuda` | M13 | Pushed, default | Questions expand, Correo, WhatsApp, "Reportar un problema" | New. The Fynk Plus question is hidden until Fynk Plus is planned. WhatsApp waits for a team decision |
| 20 | Eliminar cuenta | `CfgEliminar` | M13 | Pushed, default | "Descarga tus datos primero" → Privacidad, reasons, type ELIMINAR, "Eliminar mi cuenta", "Cancelar y volver" | New. The Fynk Plus line is hidden. Deletion follows Ley 1581 |
| 21 | Configuración · Aviso | `OnbIntro` | M3 | Flow change into onboarding, fade | "Comenzar configuración", "Omitir por ahora" | None |
| 22 | Configuración · 1 Correo | `OnbCorreo` | M3, M1 | Pushed inside onboarding, default | Back to the previous step, Omitir | **Now step 1.** Link instead of a 6 digit code: "Te enviamos un enlace", buttons "Ya lo verifiqué" and "Reenviar" |
| 23 | Configuración · 2 Nombre | `OnbNombre` | M3 | Pushed inside onboarding, default | "Continuar", back, Omitir | **Now step 2** |
| 24 | Configuración · 3 Cuentas | `OnbCuentas` | M3, M5, M6 | Pushed inside onboarding, default | "Agregar otra cuenta" → Conectar banco | Banco Demo and Billetera Demo instead of Bancolombia and Daviplata |
| 25 | Configuración · 4 Metas | `OnbMetas` | M3, M8 | Pushed inside onboarding, default | Back, Omitir | None |
| 26 | Configuración · 5 Gastos recurrentes | `OnbGastos` | M3, M9 | Pushed inside onboarding, default | Back, Omitir | None |
| 27 | Configuración · Listo | `OnbListo` | M3 | **Override:** no back gesture. "Ir a mi dashboard" is a flow change (fade) | "Ir a mi dashboard" | Shows a reminder to save the recovery code if it was not confirmed |
| 28 | Configuración · Omitir | `OnbOmitir` | M3 | **Override:** `modal` | "Volver a la configuración", go to the Dashboard | None |
| 29 | Conectar banco | `ConectarBanco` | M4, M5 | Pushed, default | "Volver" | Copy: "Se actualizan cada vez que abres Fynk o deslizas para actualizar". Fictional bank names |
| 30 | Conectar banco copy | `ConectarBanco-37ko` | none | none | | Variant of screen 29, use screen 29 |
| 31 | Suscripción · Promoción | `SubPromo` | not planned | | | Fynk Plus offer |
| 32 | Suscripción · Pago | `SubPago` | not planned | | | Plan and payment method |
| 33 | Suscripción · Procesando | `SubProcesando` | not planned | | | Payment in progress |
| 34 | Suscripción · Pago exitoso | `SubExito` | not planned | | | Success and receipt |
| 35 | Suscripción · Pago pendiente | `SubPendiente` | not planned | | | Payment pending verification |
| 36 | Suscripción · Pago rechazado | `SubRechazado` | not planned | | | Payment rejected |

Screens 31 to 36 (Fynk Plus) are in the design but not in Jira or in any module yet. Do not build them until the team adds them to the plan.

## Screens the design does not have yet

Build these from existing components, in light and dark. Each module prompt describes its own. List them in the pull request as "new screen, needs design review".

| Screen | Module | Reuse |
| --- | --- | --- |
| Lock screen with biometrics | M2 | Header of "Iniciar sesión", "Huella o Face ID" button |
| Recovery code (show once, confirm saved) | M2 | Card style of "Configuración · Listo" |
| Restore on a new phone (code or approval) | M2 | Code input of "Configuración · 1 Correo" |
| Approve a new device (old phone) | M2 | Notification card plus primary button |
| Apariencia (Sistema, Claro, Oscuro) | M0 | Rows and option chips of "Ajustes de notificaciones" |
| Consent list and consent detail | M4 | "Cuentas conectadas" of "Privacidad y datos", cards of "Conectar banco" |
| Movement detail and manual movement form | M7 | Rows of "Movimientos", sheet of the Dashboard FAB |
| Caps list and cap form | M10 | Inputs of "Configuración · 4 Metas" |
| Subscription detail with usage and cancellation | M9 | Subscription row of "Billetera" |
| Banco Demo portal (web) | M16 | Its own simple look, clearly marked as a simulated bank |
