import { test, expect } from '../support/test-fixture';
import { arrhythmiaCompleted, arrhythmiaInProgress } from '../fixtures/arrhythmias';

test('abre concluído em visualização, permite edição deliberada e permanece recolhido', async ({ app }) => {
  await app.goto({ patients: [arrhythmiaCompleted] });
  const card = app.page.locator(`.card[data-id="${arrhythmiaCompleted.id}"]`);

  await card.locator('[data-clinical-copilot-card="arrhythmias"]').click();
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'view');
  await expect(app.arrhythmiasPanel.locator('[data-rc122-readonly]')).toBeVisible();
  await expect(app.arrhythmiasPanel.locator('.arr-clean-body')).toBeHidden();

  await app.arrhythmiasPanel.locator('.arr-clean-header-edit').click();
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'edit');
  await expect(app.arrhythmiasPanel.locator('.arr-clean-body')).toBeVisible();

  await app.arrhythmiasPanel.locator('[data-rc122-arr-action="view"]').click();
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'view');
  await app.arrhythmiasPanel.locator('[data-rc122-arr-action="view"]').click();
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'collapsed');
  await app.page.waitForTimeout(750);
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'collapsed');
});

test('abre avaliação incompleta em continuidade de edição', async ({ app }) => {
  await app.goto({ patients: [arrhythmiaInProgress] });
  const card = app.page.locator(`.card[data-id="${arrhythmiaInProgress.id}"]`);
  await card.locator('[data-clinical-copilot-card="arrhythmias"]').click();

  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'edit');
  await expect(app.arrhythmiasPanel.locator('.arr-clean-body')).toBeVisible();
  await expect(app.arrhythmiasPanel.locator('[data-rc122-readonly]')).toBeHidden();
});

