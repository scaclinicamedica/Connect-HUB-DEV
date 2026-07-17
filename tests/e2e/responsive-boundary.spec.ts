import { type Page } from '@playwright/test';
import { test, expect } from '../support/test-fixture';
import { type PassagemPage } from '../support/passagem-page';
import { arrhythmiaCompleted } from '../fixtures/arrhythmias';
import {
  expectHorizontalClinicalCardLayout,
  expectStrictHorizontalNoOverflow
} from '../support/layout-assertions';

const shortPatient = {
  ...arrhythmiaCompleted,
  id: 'fixture-responsive-short',
  bed: 'F-R01',
  name: 'PACIENTE FICTICIO CURTO',
  diagnosis: 'HIPOTESE FICTICIA CURTA',
  recommendation: 'PENDENCIA FICTICIA CURTA'
};

const extremePatient = {
  ...arrhythmiaCompleted,
  id: 'fixture-responsive-extreme',
  bed: 'F-R02',
  name: 'PACIENTE FICTICIO COM NOME EXTREMAMENTE LONGO PARA CARACTERIZACAO RESPONSIVA',
  diagnosis: 'HIPOTESE DIAGNOSTICA EXCLUSIVAMENTE FICTICIA COM TEXTO EXTENSO PARA VALIDAR CONTENCAO E QUEBRA DE LINHA',
  recommendation: 'PENDENCIA EXCLUSIVAMENTE FICTICIA COM DESCRICAO EXTENSA PARA VALIDAR A CONTENCAO DO CARD SEM SOBREPOSICAO'
};

async function settleResponsiveLayout(page: Page){
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

const boundaryCases = [
  { width: 759, display: 'block' },
  { width: 760, display: 'block' },
  { width: 761, display: 'block' },
  { width: 768, display: 'block' },
  { width: 790, display: 'block' },
  { width: 791, display: 'block' },
  { width: 792, display: 'grid' },
  { width: 793, display: 'grid' },
  { width: 1180, display: 'grid' },
  { width: 1440, display: 'grid' }
] as const;

for(const current of boundaryCases) {
  test(`preserva a fronteira horizontal estrita em ${current.width} px com conteudo ficticio curto e extremo`, async ({ app }) => {
    await app.goto({ patients: [shortPatient, extremePatient] });
    const horizontal = app.page.locator('[data-view-v25="horizontal"]');
    await horizontal.scrollIntoViewIfNeeded();
    await horizontal.click();
    await expect(app.page.locator('#cards')).toHaveClass(/view-horizontal-v25/);

    await app.page.setViewportSize({ width: current.width, height: current.width === 1440 ? 1000 : 900 });
    await settleResponsiveLayout(app.page);
    expect(app.page.viewportSize()?.width).toBe(current.width);
    await expect.poll(() => app.page.locator('#cards .card').first().evaluate(node => getComputedStyle(node).display)).toBe(current.display);
    await expectStrictHorizontalNoOverflow(app.page);
    for(const patient of [shortPatient, extremePatient]) {
      const card = app.page.locator(`.card[data-id="${patient.id}"]`);
      await expect(card).toBeVisible();
      await expectHorizontalClinicalCardLayout(card);
    }
  });
}

async function openArrhythmiasFromHorizontalCard(app: PassagemPage, input: 'mouse' | 'touch'){
  await app.goto({ patients: [shortPatient] });
  const horizontal = app.page.locator('[data-view-v25="horizontal"]');
  await horizontal.scrollIntoViewIfNeeded();
  if(input === 'touch') await horizontal.tap();
  else await horizontal.click();
  await expect(app.page.locator('#cards')).toHaveClass(/view-horizontal-v25/);

  const module = app.page.locator(`.card[data-id="${shortPatient.id}"] .clinical-copilot-module[data-clinical-copilot-card="arrhythmias"]`);
  await module.scrollIntoViewIfNeeded();
  if(input === 'touch') await module.tap();
  else await module.click();

  await expect(app.drawer).toHaveClass(/open/);
  await expect(app.arrhythmiasPanel).toBeVisible();
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'view');
}

test.describe('Clinical Copilot em 390 px com mouse real', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: false, isMobile: false });

  test('abre o drawer e Arritmias por locator.click', async ({ app }) => {
    await openArrhythmiasFromHorizontalCard(app, 'mouse');
  });
});

test.describe('Clinical Copilot em 390 px com toque real', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('abre o drawer e Arritmias por locator.tap', async ({ app }) => {
    expect(await app.page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
    await openArrhythmiasFromHorizontalCard(app, 'touch');
  });
});
