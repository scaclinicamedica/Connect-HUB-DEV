import { expect, type Locator, type Page } from '@playwright/test';

type Seed = {
  unit?: string;
  patients?: unknown[];
  meta?: Record<string, unknown>;
  confirmations?: unknown[];
  historyEvents?: unknown[];
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
  get outcomeDialog(){ return this.page.locator('#patientOutcomeDialog'); }
  get outcomeConfirmButton(){ return this.page.locator('#patientOutcomeConfirmBtn'); }

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
    await this.page.locator('#dischargeForecast').fill('2099-12-31');
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
    const card = this.page.locator(`.card[data-id="${id}"]`);
    await expect(card).toBeVisible();
    await card.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const box = await card.boundingBox();
    if(!box) throw new Error(`O card ${id} não possui área clicável.`);
    await this.page.mouse.click(box.x + box.width / 2, box.y + Math.min(box.height / 2, 28));
    await expect(this.drawer).toHaveClass(/open/);
  }

  async openOutcomeFromCard(id: string){
    const button = this.page.locator(`.card[data-id="${id}"] .outcome-action`);
    await expect(button).toBeVisible();
    await button.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const box = await button.boundingBox();
    if(!box) throw new Error(`O botão Desfecho do paciente ${id} não possui área clicável.`);
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(this.outcomeDialog).toHaveClass(/is-open/);
  }

  async selectOutcome(value: 'treated' | 'death' | 'transferred'){
    await this.page.locator(`input[name="patientOutcomeType"][value="${value}"]`).check();
  }

  async fillOutcomeResponsible(name: string){
    await this.page.locator('#patientOutcomeResponsibleDoctor').fill(name);
  }

  async waitForAutosaveHydration(){
    await expect.poll(() => this.page.evaluate(() => {
      try {
        return window.eval('patientAutosaveHydrating === false');
      } catch {
        return false;
      }
    })).toBe(true);
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

  async firebaseDocument(path: string){
    return this.page.evaluate(documentPath => window.__firebaseTestHarness.document(documentPath), path);
  }

  async replaceFirebaseDocumentSilently(path: string, data: Record<string, unknown>){
    await this.page.evaluate(
      ({ documentPath, documentData }) =>
        window.__firebaseTestHarness.replaceDocumentSilently(documentPath, documentData),
      { documentPath: path, documentData: data }
    );
  }

  async delayNextFirebaseWrite(operation: 'set' | 'delete', pathIncludes: string, delayMs = 250){
    return this.page.evaluate(
      ({ op, path, delay }) => window.__firebaseTestHarness.delayNext(op, path, delay),
      { op: operation, path: pathIncludes, delay: delayMs }
    );
  }

  async waitForFirebaseControl(controlId: string, state: 'scheduled' | 'pending'){
    await expect.poll(
      () => this.page.evaluate(
        id => window.__firebaseTestHarness.pendingControls()
          .find(control => control.id === id)?.state || '',
        controlId
      )
    ).toBe(state);
  }

  async failNextFirebaseWrite(operation: 'set' | 'delete', pathIncludes: string, message?: string){
    return this.page.evaluate(
      ({ op, path, failureMessage }) => window.__firebaseTestHarness.failNext(op, path, failureMessage),
      { op: operation, path: pathIncludes, failureMessage: message }
    );
  }

  async failAfterNextFirebaseTransactionCommit(message?: string){
    return this.page.evaluate(
      failureMessage => window.__firebaseTestHarness.failAfterNextTransactionCommit(failureMessage),
      message
    );
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
      replaceDocumentSilently(path: string, data: Record<string, unknown>): void;
      delayNext(operation: string, pathIncludes: string, delayMs?: number): string;
      failNext(operation: string, pathIncludes: string, message?: string): string;
      failAfterNextTransactionCommit(message?: string): void;
      pendingControls(): Array<Record<string, unknown>>;
    };
  }
}
