import { test, expect } from '../support/test-fixture';
import { OUTCOME_TEST_DOCTOR, outcomePatient } from '../fixtures/outcomes';

const historyPath = (patientId: string) =>
  `historico_eventos/patient_outcome_emergencia_${encodeURIComponent(patientId)}`;
const adminOutcomePath = (patientId: string) =>
  `admin_outcomes/patient_outcome_emergencia_${encodeURIComponent(patientId)}`;
const patientPath = (patientId: string) =>
  `connect_hub_v55/emergencia/pacientes/${patientId}`;
const tombstonePath = (patientId: string) =>
  `connect_hub_v55/emergencia/closed_patients/${patientId}`;
const FIREBASE_TEST_UID = 'fixture-anonymous-user';
const SOURCE_VERSION = 'FOUNDATION-1.0-RC1.3.3-OUTCOME-NOSOLOGY-SECTOR-LOS';
const firebaseTimestamp = (iso: string) => ({ __testTimestamp: true, iso });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-24T15:00:00.000Z'));
});

test('substitui Excluir por Desfecho e cancelar não produz escrita', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-cancel');
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await app.clearFirebaseWrites();

  const card = app.page.locator(`[data-id="${patient.id}"]`);
  await expect(card.getByRole('button', { name: 'Desfecho' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Excluir' })).toHaveCount(0);

  await app.openOutcomeFromCard(patient.id);
  await expect(app.outcomeDialog).toHaveAttribute('role', 'dialog');
  await expect(app.outcomeDialog).toHaveAttribute('aria-modal', 'true');
  await expect(app.page.locator('input[name="patientOutcomeType"]')).toHaveCount(3);
  await expect(app.page.locator('.patient-outcome-options strong')).toHaveText([
    'Alta médica',
    'Óbito',
    'Transferência externa'
  ]);

  await app.selectOutcome('transferred');
  await app.page.locator('#patientOutcomeCancelBtn').click();
  await expect(app.outcomeDialog).not.toHaveClass(/is-open/);
  expect(await app.firebaseWrites()).toEqual([]);
  expect(await app.persistedPatient(patient.id)).toBeDefined();

  await app.openPatientById(patient.id);
  await expect(app.page.locator('#outcomePatientBtn')).toHaveText('Desfecho');
  await expect(app.drawer.getByRole('button', { name: 'Excluir' })).toHaveCount(0);
});

test('registra Alta médica antes de retirar o paciente e preserva o snapshot clínico', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-treated');
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await expect(app.page.locator('#currentDoctor')).toHaveValue(OUTCOME_TEST_DOCTOR);
  await app.clearFirebaseWrites();

  await app.openOutcomeFromCard(patient.id);
  await app.selectOutcome('treated');
  await app.fillOutcomeCid('Z00.0');
  await expect(app.page.locator('#patientOutcomeResponsibleDoctor')).toHaveValue(OUTCOME_TEST_DOCTOR);
  const pendingHistoryWrite = await app.delayNextFirebaseWrite('set', historyPath(patient.id), 350);

  await app.outcomeConfirmButton.click();
  await app.waitForFirebaseControl(pendingHistoryWrite, 'pending');
  await expect(app.page.locator('#patientOutcomeStatus')).toHaveText('Encerrando atendimento...');
  expect(await app.persistedPatient(patient.id)).toBeUndefined();
  expect(await app.firebaseWrites()).toEqual([]);
  await expect(app.cards).toHaveCount(1);
  await expect(app.outcomeConfirmButton).toHaveText('Encerrando atendimento...');
  await expect(app.outcomeConfirmButton).toBeDisabled();

  await expect(app.cards).toHaveCount(0);
  const writes = await app.firebaseWrites();
  expect(writes.map(write => ({ operation: write.operation, path: write.path }))).toEqual([
    { operation: 'set', path: historyPath(patient.id) },
    { operation: 'set', path: adminOutcomePath(patient.id) },
    { operation: 'set', path: tombstonePath(patient.id) },
    { operation: 'delete', path: `connect_hub_v55/emergencia/pacientes/${patient.id}` }
  ]);

  const record = await app.firebaseDocument(historyPath(patient.id));
  expect(record).toMatchObject({
    schemaVersion: 2,
    type: 'patient_outcome',
    outcomeType: 'treated',
    outcomeLabel: 'Alta médica',
    patientId: patient.id,
    patientName: patient.name,
    sectorUnit: 'emergencia',
    sectorName: 'Emergência',
    specialty: 'Clínica Médica',
    admissionDate: '2026-07-10',
    lengthOfStayDays: 15,
    lengthOfStayMethod: 'inclusive_calendar_days',
    responsibleDoctor: OUTCOME_TEST_DOCTOR,
    actor: OUTCOME_TEST_DOCTOR,
    actorUid: FIREBASE_TEST_UID,
    primaryIcdCode: 'Z00.0',
    sectorTrackingVersion: 0,
    episodeId: '',
    sectorTrackingOrigin: '',
    lastSectorTransitionFactId: '',
    sectorEnteredAt: null,
    patientSnapshot: {
      id: patient.id,
      diagnosis: patient.diagnosis,
      alerts: patient.alerts,
      paduaScore: 4,
      arrhythmiasCleanData: patient.arrhythmiasCleanData
    }
  });
  expect(await app.firebaseDocument(tombstonePath(patient.id))).toEqual({
    schemaVersion: 1,
    type: 'patient_closed',
    patientId: patient.id,
    sectorUnit: 'emergencia',
    outcomeId: `patient_outcome_emergencia_${encodeURIComponent(patient.id)}`,
    outcomeType: 'treated',
    closedAt: { $timestamp: expect.any(String) },
    closedByUid: FIREBASE_TEST_UID
  });
  const adminRecord = await app.firebaseDocument(adminOutcomePath(patient.id));
  expect(Object.keys(adminRecord).sort()).toEqual([
    'schemaVersion',
    'sourceVersion',
    'type',
    'outcomeId',
    'outcomeType',
    'outcomeLabel',
    'createdAt',
    'patientId',
    'patientName',
    'sectorUnit',
    'sectorName',
    'unit',
    'bed',
    'specialty',
    'admissionDate',
    'lengthOfStayDays',
    'lengthOfStayMethod',
    'responsibleDoctor',
    'primaryIcdCode',
    'palliativeAlertPresentAtOutcome',
    'actorUid',
    'sectorTrackingVersion',
    'episodeId',
    'sectorTrackingOrigin',
    'lastSectorTransitionFactId',
    'sectorEnteredAt'
  ].sort());
  expect(adminRecord).toEqual({
    schemaVersion: 3,
    sourceVersion: 'FOUNDATION-1.0-RC1.3.3-OUTCOME-NOSOLOGY-SECTOR-LOS',
    type: 'patient_outcome_admin',
    outcomeId: `patient_outcome_emergencia_${encodeURIComponent(patient.id)}`,
    outcomeType: 'treated',
    outcomeLabel: 'Alta médica',
    createdAt: { $timestamp: expect.any(String) },
    patientId: patient.id,
    patientName: patient.name,
    sectorUnit: 'emergencia',
    sectorName: 'Emergência',
    unit: '',
    bed: patient.bed,
    specialty: patient.specialty,
    admissionDate: patient.admissionDate,
    lengthOfStayDays: 15,
    lengthOfStayMethod: 'inclusive_calendar_days',
    responsibleDoctor: OUTCOME_TEST_DOCTOR,
    primaryIcdCode: 'Z00.0',
    palliativeAlertPresentAtOutcome: false,
    actorUid: FIREBASE_TEST_UID,
    sectorTrackingVersion: 0,
    episodeId: '',
    sectorTrackingOrigin: '',
    lastSectorTransitionFactId: '',
    sectorEnteredAt: null
  });
  expect((await app.firebaseReads()).map(read => read.path)).toEqual([
    tombstonePath(patient.id),
    patientPath(patient.id)
  ]);
  expect(await app.persistedPatient(patient.id)).toBeUndefined();
});

test('deriva os campos administrativos do paciente mais recente lido na transação', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-concurrent-update');
  const concurrentPatient = {
    ...patient,
    name: 'PACIENTE FICTÍCIO ATUALIZADO POR OUTRO CLIENTE',
    bed: 'Leito 88',
    inpatientUnit: 'Ala Fictícia B',
    specialty: 'Cardiologia',
    admissionDate: '2026-07-20',
    diagnosis: 'HIPÓTESE FICTÍCIA ATUALIZADA POR OUTRO CLIENTE',
    status: 'Aguardando UTI',
    severity: 'critico',
    alerts: ['DVA', 'Paliativo']
  };
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await app.openPatientById(patient.id);
  await app.waitForAutosaveHydration();
  await app.page.locator('#outcomePatientBtn').click();
  await expect(app.outcomeDialog).toHaveClass(/is-open/);
  await app.selectOutcome('treated');
  await app.fillOutcomeCid('I10');
  await app.replaceFirebaseDocumentSilently(patientPath(patient.id), concurrentPatient);
  await app.outcomeConfirmButton.click();
  await expect(app.cards).toHaveCount(0);

  const record = await app.firebaseDocument(historyPath(patient.id));
  expect(record.patientSnapshot).toEqual(concurrentPatient);
  expect(record).toMatchObject({
    patientName: concurrentPatient.name,
    unit: concurrentPatient.inpatientUnit,
    bed: concurrentPatient.bed,
    specialty: concurrentPatient.specialty,
    admissionDate: concurrentPatient.admissionDate,
    lengthOfStayDays: 5,
    status: concurrentPatient.status,
    severity: concurrentPatient.severity,
    alerts: concurrentPatient.alerts,
    patientSnapshot: concurrentPatient
  });
  expect(await app.firebaseDocument(adminOutcomePath(patient.id))).toMatchObject({
    patientName: concurrentPatient.name,
    unit: concurrentPatient.inpatientUnit,
    bed: concurrentPatient.bed,
    specialty: concurrentPatient.specialty,
    admissionDate: concurrentPatient.admissionDate,
    lengthOfStayDays: 5,
    palliativeAlertPresentAtOutcome: true
  });
});

