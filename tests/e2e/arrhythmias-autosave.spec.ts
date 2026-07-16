import { test, expect } from '../support/test-fixture';

test('protege Auto Save, Auto Advance e conclusão explícita por Finalizar perfil', async ({ app }) => {
  await app.goto();
  await app.openNewPatient();
  await app.fillRequiredPatientFields('AUTOSAVE');

  await expect.poll(async () => (await app.firebaseWrites()).filter(write => String(write.path).includes('/pacientes/')).length).toBeGreaterThan(0);
  const patientId = await app.page.locator('#patientId').inputValue();
  expect(patientId).toBeTruthy();

  await app.clearFirebaseWrites();
  await app.openCatalog();
  await app.selectModule('Arritmias');
  await app.arrhythmiasPanel.locator('[data-arr-diagnosis="af"]').click();
  await expect(app.arrhythmiasPanel.locator('[data-arr-gravity-block]')).toBeVisible();
  await app.arrhythmiasPanel.locator('[data-arr-instability="none"]').click();
  await app.arrhythmiasPanel.locator('[data-arr-clean-action="complete-gravity"]').click();

  const step = (number: number) => app.arrhythmiasPanel.locator(`[data-arr-profile-step="${number}"]`);
  await expect(step(1)).toBeVisible();
  await step(1).locator('[data-arr-profile-single="episodePattern"][data-arr-value="first"]').click();
  await expect(step(2)).toBeVisible();
  await step(2).locator('[data-arr-profile-single="onsetWindow"][data-arr-value="lt24"]').click();
  await expect(step(3)).toBeVisible();
  await step(3).locator('[data-arr-profile-single="preexcitation"][data-arr-value="no"]').click();
  await expect(step(4)).toBeVisible();
  await step(4).locator('[data-arr-profile-single="priorAnticoagulation"][data-arr-value="none"]').click();
  await expect(step(5)).toBeVisible();
  await step(5).locator('[data-arr-trigger="none"]').click();

  const beforeFinalize = await app.page.evaluate(() => window.ArrhythmiasCleanBase.getState());
  expect(beforeFinalize.finalized).toBe(false);
  expect(beforeFinalize.profileCompleted).toBe(false);

  await step(5).locator('[data-arr-clean-action="finalize-profile"]').click();
  await expect.poll(async () => {
    const patient = await app.persistedPatient(patientId) as any;
    return patient?.arrhythmiasCleanData?.finalized === true;
  }).toBe(true);

  const persisted = await app.persistedPatient(patientId) as any;
  expect(persisted.arrhythmiasCleanData.clinicalProfile.completed).toBe(true);
  expect(persisted.arrhythmiasCleanData.clinicalProfile.preexcitation).toBe('no');
  expect((await app.firebaseWrites()).some(write => String(write.path).endsWith(`/pacientes/${patientId}`))).toBe(true);
});

