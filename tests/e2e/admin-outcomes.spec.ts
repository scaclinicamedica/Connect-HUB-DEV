import { test, expect } from '../support/admin-fixture';
import type { AdminSeed } from '../support/admin-page';

const ADMIN_EMAIL = 'admin.desfechos@example.test';
const ADMIN_PASSWORD = 'senha-ficticia-desfechos';
const ADMIN_UID = 'fixture-admin-outcomes';
const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

function isoDay(daysAgo: number){
  const instant = new Date(Date.now() - (daysAgo * 86_400_000));
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function serverTimestamp(daysAgo: number, time = '12:00:00'){
  return {
    __testTimestamp: true,
    iso: `${isoDay(daysAgo)}T${time}-03:00`
  };
}

function outcome(overrides: Record<string, unknown> & { id: string }){
  return {
    schemaVersion: 1,
    sourceVersion: 'fixture-v1',
    type: 'patient_outcome_admin',
    outcomeId: `patient_outcome_${overrides.id}`,
    outcomeType: 'treated',
    outcomeLabel: 'Tratado',
    createdAt: serverTimestamp(2),
    patientId: `patient-${overrides.id}`,
    patientName: 'PACIENTE FICTÍCIO DESFECHO',
    sectorUnit: 'emergencia',
    sectorName: 'Emergência',
    specialty: 'Cardiologia',
    admissionDate: isoDay(2),
    lengthOfStayDays: 999,
    lengthOfStayMethod: 'inclusive_calendar_days',
    responsibleDoctor: 'DRA. FICTÍCIA RESPONSÁVEL',
    primaryIcdCode: '',
    actorUid: ADMIN_UID,
    createdAtLocal: `${isoDay(35)}T23:59:59-03:00`,
    dateLocal: isoDay(35),
    ...overrides
  };
}

function outcomeSeed(
  adminOutcomes: AdminSeed['adminOutcomes'],
  historyEvents: AdminSeed['historyEvents'] = []
): AdminSeed {
  return {
    adminAccounts: [
      { uid: ADMIN_UID, email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    ],
    adminUsers: [
      { id: ADMIN_UID, active: true, role: 'admin' }
    ],
    patientsByUnit: {},
    historyEvents,
    adminOutcomes
  };
}

function representativeOutcomes(){
  return [
    outcome({
      id: 'outcome-treated',
      patientName: '<img src=x onerror="window.__xssTriggered=true">',
      outcomeType: 'treated',
      outcomeLabel: 'Tratado',
      createdAt: serverTimestamp(2, '09:30:00'),
      admissionDate: isoDay(2)
    }),
    outcome({
      id: 'outcome-death-1',
      patientName: 'PACIENTE FICTÍCIO ÓBITO UM',
      outcomeType: 'death',
      outcomeLabel: 'Óbito',
      createdAt: serverTimestamp(5, '10:15:00'),
      sectorUnit: 'uti',
      sectorName: 'UTI',
      specialty: 'Cardiologia',
      admissionDate: isoDay(14),
      primaryIcdCode: 'A41.9'
    }),
    outcome({
      id: 'outcome-death-2',
      patientName: 'PACIENTE FICTÍCIO ÓBITO DOIS',
      outcomeType: 'death',
      outcomeLabel: 'Óbito',
      createdAt: serverTimestamp(10, '11:45:00'),
      sectorUnit: 'uti',
      sectorName: 'UTI',
      specialty: 'Clínica Médica',
      admissionDate: isoDay(14),
      primaryIcdCode: 'a41.9'
    }),
    outcome({
      id: 'outcome-transferred',
      patientName: 'PACIENTE FICTÍCIO TRANSFERIDO',
      outcomeType: 'transferred',
      outcomeLabel: 'Transferido',
      createdAt: serverTimestamp(20, '14:20:00'),
      sectorUnit: 'enfermaria',
      sectorName: 'Enfermaria',
      specialty: 'Nefrologia',
      admissionDate: ''
    }),
    outcome({
      id: 'outcome-outside-period',
      patientName: 'PACIENTE FICTÍCIO FORA DO PERÍODO',
      outcomeType: 'treated',
      createdAt: serverTimestamp(35, '23:55:00'),
      dateLocal: isoDay(2),
      createdAtLocal: `${isoDay(2)}T23:55:00-03:00`,
      admissionDate: isoDay(38)
    }),
    outcome({
      id: 'unknown-schema',
      schemaVersion: 99,
      patientName: 'PACIENTE FICTÍCIO ESQUEMA DESCONHECIDO',
      createdAt: serverTimestamp(3)
    })
  ];
}

test('lê somente a projeção mínima, exclui outcomes privados no servidor e inclui UTI legada', async ({ admin, page }) => {
  await admin.goto(outcomeSeed(representativeOutcomes(), [
    {
      id: 'private-outcome-with-snapshot',
      schemaVersion: 1,
      type: 'patient_outcome',
      createdAt: serverTimestamp(1),
      patientName: 'PACIENTE PRIVADO NÃO BAIXADO',
      patientSnapshot: { clinicalSecret: 'NÃO DEVE SER TRANSFERIDO' }
    },
    {
      id: 'legacy-update',
      type: 'patient_updated',
      createdAt: serverTimestamp(1),
      patientName: 'PACIENTE FICTÍCIO LEGADO'
    }
  ]));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('4');
  await expect(page.locator('#outcomeTreatedV43')).toHaveText('1');
  await expect(page.locator('#outcomeDeathsV43')).toHaveText('2');
  await expect(page.locator('#outcomeTransferredV43')).toHaveText('1');
  await expect(page.locator('#outcomeDeathShareV43')).toHaveText('Proporção de óbitos entre desfechos: 50%');
  await expect(page.locator('#outcomeAverageLosV43')).toHaveText('5,3 dias');
  await expect(page.locator('#outcomeMedianLosV43')).toHaveText('5 dias');
  await expect(page.locator('#outcomeAverageCoverageV43')).toHaveText('Cobertura: 3/4 desfechos (75%)');
  await expect(page.locator('#outcomeSectorRowsV43')).toContainText('UTI (legado)');
  await expect(page.locator('#outcomeSpecialtyRowsV43')).toContainText('Nefrologia');
  await expect(page.locator('#outcomeCidRowsV43')).toContainText('A41.9');
  await expect(page.locator('#outcomeCidRowsV43')).toContainText('2');
  await expect(page.locator('#outcomeAuditRowsV43 tr')).toHaveCount(4);
  await expect(page.locator('#outcomeAuditRowsV43')).not.toContainText('FORA DO PERÍODO');
  await expect(page.locator('#outcomeAuditRowsV43')).not.toContainText('ESQUEMA DESCONHECIDO');

  await expect(page.locator('#outcomeAuditRowsV43')).toContainText('<img');
  await expect(page.locator('#outcomeAuditRowsV43 img')).toHaveCount(0);
  expect(await page.evaluate(() => (
    window as typeof window & { __xssTriggered: boolean }
  ).__xssTriggered)).toBe(false);

  const memory = await page.evaluate(() => window.eval(`({
    outcomes: allOutcomeEventsV43,
    history: allHistoryEventsV41
  })`));
  expect(memory.outcomes.every((event: Record<string, unknown>) => (
    !Object.prototype.hasOwnProperty.call(event, 'patientSnapshot') &&
    !Object.prototype.hasOwnProperty.call(event, 'createdAtLocal') &&
    !Object.prototype.hasOwnProperty.call(event, 'dateLocal')
  ))).toBe(true);
  expect(memory.history.every((event: Record<string, unknown>) => (
    event.type !== 'patient_outcome' &&
    !Object.prototype.hasOwnProperty.call(event, 'patientSnapshot')
  ))).toBe(true);

  const reads = await admin.firebaseReads();
  const historyRead = reads.find(read => read.path === 'historico_eventos');
  const outcomesRead = reads.find(read => read.path === 'admin_outcomes');
  expect(historyRead).toMatchObject({
    filters: [{ field: 'type', operator: '!=', value: 'patient_outcome' }],
    limitCount: 5001
  });
  expect(historyRead?.returnedPaths).toEqual(['historico_eventos/legacy-update']);
  expect(outcomesRead).toMatchObject({
    orderField: 'createdAt',
    orderDirection: 'desc',
    limitCount: 5001
  });
  expect(await admin.firebaseWrites()).toEqual([]);
});

test('usa exclusivamente createdAt do servidor para período, ordenação e auditoria em São Paulo', async ({ admin, page }) => {
  await admin.goto(outcomeSeed([
    outcome({
      id: 'authoritative-newer',
      patientName: 'PACIENTE AUTORITATIVO MAIS RECENTE',
      createdAt: serverTimestamp(8, '18:45:00'),
      createdAtLocal: `${isoDay(20)}T01:00:00-03:00`,
      dateLocal: isoDay(20),
      admissionDate: isoDay(8)
    }),
    outcome({
      id: 'authoritative-older',
      patientName: 'PACIENTE AUTORITATIVO MAIS ANTIGO',
      createdAt: serverTimestamp(9, '07:15:00'),
      createdAtLocal: `${isoDay(1)}T23:59:00-03:00`,
      dateLocal: isoDay(1),
      admissionDate: isoDay(9)
    })
  ]));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await page.locator('#outcomeStartV43').fill(isoDay(9));
  await page.locator('#outcomeEndV43').fill(isoDay(8));
  await page.locator('#outcomeEndV43').dispatchEvent('change');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('2');

  const auditRows = page.locator('#outcomeAuditRowsV43 tr');
  await expect(auditRows.nth(0)).toContainText('PACIENTE AUTORITATIVO MAIS RECENTE');
  await expect(auditRows.nth(1)).toContainText('PACIENTE AUTORITATIVO MAIS ANTIGO');
  await expect(auditRows.nth(0)).toContainText('18:45:00');

  await page.locator('#outcomeStartV43').fill(isoDay(1));
  await page.locator('#outcomeEndV43').fill(isoDay(1));
  await page.locator('#outcomeEndV43').dispatchEvent('change');
  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'filter-empty');
});

test('aplica setor, especialidade e tipo e diferencia resultado vazio por filtro', async ({ admin, page }) => {
  await admin.goto(outcomeSeed(representativeOutcomes()));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await page.locator('#outcomeSectorV43').selectOption('uti');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('2');
  await expect(page.locator('#outcomeDeathsV43')).toHaveText('2');

  await page.locator('#outcomeSpecialtyV43').selectOption('Clínica Médica');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('1');
  await expect(page.locator('#outcomeAuditRowsV43')).toContainText('PACIENTE FICTÍCIO ÓBITO DOIS');

  await page.locator('#outcomeTypeV43').selectOption('transferred');
  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'filter-empty');
  await expect(page.locator('#outcomesResultsV43')).toBeHidden();
});

