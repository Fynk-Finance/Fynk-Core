<#-- Fynk code email (verify email, password reset). Table layout and inline CSS for email clients;
     the only <style> block is the dark mode override. No images and no links on purpose.
     Colors mirror services/keycloak/theme/src/login/fynk-variables.css:
     light: primary #2fa8d8, accent #a8e03a, text #0f2233, secondary text #5e7482, card #ffffff,
            page #f4fbfe, border #e4ecf0, code box #f4fbfe / #bfe6f6
     dark:  page #0b1620, card #13212d, text #e8f1f6, secondary text #97abb8, border #22313d,
            code box #182a37 / #2b5267 -->
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${msg("fynkEmailBrand")}</title>
<style>
@media (prefers-color-scheme: dark) {
  .fk-page { background-color: #0b1620 !important; }
  .fk-card { background-color: #13212d !important; border-color: #22313d !important; }
  .fk-text { color: #e8f1f6 !important; }
  .fk-muted { color: #97abb8 !important; }
  .fk-code { background-color: #182a37 !important; border-color: #2b5267 !important; color: #e8f1f6 !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#f4fbfe;">
<table role="presentation" class="fk-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4fbfe;">
<tr>
<td align="center" style="padding:24px 16px;">
<table role="presentation" class="fk-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e4ecf0;border-top:4px solid #a8e03a;border-radius:12px;">
<tr>
<td style="padding:32px 28px 8px 28px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;">
<div style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:28px;font-weight:bold;line-height:32px;color:#2fa8d8;">${msg("fynkEmailBrand")}</div>
</td>
</tr>
<tr>
<td class="fk-text" style="padding:16px 28px 0 28px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:22px;font-weight:bold;line-height:28px;color:#0f2233;">
<#if purpose == "reset">${msg("fynkEmailHeadingReset")}<#else>${msg("fynkEmailHeadingVerify")}</#if>
</td>
</tr>
<tr>
<td class="fk-muted" style="padding:8px 28px 0 28px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#5e7482;">
<#if purpose == "reset">${msg("fynkEmailIntroReset")}<#else>${msg("fynkEmailIntroVerify")}</#if>
</td>
</tr>
<tr>
<td style="padding:24px 28px 0 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="fk-code" align="center" style="background-color:#f4fbfe;border:1px solid #bfe6f6;border-radius:12px;padding:20px 8px;font-family:'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace;font-size:32px;font-weight:bold;line-height:40px;letter-spacing:8px;color:#0f2233;">${code}</td>
</tr>
</table>
</td>
</tr>
<tr>
<td class="fk-text" style="padding:16px 28px 0 28px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;color:#0f2233;">
${msg("fynkEmailExpiry", minutes)}
</td>
</tr>
<tr>
<td class="fk-muted" style="padding:24px 28px 32px 28px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:13px;line-height:19px;color:#5e7482;">
${msg("fynkEmailFooter")}
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
