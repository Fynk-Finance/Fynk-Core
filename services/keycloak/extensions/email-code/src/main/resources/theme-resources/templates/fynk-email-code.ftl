<#import "template.ftl" as layout>
<#import "field.ftl" as field>
<#import "buttons.ftl" as buttons>
<#-- Password recovery must look the same for an email with an account and one without. The layout
     shows the "attempted username" block only when the flow has a user, which would tell them
     apart. Hiding the authentication context removes that block for both. -->
<#if purpose == "reset"><#global auth = {}></#if>
<@layout.registrationLayout displayMessage=true; section>
<!-- template: fynk-email-code.ftl -->
    <#if section = "header">
        <#if purpose == "reset">${msg("fynkEmailCodeResetTitle")}<#else>${msg("fynkEmailCodeVerifyTitle")}</#if>
    <#elseif section = "form">
        <p id="kc-email-code-instructions">${msg("fynkEmailCodeInstructions", email)}</p>
        <p id="kc-email-code-expiry">${msg("fynkEmailCodeExpiry", minutes)}</p>
        <form id="kc-email-code-form" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">
            <div class="${properties.kcFormGroupClass!}">
                <div class="${properties.kcFormGroupLabelClass!}">
                    <label for="code" class="${properties.kcFormLabelClass!}">
                        <span class="${properties.kcFormLabelTextClass!}">${msg("fynkEmailCodeLabel")}</span>
                    </label>
                </div>
                <span class="${properties.kcInputClass!}">
                    <input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code"
                           maxlength="6" pattern="[0-9]*" autofocus aria-describedby="kc-email-code-instructions"/>
                </span>
            </div>

            <@buttons.actionGroup>
                <@buttons.button id="kc-email-code-submit" name="verify" label="fynkEmailCodeVerifyButton" />
            </@buttons.actionGroup>
            <@buttons.actionGroup>
                <@buttons.button id="kc-email-code-resend" name="resend" label="fynkEmailCodeResendButton" type="secondary" />
            </@buttons.actionGroup>
        </form>
        <#if purpose == "reset">
            <p id="kc-email-code-change"><a id="kc-email-code-change-link" href="${url.loginRestartFlowUrl}">${msg("fynkEmailCodeChangeEmail")}</a></p>
        </#if>
    </#if>
</@layout.registrationLayout>
