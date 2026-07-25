import { test, expect } from '../support/test-fixture';
import type { Page } from '@playwright/test';
import { basePatient } from '../fixtures/patients';
import {
  CLINICAL_TEST_DISPLAY_NAME,
  CLINICAL_TEST_EMAIL,
  CLINICAL_TEST_PASSWORD
} from '../fixtures/auth';

async function horizontalContainmentSnapshot(page: Page){
  const configuredWidth = page.viewportSize()?.width || 0;
  return page.evaluate(expectedWidth => {
    const root = document.documentElement;
    const body = document.body;
    const clientWidth = root.clientWidth;
    const documentOverflow = Math.max(0, root.scrollWidth - clientWidth);
    const bodyOverflow = Math.max(0, body.scrollWidth - body.clientWidth);
    const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .map(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.classList.length ? `.${Array.from(element.classList).slice(0, 3).join('.')}` : ''}`,
          display: style.display,
          position: style.position,
          left: Math.round(rect.left * 10) / 10,
          right: Math.round(rect.right * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
          overflowRight: Math.round(Math.max(0, rect.right - clientWidth) * 10) / 10,
          scrollOverflow: Math.max(0, element.scrollWidth - element.clientWidth)
        };
      })
      .filter(item => (
        item.display !== 'none' &&
        item.width > 0 &&
        (item.overflowRight > 1 || item.scrollOverflow > 1)
      ))
      .sort((first, second) => (
        Math.max(second.overflowRight, second.scrollOverflow) -
        Math.max(first.overflowRight, first.scrollOverflow)
      ))
      .slice(0, 12);

    const maxOverflow = Math.max(documentOverflow, bodyOverflow);
    return {
      contained: window.innerWidth === expectedWidth && maxOverflow <= 1,
      configuredWidth: expectedWidth,
      innerWidth: window.innerWidth,
      visualViewportWidth: window.visualViewport?.width || null,
      clientWidth,
      documentScrollWidth: root.scrollWidth,
      bodyClientWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      documentOverflow,
      bodyOverflow,
      verticalGutter: window.innerWidth - clientWidth,
      offenders
    };
  }, configuredWidth);
}

async function expectStableHorizontalContainment(page: Page){
  await expect.poll(() => horizontalContainmentSnapshot(page)).toMatchObject({
    contained: true
  });
}

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
  await expect(app.cards).toHaveCount(1);
  await expectStableHorizontalContainment(page);

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

  await expectStableHorizontalContainment(page);
  await expect(app.authGate).toHaveAttribute('role', 'dialog');
  await expect(page.locator('#clinicalLoginForm')).toHaveAttribute('aria-busy', 'false');

  await app.authEmail.fill(CLINICAL_TEST_EMAIL);
  await app.authPassword.fill(CLINICAL_TEST_PASSWORD);
  await app.authPassword.press('Enter');

  await expect(app.sessionName).toHaveText(CLINICAL_TEST_DISPLAY_NAME);
  await expect(page.locator('#metric-total')).toHaveText('1');
  await expect(app.signOutButton).toBeVisible();
  await expectStableHorizontalContainment(page);

  await app.signOutButton.click();
  await expect(app.authGate).toBeVisible();
  await expect(app.authEmail).toBeFocused();
});
