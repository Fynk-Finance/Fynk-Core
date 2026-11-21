package portal

// PageCSS and BannerHTML are the portal look. Other public pages of the
// simulator (the authorization page) reuse them so every page of the bank
// looks the same and carries the "Simulado" banner.
const PageCSS = `
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
`

const BannerHTML = `
  <div class="banner">
    <span>Simulado</span> Banco simulado para pruebas. No es un banco real.
  </div>
`