test('confirma o alerta Paliativo pendente antes de abrir o Desfecho', async ({ app }) => {
  const patient = {
    ...outcomePatient('fixture-outcome-palliative-pending'),
    alerts: []
  };
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await app.openPatientById(patient.id);
  await app.waitForAutosaveHydration();
  await app.clearFirebaseWrites();

  const pendingFlush = await app.delayNextFirebaseWrite(
    'set',
    `connect_hub_v55/emergencia/pacientes/${patient.id}`,
    1_500
  );
  await app.page.locator('#alertOptionsToggle').click();
  await app.page.locator('#palliativeAlert').check();
  await app.page.locator('#ppsScore').selectOption({ index: 1 });
  await app.page.locator('#karnofskyScore').selectOption({ index: 1 });
  const pps = await app.page.locator('#ppsScore').inputValue();
  const karnofsky = await app.page.locator('#karnofskyScore').inputValue();
  await app.page.locator('#palliativeWrap .detail-finish-btn').click();
  await app.page.locator('#outcomePatientBtn').click();

  await app.waitForFirebaseControl(pendingFlush, 'pending');
  expect(await app.outcomeDialog.evaluate(dialog => dialog.classList.contains('is-open'))).toBe(false);
  await expect(app.outcomeDialog).toHaveClass(/is-open/);
  await app.selectOutcome('treated');
  await app.fillOutcomeCid('Z51.5');
  await app.fillOutcomeResponsible(OUTCOME_TEST_DOCTOR);
  await app.outcomeConfirmButton.click();
  await expect(app.cards).toHaveCount(0);

  expect(await app.firebaseDocument(historyPath(patient.id))).toMatchObject({
    alerts: expect.arrayContaining(['Paliativo']),
    patientSnapshot: {
      alerts: expect.arrayContaining(['Paliativo']),
      palliativeData: { pps, karnofsky }
    }
  });
  expect(await app.firebaseDocument(adminOutcomePath(patient.id))).toMatchObject({
    palliativeAlertPresentAtOutcome: true
  });
  const patientWrites = (await app.firebaseWrites())
    .filter(write => write.path.endsWith(`/pacientes/${patient.id}`));
  expect(patientWrites.map(write => write.operation)).toEqual(['set', 'delete']);
});

test('hidrata paciente Paliativo sem criar ciclo de autosave', async ({ app }) => {
  const patient = {
    ...outcomePatient('fixture-outcome-palliative-hydration'),
    alerts: ['Paliativo'],
    palliativeData: { pps: '50', karnofsky: '50' }
  };
  await app.goto({ patients: [patient] });
  await app.clearFirebaseWrites();
  await app.openPatientById(patient.id);
  await app.waitForAutosaveHydration();
  await expect(app.page.locator('#palliativeAlert')).toBeChecked();
  await expect(app.page.locator('#ppsScore')).toHaveValue('50');
  await expect(app.page.locator('#karnofskyScore')).toHaveValue('50');

  await app.page.waitForTimeout(2_200);
  expect(await app.firebaseWrites()).toEqual([]);
  expect(await app.page.evaluate(() => window.eval(`({
    timer: patientAutosaveTimer !== null,
    busy: patientAutosaveBusy,
    queued: patientAutosaveQueued
  })`))).toEqual({ timer: false, busy: false, queued: false });

  await app.page.locator('#alertOptionsToggle').click();
  await expect(app.catalog).toHaveClass(/show/);
  await expect(app.page.locator('#rc122AddClinicalAssistant')).toBeVisible();
  await app.page.locator('#rc122AddClinicalAssistant').click();
  await expect(app.catalog).toHaveClass(/rc122-catalog-open/);
  await app.page.locator('#devicesAlert').check();
  await app.page.locator('.deviceCheck[value="IOT"]').check();
  const fio2 = app.page.locator('#deviceIotFiO2');
  await fio2.click();
  await expect(fio2).toBeFocused();
  await app.page.keyboard.type('50');
  await expect(fio2).toHaveValue('50');
  await app.page.locator('#deviceIotPao2').fill('100');
  await expect(app.page.locator('#deviceIotPafiResult')).toContainText('P/F: 200');
  await app.page.locator('#devicesDetailWrap .detail-finish-btn').click();
  await expect.poll(async () => (await app.persistedPatient(patient.id))?.deviceIotPafi).toBe(200);
  expect(await app.persistedPatient(patient.id)).toMatchObject({
    deviceIotFiO2: '50',
    deviceIotPao2: '100',
    deviceIotPafi: 200
  });
});

