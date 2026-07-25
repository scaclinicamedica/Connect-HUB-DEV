import { test, expect } from '../support/test-fixture';
import { basePatient } from '../fixtures/patients';
import {
  CLINICAL_TEST_DISPLAY_NAME,
  CLINICAL_TEST_EMAIL,
  CLINICAL_TEST_PASSWORD
} from '../fixtures/auth';

test('login e sessão clínica permanecem contidos no viewport', async ({ app, page }) => {
  await app.goto({
    patients: [basePatient('fixture-clinical-auth-responsive')]
  }, { session: 'signed-out' });

  await expect.poll(() => page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))).toMatchObject({
    width: page.viewportSize()?.width,
    scrollWidth: page.viewportSize()?.width
  });

  const gateBox = await page.locator('.clinical-auth-card').boundingBox();
  expect(gateBox).not.toBeNull();
  expect(gateBox!.x).toBeGreaterThanOrEqual(-1);
  expect(gateBox!.x + gateBox!.width).toBeLessThanOrEqual((page.viewportSize()?.width || 0) + 1);
  await expect(app.authGate).toHaveAttribute('role', 'dialog');
  await expect(app.authGate).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#clinicalLoginForm')).toHaveAttribute('aria-busy', 'false');
  await expect(app.authEmail).toHaveAttribute('autocomplete', 'username');
  await expect(app.authPassword).toHaveAttribute('autocomplete', 'current-password');
  await expect(app.authError).toHaveAttribute('aria-live', 'assertive');

  await app.authEmail.fill(CLINICAL_TEST_EMAIL);
  await app.authPassword.fill(CLINICAL_TEST_PASSWORD);
  await app.authPassword.press('Enter');

  await expect(app.sessionName).toHaveText(CLINICAL_TEST_DISPLAY_NAME);
  await expect(app.signOutButton).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);

  await app.signOutButton.click();
  await expect(app.authGate).toBeVisible();
  await expect(app.authEmail).toBeFocused();
});

test('login nominal do HUB permanece contido no viewport', async ({ app, page }) => {
  await app.goto({
    patientsByUnit: {
      emergencia: [basePatient('fixture-hub-auth-responsive')]
    }
  }, {
    session: 'signed-out',
    url: '/index.html'
  });

  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
  await expect(app.authGate).toHaveAttribute('role', 'dialog');
  await expect(page.locator('#clinicalLoginForm')).toHaveAttribute('aria-busy', 'false');

  await app.authEmail.fill(CLINICAL_TEST_EMAIL);
  await app.authPassword.fill(CLINICAL_TEST_PASSWORD);
  await app.authPassword.press('Enter');

  await expect(app.sessionName).toHaveText(CLINICAL_TEST_DISPLAY_NAME);
  await expect(page.locator('#metric-total')).toHaveText('1');
  await expect(app.signOutButton).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);

  await app.signOutButton.click();
  await expect(app.authGate).toBeVisible();
  await expect(app.authEmail).toBeFocused();
});
