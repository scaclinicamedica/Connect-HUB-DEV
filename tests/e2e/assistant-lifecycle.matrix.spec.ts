import { test, expect } from '../support/test-fixture';
import { expectInside } from '../support/layout-assertions';

test('seleção direta mantém Arritmias aberto e visível no drawer', async ({ app }) => {
  await app.goto();
  await app.openNewPatient();
  await app.openCatalog();
  await app.selectModule('Arritmias');

  await expect(app.arrhythmiasPanel).toBeVisible();
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'edit');
  await expectInside(app.drawer, app.arrhythmiasPanel);
  await app.page.waitForTimeout(750);
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'edit');
});

