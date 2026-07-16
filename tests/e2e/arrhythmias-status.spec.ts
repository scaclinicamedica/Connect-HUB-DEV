import { test, expect } from '../support/test-fixture';
import {
  arrhythmiaCompletedAfterConduct,
  arrhythmiaConductRecorded,
  arrhythmiaInProgress,
  arrhythmiaPriority
} from '../fixtures/arrhythmias';

const cases = [
  [arrhythmiaInProgress, 'Em andamento'],
  [arrhythmiaConductRecorded, 'Conduta registrada'],
  [arrhythmiaCompletedAfterConduct, 'Concluído'],
  [arrhythmiaPriority, 'Prioridade clínica']
] as const;

test('preserva a semântica homologada dos quatro estados', async ({ app }) => {
  await app.goto({ patients: cases.map(([patient]) => patient) });

  for(const [patient, status] of cases) {
    const module = app.page.locator(`.card[data-id="${patient.id}"] .clinical-copilot-module`).first();
    await expect(module.locator('.clinical-copilot-module-state')).toContainText(status);
  }

  const completed = app.page.locator(`.card[data-id="${arrhythmiaCompletedAfterConduct.id}"] .clinical-copilot-module`);
  await expect(completed).toContainText('Estabilizou após conduta imediata');
  await expect(completed.locator('.clinical-copilot-module-state')).toContainText('Concluído');

  const priority = app.page.locator(`.card[data-id="${arrhythmiaPriority.id}"]`);
  await expect(priority.locator('.clinical-priority-signal')).toBeVisible();
  await expect(priority.locator('.clinical-copilot-module-state')).toContainText('Prioridade clínica');
});

