import { readFile } from 'node:fs/promises';
import { test as base, expect, type BrowserContext } from '@playwright/test';
import { AdminPage } from './admin-page';

type NetworkAttempt = {
  url: string;
  method: string;
  disposition: 'localhost' | 'stubbed' | 'blocked';
};

type Fixtures = {
  admin: AdminPage;
  networkAttempts: NetworkAttempt[];
};

const firebaseStub = await readFile(new URL('./firebase-stub-browser.js', import.meta.url), 'utf8');

function withoutExternalAdminLibraries(html: string){
  return html.replace(
    /<script\b[^>]*\bsrc="https:\/\/cdn\.jsdelivr\.net\/npm\/(?:chart\.js|xlsx)@[^"]+"[^>]*><\/script>/gi,
    '<!-- Chart.js/XLSX supplied by controlled test doubles. -->'
  );
}

async function installNetworkPolicy(context: BrowserContext, attempts: NetworkAttempt[]){
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const base = { url: request.url(), method: request.method() };

    if(url.hostname === '127.0.0.1' || url.hostname === 'localhost'){
      attempts.push({ ...base, disposition: 'localhost' });
      if(url.pathname.endsWith('/area_administrativa.html')){
        const response = await route.fetch();
        const body = withoutExternalAdminLibraries(await response.text());
        await route.fulfill({ response, body });
        return;
      }
      await route.continue();
      return;
    }

    if(url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/10.12.5/')){
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
    if(blocked.length){
      throw new Error(`Blocked unexpected external requests:\n${blocked.map(item => item.url).join('\n')}`);
    }
  }, { auto: true }],

  admin: async ({ page, networkAttempts }, use, testInfo) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.stack || error.message));
    page.on('console', message => {
      if(message.type() === 'error') consoleErrors.push(message.text());
    });

    const admin = new AdminPage(page, networkAttempts);
    await use(admin);

    if(pageErrors.length || consoleErrors.length || testInfo.status !== testInfo.expectedStatus){
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
