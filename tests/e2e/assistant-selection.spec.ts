import { test, expect } from '../support/test-fixture';

test('seleciona Arritmias pelo cartão inteiro e abre o módulo diretamente', async ({ app }) => {
  await app.goto();
  await app.openNewPatient();
  await app.openCatalog();
  await app.selectModule('Arritmias');

  await expect(app.page.locator('#arrhythmiasAlert')).toBeChecked();
  await expect(app.catalog).not.toHaveClass(/rc122-catalog-open/);
  await expect(app.arrhythmiasPanel).toBeVisible();
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'edit');
});

test('seleciona Profilaxia de TEV e abre o painel correspondente', async ({ app }) => {
  await app.goto();
  await app.openNewPatient();
  await app.openCatalog();
  await app.selectModule('Profilaxia de TEV');

  await expect(app.page.locator('#tevProphylaxisAlert')).toBeChecked();
  await expect(app.catalog).not.toHaveClass(/rc122-catalog-open/);
  await expect(app.page.locator('#paduaCalculatorWrap')).toBeVisible();
  await expect(app.page.locator('#paduaCalculatorWrap')).toHaveClass(/show/);
});

test('novo paciente não herda o estado de Arritmias do paciente anterior', async ({ app }) => {
  const { arrhythmiaCompleted } = await import('../fixtures/arrhythmias');
  await app.goto({ patients: [arrhythmiaCompleted] });
  await app.openNewPatient();
  await app.openCatalog();
  await app.selectModule('Arritmias');

  await expect(app.page.locator('#arrhythmiasAlert')).toBeChecked();
  await expect(app.page.locator('#arrhythmiasCleanWrap [data-arr-diagnosis].is-selected')).toHaveCount(0);
  const state = await app.page.evaluate(() => window.ArrhythmiasCleanBase?.getState?.());
  expect(state?.diagnosis || '').toBe('');
  expect(state?.finalized).toBe(false);
});