test('distingue projeção vazia e ignora versões e tipos desconhecidos', async ({ admin, page }) => {
  await admin.goto(outcomeSeed([
    outcome({ id: 'unknown-schema-only', schemaVersion: 2 }),
    outcome({ id: 'unknown-type-only', type: 'patient_deleted' })
  ]));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'empty');
  await expect(page.locator('#outcomesResultsV43')).toBeHidden();
});

test('expõe estados negado, carregando e erro sem apresentar métricas parciais', async ({ admin, page }) => {
  await admin.goto(outcomeSeed(representativeOutcomes()));
  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'denied');

  await page.evaluate(() => (
    window as typeof window & {
      __firebaseTestHarness: {
        delayNext(operation: string, pathIncludes: string, delayMs: number): string;
      };
    }
  ).__firebaseTestHarness.delayNext('get', 'admin_outcomes', 700));
  await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(admin.adminContent).toBeVisible();
  await page.locator('button[data-tab="outcomes"]').click();
  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'loading');
  await expect(page.locator('#outcomesResultsV43')).toBeHidden();
  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'ready');

  await page.evaluate(() => (
    window as typeof window & {
      __firebaseTestHarness: {
        failNext(operation: string, pathIncludes: string, message: string): string;
      };
    }
  ).__firebaseTestHarness.failNext('get', 'admin_outcomes', 'Falha controlada na projeção.'));
  await page.locator('#refreshBtn').click();
  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#outcomesResultsV43')).toBeHidden();
});

