import { expect, type Page } from '@playwright/test';

export type AdminSeed = {
  authUid?: string;
  initialAuthUser?: {
    uid: string;
    email?: string;
    isAnonymous?: boolean;
    emailVerified?: boolean;
    providerData?: Array<{ providerId: string; uid?: string }>;
  } | null;
  initialAuthByApp?: Record<string, {
    uid: string;
    email?: string;
    isAnonymous?: boolean;
    emailVerified?: boolean;
    providerData?: Array<{ providerId: string; uid?: string }>;
  } | null>;
  authAccounts?: Array<{
    uid: string;
    email: string;
    password: string;
    disabled?: boolean;
    emailVerified?: boolean;
  }>;
  authPersistenceUnavailable?: boolean;
  authPersistenceFailure?: boolean;
  adminAccounts?: Array<{
    uid: string;
    email: string;
    password: string;
    disabled?: boolean;
    emailVerified?: boolean;
  }>;
  clinicalUsers?: Array<Record<string, unknown> & { id: string }>;
  adminUsers?: Array<Record<string, unknown> & { id: string }>;
  clinicalInvites?: Array<Record<string, unknown> & { id: string }>;
  accessAudit?: Array<Record<string, unknown> & { id: string }>;
  nextAuthUid?: string;
  patientsByUnit?: Record<string, Array<Record<string, unknown> & { id: string }>>;
  historyEvents?: Array<Record<string, unknown> & { id: string }>;
  adminOutcomes?: Array<Record<string, unknown> & { id: string }>;
  listenerDelays?: Array<{ pathIncludes?: string; delayMs?: number }>;
  readDelays?: Array<{ pathIncludes?: string; delayMs?: number }>;
  readFailures?: Array<{ pathIncludes?: string; message?: string; code?: string }>;
};

export class AdminPage {
  constructor(
    readonly page: Page,
    readonly networkAttempts: Array<{ url: string; method: string; disposition: string }>
  ){}

  get accessPanel(){ return this.page.locator('#accessPanel'); }
  get adminContent(){ return this.page.locator('#adminContent'); }
  get loginButton(){ return this.page.locator('#loginBtn'); }
  get signOutButton(){ return this.page.locator('#signOutBtn'); }
  get authStatus(){ return this.page.locator('#authStatus'); }
  get accessDenied(){ return this.page.locator('#accessDenied'); }
  get accessError(){ return this.page.locator('#accessError'); }

  async goto(seed: AdminSeed = {}){
    await this.page.addInitScript(value => {
      (window as typeof window & { __CONNECT_HUB_TEST_SEED__: AdminSeed }).__CONNECT_HUB_TEST_SEED__ = value;

      class ChartTestDouble {
        static instances: ChartTestDouble[] = [];
        destroyed = false;
        constructor(){
          ChartTestDouble.instances.push(this);
        }
        destroy(){ this.destroyed = true; }
      }

      const workbookWrites: string[] = [];
      const xlsxTestDouble = {
        utils: {
          book_new(){ return { sheets: [] as unknown[] }; },
          book_append_sheet(workbook: { sheets: unknown[] }, sheet: unknown, name: string){
            workbook.sheets.push({ sheet, name });
          },
          json_to_sheet(rows: unknown[]){ return { rows }; }
        },
        writeFile(_workbook: unknown, filename: string){ workbookWrites.push(filename); }
      };

      Object.assign(window, {
        Chart: ChartTestDouble,
        XLSX: xlsxTestDouble,
        __adminAssetTestHarness: {
          workbookWrites,
          printInvocations: 0
        },
        __xssTriggered: false
      });
      const clipboardWrites: string[] = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          async writeText(text: string){ clipboardWrites.push(String(text)); },
          async readText(){ return clipboardWrites.at(-1) || ''; }
        }
      });
      Object.assign(window, { __clipboardWrites: clipboardWrites });
      window.print = () => {
        (window as typeof window & {
          __adminAssetTestHarness: { printInvocations: number };
        }).__adminAssetTestHarness.printInvocations += 1;
      };
    }, seed);

    await this.page.goto('/area_administrativa.html', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => this.page.evaluate(() => Boolean(
      (window as typeof window & { __firebaseTestHarness?: unknown }).__firebaseTestHarness
    ))).toBe(true);
    await expect(this.accessPanel).toBeVisible();
    if(seed.authPersistenceUnavailable||seed.authPersistenceFailure){
      await expect(this.loginButton).toBeDisabled();
    }else{
      await expect(this.loginButton).toBeEnabled();
    }
  }

  async login(email: string, password: string){
    await this.page.locator('#adminEmail').fill(email);
    await this.page.locator('#adminPassword').fill(password);
    await this.loginButton.click();
  }

  async loginAsAuthorized(email: string, password: string){
    await this.login(email, password);
    await expect(this.adminContent).toBeVisible();
    await expect(this.accessPanel).toBeHidden();
    await expect(this.page.locator('#syncStatus')).toContainText(/carregados|indisponível/i);
  }

  async firebaseReads(){
    return this.page.evaluate(() => (
      window as typeof window & {
        __firebaseTestHarness: { reads(): Array<Record<string, unknown>> };
      }
    ).__firebaseTestHarness.reads());
  }

  async firebaseWrites(){
    return this.page.evaluate(() => (
      window as typeof window & {
        __firebaseTestHarness: { writes(): Array<Record<string, unknown>> };
      }
    ).__firebaseTestHarness.writes());
  }

  async firebaseSnapshot(){
    return this.page.evaluate(() => (
      window as typeof window & {
        __firebaseTestHarness: { snapshot(): Record<string, unknown> };
      }
    ).__firebaseTestHarness.snapshot());
  }

  async authState(){
    return this.page.evaluate(() => (
      window as typeof window & {
        __firebaseTestHarness: {
          authState(): Record<string, { uid: string; email: string; isAnonymous: boolean } | null>;
        };
      }
    ).__firebaseTestHarness.authState());
  }

  async authLog(){
    return this.page.evaluate(() => (
      window as typeof window & {
        __firebaseTestHarness: { authLog(): Array<Record<string, unknown>> };
      }
    ).__firebaseTestHarness.authLog());
  }

  async failNextAuth(
    operation: string,
    appName = '',
    code = 'fixture/auth-failed',
    message = 'Falha de autenticação simulada.'
  ){
    return this.page.evaluate(
      ({ authOperation, authAppName, authCode, authMessage }) => (
        window as typeof window & {
          __firebaseTestHarness: {
            failNextAuth(
              operation: string,
              appName?: string,
              code?: string,
              message?: string
            ): string;
          };
        }
      ).__firebaseTestHarness.failNextAuth(
        authOperation,
        authAppName,
        authCode,
        authMessage
      ),
      {
        authOperation: operation,
        authAppName: appName,
        authCode: code,
        authMessage: message
      }
    );
  }

  async replaceFirebaseDocument(path: string, data: Record<string, unknown>){
    await this.page.evaluate(
      ({ documentPath, documentData }) => (
        window as typeof window & {
          __firebaseTestHarness: {
            replaceDocument(path: string, data: Record<string, unknown>): void;
          };
        }
      ).__firebaseTestHarness.replaceDocument(documentPath, documentData),
      { documentPath: path, documentData: data }
    );
  }

  async clipboardWrites(){
    return this.page.evaluate(() => (
      window as typeof window & { __clipboardWrites: string[] }
    ).__clipboardWrites.slice());
  }
}
