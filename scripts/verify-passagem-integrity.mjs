import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const baseline = JSON.parse(await readFile(resolve(scriptDirectory, 'passagem-baseline.json'), 'utf8'));
const artifactPath = resolve(repositoryRoot, baseline.artifact);
const bytes = await readFile(artifactPath);
const canonicalBytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
const rawSha256 = createHash('sha256').update(bytes).digest('hex');
const canonicalSha256 = createHash('sha256').update(canonicalBytes).digest('hex');

function git(args) {
  const result = spawnSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' });
  if(result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

const gitBlob = git(['hash-object', '--path=passagem.html', 'passagem.html']);
const worktreeDiff = spawnSync('git', ['diff', '--quiet', '--', 'passagem.html'], { cwd: repositoryRoot });
const stagedDiff = spawnSync('git', ['diff', '--cached', '--quiet', '--', 'passagem.html'], { cwd: repositoryRoot });

const checks = [
  ['canonical SHA-256', canonicalSha256, baseline.canonicalSha256],
  ['Git blob', gitBlob, baseline.gitBlob],
  ['worktree diff', worktreeDiff.status, 0],
  ['staged diff', stagedDiff.status, 0]
];
const failures = checks.filter(([, actual, expected]) => actual !== expected);

console.log(`passagem.html raw SHA-256: ${rawSha256}`);
console.log(`passagem.html canonical SHA-256: ${canonicalSha256}`);
console.log(`passagem.html Git blob: ${gitBlob}`);

if(failures.length) {
  for(const [name, actual, expected] of failures) console.error(`${name}: expected ${expected}, received ${actual}`);
  process.exit(1);
}

console.log('Integrity check passed: passagem.html matches the recorded baseline.');

