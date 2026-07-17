import { test, expect } from '../support/test-fixture';
import { arrhythmiaCompleted } from '../fixtures/arrhythmias';

test('visualização de Arritmias não modifica dados nem solicita escrita', async ({ app }) => {
  await app.goto({ patients: [arrhythmiaCompleted] });
  await app.clearFirebaseWrites();
  const before = await app.firebaseSnapshot();

  const cardModule = app.page.locator(`.card[data-id="${arrhythmiaCompleted.id}"] [data-clinical-copilot-card="arrhythmias"]`);
  await expect(cardModule).toBeVisible();
  await expect(cardModule).toBeEnabled();
  await cardModule.scrollIntoViewIfNeeded();
  const cardModuleBox = await cardModule.boundingBox();
  expect(cardModuleBox).not.toBeNull();
  if(!cardModuleBox) throw new Error('O módulo de Arritmias não possui área clicável.');
  await app.page.mouse.click(
    cardModuleBox.x + cardModuleBox.width / 2,
    cardModuleBox.y + cardModuleBox.height / 2
  );
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'view');
  await expect(app.arrhythmiasPanel.locator('[data-rc122-readonly]')).toContainText('Arritmias');
  await app.arrhythmiasPanel.locator('[data-rc122-arr-action="view"]').click();
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'collapsed');

  const after = await app.firebaseSnapshot();
  const writes = await app.firebaseWrites();
  expect(after).toEqual(before);
  expect(writes).toEqual([]);
});