test('não ignora rascunho Paliativo depois de falha do autosave', async ({ app }) => {
  const patient = {
    ...outcomePatient('fixture-outcome-palliative-recovery'),
    alerts: []
  };
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await app.openPatientById(patient.id);
  await app.waitForAutosaveHydration();
  await app.clearFirebaseWrites();
  app.expectConsoleError(/^Erro ao salvar paciente:/);
  const failedAutosave = await app.failNextFirebaseWrite(
    'set',
    `connect_hub_v55/emergencia/pacientes/${patient.id}`,
    'Falha fictícia do primeiro autosave.'
  );

  await app.page.locator('#alertOptionsToggle').click();
  await app.page.locator('#palliativeAlert').check();
  await app.page.locator('#ppsScore').selectOption({ index: 2 });
  await app.page.locator('#karnofskyScore').selectOption({ index: 2 });
  await app.page.locator('#palliativeWrap .detail-finish-btn').click();

  const pendingRecovery = await app.delayNextFirebaseWrite(
    'set',
    `connect_hub_v55/emergencia/pacientes/${patient.id}`,
    250
  );
  const autosaveFailure = app.page.waitForEvent('console', message => (
    message.type() === 'error'
    && /^Erro ao salvar paciente:/.test(message.text())
  ));
  await app.page.locator('#outcomePatientBtn').click();
  await autosaveFailure;
  await app.waitForFirebaseControl(pendingRecovery, 'pending');
  expect(await app.page.evaluate(
    controlId => window.__firebaseTestHarness.pendingControls()
      .some(control => control.id === controlId),
    failedAutosave
  )).toBe(false);
  expect(await app.outcomeDialog.evaluate(dialog => dialog.classList.contains('is-open'))).toBe(false);
  await expect(app.page.locator('#toast')).toHaveText(
    'Aguarde a confirmação das alterações do paciente antes de registrar o Desfecho.'
  );
  await expect(app.page.locator('#toast')).toBeHidden();
  await app.page.locator('#outcomePatientBtn').click();
  await expect(app.outcomeDialog).toHaveClass(/is-open/);

  await app.selectOutcome('treated');
  await app.fillOutcomeCid('Z51.5');
  await app.fillOutcomeResponsible(OUTCOME_TEST_DOCTOR);
  await app.outcomeConfirmButton.click();
  await expect(app.cards).toHaveCount(0);
  expect(await app.firebaseDocument(adminOutcomePath(patient.id))).toMatchObject({
    palliativeAlertPresentAtOutcome: true
  });
  expect(await app.firebaseDocument(historyPath(patient.id))).toMatchObject({
    alerts: expect.arrayContaining(['Paliativo']),
    patientSnapshot: {
      alerts: expect.arrayContaining(['Paliativo'])
    }
  });
});

test('exige médico responsável e CID principal válido nos três desfechos', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-death');
  await app.goto({ patients: [patient] });
  await app.clearFirebaseWrites();

  await app.openOutcomeFromCard(patient.id);
  await app.selectOutcome('treated');
  await expect(app.page.locator('#patientOutcomeCidWrap')).not.toHaveClass(/is-hidden/);
  await app.fillOutcomeResponsible(OUTCOME_TEST_DOCTOR);
  await expect(app.outcomeConfirmButton).toBeDisabled();
  await app.fillOutcomeCid('i10');
  await expect(app.page.locator('#patientOutcomePrimaryCid')).toHaveValue('I10');
  await expect(app.outcomeConfirmButton).toBeEnabled();
  await app.selectOutcome('transferred');
  await expect(app.page.locator('#patientOutcomeCidWrap')).not.toHaveClass(/is-hidden/);
  await app.page.locator('#patientOutcomePrimaryCid').fill('');
  await expect(app.outcomeConfirmButton).toBeDisabled();
  await app.selectOutcome('death');
  await expect(app.page.locator('#patientOutcomeCidWrap')).not.toHaveClass(/is-hidden/);
  await expect(app.outcomeConfirmButton).toBeDisabled();
  expect(await app.firebaseWrites()).toEqual([]);

  await app.page.locator('#patientOutcomePrimaryCid').fill('A419');
  await app.fillOutcomeResponsible(OUTCOME_TEST_DOCTOR);
  await expect(app.outcomeConfirmButton).toBeDisabled();
  await expect(app.page.locator('#patientOutcomePrimaryCid')).toHaveAttribute('aria-invalid', 'true');
  await expect(app.page.locator('#patientOutcomeStatus')).toHaveText('Informe um CID no formato esperado, como I21.9 ou A41.');

  await app.page.locator('#patientOutcomePrimaryCid').fill('i21.9');
  await expect(app.page.locator('#patientOutcomePrimaryCid')).toHaveValue('I21.9');
  await expect(app.page.locator('#patientOutcomePrimaryCid')).toHaveAttribute('aria-invalid', 'false');
  await expect(app.outcomeConfirmButton).toBeEnabled();
  await app.outcomeConfirmButton.click();
  await expect(app.cards).toHaveCount(0);

  const record = await app.firebaseDocument(historyPath(patient.id));
  expect(record).toMatchObject({
    outcomeType: 'death',
    outcomeLabel: 'Óbito',
    primaryIcdCode: 'I21.9'
  });
});

test('registra Transferência externa pelo drawer com CID obrigatório', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-transferred');
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await app.openPatientById(patient.id);
  await app.clearFirebaseWrites();

  await app.page.locator('#outcomePatientBtn').click();
  await expect(app.outcomeDialog).toHaveClass(/is-open/);
  await app.selectOutcome('transferred');
  await app.fillOutcomeResponsible(OUTCOME_TEST_DOCTOR);
  await expect(app.page.locator('#patientOutcomeCidWrap')).not.toHaveClass(/is-hidden/);
  await expect(app.outcomeConfirmButton).toBeDisabled();
  await app.fillOutcomeCid('Z75.1');
  await app.outcomeConfirmButton.click();
  await expect(app.drawer).not.toHaveClass(/open/);
  await expect(app.cards).toHaveCount(0);

  const record = await app.firebaseDocument(historyPath(patient.id));
  expect(record).toMatchObject({
    outcomeType: 'transferred',
    outcomeLabel: 'Transferência externa',
    primaryIcdCode: 'Z75.1'
  });
});

test('builder normaliza o CID e rejeita CID ausente ou inválido em qualquer tipo', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-builder');
  await app.goto({ patients: [patient] });

  const result = await app.page.evaluate(activePatient => {
    const framework = (window as unknown as {
      PatientOutcomeFramework: {
        buildRecord(
          patient: Record<string, unknown>,
          form: Record<string, string>
        ): Record<string, unknown>;
      };
    }).PatientOutcomeFramework;
    const valid = framework.buildRecord(activePatient, {
      outcomeType: 'treated',
      responsibleDoctor: 'MÉDICA FICTÍCIA',
      primaryIcdCode: '  i10  '
    });
    const invalidCodes = ['', 'A419'].map(primaryIcdCode => {
      try {
        framework.buildRecord(activePatient, {
          outcomeType: 'transferred',
          responsibleDoctor: 'MÉDICA FICTÍCIA',
          primaryIcdCode
        });
        return '';
      } catch(error) {
        return (error as { code?: string }).code || String(error);
      }
    });
    return {
      schemaVersion: valid.schemaVersion,
      sourceVersion: valid.sourceVersion,
      outcomeType: valid.outcomeType,
      outcomeLabel: valid.outcomeLabel,
      primaryIcdCode: valid.primaryIcdCode,
      invalidCodes
    };
  }, patient);

  expect(result).toEqual({
    schemaVersion: 2,
    sourceVersion: SOURCE_VERSION,
    outcomeType: 'treated',
    outcomeLabel: 'Alta médica',
    primaryIcdCode: 'I10',
    invalidCodes: [
      'connect-hub/outcome-invalid-primary-icd',
      'connect-hub/outcome-invalid-primary-icd'
    ]
  });
});

