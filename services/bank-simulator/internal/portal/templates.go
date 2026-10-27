package portal

const portalTemplates = `
{{define "header"}}
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Banco Demo · Portal Simulado</title>
  <style>
    :root {
      --bg: #f4f6f8;
      --card-bg: #ffffff;
      --text: #1a202c;
      --text-muted: #718096;
      --primary: #1b4332;
      --primary-light: #2d6a4f;
      --accent: #52b788;
      --border: #e2e8f0;
      --danger: #e53e3e;
      --danger-bg: #fff5f5;
      --success-bg: #f0fff4;
      --success: #38a169;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: var(--bg); color: var(--text); line-height: 1.5; }
    .banner { background-color: #2d3748; color: #f7fafc; text-align: center; padding: 8px 16px; font-size: 0.85rem; font-weight: 600; letter-spacing: 0.5px; }
    .banner span { background-color: #ecc94b; color: #744210; padding: 2px 6px; border-radius: 4px; margin-right: 8px; font-size: 0.75rem; text-transform: uppercase; }
    header { background-color: var(--primary); color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
    .brand { display: flex; align-items: center; gap: 10px; font-size: 1.3rem; font-weight: 700; }
    .brand svg { width: 28px; height: 28px; fill: var(--accent); }
    .user-info { font-size: 0.9rem; color: #d8f3dc; }
    nav { background-color: white; border-bottom: 1px solid var(--border); display: flex; padding: 0 24px; gap: 8px; overflow-x: auto; }
    nav a { text-decoration: none; color: var(--text-muted); padding: 14px 16px; font-weight: 600; font-size: 0.95rem; border-bottom: 3px solid transparent; transition: all 0.2s; white-space: nowrap; }
    nav a:hover { color: var(--primary); }
    nav a.active { color: var(--primary); border-bottom-color: var(--primary); }
    .container { max-width: 1000px; margin: 24px auto; padding: 0 16px; }
    .card { background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border); padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .card h2 { font-size: 1.15rem; color: var(--primary); margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .acc-card { border: 1px solid var(--border); border-radius: 6px; padding: 16px; background: #fafafa; }
    .acc-card .acc-name { font-size: 0.9rem; font-weight: 600; color: var(--text-muted); }
    .acc-card .acc-num { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; }
    .acc-card .acc-bal { font-size: 1.4rem; font-weight: 700; color: var(--primary); }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.9rem; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
    th { background: #f8fafc; font-weight: 600; color: var(--text-muted); }
    .money-pos { color: var(--success); font-weight: 600; }
    .money-neg { color: var(--text); }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .badge-active { background: #def7ec; color: #03543f; }
    .badge-revoked { background: #fde8e8; color: #9b1c1c; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: var(--text); }
    input, select { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.95rem; }
    button, .btn { background-color: var(--primary); color: white; border: none; padding: 10px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s; text-decoration: none; display: inline-block; }
    button:hover, .btn:hover { background-color: var(--primary-light); }
    .btn-sm { padding: 6px 10px; font-size: 0.8rem; }
    .btn-danger { background-color: var(--danger); }
    .btn-danger:hover { background-color: #c53030; }
    .alert-success { background: var(--success-bg); border: 1px solid #c6f6d5; color: var(--success); padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; }
    .alert-danger { background: var(--danger-bg); border: 1px solid #fed7d7; color: var(--danger); padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="banner">
    <span>Simulado</span> Banco simulado para pruebas. No es un banco real.
  </div>
  <header>
    <div class="brand">
      <svg viewBox="0 0 24 24"><path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z"/></svg>
      Banco Demo
    </div>
    <div class="user-info">
      Hola, <strong>{{.Customer.DisplayName}}</strong> ({{.Customer.CustomerID}})
    </div>
  </header>
  <nav>
    <a href="/portal" class="{{if eq .ActiveTab "resumen"}}active{{end}}">Resumen de Cuentas</a>
    <a href="/portal/actions" class="{{if eq .ActiveTab "acciones"}}active{{end}}">Operaciones</a>
    <a href="/portal/subscriptions" class="{{if eq .ActiveTab "suscripciones"}}active{{end}}">Suscripciones</a>
    <a href="/portal/consents" class="{{if eq .ActiveTab "consentimientos"}}active{{end}}">Consentimientos Fynk</a>
    <a href="/portal/admin" class="{{if eq .ActiveTab "admin"}}active{{end}}">Herramientas Demo (Admin)</a>
  </nav>
  <div class="container">
    {{if .Notice}}
      <div class="alert-success">{{.Notice}}</div>
    {{end}}
    {{if .Error}}
      <div class="alert-danger">{{.Error}}</div>
    {{end}}
{{end}}

{{define "footer"}}
  </div>
</body>
</html>
{{end}}

{{define "dashboard"}}
{{template "header" .}}
  <div class="card">
    <h2>Mis Cuentas</h2>
    <div class="grid">
      {{range .Accounts}}
        <div class="acc-card">
          <div class="acc-name">{{.Name}}</div>
          <div class="acc-num">{{.MaskedNumber}} · {{.Type}}</div>
          <div class="acc-bal">${{formatMoney .BalanceMinor}} COP</div>
          {{if eq .Type "CREDIT_CARD"}}
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Deuda actual: ${{formatMoney .BalanceMinor}}</div>
          {{end}}
          {{if .CDT}}
            <div style="font-size: 0.8rem; color: var(--primary-light); margin-top: 4px;">Tasa: {{.CDT.RateEa}}% E.A. · Vence: {{.CDT.Maturity}}</div>
          {{end}}
          <div style="margin-top: 12px;">
            <a href="/portal/account?id={{.ID}}" class="btn btn-sm">Ver movimientos</a>
          </div>
        </div>
      {{end}}
    </div>
  </div>

  <div class="card">
    <h2>Últimos Movimientos Registrados</h2>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Descripción</th>
          <th>Categoría</th>
          <th>Monto COP</th>
        </tr>
      </thead>
      <tbody>
        {{range $i, $tx := .Transactions}}
          {{if lt $i 15}}
          <tr>
            <td>{{$tx.BookingDateTime.Format "2006-01-02 15:04"}}</td>
            <td><strong>{{$tx.Description}}</strong></td>
            <td><span class="badge" style="background:#edf2f7;">{{if $tx.Category}}{{$tx.Category}}{{else}}general{{end}}</span></td>
            <td class="{{if gt $tx.AmountMinor 0}}money-pos{{else}}money-neg{{end}}">
              {{if gt $tx.AmountMinor 0}}+{{end}}${{formatMoney $tx.AmountMinor}}
            </td>
          </tr>
          {{end}}
        {{end}}
      </tbody>
    </table>
  </div>
{{template "footer" .}}
{{end}}

{{define "account"}}
{{template "header" .}}
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <h2>Movimientos de {{.Account.Name}} ({{.Account.MaskedNumber}})</h2>
      <a href="/portal" class="btn btn-sm" style="background:#718096;">&larr; Volver</a>
    </div>
    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary); margin-bottom: 16px;">
      Saldo actual: ${{formatMoney .Account.BalanceMinor}} COP
    </div>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Fecha</th>
          <th>Descripción</th>
          <th>Comercio</th>
          <th>Categoría</th>
          <th>Monto COP</th>
        </tr>
      </thead>
      <tbody>
        {{range .Transactions}}
          <tr>
            <td style="font-family: monospace; font-size: 0.8rem; color: #718096;">{{.ID}}</td>
            <td>{{.BookingDateTime.Format "2006-01-02 15:04"}}</td>
            <td>{{.Description}}</td>
            <td>{{if .MerchantName}}{{.MerchantName}}{{else}}-{{end}}</td>
            <td>{{if .Category}}{{.Category}}{{else}}-{{end}}</td>
            <td class="{{if gt .AmountMinor 0}}money-pos{{else}}money-neg{{end}}">
              {{if gt .AmountMinor 0}}+{{end}}${{formatMoney .AmountMinor}}
            </td>
          </tr>
        {{end}}
      </tbody>
    </table>
  </div>
{{template "footer" .}}
{{end}}

{{define "actions"}}
{{template "header" .}}
  <div class="grid" style="grid-template-columns: 1fr 1fr;">
    <div class="card">
      <h2>1. Registrar un Pago o Gasto</h2>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">
        Simula una compra en un comercio. Aparece de inmediato en la API de Fynk.
      </p>
      <form method="POST" action="/portal/actions/pay">
        <div class="form-group">
          <label>Cuenta de origen</label>
          <select name="account_id" required>
            {{range .Accounts}}
              {{if ne .Type "CDT"}}
                <option value="{{.ID}}">{{.Name}} ({{.MaskedNumber}}) - Saldo: ${{formatMoney .BalanceMinor}}</option>
              {{end}}
            {{end}}
          </select>
        </div>
        <div class="form-group">
          <label>Comercio / Establecimiento</label>
          <input type="text" name="merchant" placeholder="Ej: EXITO, NETFLIX, JUAN VALDEZ" required>
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select name="category">
            <option value="groceries">Mercado</option>
            <option value="restaurants">Restaurantes</option>
            <option value="treats">Antojos</option>
            <option value="shopping">Compras</option>
            <option value="transport">Transporte</option>
            <option value="utilities">Servicios Públicos</option>
          </select>
        </div>
        <div class="form-group">
          <label>Monto COP (en pesos)</label>
          <input type="text" name="amount" placeholder="Ej: 45000" required>
        </div>
        <button type="submit">Efectuar Pago</button>
      </form>
    </div>

    <div class="card">
      <h2>2. Transferir entre mis Cuentas</h2>
      <form method="POST" action="/portal/actions/transfer">
        <div class="form-group">
          <label>Desde cuenta</label>
          <select name="from_account" required>
            {{range .Accounts}}
              {{if ne .Type "CDT"}}
                <option value="{{.ID}}">{{.Name}} ({{.MaskedNumber}})</option>
              {{end}}
            {{end}}
          </select>
        </div>
        <div class="form-group">
          <label>Hacia cuenta</label>
          <select name="to_account" required>
            {{range .Accounts}}
              {{if ne .Type "CDT"}}
                <option value="{{.ID}}">{{.Name}} ({{.MaskedNumber}})</option>
              {{end}}
            {{end}}
          </select>
        </div>
        <div class="form-group">
          <label>Monto COP</label>
          <input type="text" name="amount" placeholder="Ej: 100000" required>
        </div>
        <button type="submit">Transferir</button>
      </form>
    </div>

    <div class="card">
      <h2>3. Pagar Tarjeta de Crédito</h2>
      <form method="POST" action="/portal/actions/pay-card">
        <div class="form-group">
          <label>Cuenta de Débito (Ahorros / Billetera)</label>
          <select name="from_account" required>
            {{range .Accounts}}
              {{if or (eq .Type "SAVINGS") (eq .Type "WALLET")}}
                <option value="{{.ID}}">{{.Name}} ({{.MaskedNumber}})</option>
              {{end}}
            {{end}}
          </select>
        </div>
        <div class="form-group">
          <label>Tarjeta a pagar</label>
          <select name="card_account" required>
            {{range .Accounts}}
              {{if eq .Type "CREDIT_CARD"}}
                <option value="{{.ID}}">{{.Name}} ({{.MaskedNumber}}) - Deuda: ${{formatMoney .BalanceMinor}}</option>
              {{end}}
            {{end}}
          </select>
        </div>
        <div class="form-group">
          <label>Monto a abonar COP</label>
          <input type="text" name="amount" placeholder="Ej: 500000" required>
        </div>
        <button type="submit">Abonar a Tarjeta</button>
      </form>
    </div>

    <div class="card">
      <h2>4. Invertir / Abrir CDT</h2>
      <form method="POST" action="/portal/actions/open-cdt">
        <div class="form-group">
          <label>Producto CDT</label>
          <select name="product_id" required>
            {{range .CdtProducts}}
              <option value="{{.ID}}">{{.Name}} ({{.TermDays}} días, {{.RateEa}}% E.A.)</option>
            {{end}}
          </select>
        </div>
        <div class="form-group">
          <label>Fondear desde cuenta</label>
          <select name="from_account" required>
            {{range .Accounts}}
              {{if eq .Type "SAVINGS"}}
                <option value="{{.ID}}">{{.Name}} ({{.MaskedNumber}})</option>
              {{end}}
            {{end}}
          </select>
        </div>
        <div class="form-group">
          <label>Monto a invertir COP</label>
          <input type="text" name="amount" placeholder="Ej: 1000000" required>
        </div>
        <button type="submit">+ Abrir CDT</button>
      </form>
    </div>
  </div>
{{template "footer" .}}
{{end}}

{{define "subscriptions"}}
{{template "header" .}}
  <div class="card">
    <h2>Suscripciones Activas</h2>
    <table>
      <thead>
        <tr>
          <th>Comercio</th>
          <th>Monto Mensual</th>
          <th>Día de Cobro</th>
          <th>Estado</th>
          <th>Acciones de Simulación</th>
        </tr>
      </thead>
      <tbody>
        {{range .Subscriptions}}
          <tr>
            <td><strong>{{.Merchant}}</strong></td>
            <td>${{formatMoney .AmountMinor}} COP</td>
            <td>Día {{.AnchorDay}}</td>
            <td>
              {{if .Active}}
                <span class="badge badge-active">Activa</span>
              {{else}}
                <span class="badge badge-revoked">Cancelada</span>
              {{end}}
            </td>
            <td>
              {{if .Active}}
                <form method="POST" action="/portal/subscriptions/charge-now" style="display:inline;">
                  <input type="hidden" name="sub_id" value="{{.ID}}">
                  <button type="submit" class="btn btn-sm" style="background:#2b6cb0;">⚡ Cobrar ahora</button>
                </form>
                <form method="POST" action="/portal/subscriptions/cancel" style="display:inline; margin-left: 6px;">
                  <input type="hidden" name="sub_id" value="{{.ID}}">
                  <button type="submit" class="btn btn-sm btn-danger">Cancelar</button>
                </form>
              {{else}}
                <span style="color: #a0aec0; font-size: 0.85rem;">Inactiva</span>
              {{end}}
            </td>
          </tr>
        {{end}}
      </tbody>
    </table>
  </div>

  <div class="grid" style="grid-template-columns: 1fr 1fr;">
    <div class="card">
      <h2>Simular Cambio de Precio</h2>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">
        Cambiar el precio de una suscripción dispara la alerta de incremento en Fynk.
      </p>
      <form method="POST" action="/portal/subscriptions/change-price">
        <div class="form-group">
          <label>Suscripción</label>
          <select name="sub_id" required>
            {{range .Subscriptions}}
              {{if .Active}}
                <option value="{{.ID}}">{{.Merchant}} (actual: ${{formatMoney .AmountMinor}})</option>
              {{end}}
            {{end}}
          </select>
        </div>
        <div class="form-group">
          <label>Nuevo monto mensual COP</label>
          <input type="text" name="new_amount" placeholder="Ej: 42900" required>
        </div>
        <button type="submit">Actualizar Precio</button>
      </form>
    </div>

    <div class="card">
      <h2>Nueva Suscripción</h2>
      <form method="POST" action="/portal/subscriptions/new">
        <div class="form-group">
          <label>Comercio</label>
          <input type="text" name="merchant" placeholder="Ej: SPOTIFY PREMIUM" required>
        </div>
        <div class="form-group">
          <label>Monto COP</label>
          <input type="text" name="amount" placeholder="Ej: 18900" required>
        </div>
        <div class="form-group">
          <label>Día de cobro mensual (1 a 31)</label>
          <input type="number" name="day" min="1" max="31" value="15" required>
        </div>
        <div class="form-group">
          <label>Cargar a</label>
          <select name="account_id" required>
            {{range .Accounts}}
              {{if ne .Type "CDT"}}
                <option value="{{.ID}}">{{.Name}} ({{.MaskedNumber}})</option>
              {{end}}
            {{end}}
          </select>
        </div>
        <button type="submit">Crear Suscripción</button>
      </form>
    </div>
  </div>
{{template "footer" .}}
{{end}}

{{define "consents"}}
{{template "header" .}}
  <div class="card">
    <h2>Consentimientos Otorgados a Fynk</h2>
    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">
      Autorizaciones Open Finance vigentes. Si revocas un consentimiento aquí, la siguiente sincronización de Fynk fallará con <code style="background:#edf2f7; padding:2px 4px;">403 consent_revoked</code>.
    </p>
    <table>
      <thead>
        <tr>
          <th>ID Consentimiento</th>
          <th>Aplicación Receptora</th>
          <th>Propósito</th>
          <th>Estado</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        {{range .Consents}}
          <tr>
            <td><code>{{.ID}}</code></td>
            <td><strong>{{.ClientID}}</strong></td>
            <td>{{.Purpose}}</td>
            <td>
              {{if eq .Status "active"}}
                <span class="badge badge-active">Activo</span>
              {{else}}
                <span class="badge badge-revoked">Revocado</span>
              {{end}}
            </td>
            <td>
              {{if eq .Status "active"}}
                <form method="POST" action="/portal/consents/revoke">
                  <input type="hidden" name="consent_id" value="{{.ID}}">
                  <button type="submit" class="btn btn-sm btn-danger">Revocar</button>
                </form>
              {{else}}
                <span style="color:#a0aec0; font-size:0.85rem;">Revocado</span>
              {{end}}
            </td>
          </tr>
        {{end}}
      </tbody>
    </table>
  </div>
{{template "footer" .}}
{{end}}

{{define "admin"}}
{{template "header" .}}
  <div class="card">
    <h2>Herramientas de Demostración para el Jurado</h2>
    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px;">
      Permite resetear los datos a los saldos iniciales del diseño o avanzar el tiempo simulado.
    </p>
    <div class="grid" style="grid-template-columns: 1fr 1fr;">
      <div style="border: 1px solid var(--border); padding: 16px; border-radius: 6px;">
        <h3>Restablecer a Semilla Inicial</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 8px 0 16px 0;">
          Restaura saldos canónicos: Ahorros $3.200.000, Billetera $4.600.000, Tarjeta -$500.000, CDT $2.000.000.
        </p>
        <form method="POST" action="/portal/admin/reset">
          <button type="submit" class="btn" style="background:#dd6b20;">Restablecer Datos</button>
        </form>
      </div>

      <div style="border: 1px solid var(--border); padding: 16px; border-radius: 6px;">
        <h3>Avanzar Tiempo Simulado</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 8px 0 16px 0;">
          Avanza N días para probar cargos recurrentes, vencimientos de CDT o límites de tiempo.
        </p>
        <form method="POST" action="/portal/admin/advance-time">
          <div class="form-group">
            <input type="number" name="days" value="30" min="1" max="365" style="width: 120px; display:inline-block;"> días
          </div>
          <button type="submit" class="btn">Avanzar Tiempo</button>
        </form>
      </div>
    </div>
  </div>
{{template "footer" .}}
{{end}}
`
