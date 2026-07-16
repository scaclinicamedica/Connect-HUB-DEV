import { test, expect } from '../support/test-fixture';
import { arrhythmiaCompleted } from '../fixtures/arrhythmias';
import { attachTimingRecorder, installTimingRecorder } from '../support/timing-recorder';

test('ações manuais prevalecem sobre recuperações tardias em 1440 px', async ({ app }, testInfo) => {
  await app.goto({ patients: [arrhythmiaCompleted] });
  await installTimingRecorder(app.page);

  try {
    await app.openNewPatient();
    await app.openCatalog();
    await app.selectModule('Arritmias');
    await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'edit');
    await app.page.waitForTimeout(750);
    await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'edit');

    await app.page.locator('#overlay').click({ position: { x: 4, y: 4 } });
    await expect(app.drawer).not.toHaveClass(/open/);
    await app.page.locator(`.card[data-id="${arrhythmiaCompleted.id}"] [data-clinical-copilot-card="arrhythmias"]`).click();
    await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'view');
    await app.arrhythmiasPanel.locator('[data-rc122-arr-action="view"]').click();
    await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'collapsed');
    await app.page.waitForTimeout(750);
    await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'collapsed');
  } catch(error) {
    await attachTimingRecorder(app.page, testInfo);
    throw error;
  }
});

