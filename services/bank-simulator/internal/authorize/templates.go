package authorize

import "github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/portal"

// The look comes from the portal (same styles, same "Simulado" banner).
const pageTemplates = `
{{define "head"}}<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{.Title}} · Banco Demo</title>
  <style>` + portal.PageCSS + `
    .consent-list { margin: 0 0 16px 20px; }
    .consent-facts dt { font-weight: 600; color: var(--text-muted); font-size: 0.85rem; margin-top: 12px; }
    .consent-facts dd { margin: 0; }
    .actions { display: flex; gap: 12px; margin-top: 20px; }
    .actions form { margin: 0; }
    .btn-secondary { background-color: #edf2f7; color: var(--text); }
    .btn-secondary:hover { background-color: #e2e8f0; }
  </style>
</head>
<body>
` + portal.BannerHTML + `
  <header><div class="brand">Banco Demo</div></header>
  <div class="container">
{{end}}

{{define "foot"}}
  </div>
</body>
</html>
{{end}}

{{define "decisionForm"}}
<form method="post" action="/oauth/authorize/decision">
  <input type="hidden" name="request_uri" value="{{.RequestURI}}">
  <input type="hidden" name="client_id" value="{{.ClientID}}">
  <input type="hidden" name="csrf" value="{{.CSRF}}">
{{end}}

{{define "message"}}{{template "head" .}}
    <div class="card">
      <h2>{{.Title}}</h2>
      <p>{{.Message}}</p>
    </div>
{{template "foot"}}{{end}}

{{define "noProducts"}}{{template "head" .}}
    <div class="card">
      <h2>Sin productos</h2>
      <p>No tienes productos en {{.Entity}}.</p>
      <div class="actions">
        {{template "decisionForm" .}}
          <button type="submit" name="decision" value="cancel">Volver a Fynk</button>
        </form>
      </div>
    </div>
{{template "foot"}}{{end}}

{{define "consent"}}{{template "head" .}}
    <div class="card">
      <h2>{{.Receiver}} quiere acceder a tus datos de {{.Entity}}</h2>
      <dl class="consent-facts">
        <dt>Entidad</dt><dd>{{.Entity}}</dd>
        <dt>Datos</dt>
        <dd><ul class="consent-list">{{range .DataLabels}}<li>{{.}}</li>{{end}}</ul></dd>
        <dt>Quién los recibe</dt><dd>{{.Receiver}}</dd>
        <dt>Para qué</dt><dd>{{.Purpose}}</dd>
        <dt>Plazo</dt><dd>{{.Term}} días</dd>
      </dl>
      <p>Solo lectura: Fynk no mueve dinero. Puedes revocar este permiso cuando quieras.</p>
      <div class="actions">
        {{template "decisionForm" .}}
          <button type="submit" name="decision" value="authorize">Autorizar</button>
        </form>
        {{template "decisionForm" .}}
          <button type="submit" name="decision" value="cancel" class="btn-secondary">Cancelar</button>
        </form>
      </div>
    </div>
{{template "foot"}}{{end}}
`
