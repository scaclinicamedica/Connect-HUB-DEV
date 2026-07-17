import { test, expect } from '../support/test-fixture';
import { arrhythmiaCompleted } from '../fixtures/arrhythmias';

test('protege Auto Save intermediário, Auto Advance, reabertura e conclusão explícita', async ({ app }) => {
  test.setTimeout(75_000);
  await app.goto();
  await app.openNewPatient();
  await app.fillRequiredPatientFields('AUTOSAVE');

  await expect.poll(async () => (await app.firebaseWrites()).filter(write => String(write.path).includes('/pacientes/')).length).toBeGreaterThan(0);
  const patientId = await app.page.locator('#patientId').inputValue();
  expect(patientId).toBeTruthy();
  await expect.poll(async () => {
    const patient = await app.persistedPatient(patientId) as any;
    return {
      name: patient?.name,
      bed: patient?.bed,
      diagnosis: patient?.diagnosis,
      dischargeForecast: patient?.dischargeForecast
    };
  }).toEqual({
    name: 'PACIENTE FICTÍCIO AUTOSAVE',
    bed: 'Leito 01',
    diagnosis: 'HIPÓTESE FICTÍCIA PARA TESTE',
    dischargeForecast: '2026-07-20'
  });

  await app.clearFirebaseWrites();
  await app.openCatalog();
  await app.selectModule('Arritmias');
  await app.arrhythmiasPanel.locator('[data-arr-diagnosis="af"]').click();
  await expect.poll(async () => {
    const data = (await app.persistedPatient(patientId) as any)?.arrhythmiasCleanData;
    return { diagnosis: data?.diagnosis, finalized: data?.finalized, status: data?.status };
  }).toEqual({ diagnosis: 'af', finalized: false, status: 'Em andamento' });

  await expect(app.arrhythmiasPanel.locator('[data-arr-gravity-block]')).toBeVisible();
  await app.arrhythmiasPanel.locator('[data-arr-instability="none"]').click();
  await expect.poll(async () => {
    const data = (await app.persistedPatient(patientId) as any)?.arrhythmiasCleanData;
    return { criteria: data?.instabilityCriteria, gravityCompleted: data?.gravityCompleted };
  }).toEqual({ criteria: ['none'], gravityCompleted: false });

  await app.arrhythmiasPanel.locator('[data-arr-clean-action="complete-gravity"]').click();
  await expect.poll(async () => {
    const data = (await app.persistedPatient(patientId) as any)?.arrhythmiasCleanData;
    return { gravityCompleted: data?.gravityCompleted, finalized: data?.finalized, profileCompleted: data?.clinicalProfile?.completed };
  }).toEqual({ gravityCompleted: true, finalized: false, profileCompleted: false });

  const step = (number: number) => app.arrhythmiasPanel.locator(`[data-arr-profile-step="${number}"]`);
  await expect(step(1)).toBeVisible();
  await expect(step(2)).toBeHidden();
  await step(1).locator('[data-arr-profile-single="episodePattern"][data-arr-value="first"]').click();
  await expect(step(2)).toBeVisible();
  await expect.poll(async () => {
    const data = (await app.persistedPatient(patientId) as any)?.arrhythmiasCleanData;
    return {
      episodePattern: data?.clinicalProfile?.episodePattern,
      finalized: data?.finalized,
      profileCompleted: data?.clinicalProfile?.completed,
      status: data?.status
    };
  }).toEqual({ episodePattern: 'first', finalized: false, profileCompleted: false, status: 'Em andamento' });

  await app.page.locator('button[onclick="closeDrawer()"]', { hasText: 'Fechar' }).click();
  await expect(app.drawer).not.toHaveClass(/open/);
  const cardModule = app.page.locator(`.card[data-id="${patientId}"] [data-clinical-copilot-card="arrhythmias"]`);
  await expect(cardModule).toBeVisible();
  await app.clearFirebaseWrites();
  const beforeReopen = await app.firebaseSnapshot();
  await cardModule.click();
  await expect(app.drawer).toHaveClass(/open/);
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'edit');
  await expect(step(1)).toBeHidden();
  await expect(step(2)).toBeVisible();
  await app.page.waitForTimeout(1100);
  expect(await app.firebaseWrites()).toEqual([]);
  expect(await app.firebaseSnapshot()).toEqual(beforeReopen);
  await expect.poll(async () => {
    const state = await app.page.evaluate(() => window.ArrhythmiasCleanBase.getState());
    return { episodePattern: state.episodePattern, finalized: state.finalized, profileCompleted: state.profileCompleted, profileStep: state.profileStep };
  }).toEqual({ episodePattern: 'first', finalized: false, profileCompleted: false, profileStep: 2 });

  await step(2).locator('[data-arr-profile-single="onsetWindow"][data-arr-value="lt24"]').click();
  await expect(step(3)).toBeVisible();
  await expect.poll(async () => (await app.persistedPatient(patientId) as any)?.arrhythmiasCleanData?.clinicalProfile?.onsetWindow).toBe('lt24');
  await step(3).locator('[data-arr-profile-single="preexcitation"][data-arr-value="no"]').click();
  await expect(step(4)).toBeVisible();
  await expect.poll(async () => (await app.persistedPatient(patientId) as any)?.arrhythmiasCleanData?.clinicalProfile?.preexcitation).toBe('no');
  await step(4).locator('[data-arr-profile-single="priorAnticoagulation"][data-arr-value="none"]').click();
  await expect(step(5)).toBeVisible();
  await expect.poll(async () => (await app.persistedPatient(patientId) as any)?.arrhythmiasCleanData?.clinicalProfile?.priorAnticoagulation).toBe('none');
  await step(5).locator('[data-arr-trigger="none"]').click();
  await expect.poll(async () => {
    const data = (await app.persistedPatient(patientId) as any)?.arrhythmiasCleanData;
    return {
      triggers: data?.clinicalProfile?.triggers,
      finalized: data?.finalized,
      profileCompleted: data?.clinicalProfile?.completed,
      status: data?.status
    };
  }).toEqual({ triggers: ['none'], finalized: false, profileCompleted: false, status: 'Em andamento' });

  const beforeFinalize = await app.page.evaluate(() => window.ArrhythmiasCleanBase.getState());
  expect(beforeFinalize.finalized).toBe(false);
  expect(beforeFinalize.profileCompleted).toBe(false);

  await app.clearFirebaseWrites();
  await app.page.locator('#savePatientBtn').click();
  await app.page.waitForTimeout(900);
  expect(await app.firebaseWrites()).toEqual([]);
  await expect(app.drawer).toHaveClass(/open/);

  await step(5).locator('[data-arr-clean-action="finalize-profile"]').click();
  await expect.poll(async () => {
    const patient = await app.persistedPatient(patientId) as any;
    return patient?.arrhythmiasCleanData?.finalized === true;
  }).toBe(true);

  const persisted = await app.persistedPatient(patientId) as any;
  expect(persisted.arrhythmiasCleanData.finalized).toBe(true);
  expect(persisted.arrhythmiasCleanData.status).toBe('Avaliação concluída');
  expect(persisted.arrhythmiasCleanData.clinicalProfile.completed).toBe(true);
  expect(persisted.arrhythmiasCleanData.clinicalProfile.episodePattern).toBe('first');
  expect(persisted.arrhythmiasCleanData.clinicalProfile.preexcitation).toBe('no');
  expect((await app.firebaseWrites()).some(write => String(write.path).endsWith(`/pacientes/${patientId}`))).toBe(true);
});

