import { test, expect } from '../support/test-fixture';
import { arrhythmiaCompleted } from '../fixtures/arrhythmias';
import { expectHorizontalClinicalCardLayout, expectNoHorizontalOverflow } from '../support/layout-assertions';

test('não apresenta overflow horizontal e preserva card e drawer', async ({ app }) => {
  await app.goto({ patients: [arrhythmiaCompleted] });
  await expectNoHorizontalOverflow(app.page);
  await expect(app.page.locator(`.card[data-id="${arrhythmiaCompleted.id}"] .clinical-copilot-card-summary`)).toBeVisible();

  await app.openPatientById(arrhythmiaCompleted.id);
  await expect(app.drawer).toBeVisible();
  await expectNoHorizontalOverflow(app.page);
});

test('modo horizontal permanece utilizável no breakpoint corrente', async ({ app }) => {
  await app.goto({ patients: [arrhythmiaCompleted] });
  await app.page.locator('[data-view-v25="horizontal"]').click();
  await expect(app.page.locator('#cards')).toHaveClass(/view-horizontal-v25/);
  const card = app.page.locator(`.card[data-id="${arrhythmiaCompleted.id}"]`);
  await expect(card.locator('.clinical-copilot-card-summary')).toBeVisible();
  await expectHorizontalClinicalCardLayout(card);
});

test('modo horizontal não apresenta overflow fora da regressão conhecida', async ({ app }) => {
  const width = app.page.viewportSize()?.width;
  test.fail(
    width === 761 || width === 768,
    'Regressão preexistente da V1: o modo horizontal mede 792 px nestes viewports.'
  );

  await app.goto({ patients: [arrhythmiaCompleted] });
  await app.page.locator('[data-view-v25="horizontal"]').click();
  await expectNoHorizontalOverflow(app.page);
});
