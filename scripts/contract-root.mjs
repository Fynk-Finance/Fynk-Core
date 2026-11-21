#!/usr/bin/env node
// Builds the full API root for `make generate` (owned by M0).
//
// contracts/openapi.yaml holds only the shared parts. Each backend module writes its paths in
// contracts/modules/<module>.yaml. This script writes contracts/dist/openapi.root.yaml: the
// shared root plus a $ref to every path of every module file. Redocly then bundles and lints it.
// Nobody edits the root to add a path, so module contracts never conflict.
//
// It fails when:
//   * two module files declare the same path, operationId or tag;
//   * an operation is not tagged with its own module name (oapi-codegen generates per tag);
//   * a component of a module file does not start with the module name in PascalCase
//     (ConsentsConsent in consents.yaml), so two modules never fight over a schema name.
//     Schemas every module uses belong in openapi.yaml.
//
// Usage: node scripts/contract-root.mjs [contractsDir]
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

// JSON pointer escaping (RFC 6901), then URI fragment escaping for braces and percent signs.
export function pathPointer(path) {
  const escaped = path.replace(/~/g, '~0').replace(/\//g, '~1');
  return escaped.replace(/%/g, '%25').replace(/\{/g, '%7B').replace(/\}/g, '%7D');
}

export function buildRoot(root, modules) {
  const errors = [];
  const paths = {};
  const tags = [];
  const operationIds = new Map();
  const tagOwners = new Map();
  const componentNames = new Map();
  for (const [kind, entries] of Object.entries(root.components ?? {})) {
    for (const name of Object.keys(entries ?? {}))
      componentNames.set(`${kind}/${name}`, 'openapi.yaml');
  }

  for (const { name, file, doc } of modules) {
    for (const tag of doc.tags ?? []) {
      if (tagOwners.has(tag.name)) {
        errors.push(`${file}: tag "${tag.name}" is already declared by ${tagOwners.get(tag.name)}`);
      } else {
        tagOwners.set(tag.name, file);
        tags.push(tag);
      }
    }
    for (const [kind, entries] of Object.entries(doc.components ?? {})) {
      for (const component of Object.keys(entries ?? {})) {
        const key = `${kind}/${component}`;
        const pascal = name.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
        if (!component.startsWith(pascal)) {
          errors.push(`${file}: component ${key} must start with "${pascal}"`);
        }
        if (componentNames.has(key)) {
          errors.push(
            `${file}: component ${key} is already declared by ${componentNames.get(key)}`,
          );
        } else {
          componentNames.set(key, file);
        }
      }
    }
    for (const [path, item] of Object.entries(doc.paths ?? {})) {
      if (paths[path]) {
        errors.push(`${file}: path ${path} is already declared by another module`);
        continue;
      }
      paths[path] = { $ref: `../modules/${file}#/paths/${pathPointer(path)}` };
      for (const method of HTTP_METHODS) {
        const op = item?.[method];
        if (!op) continue;
        const where = `${file}: ${method.toUpperCase()} ${path}`;
        if (!op.operationId) {
          errors.push(`${where} has no operationId`);
        } else if (operationIds.has(op.operationId)) {
          errors.push(
            `${where} reuses operationId "${op.operationId}" from ${operationIds.get(op.operationId)}`,
          );
        } else {
          operationIds.set(op.operationId, file);
        }
        if (!Array.isArray(op.tags) || !op.tags.includes(name)) {
          errors.push(`${where} must be tagged "${name}"`);
        }
      }
    }
  }

  const out = { ...root, tags: [...(root.tags ?? []), ...tags], paths };
  // Shared components are referenced from openapi.yaml, the same file the modules point to,
  // so the bundler keeps one copy of each.
  out.components = Object.fromEntries(
    Object.entries(root.components ?? {}).map(([kind, entries]) => [
      kind,
      Object.fromEntries(
        Object.keys(entries ?? {}).map((n) => [
          n,
          { $ref: `../openapi.yaml#/components/${kind}/${n}` },
        ]),
      ),
    ]),
  );
  return { doc: out, errors };
}

function main() {
  const dir = process.argv[2] ?? 'contracts';
  const root = parse(readFileSync(join(dir, 'openapi.yaml'), 'utf8'));
  const modules = readdirSync(join(dir, 'modules'))
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((file) => ({
      name: file.replace(/\.yaml$/, ''),
      file,
      doc: parse(readFileSync(join(dir, 'modules', file), 'utf8')),
    }));

  const { doc, errors } = buildRoot(root, modules);
  if (errors.length > 0) {
    console.error(`Contract errors:\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }
  mkdirSync(join(dir, 'dist'), { recursive: true });
  const header = '# Generated by scripts/contract-root.mjs from contracts/. Do not edit.\n';
  writeFileSync(join(dir, 'dist', 'openapi.root.yaml'), header + stringify(doc));
  console.log(`contract root: ${modules.length} modules, ${Object.keys(doc.paths).length} paths`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
