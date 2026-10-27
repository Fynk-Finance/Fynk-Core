# M12 Notifications center

| Item | Value |
| --- | --- |
| Phase | 2 |
| Stories | HU-053 SCRUM-70 (3) |
| Points | 3 |
| Owner | Karol (`@Karol2905`) |
| Owns | `apps/mobile/src/modules/notifications/` |
| Depends on | M0, M2 (vault) |
| Used by | M2, M5, M8, M9, M10, M11 (they call `NotificationsPort`) |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M12 Notifications center of Fynk: the in app inbox and local notifications scheduled on the phone. There are no server push notifications, because financial events only exist after a sync with the app open.

## Read first

1. `CLAUDE.md` (Architecture rule 4), `docs/modules/00-shared-contracts.md` section 3.4.
2. Design PNGs `08-notificaciones.png` and `07-mi-cuenta.png` and `07-mi-cuenta-2.png` (Notificaciones row). Read the code of the same screens in `docs/design/source/` first (file map in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs are for checking the result.
3. Jira SCRUM-70.

## Story HU-053 (SCRUM-70), criteria

* Agrupa los avisos en Hoy y Esta semana, con contador de no leídos y "Marcar como leídas".
* El ícono de la campana muestra si hay avisos sin leer.
* Los recordatorios programados funcionan como notificaciones locales aunque la aplicación esté cerrada.
* No se envían notificaciones push desde el servidor.
* El usuario puede activar o desactivar cada tipo de aviso desde Mi cuenta.

## Screen (match the PNG)

* Back arrow, title "Notificaciones", "<n> sin leer", green link "Marcar como leídas".
* Sections "HOY", "ESTA SEMANA", "ANTES". Rows: icon tile (lime for payments and recommendations, light blue for income, goals, sync and subscriptions), bold title, body, time on the right for today ("9:12") or the weekday for this week ("Lun"), lime dot when unread.
* Tapping a row marks it read and opens its `deepLink`.
* Empty state: "No tienes avisos por ahora."
* **Mi cuenta, Notificaciones** (new): one switch per kind with Spanish labels: Pagos próximos, Ingresos recibidos, Recomendaciones, Avance de metas, Sincronización, Renovación de suscripciones, Aumentos de precio, Topes de gasto, Nuevos dispositivos. `device_approval` cannot be turned off.

## Technical design

* Implements `NotificationsPort` from the shared contracts. Replace M0's stub.
* `expo-notifications` for local scheduling only (no push token is ever requested from the server). Ask for permission the first time a module schedules something, with a short explanation screen before the OS prompt.
* Vault tables through `registerVaultMigrations('notifications', ...)`: `notifications_inbox (id, kind, title, body, deep_link, dedupe_key unique, created_at, read_at)`, `notifications_scheduled (id, kind, fire_at, payload_json, os_id)`, `notifications_settings (kind, enabled)`.
* `schedule` stores the payload, schedules the OS notification and, when the app next opens after `fire_at`, moves it into the inbox (so it appears in the list even if the user never tapped it).
* `notify` with an existing `dedupeKey` does nothing.
* Keep at most 200 inbox rows, delete the oldest read ones first.
* OS notification text never includes amounts when the phone is locked: use the title only on the lock screen (iOS `hiddenPreviewsBodyPlaceholder`, Android `VISIBILITY_PRIVATE`), the full body inside the app.
* Bell badge: `useUnreadCount()` used by M0's `HeaderBlue`.
* Backup collection `notifications.settings` (settings only, not the inbox).
* Exports: `notificationsPort`, `NotificationsScreen`, `NotificationSettingsScreen`, `useUnreadCount()`.

## Work plan (one branch each, from `develop`)

1. `feature/notifications-port-and-inbox`: tables, port, inbox screen, bell badge.
2. `feature/local-scheduled-notifications`: scheduling, permission flow, moving fired items to the inbox, lock screen privacy.
3. `feature/notification-settings`: settings screen, backup collection.

## Tests

* Grouping into Hoy, Esta semana and Antes with an injected clock in Bogotá time.
* The same dedupe key twice creates one row.
* A disabled kind is neither stored nor scheduled.
* Manual test on a real Android and iPhone: a reminder fires with the app closed and the amount is hidden on the lock screen.

## Done when

* All criteria pass and the Gate C notification item passes.

## Ask before

* Adding server push or any remote notification service.