test('copia rastreamento setorial autoritativo para evento privado e projeção administrativa', async ({ app }) => {
  const enteredAt = '2026-07-22T10:15:00.000Z';
  const authoritativeEnteredAt = '2026-07-23T11:45:00.000Z';
  const patient = {
    ...outcomePatient('fixture-outcome-tracked'),
    sectorTrackingVersion: 1,
    episodeId: 'patient_episode_fixture-outcome-tracked',
    sectorTrackingOrigin: 'initial_entry',
    lastSectorTransitionFactId: 'patient_sector_transition_previous',
    sectorEnteredAt: firebaseTimestamp(enteredAt)
  };
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });

  await app.openPatientById(patient.id);
  await app.waitForAutosaveHydration();
  await app.page.locator('#outcomePatientBtn').click();
  await app.selectOutcome('treated');
  await app.fillOutcomeCid('I10');
  await app.replaceFirebaseDocumentSilently(patientPath(patient.id), {
    ...patient,
    episodeId: 'patient_episode_authoritative',
    sectorTrackingOrigin: 'baseline_observation',
    lastSectorTransitionFactId: 'patient_sector_transition_authoritative',
    sectorEnteredAt: firebaseTimestamp(authoritativeEnteredAt)
  });
  await app.outcomeConfirmButton.click();
  await expect(app.cards).toHaveCount(0);

  const expectedTracking = {
    sectorTrackingVersion: 1,
    episodeId: 'patient_episode_authoritative',
    sectorTrackingOrigin: 'baseline_observation',
    lastSectorTransitionFactId: 'patient_sector_transition_authoritative',
    sectorEnteredAt: { $timestamp: authoritativeEnteredAt }
  };
  expect(await app.firebaseDocument(historyPath(patient.id))).toMatchObject({
    schemaVersion: 2,
    sourceVersion: SOURCE_VERSION,
    primaryIcdCode: 'I10',
    ...expectedTracking
  });
  expect(await app.firebaseDocument(adminOutcomePath(patient.id))).toMatchObject({
    schemaVersion: 3,
    sourceVersion: SOURCE_VERSION,
    ...expectedTracking
  });
});

test('novo cadastro inicia episódio e edições preservam tracking sem criar baseline', async ({ app }) => {
  const trackedEnteredAt = '2026-07-23T08:00:00.000Z';
  const trackedPatient = {
    ...outcomePatient('fixture-save-tracked', 1),
    alerts: [],
    sectorTrackingVersion: 1,
    episodeId: 'patient_episode_fixture-save-tracked',
    sectorTrackingOrigin: 'initial_entry',
    lastSectorTransitionFactId: '',
    sectorEnteredAt: firebaseTimestamp(trackedEnteredAt)
  };
  const legacyPatient = {
    ...outcomePatient('fixture-save-legacy', 2),
    alerts: []
  };
  await app.goto({ patients: [trackedPatient, legacyPatient] });

  await app.openPatientById(trackedPatient.id);
  await app.waitForAutosaveHydration();
  await app.page.locator('#diagnosis').fill('HIPÓTESE FICTÍCIA EDITADA COM TRACKING');
  await app.page.locator('#savePatientBtn').click();
  await expect(app.drawer).not.toHaveClass(/open/);
  expect(await app.persistedPatient(trackedPatient.id)).toMatchObject({
    sectorTrackingVersion: 1,
    episodeId: trackedPatient.episodeId,
    sectorTrackingOrigin: 'initial_entry',
    lastSectorTransitionFactId: '',
    sectorEnteredAt: { $timestamp: trackedEnteredAt }
  });

  await app.openPatientById(legacyPatient.id);
  await app.waitForAutosaveHydration();
  await app.page.locator('#diagnosis').fill('HIPÓTESE FICTÍCIA EDITADA SEM TRACKING');
  await app.page.locator('#savePatientBtn').click();
  await expect(app.drawer).not.toHaveClass(/open/);
  const editedLegacy = await app.persistedPatient(legacyPatient.id);
  expect(editedLegacy).not.toHaveProperty('sectorTrackingVersion');
  expect(editedLegacy).not.toHaveProperty('episodeId');
  expect(editedLegacy).not.toHaveProperty('sectorTrackingOrigin');
  expect(editedLegacy).not.toHaveProperty('lastSectorTransitionFactId');
  expect(editedLegacy).not.toHaveProperty('sectorEnteredAt');

  await app.openNewPatient();
  await app.fillRequiredPatientFields('TRACKING');
  await app.page.evaluate(() => window.eval(`
    if(patientAutosaveTimer){
      clearTimeout(patientAutosaveTimer);
      patientAutosaveTimer=null;
      patientAutosaveScheduledOptions=null;
    }
  `));
  await app.page.locator('#savePatientBtn').click();
  await expect(app.drawer).not.toHaveClass(/open/);
  const createdCard = app.cards.filter({ hasText: 'PACIENTE FICTÍCIO TRACKING' });
  await expect(createdCard).toHaveCount(1);
  const newPatientId = await createdCard.getAttribute('data-id');
  expect(newPatientId).toBeTruthy();
  const createdPatient = await app.persistedPatient(newPatientId!);
  expect(createdPatient).toMatchObject({
    sectorTrackingVersion: 1,
    episodeId: `patient_episode_${newPatientId}`,
    sectorTrackingOrigin: 'initial_entry',
    lastSectorTransitionFactId: '',
    sectorEnteredAt: { $timestamp: expect.any(String) }
  });
});

test('drawer existente não recria a origem após remoção ou migração remota', async ({ app }) => {
  const removedPatient = {
    ...outcomePatient('fixture-remote-removal', 1),
    alerts: []
  };
  const migratedPatient = {
    ...outcomePatient('fixture-remote-migration', 2),
    alerts: []
  };
  await app.goto({ patients: [removedPatient, migratedPatient] });

  await app.openPatientById(removedPatient.id);
  await app.waitForAutosaveHydration();
  await app.page.evaluate(async patientId => {
    const browserWindow = window as unknown as {
      firebase: {
        firestore(): {
          collection(name: string): {
            doc(id: string): {
              collection(name: string): {
                doc(id: string): { delete(): Promise<void> };
              };
            };
          };
        };
      };
    };
    await browserWindow.firebase.firestore()
      .collection('connect_hub_v55')
      .doc('emergencia')
      .collection('pacientes')
      .doc(patientId)
      .delete();
  }, removedPatient.id);
  await expect.poll(() => app.persistedPatient(removedPatient.id)).toBeUndefined();
  await app.clearFirebaseWrites();
  app.expectConsoleError(/^Erro ao salvar paciente:/);
  await app.page.locator('#diagnosis').evaluate((element, diagnosis) => {
    (element as HTMLTextAreaElement).value = diagnosis;
  }, 'HIPÓTESE FICTÍCIA APÓS REMOÇÃO REMOTA');
  await app.page.locator('#savePatientBtn').click();
  await expect(app.page.locator('#toast')).toContainText('Erro ao salvar no Firebase');
  expect(await app.persistedPatient(removedPatient.id)).toBeUndefined();
  expect(await app.firebaseWrites()).toEqual([]);

  await app.page.evaluate(() => {
    (window as unknown as { closeDrawer(): void }).closeDrawer();
  });
  await app.openPatientById(migratedPatient.id);
  await app.waitForAutosaveHydration();
  await app.page.evaluate(async activePatient => {
    type DocumentRef = {
      set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void>;
      delete(): Promise<void>;
    };
    const browserWindow = window as unknown as {
      firebase: {
        firestore(): {
          collection(name: string): {
            doc(id: string): {
              collection(name: string): { doc(id: string): DocumentRef };
            };
          };
        };
      };
    };
    const database = browserWindow.firebase.firestore();
    const source = database.collection('connect_hub_v55')
      .doc('emergencia')
      .collection('pacientes')
      .doc(activePatient.id);
    const destination = database.collection('connect_hub_v55')
      .doc('observacao_sus')
      .collection('pacientes')
      .doc(activePatient.id);
    await destination.set({
      ...activePatient,
      migratedFrom: 'emergencia',
      migratedTo: 'observacao_sus'
    }, { merge: false });
    await source.delete();
  }, migratedPatient);
  await expect.poll(() => app.persistedPatient(migratedPatient.id)).toBeUndefined();
  expect(await app.persistedPatientInUnit('observacao_sus', migratedPatient.id)).toBeDefined();
  await app.clearFirebaseWrites();
  app.expectConsoleError(/^Erro ao salvar paciente:/);
  await app.page.locator('#diagnosis').evaluate((element, diagnosis) => {
    (element as HTMLTextAreaElement).value = diagnosis;
  }, 'HIPÓTESE FICTÍCIA APÓS MIGRAÇÃO REMOTA');
  await app.page.locator('#savePatientBtn').click();
  await expect(app.page.locator('#toast')).toContainText('Erro ao salvar no Firebase');
  expect(await app.persistedPatient(migratedPatient.id)).toBeUndefined();
  expect(await app.persistedPatientInUnit('observacao_sus', migratedPatient.id)).toMatchObject({
    id: migratedPatient.id,
    diagnosis: migratedPatient.diagnosis
  });
  expect(await app.firebaseWrites()).toEqual([]);
});

