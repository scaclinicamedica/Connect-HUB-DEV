import { expect, type Locator, type Page } from '@playwright/test';
import {
  clinicalTestAccount,
  clinicalTestProfile,
  clinicalTestUser
} from '../fixtures/auth';

type AuthUserSeed = {
  uid: string;
  email?: string;
  isAnonymous?: boolean;
};

type AuthAccountSeed = {
  uid: string;
  email: string;
  password: string;
  disabled?: boolean;
};

export type PassagemSeed = {
  unit?: string;
  authUid?: string;
  initialAuthUser?: AuthUserSeed | null;
  initialAuthByApp?: Record<string, AuthUserSeed | null>;
  authAccounts?: AuthAccountSeed[];
  authPersistenceUnavailable?: boolean;
  authPersistenceFailure?: boolean;
  patients?: unknown[];
  patientsByUnit?: Record<string, unknown[]>;
  meta?: Record<string, unknown>;
  confirmations?: unknown[];
  closedPatients?: unknown[];
  historyEvents?: unknown[];
  adminOutcomes?: unknown[];
  adminUsers?: unknown[];
  clinicalUsers?: unknown[];
  adminAccounts?: AuthAccountSeed[];
  readDelays?: Array<{ pathIncludes?: string; delayMs?: number }>;
  listenerDelays?: Array<{ pathIncludes?: string; delayMs?: number }>;
  readFailures?: Array<{ pathIncludes?: string; message?: string; code?: string }>;
};

