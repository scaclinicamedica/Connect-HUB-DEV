import { test, expect } from '../support/test-fixture';
import { arrhythmiaCompleted } from '../fixtures/arrhythmias';
import { basePatient } from '../fixtures/patients';

test('inclui Clinical Copilot na busca, passagem copiada e snapshot', async ({ app }) => {
  await app.goto({ patients: [arrhythmiaCompleted, basePatient('fixture-unrelated', 2)] });

  await app.page.locator('#search').fill('Infecção');
  await expect(app.cards).toHaveCount(1);
  await expect(app.cards.first()).toHaveAttribute('data-id', arrhythmiaCompleted.id);
  await app.page.locator('#search').fill('');

  await app.page.evaluate(() => (window as any).copyFullHandover());
  const copied = await app.page.evaluate(() => window.__clipboardWrites.at(-1) || '');
  expect(copied).toContain('Resumo assistencial (Clinical Copilot)');
  expect(copied).toContain('Arritmias [Concluído]');
  expect(copied).toContain('Infecção/sepse');

  await app.page.locator('#currentDoctor').fill('MÉDICO FICTÍCIO CHECK-OUT');
  await app.page.locator('#receiverDoctor').fill('MÉDICO FICTÍCIO CHECK-IN');
  await app.page.locator('button[onclick="confirmHandover()"]').click();

  await expect.poll(async () => {
    const snapshot = await app.firebaseSnapshot();
    return Object.keys(snapshot).filter(path => path.includes('/confirmacoes/')).length;
  }).toBe(1);

  const snapshot = await app.firebaseSnapshot() as Record<string, any>;
  const confirmation = Object.entries(snapshot).find(([path]) => path.includes('/confirmacoes/'))?.[1];
  expect(confirmation).toBeTruthy();
  expect(confirmation.patientsSnapshot[0].clinicalCopilotSummary).toContain('Arritmias [Concluído]');
  expect(confirmation.patientsSnapshot[0].clinicalHandoverSummary).toContain('Fibrilação atrial');
});