test('migração de legado cria fato setorial atômico e inicia baseline no destino', async ({ app }) => {
  const patient = outcomePatient('fixture-sector-transition-legacy-%');
  await app.goto({ patients: [patient] });
  await app.clearFirebaseWrites();
  app.page.once('dialog', dialog => dialog.dismiss());

  await app.page.evaluate(async patientId => {
    const browserWindow = window as unknown as {
      setMigrationTarget(unit: string): Promise<void>;
      selectMigrationObsV37(unit: string): void;
      migratePatientToSector(id: string, unit: string): Promise<void>;
    };
    await browserWindow.setMigrationTarget('observacao_sus');
    browserWindow.selectMigrationObsV37('Observação SUS 01');
    await browserWindow.migratePatientToSector(patientId, 'observacao_sus');
  }, patient.id);

  let snapshotAfterAbort = await app.firebaseSnapshot();
  expect(Object.keys(snapshotAfterAbort)
    .filter(path => path.startsWith('historico_eventos/'))).toEqual([]);
  expect(Object.keys(snapshotAfterAbort)
    .filter(path => path.startsWith('admin_sector_transitions/'))).toEqual([]);
  expect(await app.persistedPatient(patient.id)).toBeDefined();
  expect(await app.persistedPatientInUnit('observacao_sus', patient.id)).toBeUndefined();

  app.expectConsoleError(/^Erro ao migrar paciente:/);
  await app.failNextFirebaseWrite(
    'set',
    'admin_sector_transitions/',
    'Falha fictícia no fato setorial.'
  );
  app.page.once('dialog', dialog => dialog.accept());
  await app.page.evaluate(async patientId => {
    const browserWindow = window as unknown as {
      migratePatientToSector(id: string, unit: string): Promise<void>;
    };
    await browserWindow.migratePatientToSector(patientId, 'observacao_sus');
  }, patient.id);

  expect(await app.persistedPatient(patient.id)).toBeDefined();
  expect(await app.persistedPatientInUnit('observacao_sus', patient.id)).toBeUndefined();
  snapshotAfterAbort = await app.firebaseSnapshot();
  expect(Object.keys(snapshotAfterAbort)
    .filter(path => path.startsWith('historico_eventos/'))).toEqual([]);
  expect(Object.keys(snapshotAfterAbort)
    .filter(path => path.startsWith('admin_sector_transitions/'))).toEqual([]);

  app.page.once('dialog', dialog => dialog.accept());
  await app.page.evaluate(async patientId => {
    const browserWindow = window as unknown as {
      migratePatientToSector(id: string, unit: string): Promise<void>;
    };
    await browserWindow.migratePatientToSector(patientId, 'observacao_sus');
  }, patient.id);

  await expect(app.cards).toHaveCount(0);
  expect(await app.persistedPatient(patient.id)).toBeUndefined();
  const destination = await app.persistedPatientInUnit('observacao_sus', patient.id);
  const snapshot = await app.firebaseSnapshot();
  const transitionPaths = Object.keys(snapshot)
    .filter(path => path.startsWith('admin_sector_transitions/'));
  expect(transitionPaths).toHaveLength(1);
  const factId = transitionPaths[0].slice('admin_sector_transitions/'.length);
  const episodeId = `patient_episode_${patient.id}`;
  expect(destination).toMatchObject({
    sectorTrackingVersion: 1,
    episodeId,
    sectorTrackingOrigin: 'baseline_observation',
    lastSectorTransitionFactId: factId,
    sectorEnteredAt: { $timestamp: expect.any(String) }
  });
  expect(await app.firebaseDocument(transitionPaths[0])).toEqual({
    schemaVersion: 1,
    sourceVersion: SOURCE_VERSION,
    type: 'patient_sector_transition_admin',
    factId,
    episodeId,
    patientId: patient.id,
    occurredAt: { $timestamp: expect.any(String) },
    actorUid: FIREBASE_TEST_UID,
    predecessorFactId: '',
    movementClassification: 'sector_transfer',
    trackingOrigin: 'baseline_observation',
    originEnteredAt: null,
    origin: {
      catalogVersion: 1,
      canonicalSectorId: 'emergencia',
      sectorUnit: 'emergencia',
      sectorName: 'Emergência',
      unit: '',
      bed: patient.bed
    },
    destination: {
      catalogVersion: 1,
      canonicalSectorId: 'observacao_sus',
      sectorUnit: 'observacao_sus',
      sectorName: 'Observação SUS',
      unit: 'Observação SUS 01',
      bed: 'Maca'
    }
  });
});

