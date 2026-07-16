import { test, expect } from '../support/test-fixture';
import { arrhythmiaCompleted } from '../fixtures/arrhythmias';
import { basePatient } from '../fixtures/patients';
import { expectNoHorizontalOverflow, expectOrderedVertically } from '../support/layout-assertions';

test('mantém o resumo no card vertical e horizontal sem contêiner vazio', async ({ app }) => {
  const withoutModule = basePatient('fixture-without-module', 2);
  await app.goto({ patients: [arrhythmiaCompleted, withoutModule] });

  const withCopilot = app.page.locator(`.card[data-id="${arrhythmiaCompleted.id}"]`);
  const withoutCopilot = app.page.locator(`.card[data-id="${withoutModule.id}"]`);
  await expect(withCopilot.locator('.clinical-copilot-card-summary')).toBeVisible();
  await expect(withoutCopilot.locator('.clinical-copilot-card-summary')).toHaveCount(0);
  await expectOrderedVertically([
    withCopilot.locator('.card-head'),
    withCopilot.locator('.hypothesis-block'),
    withCopilot.locator('.pending-block'),
    withCopilot.locator('.clinical-copilot-card-summary'),
    withCopilot.locator('.card-actions')
  ]);

  await app.page.locator('[data-view-v25="horizontal"]').click();
  await expect(app.page.locator('#cards')).toHaveClass(/view-horizontal-v25/);
  await expect(withCopilot.locator('.clinical-copilot-card-summary')).toBeVisible();
  await expectNoHorizontalOverflow(app.page);
});