type PassagemGotoOptions = {
  session?: 'authorized' | 'signed-out' | 'as-seeded';
  url?: string;
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
  get authGate(){ return this.page.locator('#clinicalAuthGate'); }
  get appShell(){ return this.page.locator('#clinicalAppShell'); }
  get authEmail(){ return this.page.locator('#clinicalEmail'); }
  get authPassword(){ return this.page.locator('#clinicalPassword'); }
  get authStatus(){ return this.page.locator('#clinicalAuthStatus'); }
  get authError(){ return this.page.locator('#clinicalAuthError'); }
  get loginButton(){ return this.page.locator('#clinicalLoginBtn'); }
  get sessionPanel(){ return this.page.locator('#clinicalSessionPanel'); }
  get sessionName(){ return this.page.locator('#clinicalSessionName'); }
  get signOutButton(){ return this.page.locator('#clinicalSignOutBtn'); }

  async goto(seed: PassagemSeed = {}, options: PassagemGotoOptions = {}){
    const session = options.session || 'authorized';
    const effectiveSeed: PassagemSeed = {
      ...seed,
      authAccounts: seed.authAccounts ?? [clinicalTestAccount],
      clinicalUsers: seed.clinicalUsers ?? [clinicalTestProfile]
    };
    if(
      session === 'authorized' &&
      !Object.prototype.hasOwnProperty.call(seed, 'initialAuthUser') &&
      !Object.prototype.hasOwnProperty.call(seed, 'authUid') &&
      !Object.prototype.hasOwnProperty.call(seed.initialAuthByApp || {}, '[DEFAULT]')
    ){
      effectiveSeed.initialAuthUser = clinicalTestUser;
    }

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
    }, effectiveSeed);

    const targetUrl = options.url || '/passagem.html?setor=emergencia';
    const isPassagem = targetUrl.includes('passagem.html');
    await this.page.goto(targetUrl, {
      waitUntil: 'domcontentloaded'
    });
    await expect.poll(() => this.page.evaluate(() => Boolean(window.__firebaseTestHarness))).toBe(true);
    if(isPassagem){
      await expect.poll(() => this.page.evaluate(() => document.documentElement.dataset.rc127HostedDesktopBridge)).toBe('ready');
    }
    if(session === 'authorized'){
      await expect(this.authGate).toBeHidden();
      await expect(this.appShell).toBeVisible();
      if(isPassagem){
        await expect(this.page.locator('#cards')).toBeVisible();
        if(seed.patients) await expect(this.cards).toHaveCount(seed.patients.length);
      }
    } else if(session === 'signed-out'){
      await expect(this.authGate).toBeVisible();
      await expect(this.appShell).toBeHidden();
      await expect(this.authEmail).toBeFocused();
    }
  }

  async login(email: string, password: string){
    await this.authEmail.fill(email);
    await this.authPassword.fill(password);
    await expect(this.authEmail).toHaveValue(email);
    await expect(this.authPassword).toHaveValue(password);
    await this.loginButton.click();
  }

  async loginAsAuthorized(
    email = clinicalTestAccount.email,
    password = clinicalTestAccount.password
  ){
    await this.login(email, password);
    await expect(this.authGate).toBeHidden();
    await expect(this.appShell).toBeVisible();
    await expect(this.sessionPanel).toBeVisible();
  }

  async authState(){
    return this.page.evaluate(() => window.__firebaseTestHarness.authState());
  }

  async authLog(){
    return this.page.evaluate(() => window.__firebaseTestHarness.authLog());
  }

  async firestoreAccesses(){
    return this.page.evaluate(() => window.__firebaseTestHarness.firestoreAccesses());
  }

  async activeListeners(){
    return this.page.evaluate(() => window.__firebaseTestHarness.activeListeners());
  }

  async listenerDeliveries(){
    return this.page.evaluate(() => window.__firebaseTestHarness.listenerDeliveries());
  }

  async clearFirestoreAccesses(){
    await this.page.evaluate(() => window.__firebaseTestHarness.clearFirestoreAccesses());
  }

  async failNextAuth(
    operation: 'signInWithEmailAndPassword' | 'signOut',
    message = 'Falha de autenticação simulada.',
    code = 'fixture/auth-failed'
  ){
    return this.page.evaluate(
      ({ authOperation, failureMessage, failureCode }) =>
        window.__firebaseTestHarness.failNextAuth(
          authOperation,
          '[DEFAULT]',
          failureCode,
          failureMessage
        ),
      { authOperation: operation, failureMessage: message, failureCode: code }
    );
  }

  async failActiveListener(
    pathIncludes: string,
    code = 'permission-denied',
    message = 'Leitura negada pela regra simulada.'
  ){
    return this.page.evaluate(
      ({ path, failureCode, failureMessage }) =>
        window.__firebaseTestHarness.failActiveListener(
          path,
          failureCode,
          failureMessage
        ),
      { path: pathIncludes, failureCode: code, failureMessage: message }
    );
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

  async firebaseReads(){
    return this.page.evaluate(() => window.__firebaseTestHarness.reads());
  }

  async clearFirebaseWrites(){
    await this.page.evaluate(() => window.__firebaseTestHarness.clearWrites());
  }

  async clearFirebaseReads(){
    await this.page.evaluate(() => window.__firebaseTestHarness.clearReads());
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

  async replaceFirebaseDocument(path: string, data: Record<string, unknown>){
    await this.page.evaluate(
      ({ documentPath, documentData }) =>
        window.__firebaseTestHarness.replaceDocument(documentPath, documentData),
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
      ),
      { intervals: [50, 100, 150], timeout: 7_500 }
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
    __CONNECT_HUB_TEST_SEED__: PassagemSeed;
    __clipboardWrites: string[];
    __printInvocations: number;
    __firebaseTestHarness: {
      snapshot(): Record<string, unknown>;
      writes(): Array<Record<string, unknown>>;
      reads(): Array<Record<string, unknown>>;
      subscriptions(): Array<Record<string, unknown>>;
      firestoreAccesses(): Array<Record<string, unknown>>;
      activeListeners(): Array<Record<string, unknown>>;
      listenerDeliveries(): Array<Record<string, unknown>>;
      authLog(): Array<Record<string, unknown>>;
      authState(): Record<string, Record<string, unknown> | null>;
      clearWrites(): void;
      clearReads(): void;
      clearFirestoreAccesses(): void;
      document(path: string): Record<string, unknown> | undefined;
      replaceDocumentSilently(path: string, data: Record<string, unknown>): void;
      replaceDocument(path: string, data: Record<string, unknown>): void;
      delayNext(operation: string, pathIncludes: string, delayMs?: number): string;
      failNext(operation: string, pathIncludes: string, message?: string): string;
      failAfterNextTransactionCommit(message?: string): void;
      failNextAuth(operation: string, appName?: string, code?: string, message?: string): string;
      failActiveListener(pathIncludes: string, code?: string, message?: string): number;
      pendingControls(): Array<Record<string, unknown>>;
    };
  }
}