test('migração encadeia predecessor e remanejamento interno preserva a entrada setorial', async ({ app }) => {
  const enteredAt = '2026-07-21T09:30:00.000Z';
  const patient = {
    ...outcomePatient('fixture-sector-transition-chain'),
    sectorTrackingVersion: 1,
    episodeId: 'patient_episode_existing_chain',
    sectorTrackingOrigin: 'initial_entry',
    lastSectorTransitionFactId: 'patient_sector_transition_previous',
    sectorEnteredAt: firebaseTimestamp(enteredAt)
  };
  await app.goto({ patients: [patient] });

  await app.page.evaluate(async patientId => {
    const browserWindow = window as unknown as {
      setMigrationTarget(unit: string): Promise<void>;
      selectMigrationBedV37(bed: string): void;
      migratePatientToSector(id: string, unit: string): Promise<void>;
    };
    await browserWindow.setMigrationTarget('emergencia');
    browserWindow.selectMigrationBedV37('Leito 02');
    await browserWindow.migratePatientToSector(patientId, 'emergencia');
  }, patient.id);

  const afterReassignment = await app.persistedPatient(patient.id);
  expect(afterReassignment).toMatchObject({
    bed: 'Leito 02',
    sectorTrackingVersion: 1,
    episodeId: patient.episodeId,
    sectorTrackingOrigin: 'initial_entry',
    lastSectorTransitionFactId: patient.lastSectorTransitionFactId,
    sectorEnteredAt: { $timestamp: enteredAt }
  });
  const snapshotAfterReassignment = await app.firebaseSnapshot();
  expect(Object.keys(snapshotAfterReassignment)
    .filter(path => path.startsWith('admin_sector_transitions/'))).toEqual([]);
  const reassignmentHistoryPaths = Object.keys(snapshotAfterReassignment)
    .filter(path => path.startsWith('historico_eventos/'));
  expect(reassignmentHistoryPaths).toHaveLength(1);
  expect(await app.firebaseDocument(reassignmentHistoryPaths[0])).toMatchObject({
    type: 'bed_reassignment',
    patientId: patient.id,
    fromSectorUnit: 'emergencia',
    toSectorUnit: 'emergencia',
    fromBed: patient.bed,
    toBed: 'Leito 02'
  });

  app.page.once('dialog', dialog => dialog.accept());
  await app.page.evaluate(async patientId => {
    const browserWindow = window as unknown as {
      setMigrationTarget(unit: string): Promise<void>;
      selectMigrationObsV37(unit: string): void;
      migratePatientToSector(id: string, unit: string): Promise<void>;
    };
    await browserWindow.setMigrationTarget('observacao_sus');
    browserWindow.selectMigrationObsV37('Observação SUS 02');
    await browserWindow.migratePatientToSector(patientId, 'observacao_sus');
  }, patient.id);

  const snapshot = await app.firebaseSnapshot();
  const transitionPath = Object.keys(snapshot)
    .find(path => path.startsWith('admin_sector_transitions/'));
  expect(transitionPath).toBeDefined();
  const factId = transitionPath!.slice('admin_sector_transitions/'.length);
  expect(await app.firebaseDocument(transitionPath!)).toMatchObject({
    factId,
    episodeId: patient.episodeId,
    predecessorFactId: patient.lastSectorTransitionFactId,
    trackingOrigin: 'initial_entry',
    originEnteredAt: { $timestamp: enteredAt },
    origin: { bed: 'Leito 02' },
    destination: {
      canonicalSectorId: 'observacao_sus',
      unit: 'Observação SUS 02',
      bed: 'Maca'
    }
  });
  expect(await app.persistedPatientInUnit('observacao_sus', patient.id)).toMatchObject({
    episodeId: patient.episodeId,
    sectorTrackingOrigin: 'initial_entry',
    lastSectorTransitionFactId: factId,
    sectorEnteredAt: { $timestamp: expect.any(String) }
  });
});

test('classifica Convênio para Emergência como contra-fluxo no fato setorial', async ({ app }) => {
  const patient = outcomePatient('fixture-sector-transition-counterflow');
  await app.goto({ unit: 'convenio', patients: [patient] });
  app.page.once('dialog', dialog => dialog.accept());

  await app.page.evaluate(async patientId => {
    const browserWindow = window as unknown as {
      setMigrationTarget(unit: string): Promise<void>;
      migratePatientToSector(id: string, unit: string): Promise<void>;
    };
    await browserWindow.setMigrationTarget('emergencia');
    await browserWindow.migratePatientToSector(patientId, 'emergencia');
  }, patient.id);

  const snapshot = await app.firebaseSnapshot();
  const transitionPath = Object.keys(snapshot)
    .find(path => path.startsWith('admin_sector_transitions/'));
  expect(transitionPath).toBeDefined();
  expect(await app.firebaseDocument(transitionPath!)).toMatchObject({
    movementClassification: 'counterflow_transfer',
    trackingOrigin: 'baseline_observation',
    origin: {
      canonicalSectorId: 'convenio',
      sectorUnit: 'convenio',
      sectorName: 'Convênio',
      bed: patient.bed
    },
    destination: {
      canonicalSectorId: 'emergencia',
      sectorUnit: 'emergencia',
      sectorName: 'Emergência',
      unit: 'Emergência',
      bed: 'Maca'
    }
  });
  expect(await app.persistedPatientInUnit('emergencia', patient.id)).toMatchObject({
    bed: 'Maca',
    counterflowDate: '2026-07-24',
    sectorTrackingVersion: 1,
    sectorTrackingOrigin: 'baseline_observation'
  });
});

test('falha atômica mantém o paciente e permite tentar novamente', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-failure');
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await app.clearFirebaseWrites();
  await app.openOutcomeFromCard(patient.id);
  await app.selectOutcome('treated');
  await app.fillOutcomeCid('Z00.0');
  await app.fillOutcomeResponsible(OUTCOME_TEST_DOCTOR);
  await app.failNextFirebaseWrite(
    'delete',
    `connect_hub_v55/emergencia/pacientes/${patient.id}`,
    'Falha atômica fictícia.'
  );

  await app.outcomeConfirmButton.click();
  await expect(app.page.locator('#patientOutcomeStatus')).toContainText('paciente permanece no HUB');
  await expect(app.outcomeDialog).toHaveClass(/is-open/);
  await expect(app.cards).toHaveCount(1);
  expect(await app.persistedPatient(patient.id)).toBeDefined();
  expect(await app.firebaseDocument(historyPath(patient.id))).toBeUndefined();
  expect(await app.firebaseDocument(adminOutcomePath(patient.id))).toBeUndefined();
  expect(await app.firebaseDocument(tombstonePath(patient.id))).toBeUndefined();
  expect(await app.firebaseWrites()).toEqual([]);

  await app.outcomeConfirmButton.click();
  await expect(app.cards).toHaveCount(0);
  expect(await app.firebaseDocument(historyPath(patient.id))).toMatchObject({
    outcomeType: 'treated',
    patientId: patient.id
  });
});

test('aguarda autosave em voo, preserva a última edição e não recria o paciente', async ({ app }) => {
  const patient = {
    ...outcomePatient('fixture-outcome-autosave'),
    alerts: []
  };
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await app.openPatientById(patient.id);
  await app.waitForAutosaveHydration();
  await app.clearFirebaseWrites();
  const pendingAutosave = await app.delayNextFirebaseWrite(
    'set',
    `connect_hub_v55/emergencia/pacientes/${patient.id}`,
    1_000
  );

  const latestDiagnosis = 'HIPÓTESE FICTÍCIA ATUALIZADA ANTES DO DESFECHO';
  await app.page.locator('#diagnosis').fill(latestDiagnosis);
  await app.waitForFirebaseControl(pendingAutosave, 'pending');
  await expect(app.page.locator('#autosaveStatus')).toContainText('Salvando automaticamente', {
    timeout: 3_000
  });

  await app.page.locator('#outcomePatientBtn').click();
  await app.selectOutcome('treated');
  await app.fillOutcomeCid('I10');
  await app.fillOutcomeResponsible(OUTCOME_TEST_DOCTOR);
  await app.outcomeConfirmButton.click();
  await expect(app.cards).toHaveCount(0, { timeout: 5_000 });
  await app.page.waitForTimeout(1_200);

  const record = await app.firebaseDocument(historyPath(patient.id));
  expect(record).toMatchObject({
    patientSnapshot: { diagnosis: latestDiagnosis }
  });
  expect(await app.persistedPatient(patient.id)).toBeUndefined();
  const writes = await app.firebaseWrites();
  expect(writes.filter(write => write.path.endsWith(`/pacientes/${patient.id}`))).toHaveLength(2);
  expect(writes.at(-1)).toMatchObject({
    operation: 'delete',
    path: `connect_hub_v55/emergencia/pacientes/${patient.id}`
  });
});

