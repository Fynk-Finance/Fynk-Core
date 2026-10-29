import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Keycloakify writes every page's .ftl so that the whole FreeMarker data model is serialized into the
// HTML (`kcContext`). On the email-code page that data has `auth` and `user`, which Keycloak fills
// only when the flow has a real account. The password recovery shows the same page for an email with
// an account and one without (the Java side hides `auth` for the same reason), so the generated
// page must not carry those two objects either: the JSON would tell the two cases apart.
//
// This runs as Keycloakify's `postBuild` hook, with the working directory set to the folder that
// becomes the jar. It adds one rule to the serializer of the listed pages. If Keycloakify changes the
// generated file so the rule cannot be placed, the build fails instead of shipping the leak.
const PAGES = ['fynk-email-code.ftl'];
const HIDDEN_KEYS = ['auth', 'user'];

const ANCHOR =
  /<#if \["class","declaredConstructors","superclass","declaringClass" \]\?seq_contains\(key\) >/g;

export async function postBuild() {
  for (const page of PAGES) {
    const path = join(process.cwd(), 'theme', 'fynk', 'login', page);
    if (!existsSync(path)) {
      throw new Error(`postBuild: ${path} was not generated`);
    }
    const source = readFileSync(path, 'utf8');
    const matches = source.match(ANCHOR) ?? [];
    if (matches.length !== 1) {
      throw new Error(
        `postBuild: expected one serializer anchor in ${page}, found ${matches.length}. Keycloakify changed its .ftl; update postBuild.ts.`,
      );
    }
    const keys = HIDDEN_KEYS.map((key) => `"${key}"`).join(', ');
    const rule = `<#-- Fynk: the recovery pages must look the same with and without an account. -->\n            <#if areSamePath(path, []) && [${keys}]?seq_contains(key)>\n                <#continue>\n            </#if>\n\n            `;
    writeFileSync(
      path,
      source.replace(ANCHOR, (anchor) => rule + anchor),
      'utf8',
    );
  }
}
