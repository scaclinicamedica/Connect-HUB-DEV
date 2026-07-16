import { readFile } from 'node:fs/promises';
import { test as base, expect, type BrowserContext } from '@playwright/test';
import { PassagemPage } from './passagem-page';

type NetworkAttempt = {
  url: string;
  method: string;
  disposition: 'localhost' | 'stubbed' | 'blocked';
};

type Fixtures = {
  app: PassagemPage;
  networkAttempts: NetworkAttempt[];
};

const firebaseStub = await readFile(new URL('./firebase-stub-browser.js', import.meta.url), 'utf8');

async function installNetworkPolicy(context: BrowserContext, attempts: NetworkAttempt[]){
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const base = { url: request.url(), method: request.method() };

    if(url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      attempts.push({ ...base, disposition: 'localhost' });
      await route.continue();
      return;
    }

    if(url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/10.12.5/')) {
      attempts.push({ ...base, disposition: 'stubbed' });
      const body = url.pathname.endsWith('firebase-app-compat.js')
        ? firebaseStub
        : '/* Firebase compat API supplied by the local test double. */';
      await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
      return;
    }

    attempts.push({ ...base, disposition: 'blocked' });
    await route.abort('blockedbyclient');
  });
}

export const test = base.extend<Fixtures>({
  networkAttempts: [async ({ context }, use, testInfo) => {
    const attempts: NetworkAttempt[] = [];
    await installNetworkPolicy(context, attempts);
    await use(attempts);

    await testInfo.attach('network-attempts.json', {
      body: Buffer.from(JSON.stringify(attempts, null, 2)),
      contentType: 'application/json'
    });

    const blocked = attempts.filter(attempt => attempt.disposition === 'blocked');
    if(blocked.length) throw new Error(`Blocked unexpected external requests:\n${blocked.map(item => item.url).join('\n')}`);
  }, { auto: true }],

  app: async ({ page, networkAttempts }, use, testInfo) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.stack || error.message));
    page.on('console', message => {
      if(message.type() === 'error') consoleErrors.push(message.text());
    });

    const app = new PassagemPage(page, networkAttempts);
    await use(app);

    if(pageErrors.length || consoleErrors.length || testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('browser-diagnostics.json', {
        body: Buffer.from(JSON.stringify({ pageErrors, consoleErrors }, null, 2)),
        contentType: 'application/json'
      });
    }
    expect(pageErrors, 'No uncaught page errors').toEqual([]);
    expect(consoleErrors, 'No blocking console errors').toEqual([]);
  }
});

export { expect };
