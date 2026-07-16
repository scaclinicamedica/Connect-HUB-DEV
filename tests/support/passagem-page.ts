import { expect, type Locator, type Page } from '@playwright/test';

type Seed = {
  unit?: string;
  patients?: unknown[];
  meta?: Record<string, unknown>;
  confirmations?: unknown[];
};

export class PassagemPage {
  constructor(
    readonly page: Page,
    readonly networkAttempts: Array<{ url: string; method: string; disposition: string }>
  ){}

  get drawer(){ return this.page.locator('#drawer'); }
  get catalog(){ return this.page.locator('#alertChecks'); }
  get arrhythmiasPanel(){ return this.page.locator('#arrhythmiasCleanWrap'); }
  get cards(){ return this.page.locator('#cards .card'); }

  async goto(seed: Seed = {}){
    await this.page.addInitScript(value => {
      window.__CONNECT_HUB_TEST_SEED__ = value;
      window.__clipboardWrites = [];
      window.__printInvocations = 0;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          async writeText(text: string){ window.__clipboardWrites.push(String(text)); },
          async readText(){ return window.__clipboardWrites.at(-1) || ''; }
        }
      });
      window.print = () => { window.__printInvocations += 1; };
    }, seed);

    await this.page.goto('/passagem.html?setor=emergencia', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => this.page.evaluate(() => Boolean(window.__firebaseTestHarness))).toBe(true);
    await expect.poll(() => this.page.evaluate(() => document.documentElement.dataset.rc127HostedDesktopBridge)).toBe('ready');
    await expect(this.page.locator('#cards')).toBeVisible();
    if(seed.patients) await expect(this.cards).toHaveCount(seed.patients.length);
  }

  async openNewPatient(){
    await this.page.locator('button[onclick="openDrawer()"]') .click();
    await expect(this.drawer).toHaveClass(/open/);
  }

  async fillRequiredPatientFields(suffix = 'AUTO'){
    const bed = this.page.locator('#bed');
    if(await bed.isVisible()){
      await bed.fill(`F-${suffix}`);
    } else {
      await this.page.locator('.bed-picker-toggle').click();
      const firstAvailableBed = this.page.locator('#bedOptions .bed-option').first();
      await expect(firstAvailableBed).toBeVisible();
      await firstAvailableBed.click();
      await expect(bed).not.toHaveValue('');
    }
    await this.page.locator('#name').fill(`PACIENTE FICTÍCIO ${suffix}`);
    await this.page.locator('#dischargeForecast').fill('2026-07-20');
    await this.page.locator('#diagnosis').fill('HIPÓTESE FICTÍCIA PARA TESTE');
  }

  moduleOption(value: string): Locator {
    return this.page.locator('#alertChecks > label').filter({
      has: this.page.locator(`:scope > input.alertCheck[value="${value}"]`)
    }).first();
  }

  async openCatalog(){
    await this.page.locator('#alertOptionsToggle').click();
    await expect(this.catalog).toHaveClass(/show/);
    await expect(this.catalog).toHaveClass(/rc122-catalog-open/);
  }

  async selectModule(value: string){
    const option = this.moduleOption(value);
    await expect(option).toBeVisible();
    await option.click();
  }

  async openPatientById(id: string){
    await this.page.locator(`.card[data-id="${id}"]`).click();
    await expect(this.drawer).toHaveClass(/open/);
  }

  async firebaseSnapshot(){
    return this.page.evaluate(() => window.__firebaseTestHarness.snapshot());
  }

  async firebaseWrites(){
    return this.page.evaluate(() => window.__firebaseTestHarness.writes());
  }

  async clearFirebaseWrites(){
    await this.page.evaluate(() => window.__firebaseTestHarness.clearWrites());
  }

  async persistedPatient(id: string){
    return this.page.evaluate(patientId => window.__firebaseTestHarness.document(`connect_hub_v55/emergencia/pacientes/${patientId}`), id);
  }
}

declare global {
  interface Window {
    __CONNECT_HUB_TEST_SEED__: Seed;
    __clipboardWrites: string[];
    __printInvocations: number;
    __firebaseTestHarness: {
      snapshot(): Record<string, unknown>;
      writes(): Array<Record<string, unknown>>;
      clearWrites(): void;
      document(path: string): Record<string, unknown> | undefined;
    };
  }
}
