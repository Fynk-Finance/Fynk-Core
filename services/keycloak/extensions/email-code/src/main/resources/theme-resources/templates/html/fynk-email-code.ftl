<#import "template.ftl" as layout>
<@layout.emailLayout>
<p>
    <#if purpose == "reset">${msg("fynkEmailCodeEmailResetIntro")}<#else>${msg("fynkEmailCodeEmailVerifyIntro")}</#if>
</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px;font-family:monospace;">${code}</p>
<p>${msg("fynkEmailCodeExpiry", minutes)}</p>
<p>${msg("fynkEmailCodeEmailIgnore")}</p>
</@layout.emailLayout>