test('aguarda salvamento manual em voo antes de registrar o desfecho', async ({ app }) => {
  const patient = {
    ...outcomePatient('fixture-outcome-manual-save'),
    alerts: []
  };
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await app.openPatientById(patient.id);
  await app.clearFirebaseWrites();
  const pendingManualSave = await app.delayNextFirebaseWrite(
    'set',
    `connect_hub_v55/emergencia/pacientes/${patient.id}`,
    500
  );

  const latestDiagnosis = 'HIPÓTESE FICTÍCIA SALVA MANUALMENTE ANTES DO DESFECHO';
  await app.page.locator('#diagnosis').fill(latestDiagnosis);
  await app.page.locator('#savePatientBtn').click();
  await app.waitForFirebaseControl(pendingManualSave, 'pending');
  await app.page.locator('#outcomePatientBtn').click();
  await app.selectOutcome('treated');
  await app.fillOutcomeCid('I10');
  await app.fillOutcomeResponsible(OUTCOME_TEST_DOCTOR);
  await app.outcomeConfirmButton.click();

  await expect(app.cards).toHaveCount(0, { timeout: 5_000 });
  await app.page.waitForTimeout(800);
  expect(await app.persistedPatient(patient.id)).toBeUndefined();
  expect(await app.firebaseDocument(historyPath(patient.id))).toMatchObject({
    patientSnapshot: { diagnosis: latestDiagnosis }
  });
  const writes = await app.firebaseWrites();
  const patientWrites = writes.filter(write => write.path.endsWith(`/pacientes/${patient.id}`));
  expect(patientWrites).toHaveLength(2);
  expect(patientWrites.at(-1)).toMatchObject({
    operation: 'delete',
    path: `connect_hub_v55/emergencia/pacientes/${patient.id}`
  });
});

test('aguarda reordenação em voo e não recria documento parcial do paciente', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-reorder', 1);
  const secondPatient = outcomePatient('fixture-outcome-reorder-peer', 2);
  await app.goto({
    patients: [patient, secondPatient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await app.clearFirebaseWrites();
  const pendingReorder = await app.delayNextFirebaseWrite(
    'set',
    `connect_hub_v55/emergencia/pacientes/${patient.id}`,
    500
  );

  await app.page.evaluate(
    ({ sourceId, targetId }) => {
      (window as unknown as { __outcomeReorderPromise: Promise<void> }).__outcomeReorderPromise =
        (window as unknown as { reorderPatients(source: string, target: string): Promise<void> })
          .reorderPatients(sourceId, targetId);
    },
    { sourceId: patient.id, targetId: secondPatient.id }
  );
  await app.waitForFirebaseControl(pendingReorder, 'pending');
  await app.openOutcomeFromCard(patient.id);
  await app.selectOutcome('treated');
  await app.fillOutcomeCid('Z00.0');
  await app.fillOutcomeResponsible(OUTCOME_TEST_DOCTOR);
  await app.outcomeConfirmButton.click();

  await expect(app.cards).toHaveCount(1, { timeout: 5_000 });
  await app.page.evaluate(() =>
    (window as unknown as { __outcomeReorderPromise: Promise<void> }).__outcomeReorderPromise
  );
  expect(await app.persistedPatient(patient.id)).toBeUndefined();
  expect(await app.persistedPatient(secondPatient.id)).toBeDefined();
  const patientWrites = (await app.firebaseWrites())
    .filter(write => write.path.endsWith(`/pacientes/${patient.id}`));
  expect(patientWrites.map(write => write.operation)).toEqual(['set', 'delete']);
});

test('retry após perda do ACK reutiliza o registro imutável sem reescrever auditoria', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-ack-lost');
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await app.clearFirebaseWrites();
  await app.openOutcomeFromCard(patient.id);
  await app.selectOutcome('death');
  await app.fillOutcomeResponsible(OUTCOME_TEST_DOCTOR);
  await app.page.locator('#patientOutcomePrimaryCid').fill('j18.9');
  await app.failAfterNextFirebaseTransactionCommit();

  await app.outcomeConfirmButton.click();
  await expect(app.page.locator('#patientOutcomeStatus')).toContainText('paciente permanece no HUB');
  await expect(app.cards).toHaveCount(1);
  for(const outcomeType of ['treated', 'death', 'transferred']){
    await expect(
      app.page.locator(`input[name="patientOutcomeType"][value="${outcomeType}"]`)
    ).toBeDisabled();
  }
  await expect(app.page.locator('input[name="patientOutcomeType"][value="death"]')).toBeChecked();
  await expect(app.page.locator('#patientOutcomeResponsibleDoctor')).toBeDisabled();
  await expect(app.page.locator('#patientOutcomeResponsibleDoctor')).toHaveValue(OUTCOME_TEST_DOCTOR);
  await expect(app.page.locator('#patientOutcomePrimaryCid')).toBeDisabled();
  await expect(app.page.locator('#patientOutcomePrimaryCid')).toHaveValue('J18.9');
  await expect(app.outcomeConfirmButton).toBeEnabled();
  const firstRecord = await app.firebaseDocument(historyPath(patient.id));
  const firstAdminRecord = await app.firebaseDocument(adminOutcomePath(patient.id));
  expect(firstRecord).toMatchObject({
    outcomeType: 'death',
    primaryIcdCode: 'J18.9',
    responsibleDoctor: OUTCOME_TEST_DOCTOR,
    actorUid: FIREBASE_TEST_UID
  });
  expect(await app.persistedPatient(patient.id)).toBeUndefined();
  const firstTombstone = await app.firebaseDocument(tombstonePath(patient.id));
  expect(firstTombstone).toEqual({
    schemaVersion: 1,
    type: 'patient_closed',
    patientId: patient.id,
    sectorUnit: 'emergencia',
    outcomeId: `patient_outcome_emergencia_${encodeURIComponent(patient.id)}`,
    outcomeType: 'death',
    closedAt: { $timestamp: expect.any(String) },
    closedByUid: FIREBASE_TEST_UID
  });
  const writesBeforeRetry = await app.firebaseWrites();
  expect(writesBeforeRetry).toHaveLength(4);
  await app.clearFirebaseReads();

  await app.outcomeConfirmButton.click();
  await expect(app.cards).toHaveCount(0);
  await expect(app.page.locator('#toast')).toContainText(
    'Os dados da primeira confirmação foram preservados'
  );
  expect(await app.firebaseDocument(historyPath(patient.id))).toEqual(firstRecord);
  expect(await app.firebaseDocument(adminOutcomePath(patient.id))).toEqual(firstAdminRecord);
  expect(await app.firebaseDocument(tombstonePath(patient.id))).toEqual(firstTombstone);
  expect(await app.firebaseWrites()).toEqual(writesBeforeRetry);
  const retryReadPaths = (await app.firebaseReads()).map(read => read.path);
  expect(retryReadPaths).toEqual([
    tombstonePath(patient.id)
  ]);
  expect(retryReadPaths).not.toContain(historyPath(patient.id));
  expect(retryReadPaths).not.toContain(adminOutcomePath(patient.id));
});

test('rejeita como conflito uma lápide criada por outro UID sem consultar auditoria', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-other-session');
  const outcomeId = `patient_outcome_emergencia_${encodeURIComponent(patient.id)}`;
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR },
    closedPatients: [{
      id: patient.id,
      schemaVersion: 1,
      type: 'patient_closed',
      patientId: patient.id,
      sectorUnit: 'emergencia',
      outcomeId,
      outcomeType: 'death',
      closedAt: '2026-07-24T14:00:00.000Z',
      closedByUid: 'fixture-other-session-user'
    }]
  });
  await app.clearFirebaseWrites();
  await app.clearFirebaseReads();

  await app.openOutcomeFromCard(patient.id);
  await app.selectOutcome('death');
  await app.fillOutcomeResponsible('MÉDICO FICTÍCIO DESTA SESSÃO');
  await app.page.locator('#patientOutcomePrimaryCid').fill('i21.9');
  await app.outcomeConfirmButton.click();

  const status = app.page.locator('#patientOutcomeStatus');
  await expect(status).toContainText(
    'Não foi possível registrar o desfecho. O paciente permanece no HUB.'
  );
  await expect(status).not.toContainText('MÉDICO FICTÍCIO DESTA SESSÃO');
  await expect(status).not.toContainText('I21.9');
  await expect(app.outcomeDialog).toHaveClass(/is-open/);
  await expect(app.cards).toHaveCount(1);
  expect(await app.persistedPatient(patient.id)).toBeDefined();
  expect(await app.firebaseWrites()).toEqual([]);
  const readPaths = (await app.firebaseReads()).map(read => read.path);
  expect(readPaths).toEqual([tombstonePath(patient.id)]);
  expect(readPaths).not.toContain(historyPath(patient.id));
  expect(readPaths).not.toContain(adminOutcomePath(patient.id));
});