test('bloqueia a aba quando a projeção ultrapassa o limite seguro', async ({ admin, page }) => {
  const adminOutcomes = Array.from({ length: 5001 }, (_, index) => outcome({
    id: `outcome-${String(index).padStart(4, '0')}`,
    createdAt: serverTimestamp(1)
  }));
  await admin.goto(outcomeSeed(adminOutcomes));
  await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(admin.adminContent).toBeVisible();
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'truncated');
  await expect(page.locator('#outcomesStateV43')).toContainText('excede 5.000 registros');
  await expect(page.locator('#outcomesResultsV43')).toBeHidden();
});

test('encerra o carregamento com erro quando a leitura de pacientes falha', async ({ admin, page }) => {
  await admin.goto({
    ...outcomeSeed(representativeOutcomes()),
    readFailures: [{
      pathIncludes: 'connect_hub_v55/emergencia/pacientes',
      code: 'unavailable',
      message: 'Falha controlada na leitura de pacientes.'
    }]
  });
  await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(admin.adminContent).toBeVisible();
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#outcomesResultsV43')).toBeHidden();
});

test('aplica exatamente 30 dias civis de São Paulo e aceita período personalizado', async ({ admin, page }) => {
  await admin.goto(outcomeSeed([
    outcome({ id: 'outcome-today', createdAt: serverTimestamp(0), admissionDate: isoDay(0) }),
    outcome({ id: 'outcome-day-29', createdAt: serverTimestamp(29), admissionDate: isoDay(29) }),
    outcome({
      id: 'outcome-day-30',
      createdAt: serverTimestamp(30),
      admissionDate: isoDay(30),
      dateLocal: isoDay(0),
      createdAtLocal: `${isoDay(0)}T12:00:00-03:00`
    })
  ]));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomeStartV43')).toHaveValue(isoDay(29));
  await expect(page.locator('#outcomeEndV43')).toHaveValue(isoDay(0));
  await expect(page.locator('#outcomeTotalV43')).toHaveText('2');
  await expect(page.locator('#outcomeAuditRowsV43')).not.toContainText('patient_outcome_outcome-day-30');

  await page.locator('#outcomeStartV43').fill(isoDay(30));
  await page.locator('#outcomeEndV43').fill(isoDay(30));
  await page.locator('#outcomeEndV43').dispatchEvent('change');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('1');
  await expect(page.locator('#outcomeAuditRowsV43')).toContainText('patient_outcome_outcome-day-30');

  await page.locator('#outcomeStartV43').fill(isoDay(0));
  await page.locator('#outcomeStartV43').dispatchEvent('change');
  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'error');
});

