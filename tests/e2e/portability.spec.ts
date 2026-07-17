import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { test, expect } from '../support/test-fixture';

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const output: string[] = [];
  for(const entry of entries) {
    const path = join(directory, entry.name);
    if(entry.isDirectory()) output.push(...await sourceFiles(path));
    else if(['.ts', '.js', '.mjs', '.json'].includes(extname(entry.name))) output.push(path);
  }
  return output;
}

test('infraestrutura não contém executablePath nem caminhos temporários absolutos', async () => {
  const root = resolve(process.cwd());
  const files = [
    resolve(root, 'package.json'),
    resolve(root, 'playwright.config.ts'),
    ...await sourceFiles(resolve(root, 'tests')),
    ...await sourceFiles(resolve(root, 'scripts'))
  ];
  const violations: string[] = [];
  for(const file of files) {
    const source = await readFile(file, 'utf8');
    if(/executablePath\s*[:(]/.test(source)) violations.push(`${file}: executablePath`);
    if(/(?:^|["'])\/tmp\//m.test(source)) violations.push(`${file}: /tmp/`);
    if(/[A-Za-z]:\\Users\\/.test(source)) violations.push(`${file}: Windows user path`);
  }
  expect(violations).toEqual([]);
});

