<#ftl output_format="plainText">
${msg("fynkEmailBrand")}

<#if purpose == "reset">${msg("fynkEmailHeadingReset")}<#else>${msg("fynkEmailHeadingVerify")}</#if>

<#if purpose == "reset">${msg("fynkEmailIntroReset")}<#else>${msg("fynkEmailIntroVerify")}</#if>

${code}

${msg("fynkEmailExpiry", minutes)}

${msg("fynkEmailFooter")}
