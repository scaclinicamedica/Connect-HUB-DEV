import { test, expect } from '../support/test-fixture';
import { OUTCOME_TEST_DOCTOR, outcomePatient } from '../fixtures/outcomes';

const historyPath = (patientId: string) =>
  `historico_eventos/patient_outcome_emergencia_${encodeURIComponent(patientId)}`;
const patientPath = (patientId: string) =>
  `connect_hub_v55/emergencia/pacientes/${patientId}`;

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
    'Tratado',
    'Óbito',
    'Transferido'
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

test('registra Tratado antes de retirar o paciente e preserva o snapshot clínico', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-treated');
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await expect(app.page.locator('#currentDoctor')).toHaveValue(OUTCOME_TEST_DOCTOR);
  await app.clearFirebaseWrites();

  await app.openOutcomeFromCard(patient.id);
  await app.selectOutcome('treated');
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
    { operation: 'delete', path: `connect_hub_v55/emergencia/pacientes/${patient.id}` }
  ]);

  const record = await app.firebaseDocument(historyPath(patient.id));
  expect(record).toMatchObject({
    schemaVersion: 1,
    type: 'patient_outcome',
    outcomeType: 'treated',
    outcomeLabel: 'Tratado',
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
    primaryIcdCode: '',
    patientSnapshot: {
      id: patient.id,
      diagnosis: patient.diagnosis,
      alerts: patient.alerts,
      paduaScore: 4,
      arrhythmiasCleanData: patient.arrhythmiasCleanData
    }
  });
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
    status: 'Aguardando UTI',
    severity: 'critico',
    alerts: ['DVA']
  };
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: OUTCOME_TEST_DOCTOR }
  });
  await app.openOutcomeFromCard(patient.id);
  await app.selectOutcome('treated');
  await app.replaceFirebaseDocumentSilently(patientPath(patient.id), concurrentPatient);
  await app.outcomeConfirmButton.click();
  await expect(app.cards).toHaveCount(0);

  const record = await app.firebaseDocument(historyPath(patient.id));
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
});

test('exige médico responsável e CID principal somente para Óbito', async ({ app }) => {
  const patient = outcomePatient('fixture-outcome-death');
  await app.goto({ patients: [patient] });
  await app.clearFirebaseWrites();

  await app.openOutcomeFromCard(patient.id);
  await app.selectOutcome('death');
  await expect(app.page.locator('#patientOutcomeCidWrap')).not.toHaveClass(/is-hidden/);
  await expect(app.outcomeConfirmButton).toBeDisabled();
  expect(await app.firebaseWrites()).toEqual([]);

  await app.page.locator('#patientOutcomePrimaryCid').fill('i21.9');
  await expect(app.outcomeConfirmButton).toBeDisabled();
  await app.fillOutcomeResponsible(OUTCOME_TEST_DOCTOR);
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

test('permite registrar Transferido pelo drawer sem persistir CID', async ({ app }) => {
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
  await expect(app.page.locator('#patientOutcomeCidWrap')).toHaveClass(/is-hidden/);
  await app.outcomeConfirmButton.click();
  await expect(app.drawer).not.toHaveClass(/open/);
  await expect(app.cards).toHaveCount(0);

  const record = await app.firebaseDocument(historyPath(patient.id));
  expect(record).toMatchObject({
    outcomeType: 'transferred',
    outcomeLabel: 'Transferido',
    primaryIcdCode: ''
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
    500
  );

  const latestDiagnosis = 'HIPÓTESE FICTÍCIA ATUALIZADA ANTES DO DESFECHO';
  await app.page.locator('#diagnosis').fill(latestDiagnosis);
  await expect(app.page.locator('#autosaveStatus')).toContainText('Salvando automaticamente', {
    timeout: 3_000
  });
  await app.waitForFirebaseControl(pendingAutosave, 'pending');

  await app.page.locator('#outcomePatientBtn').click();
  await app.selectOutcome('treated');
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
  const firstRecord = await app.firebaseDocument(historyPath(patient.id));
  expect(firstRecord).toMatchObject({
    outcomeType: 'death',
    primaryIcdCode: 'J18.9',
    responsibleDoctor: OUTCOME_TEST_DOCTOR
  });
  expect(await app.persistedPatient(patient.id)).toBeUndefined();
  expect(await app.firebaseWrites()).toHaveLength(2);

  await app.outcomeConfirmButton.click();
  await expect(app.cards).toHaveCount(0);
  expect(await app.firebaseDocument(historyPath(patient.id))).toEqual(firstRecord);
  expect(await app.firebaseWrites()).toHaveLength(2);
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
  await app.goto({
    patients: [patient],
    historyEvents: [existingOutcome]
  });
  await app.clearFirebaseWrites();

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
