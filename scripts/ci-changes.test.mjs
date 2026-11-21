// Tests for scripts/ci-changes.mjs. Run with `node --test scripts/` (part of `make test`).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { SESSION_LOG_MESSAGE, areas, missingSessionLog, parseNameStatus } from './ci-changes.mjs';

const ch = (status, ...paths) => ({ status, paths });
const LOG = 'docs/history/sessions/2026-10-26-someone-m0-topic.md';

test('parses git diff --name-status -z, including renames and odd file names', () => {
  const raw = 'M\0Makefile\0R087\0apps/a.ts\0apps/b c.ts\0A\0docs/ñ.md\0D\0go.work.sum\0';
  assert.deepEqual(parseNameStatus(raw), [
    ch('M', 'Makefile'),
    ch('R', 'apps/a.ts', 'apps/b c.ts'),
    ch('A', 'docs/ñ.md'),
    ch('D', 'go.work.sum'),
  ]);
  assert.deepEqual(parseNameStatus(''), []);
});

test('a docs-only pull request runs no area and needs no session log', () => {
  const changes = [ch('M', 'docs/local-dev.md'), ch('A', 'docs/adr/0002-x.md')];
  assert.deepEqual(areas(changes), { mobile: false, go: false });
  assert.equal(missingSessionLog(changes), false);
});

test('a mobile change runs only the mobile area', () => {
  assert.deepEqual(areas([ch('M', 'apps/mobile/src/app/registry.ts')]), {
    mobile: true,
    go: false,
  });
});

test('a Go change runs only the go area', () => {
  assert.deepEqual(areas([ch('M', 'services/bank-simulator/cmd/bank-simulator/main.go')]), {
    mobile: false,
    go: true,
  });
  assert.deepEqual(areas([ch('M', 'go.work')]), { mobile: false, go: true });
});

test('a Keycloak realm change runs the go area, where its tests live', () => {
  assert.deepEqual(areas([ch('M', 'services/keycloak/realms/fynk-realm.json')]), {
    mobile: false,
    go: true,
  });
});

test('contracts, tooling and CI files run both areas', () => {
  for (const path of [
    'contracts/modules/bank.yaml',
    'Makefile',
    'pnpm-lock.yaml',
    '.github/workflows/ci.yml',
    '.github/actions/setup-pnpm/action.yml',
    'scripts/ci-changes.mjs',
  ]) {
    assert.deepEqual(areas([ch('M', path)]), { mobile: true, go: true }, path);
  }
});

test('files rules match whole names, not prefixes', () => {
  assert.deepEqual(areas([ch('A', 'Makefile.local'), ch('A', 'go.workspace')]), {
    mobile: false,
    go: false,
  });
  assert.deepEqual(areas([ch('M', 'services/caddy/Caddyfile.local')]), {
    mobile: false,
    go: false,
  });
});

test('a rename counts both the old and the new path', () => {
  assert.deepEqual(areas([ch('R', 'apps/mobile/x.ts', 'docs/x.ts')]), { mobile: true, go: false });
});

test('a code change without a new session log fails', () => {
  assert.equal(missingSessionLog([ch('M', 'apps/mobile/App.tsx')]), true);
  assert.equal(missingSessionLog([ch('D', 'services/api/old.go'), ch('M', 'docs/a.md')]), true);
});

test('a code change with a new session log passes', () => {
  assert.equal(missingSessionLog([ch('M', 'apps/mobile/App.tsx'), ch('A', LOG)]), false);
});

test('editing or renaming an existing session log does not count', () => {
  assert.equal(missingSessionLog([ch('M', 'Makefile'), ch('M', LOG)]), true);
  assert.equal(
    missingSessionLog([ch('M', 'Makefile'), ch('R', 'docs/history/sessions/old.md', LOG)]),
    true,
  );
});

test('only markdown files directly under docs/history/sessions/ count', () => {
  for (const path of [
    'docs/history/sessions/.gitkeep',
    'docs/history/sessions/nested/x.md',
    'docs/history/_template.md',
  ]) {
    assert.equal(missingSessionLog([ch('M', 'Makefile'), ch('A', path)]), true, path);
  }
});

test('an empty diff needs no session log', () => {
  assert.equal(missingSessionLog([]), false);
});

test('the CLI prints the CI error message and exits 1 when the log is missing', () => {
  const script = fileURLToPath(new URL('./ci-changes.mjs', import.meta.url));
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  // HEAD...HEAD is an empty diff: passes. A bad command exits 2.
  const ok = execFileSync('node', [script, 'session-log', 'HEAD', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.match(ok, /Session log found/);
  assert.throws(() => execFileSync('node', [script, 'nope'], { cwd: root, stdio: 'pipe' }), {
    status: 2,
  });
  assert.equal(SESSION_LOG_MESSAGE, 'Add the session log (see CLAUDE.md, Project history log)');
});

test('the CLI marks every area for manual runs', () => {
  const script = fileURLToPath(new URL('./ci-changes.mjs', import.meta.url));
  const out = execFileSync('node', [script, 'areas', '--all'], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_OUTPUT: '' },
  });
  assert.equal(out.trim(), 'mobile=true\ngo=true');
});
