import { expect, type Page } from '@playwright/test';

export type AdminSeed = {
  authUid?: string;
  adminAccounts?: Array<{ uid: string; email: string; password: string }>;
  adminUsers?: Array<Record<string, unknown> & { id: string }>;
  patientsByUnit?: Record<string, Array<Record<string, unknown> & { id: string }>>;
  historyEvents?: Array<Record<string, unknown> & { id: string }>;
  adminOutcomes?: Array<Record<string, unknown> & { id: string }>;
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
        canvasId: string;
        config: unknown;
        constructor(canvas: HTMLCanvasElement, config: unknown){
          this.canvasId = canvas?.id || '';
          this.config = config;
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
          printInvocations: 0,
          ChartTestDouble
        },
        __xssTriggered: false
      });
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
    await expect(this.loginButton).toBeEnabled();
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

  async authState(){
    return this.page.evaluate(() => (
      window as typeof window & {
        __firebaseTestHarness: {
          authState(): Record<string, { uid: string; email: string; isAnonymous: boolean } | null>;
        };
      }
    ).__firebaseTestHarness.authState());
  }
}
