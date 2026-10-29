<#ftl output_format="plainText">
<#if purpose == "reset">${msg("fynkEmailCodeEmailResetIntro")}<#else>${msg("fynkEmailCodeEmailVerifyIntro")}</#if>

${code}

${msg("fynkEmailCodeExpiry", minutes)}

${msg("fynkEmailCodeEmailIgnore")}