test('novo paciente não herda o estado de Arritmias do paciente anterior', async ({ app }) => {
  await app.goto({ patients: [arrhythmiaCompleted] });
  const completedCardModule = app.page.locator(`.card[data-id="${arrhythmiaCompleted.id}"] [data-clinical-copilot-card="arrhythmias"]`);
  await completedCardModule.click();
  await expect(app.arrhythmiasPanel).toHaveAttribute('data-rc122-mode', 'view');
  await app.page.locator('button[onclick="closeDrawer()"]', { hasText: 'Fechar' }).click();

  await app.openNewPatient();
  await app.fillRequiredPatientFields('NOVO');
  await expect.poll(async () => app.page.locator('#patientId').inputValue()).not.toBe('');
  const newPatientId = await app.page.locator('#patientId').inputValue();
  await app.openCatalog();
  await app.selectModule('Arritmias');
  await expect.poll(async () => {
    const data = (await app.persistedPatient(newPatientId) as any)?.arrhythmiasCleanData;
    return {
      diagnosis: data?.diagnosis,
      episodePattern: data?.clinicalProfile?.episodePattern,
      finalized: data?.finalized,
      profileCompleted: data?.clinicalProfile?.completed,
      status: data?.status
    };
  }).toEqual({ diagnosis: '', episodePattern: '', finalized: false, profileCompleted: false, status: 'Em andamento' });
  const state = await app.page.evaluate(() => window.ArrhythmiasCleanBase.getState());
  expect(state.diagnosis).toBe('');
  expect(state.episodePattern).toBe('');
  expect(state.finalized).toBe(false);
  expect(state.profileCompleted).toBe(false);
});