test('guard de Desfecho rejeita salvamento tardio de outro cliente', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-guard');
  const existingOutcome = {
    id: `patient_outcome_emergencia_${encodeURIComponent(patient.id)}`,
    type: 'patient_outcome',
    outcomeType: 'treated',
    outcomeLabel: 'Tratado',
    patientId: patient.id,
    sectorUnit: 'emergencia',
    responsibleDoctor: OUTCOME_TEST_DOCTOR,
    primaryIcdCode: '',
    createdAtLocal: '2026-07-24T14:00:00.000Z',
    patientSnapshot: patient
  };
  const existingTombstone = {
    id: patient.id,
    schemaVersion: 1,
    type: 'patient_closed',
    patientId: patient.id,
    sectorUnit: 'emergencia',
    outcomeId: existingOutcome.id,
    outcomeType: 'treated',
    closedAt: '2026-07-24T14:00:00.000Z',
    closedByUid: FIREBASE_TEST_UID
  };
  await app.goto({
    patients: [patient],
    closedPatients: [existingTombstone],
    historyEvents: [existingOutcome]
  });
  await app.clearFirebaseWrites();
  await app.clearFirebaseReads();

  const errorCode = await app.page.evaluate(async patientId => {
    const browserWindow = window as unknown as {
      firebase: {
        firestore(): {
          collection(name: string): {
            doc(id: string): {
              collection(name: string): {
                doc(id: string): unknown;
              };
            };
          };
        };
      };
      commitGuardedPatientMutation(
        ids: string,
        applyWrites: (transaction: {
          set(reference: unknown, data: Record<string, unknown>, options: { merge: boolean }): void;
        }) => void
      ): Promise<void>;
    };
    const patientRef = browserWindow.firebase.firestore()
      .collection('connect_hub_v55')
      .doc('emergencia')
      .collection('pacientes')
      .doc(patientId);
    try {
      await browserWindow.commitGuardedPatientMutation(patientId, transaction => {
        transaction.set(patientRef, { diagnosis: 'ESCRITA TARDIA FICTÍCIA' }, { merge: true });
      });
      return '';
    } catch(error) {
      return (error as { code?: string }).code || String(error);
    }
  }, patient.id);

  expect(errorCode).toBe('connect-hub/patient-outcome-closed');
  expect(await app.firebaseWrites()).toEqual([]);
  expect((await app.firebaseReads()).map(read => read.path)).toEqual([
    tombstonePath(patient.id)
  ]);
  expect(await app.persistedPatient(patient.id)).toEqual(expect.objectContaining({
    id: patient.id,
    diagnosis: patient.diagnosis
  }));
  expect(await app.firebaseDocument(historyPath(patient.id))).toEqual(
    expect.objectContaining({
      outcomeType: 'treated',
      responsibleDoctor: OUTCOME_TEST_DOCTOR
    })
  );
});

test('falha fechada diante de histórico local corrompido sem apagar dados existentes', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-local-corrupt');
  await app.goto({ patients: [patient] });
  const result = await app.page.evaluate(patientId => {
    const outcomesKey = 'sbar_breve_santa_casa_desfechos_v1_emergencia';
    const patientsKey = 'sbar_breve_santa_casa_v1_emergencia';
    const corrupted = '{"estado":';
    const activePatients = JSON.stringify([{ id: patientId, name: 'PACIENTE FICTÍCIO LOCAL' }]);
    localStorage.setItem(outcomesKey, corrupted);
    localStorage.setItem(patientsKey, activePatients);
    let message = '';
    try {
      (window as unknown as {
        PatientOutcomeFramework: {
          persistLocal(record: Record<string, unknown>): Record<string, unknown>;
        };
      }).PatientOutcomeFramework.persistLocal({
        outcomeId: `patient_outcome_emergencia_${encodeURIComponent(patientId)}`,
        patientId
      });
    } catch(error) {
      message = error instanceof Error ? error.message : String(error);
    }
    return {
      message,
      storedOutcomes: localStorage.getItem(outcomesKey),
      storedPatients: localStorage.getItem(patientsKey),
      expectedPatients: activePatients,
      patientStillVisible: Boolean(document.querySelector(`[data-id="${patientId}"]`))
    };
  }, patient.id);

  expect(result.message).toContain('precisa ser recuperado');
  expect(result.storedOutcomes).toBe('{"estado":');
  expect(result.storedPatients).toBe(result.expectedPatients);
  expect(result.patientStillVisible).toBe(true);
});

test('calcula permanência inclusiva e rejeita datas inválidas ou futuras', async ({ app }) => {
  await app.goto();
  const values = await app.page.evaluate(() => {
    const framework = (window as unknown as {
      PatientOutcomeFramework: {
        lengthOfStayDays(admissionDate: string, closedAt: Date): number | null;
      };
    }).PatientOutcomeFramework;
    const closedAt = new Date(2026, 6, 24, 12, 0, 0);
    return {
      sameDay: framework.lengthOfStayDays('2026-07-24', closedAt),
      priorDay: framework.lengthOfStayDays('2026-07-23', closedAt),
      invalidDay: framework.lengthOfStayDays('2026-02-31', closedAt),
      extraSuffix: framework.lengthOfStayDays('2026-07-24T00:00:00Z', closedAt),
      future: framework.lengthOfStayDays('2026-07-25', closedAt)
    };
  });

  expect(values).toEqual({
    sameDay: 1,
    priorDay: 2,
    invalidDay: null,
    extraSuffix: null,
    future: null
  });
});

test('snapshot do drawer remove dados TEV ao desmarcar o protocolo', async ({ app }) => {
  const patient = {
    ...outcomePatient('fixture-outcome-tev-cleanup'),
    tevProtocol: { completed: true, status: 'complete' },
    tevProtocolStatus: 'complete',
    improveBleedingScore: 2,
    capriniScore: 4
  };
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await app.openPatientById(patient.id);
  await app.page.waitForTimeout(1_200);
  await app.page.locator('#alertOptionsToggle').click();
  await expect(app.moduleOption('Profilaxia de TEV')).toBeVisible();
  const tevCheckbox = app.moduleOption('Profilaxia de TEV').locator('input');
  await tevCheckbox.evaluate(element => {
    const checkbox = element as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(tevCheckbox).not.toBeChecked();
  await app.page.locator('#outcomePatientBtn').click();
  await app.selectOutcome('treated');
  await app.fillOutcomeCid('Z00.0');
  await app.fillOutcomeResponsible(OUTCOME_TEST_DOCTOR);
  await app.outcomeConfirmButton.click();
  await expect(app.cards).toHaveCount(0);

  const record = await app.firebaseDocument(historyPath(patient.id)) as {
    patientSnapshot?: Record<string, unknown>;
  };
  expect(record.patientSnapshot).not.toHaveProperty('tevProtocol');
  expect(record.patientSnapshot).not.toHaveProperty('tevProtocolStatus');
  expect(record.patientSnapshot).not.toHaveProperty('improveBleedingScore');
  expect(record.patientSnapshot).not.toHaveProperty('capriniScore');
});
