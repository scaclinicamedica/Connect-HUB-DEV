import { test, expect } from '../support/test-fixture';
import { OUTCOME_TEST_DOCTOR, outcomePatient } from '../fixtures/outcomes';

test('Desfecho permanece utilizável sem overflow no viewport corrente', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-responsive');
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });

  await app.openOutcomeFromCard(patient.id);
  await expect(app.page.locator('#patientOutcomeTitle')).toBeVisible();
  await expect(app.page.locator('#patientOutcomeCancelBtn')).toBeVisible();
  await expect(app.outcomeConfirmButton).toBeVisible();

  const layout = await app.page.evaluate(() => {
    const dialog = document.querySelector('.patient-outcome-dialog');
    if(!dialog) return null;
    const rect = dialog.getBoundingClientRect();
    return {
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: window.innerWidth,
      height: window.innerHeight
    };
  });

  expect(layout).not.toBeNull();
  expect(layout!.documentOverflow).toBeLessThanOrEqual(0);
  expect(layout!.left).toBeGreaterThanOrEqual(-1);
  expect(layout!.right).toBeLessThanOrEqual(layout!.width + 1);
  expect(layout!.top).toBeGreaterThanOrEqual(-1);
  expect(layout!.bottom).toBeLessThanOrEqual(layout!.height + 1);
});
