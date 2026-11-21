-- Consent text 2026-10-v1, built only from the copy of Conectar banco in docs/modules/M04-consents.md.
-- Legal wording changes need the team. A new wording is a new version, never an edit of this row.
INSERT INTO consent_texts (version, body_md, sha256, published_at)
SELECT version, body_md, sha256(convert_to(body_md, 'UTF8')), published_at
FROM (VALUES ('2026-10-v1', $text$# Autorización para compartir tus datos con Fynk

**Quién recibe tus datos:** Fynk.

**Qué compartirá la entidad que elijas:**

- **Saldos:** saldo disponible de tus cuentas y tarjetas.
- **Movimientos:** ingresos y gastos de los últimos 12 meses.
- **Datos de la cuenta:** tipo de cuenta, nombre del titular y últimos 4 dígitos.

**Finalidad:** mostrarte tus finanzas y recomendaciones dentro de Fynk.

**Vigencia:** 12 meses.

**Fynk nunca podrá:**

- Ver ni guardar tu clave del banco.
- Mover tu dinero, hacer pagos o transferencias.

Puedes revocar el acceso cuando quieras desde Mi cuenta. Se actualizan cada vez que abres Fynk o deslizas para actualizar.

Autorizo a Fynk a consultar y tratar estos datos según la Política de privacidad.
$text$, timestamptz '2026-10-27T00:00:00Z')) AS t (version, body_md, published_at);