test('calcula permanência inclusiva por DIH e createdAt, ignorando duração e relógio locais adulterados', async ({ admin, page }) => {
  await admin.goto(outcomeSeed([
    outcome({
      id: 'los-one',
      createdAt: serverTimestamp(2),
      admissionDate: isoDay(2),
      lengthOfStayDays: 400
    }),
    outcome({
      id: 'los-four',
      createdAt: serverTimestamp(2),
      admissionDate: isoDay(5),
      lengthOfStayDays: 1,
      dateLocal: isoDay(20),
      createdAtLocal: `${isoDay(20)}T00:01:00-03:00`
    }),
    outcome({
      id: 'los-future-admission',
      createdAt: serverTimestamp(2),
      admissionDate: isoDay(1),
      lengthOfStayDays: 25
    }),
    outcome({
      id: 'los-invalid-admission',
      createdAt: serverTimestamp(2),
      admissionDate: 'data-inválida',
      lengthOfStayDays: 10
    })
  ]));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomeAverageLosV43')).toHaveText('2,5 dias');
  await expect(page.locator('#outcomeMedianLosV43')).toHaveText('2,5 dias');
  await expect(page.locator('#outcomeAverageCoverageV43')).toHaveText('Cobertura: 2/4 desfechos (50%)');
  await expect(page.locator('#outcomeAuditRowsV43')).toContainText('4 dias');
  await expect(page.locator('#outcomeAuditRowsV43')).not.toContainText('400 dias');
});

test('escapa todos os campos persistidos exibidos pela nova aba', async ({ admin, page }) => {
  const payload = '<img src=x onerror="window.__xssTriggered=true">';
  await admin.goto(outcomeSeed([
    outcome({
      id: 'outcome-xss',
      outcomeId: payload,
      outcomeType: 'death',
      patientName: payload,
      sectorUnit: '',
      sectorName: payload,
      specialty: payload,
      responsibleDoctor: payload,
      primaryIcdCode: payload
    })
  ]));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#tab-outcomes')).toContainText('<img');
  await expect(page.locator('#tab-outcomes img')).toHaveCount(0);
  expect(await page.evaluate(() => (
    window as typeof window & { __xssTriggered: boolean }
  ).__xssTriggered)).toBe(false);
});
