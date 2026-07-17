import { test, expect } from '../support/test-fixture';
import { arrhythmiaCompleted } from '../fixtures/arrhythmias';
import { expectHorizontalClinicalCardLayout, expectNoHorizontalOverflow } from '../support/layout-assertions';

test('não apresenta overflow horizontal e preserva card e drawer', async ({ app }) => {
  await app.goto({ patients: [arrhythmiaCompleted] });
  await expectNoHorizontalOverflow(app.page);
  await expect(app.page.locator(`.card[data-id="${arrhythmiaCompleted.id}"] .clinical-copilot-card-summary`)).toBeVisible();

  const card = app.page.locator(`.card[data-id="${arrhythmiaCompleted.id}"]`);
  await expect(card).toBeVisible();
  await expect(card).toBeEnabled();
  await card.scrollIntoViewIfNeeded();

  const cardBox = await card.boundingBox();
  expect(cardBox).not.toBeNull();
  if (!cardBox) {
    throw new Error('O card não possui uma área clicável.');
  }

  const clickPoint = {
    x: cardBox.x + cardBox.width / 2,
    y: cardBox.y + cardBox.height / 2,
  };
  const centerBelongsToCard = await app.page.evaluate(
    ({ id, x, y }) => {
      const patientCard = document.querySelector(`.card[data-id="${id}"]`);
      const hitTarget = document.elementFromPoint(x, y);
      return Boolean(
        patientCard &&
          hitTarget &&
          (hitTarget === patientCard || patientCard.contains(hitTarget)),
      );
    },
    { id: arrhythmiaCompleted.id, ...clickPoint },
  );
  expect(centerBelongsToCard).toBe(true);

  await app.page.mouse.click(clickPoint.x, clickPoint.y);
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

test('modo horizontal não apresenta overflow', async ({ app }) => {
  await app.goto({ patients: [arrhythmiaCompleted] });
  await app.page.locator('[data-view-v25="horizontal"]').click();
  await expectNoHorizontalOverflow(app.page);
});
