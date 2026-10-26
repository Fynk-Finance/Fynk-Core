// Tests for scripts/contract-root.mjs. Run with `node --test scripts/` (part of `make test`).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildRoot, pathPointer } from './contract-root.mjs';

const root = {
  openapi: '3.1.0',
  info: { title: 'Fynk API', version: '0.1.0' },
  security: [{ bearerAuth: [] }],
  paths: {},
  components: { schemas: { Problem: { type: 'object' } } },
};

const op = (tag, operationId) => ({ tags: [tag], operationId, summary: 's', responses: {} });

const mod = (name, doc) => ({
  name,
  file: `${name}.yaml`,
  doc: { tags: [{ name, description: 'd' }], ...doc },
});

test('pathPointer escapes slashes, tildes and braces', () => {
  assert.equal(pathPointer('/consents/{id}/revoke'), '~1consents~1%7Bid%7D~1revoke');
  assert.equal(pathPointer('/a~b'), '~1a~0b');
});

test('references every module path and keeps the shared root', () => {
  const { doc, errors } = buildRoot(root, [
    mod('bank', { paths: { '/bank/health': { get: op('bank', 'bankHealth') } } }),
    mod('consents', {
      paths: {
        '/consents/{id}': {
          get: op('consents', 'getConsent'),
          delete: op('consents', 'deleteConsent'),
        },
      },
    }),
  ]);

  assert.deepEqual(errors, []);
  assert.deepEqual(doc.paths, {
    '/bank/health': { $ref: '../modules/bank.yaml#/paths/~1bank~1health' },
    '/consents/{id}': { $ref: '../modules/consents.yaml#/paths/~1consents~1%7Bid%7D' },
  });
  assert.deepEqual(doc.security, root.security);
  assert.deepEqual(
    doc.tags.map((t) => t.name),
    ['bank', 'consents'],
  );
  assert.deepEqual(doc.components.schemas.Problem, {
    $ref: '../openapi.yaml#/components/schemas/Problem',
  });
});

test('rejects a path declared by two modules', () => {
  const { errors } = buildRoot(root, [
    mod('bank', { paths: { '/x': { get: op('bank', 'a') } } }),
    mod('catalog', { paths: { '/x': { get: op('catalog', 'b') } } }),
  ]);
  assert.match(errors.join('\n'), /path \/x is already declared/);
});

test('rejects duplicate operationIds and missing ones', () => {
  const { errors } = buildRoot(root, [
    mod('bank', {
      paths: {
        '/a': { get: op('bank', 'same') },
        '/b': { post: { ...op('bank'), operationId: undefined } },
      },
    }),
    mod('catalog', { paths: { '/c': { get: op('catalog', 'same') } } }),
  ]);
  const text = errors.join('\n');
  assert.match(text, /POST \/b has no operationId/);
  assert.match(text, /reuses operationId "same"/);
});

test('rejects an operation not tagged with its own module', () => {
  const { errors } = buildRoot(root, [
    mod('bank', { paths: { '/a': { get: op('catalog', 'a') } } }),
  ]);
  assert.match(errors.join('\n'), /GET \/a must be tagged "bank"/);
});

test('rejects a tag declared twice', () => {
  const { errors } = buildRoot(root, [
    mod('bank', { paths: {} }),
    { name: 'catalog', file: 'catalog.yaml', doc: { tags: [{ name: 'bank' }], paths: {} } },
  ]);
  assert.match(errors.join('\n'), /tag "bank" is already declared by bank.yaml/);
});

test('requires module components to carry the module prefix and stay unique', () => {
  const { errors } = buildRoot(root, [
    mod('consents', {
      paths: {},
      components: { schemas: { ConsentsConsent: {}, Consent: {} } },
    }),
    mod('recommendations', { paths: {}, components: { schemas: { RecommendationsCard: {} } } }),
    mod('bank', { paths: {}, components: { schemas: { Problem: {} } } }),
  ]);
  const text = errors.join('\n');
  assert.match(text, /consents.yaml: component schemas\/Consent must start with "Consents"/);
  assert.doesNotMatch(text, /ConsentsConsent/);
  assert.doesNotMatch(text, /RecommendationsCard/);
  assert.match(text, /bank.yaml: component schemas\/Problem is already declared by openapi.yaml/);
});
