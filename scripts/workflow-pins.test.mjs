// Every action a workflow uses is pinned to a commit, with its version in a comment. A tag such
// as `@v4` can be moved to other code, and the deploy workflow runs with the role that deploys.
// Run with `node --test scripts/` (part of `make test`).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const github = join(dirname(fileURLToPath(import.meta.url)), '..', '.github');

function yamlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return yamlFiles(path);
    return /\.ya?ml$/.test(name) ? [path] : [];
  });
}

/** The `uses:` lines of the workflows and of the repository's own actions. */
function usedActions() {
  const used = [];
  for (const file of [
    ...yamlFiles(join(github, 'workflows')),
    ...yamlFiles(join(github, 'actions')),
  ]) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const match = /^\s*(?:-\s+)?uses:\s*(\S+)/.exec(line);
        if (match) used.push({ where: `${file.slice(github.length + 1)}:${i + 1}`, ref: match[1] });
      });
  }
  return used;
}

test('every action is pinned to a full commit SHA', () => {
  const used = usedActions();
  assert.ok(used.length > 0, 'no action found: the test reads the wrong folder');
  const moving = used
    // An action of this repository (./.github/actions/...) changes with the commit itself.
    .filter(({ ref }) => !ref.startsWith('./'))
    .filter(({ ref }) => !/@[0-9a-f]{40}$/.test(ref))
    .map(({ where, ref }) => `${where} ${ref}`);
  assert.deepEqual(moving, []);
});
