// Pull request checks for CI (.github/workflows/ci.yml), from the files a pull request changes.
//
//   node scripts/ci-changes.mjs areas <base> <head>        which CI areas run (mobile, go)
//   node scripts/ci-changes.mjs areas --all                every area (manual runs)
//   node scripts/ci-changes.mjs session-log <base> <head>  fails without a new session log
//
// Areas are written to $GITHUB_OUTPUT when it is set. Plain Node, no dependencies.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SESSION_LOG_MESSAGE = 'Add the session log (see CLAUDE.md, Project history log)';

// A rule ending in "/" matches a folder, anything else matches one file.
const SHARED = [
  'contracts/',
  'redocly.yaml',
  'scripts/contract-root.mjs',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
  'Makefile',
  '.github/workflows/ci.yml',
  '.github/actions/',
  'scripts/ci-changes.mjs',
];

export const AREAS = {
  mobile: ['apps/', ...SHARED],
  go: ['services/api/', 'services/bank-simulator/', 'go.work', 'go.work.sum', ...SHARED],
};

const SESSION_LOG = /^docs\/history\/sessions\/[^/]+\.md$/;

const matches = (path, rule) => (rule.endsWith('/') ? path.startsWith(rule) : path === rule);

// Parses `git diff --name-status -z`: "M\0path\0R100\0old\0new\0".
export function parseNameStatus(raw) {
  const parts = raw.split('\0').filter((p) => p !== '');
  const changes = [];
  for (let i = 0; i < parts.length;) {
    const status = parts[i++][0];
    if (status === 'R' || status === 'C') {
      changes.push({ status, paths: [parts[i], parts[i + 1]] });
      i += 2;
    } else {
      changes.push({ status, paths: [parts[i]] });
      i += 1;
    }
  }
  return changes;
}

export function areas(changes) {
  const paths = changes.flatMap((c) => c.paths);
  return Object.fromEntries(
    Object.entries(AREAS).map(([name, rules]) => [
      name,
      paths.some((p) => rules.some((r) => matches(p, r))),
    ]),
  );
}

// True when the pull request changes something outside docs/ and adds no session log.
// Editing or renaming an existing log does not count: every session gets its own new file.
export function missingSessionLog(changes) {
  const outsideDocs = changes.some((c) => c.paths.some((p) => !p.startsWith('docs/')));
  const addsLog = changes.some((c) => c.status === 'A' && SESSION_LOG.test(c.paths[0]));
  return outsideDocs && !addsLog;
}

function diff(base, head) {
  for (const ref of [base, head]) {
    if (!ref || ref.startsWith('-'))
      throw new Error('usage: ci-changes.mjs <command> <base> <head>');
  }
  const raw = execFileSync('git', ['diff', '--name-status', '-z', `${base}...${head}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return parseNameStatus(raw);
}

function main([command, base, head]) {
  if (command === 'areas') {
    const result =
      base === '--all'
        ? Object.fromEntries(Object.keys(AREAS).map((n) => [n, true]))
        : areas(diff(base, head));
    const lines = Object.entries(result).map(([n, v]) => `${n}=${v}`);
    console.log(lines.join('\n'));
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');
    return 0;
  }
  if (command === 'session-log') {
    if (missingSessionLog(diff(base, head))) {
      console.log(`::error::${SESSION_LOG_MESSAGE}`);
      return 1;
    }
    console.log('Session log found (or the pull request only changes docs/).');
    return 0;
  }
  console.error('usage: ci-changes.mjs areas|session-log <base> <head>');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
