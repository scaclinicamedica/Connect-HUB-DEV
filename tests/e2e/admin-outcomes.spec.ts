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
  const projected: Record<string, unknown> = {
    schemaVersion: 2,
    sourceVersion: 'fixture-v2',
    type: 'patient_outcome_admin',
    outcomeId: `patient_outcome_${overrides.id}`,
    outcomeType: 'treated',
    outcomeLabel: 'Alta médica',
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
    palliativeAlertPresentAtOutcome: false,
    actorUid: ADMIN_UID,
    createdAtLocal: `${isoDay(35)}T23:59:59-03:00`,
    dateLocal: isoDay(35),
    ...overrides
  };
  if(projected.schemaVersion === 1){
    delete projected.palliativeAlertPresentAtOutcome;
  }
  return projected;
}

function sectorLocation(
  sectorUnit: string,
  sectorName: string,
  unit = '',
  bed = ''
){
  return {
    catalogVersion: 1,
    canonicalSectorId: sectorUnit,
    sectorUnit,
    sectorName,
    unit,
    bed
  };
}

function trackedOutcome(overrides: Record<string, unknown> & { id: string }){
  const patientId = String(overrides.patientId || `patient-${overrides.id}`);
  return outcome({
    schemaVersion: 3,
    sourceVersion: 'fixture-v3',
    patientId,
    sectorTrackingVersion: 1,
    episodeId: `patient_episode_${patientId}`,
    sectorTrackingOrigin: 'initial_entry',
    lastSectorTransitionFactId: '',
    sectorEnteredAt: serverTimestamp(2, '08:00:00'),
    unit: '',
    bed: '',
    primaryIcdCode: 'Z00.0',
    ...overrides
  });
}

function sectorFact(overrides: Record<string, unknown> & { id: string }){
  const factId = String(overrides.factId || overrides.id);
  const patientId = String(overrides.patientId || 'patient-sector-tracked');
  return {
    id: overrides.id,
    schemaVersion: 1,
    sourceVersion: 'FOUNDATION-1.0-RC1.3.3-OUTCOME-NOSOLOGY-SECTOR-LOS',
    type: 'patient_sector_transition_admin',
    factId,
    episodeId: `patient_episode_${patientId}`,
    patientId,
    occurredAt: serverTimestamp(2, '12:00:00'),
    actorUid: ADMIN_UID,
    predecessorFactId: '',
    movementClassification: 'sector_transfer',
    trackingOrigin: 'initial_entry',
    originEnteredAt: serverTimestamp(2, '08:00:00'),
    origin: sectorLocation('emergencia', 'Emergência', '', 'Maca 01'),
    destination: sectorLocation('uti_1', 'UTI 1', 'UTI 1', '151'),
    ...overrides
  };
}

function outcomeSeed(
  adminOutcomes: AdminSeed['adminOutcomes'],
  historyEvents: AdminSeed['historyEvents'] = [],
  adminSectorTransitions: AdminSeed['adminSectorTransitions'] = []
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
    adminOutcomes,
    adminSectorTransitions
  };
}

function representativeOutcomes(){
  return [
    outcome({
      id: 'outcome-treated',
      patientName: '<img src=x onerror="window.__xssTriggered=true">',
      outcomeType: 'treated',
      outcomeLabel: 'Alta médica',
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
      primaryIcdCode: 'A41.9',
      palliativeAlertPresentAtOutcome: true
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
      primaryIcdCode: 'a41.9',
      schemaVersion: 1
    }),
    outcome({
      id: 'outcome-transferred',
      patientName: 'PACIENTE FICTÍCIO TRANSFERIDO',
      outcomeType: 'transferred',
      outcomeLabel: 'Transferência externa',
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
  await expect(page.locator('#liveSummaryGridV70')).toBeVisible();
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#liveSummaryGridV70')).toBeHidden();
  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('4');
  await expect(page.locator('#outcomeTreatedV43')).toHaveText('1');
  await expect(page.locator('#outcomeDeathsV43')).toHaveText('2');
  await expect(page.locator('#outcomeTransferredV43')).toHaveText('1');
  await expect(page.locator('#outcomeDeathShareV43')).toHaveText('Proporção de óbitos entre desfechos: 50%');
  await expect(page.locator('#outcomePalliativeDeathsV70')).toHaveText('1');
  await expect(page.locator('#outcomeNonPalliativeDeathsV70')).toHaveText('0');
  await expect(page.locator('#outcomePalliativeDeathShareV70')).toHaveText('Proporção entre óbitos com registro disponível: 100%');
  await expect(page.locator('#outcomePalliativeDeathCoverageV70')).toHaveText('Cobertura do registro: 1/2 óbitos (50%)');
  await expect(page.locator('#outcomeUnknownPalliativeDeathsV70')).toHaveText('1');
  await expect(page.locator('#outcomeAverageLosV43')).toHaveText('5,3 dias');
  await expect(page.locator('#outcomeMedianLosV43')).toHaveText('5 dias');
  await expect(page.locator('#outcomeAverageCoverageV43')).toHaveText('Cobertura: 3/4 desfechos (75%)');
  await expect(page.locator('#outcomePalliativeRowsV70')).toContainText('Registro indisponível');
  await expect(page.locator('#outcomePalliativeRowsV70')).toContainText('50%');
  await expect(page.locator('#outcomeLosByTypeRowsV70 tr')).toHaveCount(3);
  await expect(page.locator('#outcomeSectorRowsV43')).toContainText('UTI (legado)');
  await expect(page.locator('#outcomeSectorRowsV43 tr').filter({ hasText: 'UTI (legado)' }).locator('th, td')).toHaveText([
    'UTI (legado)', '2', '0', '2', '1', '1/2 (50%)', '0'
  ]);
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

  const outcomesTab = page.locator('button[data-tab="outcomes"]');
  await outcomesTab.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('button[data-tab="movements"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#liveSummaryGridV70')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(outcomesTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#liveSummaryGridV70')).toBeHidden();

  const reads = await admin.firebaseReads();
  const historyRead = reads.find(read => read.path === 'historico_eventos');
  const outcomesRead = reads.find(read => read.path === 'admin_outcomes');
  const sectorTransitionsRead = reads.find(read => read.path === 'admin_sector_transitions');
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
  expect(sectorTransitionsRead).toMatchObject({
    orderField: 'occurredAt',
    orderDirection: 'asc',
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
  await expect(page.locator('#outcomeAuditPageStatusV70')).toHaveText('1–1 de 1 Desfecho • Página 1 de 1');
  await expect(page.locator('#outcomeAuditRowsV43')).toContainText('PACIENTE FICTÍCIO ÓBITO DOIS');

  await page.locator('#outcomeTypeV43').selectOption('transferred');
  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'filter-empty');
  await expect(page.locator('#outcomesResultsV43')).toBeHidden();

  await page.locator('#outcomeClearFiltersV70').click();
  await expect(page.locator('#outcomeSectorV43')).toHaveValue('all');
  await expect(page.locator('#outcomeSpecialtyV43')).toHaveValue('all');
  await expect(page.locator('#outcomeTypeV43')).toHaveValue('all');
  await expect(page.locator('#outcomePalliativeV70')).toHaveValue('all');
  await expect(page.locator('#outcomeCidV80')).toHaveValue('all');
  await expect(page.locator('#outcomeStartV43')).toHaveValue(isoDay(29));
  await expect(page.locator('#outcomeEndV43')).toHaveValue(isoDay(0));
  await expect(page.locator('#outcomeTotalV43')).toHaveText('4');
});

test('aplica CID em conjunto com os demais filtros e descreve todos os tipos de desfecho', async ({ admin, page }) => {
  await admin.goto(outcomeSeed([
    outcome({
      id: 'cid-medical-discharge',
      outcomeType: 'treated',
      outcomeLabel: 'Alta médica',
      primaryIcdCode: 'A41.9',
      specialty: 'Cardiologia'
    }),
    outcome({
      id: 'cid-death',
      outcomeType: 'death',
      outcomeLabel: 'Óbito',
      primaryIcdCode: 'a41.9',
      specialty: 'Cardiologia'
    }),
    outcome({
      id: 'cid-external-transfer',
      outcomeType: 'transferred',
      outcomeLabel: 'Transferência externa',
      primaryIcdCode: 'J18.9',
      specialty: 'Pneumologia'
    }),
    outcome({
      id: 'cid-legacy-empty',
      schemaVersion: 1,
      outcomeType: 'treated',
      outcomeLabel: 'Alta médica',
      primaryIcdCode: ''
    })
  ]));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomeCidQualityV70')).toHaveText('Cobertura: 3/4 desfechos (75%)');
  await expect(page.locator('#outcomeCidV80 option')).toHaveText([
    'Todos os CIDs', 'A41.9', 'J18.9'
  ]);
  await expect(
    page.locator('#outcomeCidRowsV43 tr').filter({ hasText: 'A41.9' }).locator('th, td')
  ).toHaveText(['A41.9', '2', '1', '1', '0', '67%']);
  await expect(
    page.locator('#outcomeCidRowsV43 tr').filter({ hasText: 'J18.9' }).locator('th, td')
  ).toHaveText(['J18.9', '1', '0', '0', '1', '33%']);
  await expect(
    page.locator('#outcomeAuditRowsV43 tr')
      .filter({ hasText: 'patient_outcome_cid-medical-discharge' })
      .locator('th, td')
      .nth(10)
  ).toHaveText('A41.9');
  await expect(
    page.locator('#outcomeAuditRowsV43 tr')
      .filter({ hasText: 'patient_outcome_cid-external-transfer' })
      .locator('th, td')
      .nth(10)
  ).toHaveText('J18.9');

  const cidChart = await page.evaluate(() => {
    const instances = (
      window as typeof window & {
        __adminAssetTestHarness: {
          ChartTestDouble: {
            instances: Array<{
              canvasId: string;
              destroyed: boolean;
              config: {
                data: { datasets: Array<{ label: string; data: number[] }> };
                options: { indexAxis: string; scales: { x: { stacked: boolean }; y: { stacked: boolean } } };
              };
            }>;
          };
        };
      }
    ).__adminAssetTestHarness.ChartTestDouble.instances;
    return instances.find(instance => (
      instance.canvasId === 'outcomeCidChartV70' && !instance.destroyed
    ))?.config;
  });
  expect(cidChart?.options.indexAxis).toBe('y');
  expect(cidChart?.options.scales.x.stacked).toBe(true);
  expect(cidChart?.options.scales.y.stacked).toBe(true);
  expect(cidChart?.data.datasets.map(dataset => dataset.label)).toEqual([
    'Altas médicas', 'Óbitos', 'Transferências externas'
  ]);

  await page.locator('#outcomeCidV80').selectOption('J18.9');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('1');
  await expect(page.locator('#outcomeTransferredV43')).toHaveText('1');
  await expect(page.locator('#outcomeAuditRowsV43')).toContainText('Transferência externa');

  await page.locator('#outcomeTypeV43').selectOption('death');
  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'filter-empty');
});

test('ignora schema 3 sem CID canônico, incluindo código minúsculo ou com espaços', async ({ admin, page }) => {
  const withoutCid = trackedOutcome({
    id: 'schema-three-without-cid',
    primaryIcdCode: 'A41.9'
  });
  delete withoutCid.primaryIcdCode;

  await admin.goto(outcomeSeed([
    withoutCid,
    trackedOutcome({
      id: 'schema-three-lowercase-cid',
      primaryIcdCode: 'a41.9'
    }),
    trackedOutcome({
      id: 'schema-three-spaced-cid',
      primaryIcdCode: ' A41.9 '
    }),
    trackedOutcome({
      id: 'schema-three-canonical-cid',
      primaryIcdCode: 'A41.9'
    })
  ]));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('1');
  await expect(page.locator('#outcomeCidQualityV70')).toHaveText('Cobertura: 1/1 desfechos (100%)');
  await expect(page.locator('#outcomeAuditRowsV43 tr')).toHaveCount(1);
  await expect(page.locator('#outcomeAuditRowsV43')).toContainText('schema-three-canonical-cid');
  await expect(page.locator('#outcomeAuditRowsV43')).not.toContainText('schema-three-lowercase-cid');
  await expect(page.locator('#outcomeAuditRowsV43')).not.toContainText('schema-three-spaced-cid');
  await expect(page.locator('#outcomeCidV80 option')).toHaveText(['Todos os CIDs', 'A41.9']);
});

test('reconstrói permanência setorial através de remanejamentos, soma retornos e explicita cobertura', async ({ admin, page }) => {
  const emergency = sectorLocation('emergencia', 'Emergência', '', 'Maca 01');
  const intensiveCare = sectorLocation('uti_1', 'UTI 1', 'UTI 1', '151');
  const legacyIntensiveCare = sectorLocation('uti_2', 'UTI 2', 'UTI 2', '101-1');
  const ward = sectorLocation('enfermaria', 'Enfermaria', '2º andar', '201-1');
  const returnPatientId = 'patient-sector-return';
  const baselinePatientId = 'patient-sector-baseline';

  const outcomes = [
    trackedOutcome({
      id: 'sector-return',
      patientId: returnPatientId,
      episodeId: `patient_episode_${returnPatientId}`,
      outcomeType: 'treated',
      outcomeLabel: 'Alta médica',
      primaryIcdCode: 'A41.9',
      createdAt: serverTimestamp(2, '18:00:00'),
      sectorUnit: emergency.sectorUnit,
      sectorName: emergency.sectorName,
      unit: emergency.unit,
      bed: 'Maca 02',
      sectorEnteredAt: serverTimestamp(2, '12:00:00'),
      lastSectorTransitionFactId: 'fact-return-to-emergency'
    }),
    trackedOutcome({
      id: 'sector-baseline',
      patientId: baselinePatientId,
      episodeId: `patient_episode_${baselinePatientId}`,
      outcomeType: 'death',
      outcomeLabel: 'Óbito',
      primaryIcdCode: 'A41.9',
      createdAt: serverTimestamp(2, '22:00:00'),
      sectorUnit: ward.sectorUnit,
      sectorName: ward.sectorName,
      unit: ward.unit,
      bed: ward.bed,
      sectorTrackingOrigin: 'baseline_observation',
      sectorEnteredAt: serverTimestamp(2, '10:00:00'),
      lastSectorTransitionFactId: 'fact-baseline-to-ward'
    }),
    trackedOutcome({
      id: 'sector-no-facts',
      patientId: 'patient-sector-no-facts',
      outcomeType: 'transferred',
      outcomeLabel: 'Transferência externa',
      primaryIcdCode: 'J18.9',
      createdAt: serverTimestamp(2, '14:00:00'),
      sectorUnit: intensiveCare.sectorUnit,
      sectorName: intensiveCare.sectorName,
      unit: intensiveCare.unit,
      bed: intensiveCare.bed,
      sectorEnteredAt: serverTimestamp(3, '08:00:00')
    }),
    outcome({
      id: 'sector-legacy-schema-two',
      outcomeType: 'death',
      outcomeLabel: 'Óbito',
      primaryIcdCode: ''
    }),
    trackedOutcome({
      id: 'sector-tracking-zero',
      outcomeType: 'treated',
      outcomeLabel: 'Alta médica',
      primaryIcdCode: 'C34.9',
      sectorTrackingVersion: 0,
      episodeId: '',
      sectorTrackingOrigin: '',
      lastSectorTransitionFactId: '',
      sectorEnteredAt: null
    }),
    trackedOutcome({
      id: 'sector-missing-fact',
      outcomeType: 'treated',
      outcomeLabel: 'Alta médica',
      primaryIcdCode: 'C34.9',
      lastSectorTransitionFactId: 'fact-that-does-not-exist'
    })
  ];

  const transitions = [
    sectorFact({
      id: 'fact-emergency-to-uti',
      patientId: returnPatientId,
      episodeId: `patient_episode_${returnPatientId}`,
      occurredAt: serverTimestamp(2, '06:00:00'),
      originEnteredAt: serverTimestamp(2, '00:00:00'),
      origin: { ...emergency, privateClinicalNote: 'NÃO DEVE SER MANTIDA' },
      destination: intensiveCare,
      extraSnapshot: { secret: true }
    }),
    sectorFact({
      id: 'fact-uti-to-ward',
      patientId: returnPatientId,
      episodeId: `patient_episode_${returnPatientId}`,
      occurredAt: serverTimestamp(2, '09:00:00'),
      predecessorFactId: 'fact-emergency-to-uti',
      originEnteredAt: serverTimestamp(2, '06:00:00'),
      origin: { ...intensiveCare, bed: '152' },
      destination: ward
    }),
    sectorFact({
      id: 'fact-return-to-emergency',
      patientId: returnPatientId,
      episodeId: `patient_episode_${returnPatientId}`,
      occurredAt: serverTimestamp(2, '12:00:00'),
      predecessorFactId: 'fact-uti-to-ward',
      movementClassification: 'counterflow_transfer',
      originEnteredAt: serverTimestamp(2, '09:00:00'),
      origin: { ...ward, bed: '202-1' },
      destination: emergency
    }),
    sectorFact({
      id: 'fact-baseline-to-ward',
      patientId: baselinePatientId,
      episodeId: `patient_episode_${baselinePatientId}`,
      occurredAt: serverTimestamp(2, '10:00:00'),
      originEnteredAt: null,
      trackingOrigin: 'baseline_observation',
      origin: legacyIntensiveCare,
      destination: ward
    })
  ];

  await admin.goto(outcomeSeed(outcomes, [], transitions));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomeSectorStayStateV80')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#outcomeSectorStayQualityV80')).toHaveText(
    'Completa: 2 • Parcial: 1 • Indisponível: 3'
  );
  await expect(
    page.locator('#outcomeSectorStayRowsV80 tr').filter({ hasText: 'Emergência' }).locator('th, td')
  ).toHaveText(['Emergência', '1', '12 h', '12 h', '12 h']);
  await expect(
    page.locator('#outcomeSectorStayRowsV80 tr').filter({ hasText: 'UTI 1' }).locator('th, td')
  ).toHaveText(['UTI 1', '2', '16,5 h', '16,5 h', '1 d 9 h (33 h)']);
  await expect(
    page.locator('#outcomeSectorStayRowsV80 tr').filter({ hasText: 'Enfermaria' }).locator('th, td')
  ).toHaveText(['Enfermaria', '2', '7,5 h', '7,5 h', '15 h']);
  await expect(page.locator('#tab-outcomes')).toContainText(
    'independente da permanência hospitalar inclusiva calculada pela DIH'
  );

  const sectorChart = await page.evaluate(() => {
    const instances = (
      window as typeof window & {
        __adminAssetTestHarness: {
          ChartTestDouble: {
            instances: Array<{
              canvasId: string;
              destroyed: boolean;
              config: {
                options: { indexAxis: string };
                data: { labels: string[]; datasets: Array<{ label: string; data: number[] }> };
              };
            }>;
          };
        };
      }
    ).__adminAssetTestHarness.ChartTestDouble.instances;
    return instances.find(instance => (
      instance.canvasId === 'outcomeSectorStayChartV80' && !instance.destroyed
    ))?.config;
  });
  expect(sectorChart?.options.indexAxis).toBe('y');
  expect(sectorChart?.data.datasets.map(dataset => dataset.label)).toEqual([
    'Média (horas)', 'Mediana (horas)'
  ]);
  const chartBySector = Object.fromEntries(
    (sectorChart?.data.labels || []).map((label, index) => [
      label,
      sectorChart?.data.datasets.map(dataset => dataset.data[index])
    ])
  );
  expect(chartBySector).toMatchObject({
    'Emergência': [12, 12],
    'UTI 1': [16.5, 16.5],
    'Enfermaria': [7.5, 7.5]
  });

  const memory = await page.evaluate(() => window.eval('allSectorTransitionFactsV80'));
  expect(memory).toHaveLength(4);
  expect(memory[0]).not.toHaveProperty('extraSnapshot');
  expect(memory[0].origin).not.toHaveProperty('privateClinicalNote');

  await page.locator('#outcomeSectorV43').selectOption('uti_1');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('1');
  await expect(page.locator('#outcomeAuditRowsV43')).toContainText('sector-no-facts');
  await expect(
    page.locator('#outcomeSectorStayRowsV80 tr').filter({ hasText: 'UTI 1' }).locator('th, td')
  ).toHaveText(['UTI 1', '2', '16,5 h', '16,5 h', '1 d 9 h (33 h)']);
  await expect(page.locator('#outcomeSectorStayRowsV80 tr')).toHaveCount(1);

  await page.locator('#outcomeSectorV43').selectOption('all');
  await page.locator('#outcomeCidV80').selectOption('A41.9');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('2');
  await expect(page.locator('#outcomeSectorStayQualityV80')).toHaveText(
    'Completa: 1 • Parcial: 1 • Indisponível: 0'
  );
  await expect(page.locator('#outcomeSectorStayRowsV80')).not.toContainText('1 d 12 h');

  await page.locator('#outcomeTypeV43').selectOption('death');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('1');
  await expect(page.locator('#outcomeSectorStayQualityV80')).toHaveText(
    'Completa: 0 • Parcial: 1 • Indisponível: 0'
  );
  await expect(page.locator('#outcomeSectorStayRowsV80 tr')).toHaveCount(1);
  await expect(page.locator('#outcomeSectorStayRowsV80')).toContainText('Enfermaria');
});

test('classifica como indisponíveis fatos setoriais fora do contrato fechado', async ({ admin, page }) => {
  const emergency = sectorLocation('emergencia', 'Emergência', '', 'Maca 01');
  const observation = sectorLocation('observacao_sus', 'Observação SUS', 'Observação SUS 01', '01');
  const intensiveCare = sectorLocation('uti_1', 'UTI 1', 'UTI 1', '151');
  const ward = sectorLocation('enfermaria', 'Enfermaria', '2º andar', '201-1');
  const factWithoutSourceBase = sectorFact({
    id: 'fact-without-source-version',
    patientId: 'patient-without-source-version',
    destination: intensiveCare
  });
  const zeroIntervalPatientId = 'patient-zero-hour-sector';
  const zeroIntervalFirstFact = sectorFact({
    id: 'fact-zero-hour-emergency-to-uti',
    patientId: zeroIntervalPatientId,
    occurredAt: serverTimestamp(2, '12:00:00'),
    originEnteredAt: serverTimestamp(2, '08:00:00'),
    destination: intensiveCare
  });
  const zeroIntervalSecondFact = sectorFact({
    id: 'fact-zero-hour-uti-to-ward',
    patientId: zeroIntervalPatientId,
    occurredAt: serverTimestamp(2, '12:00:00'),
    predecessorFactId: zeroIntervalFirstFact.factId,
    originEnteredAt: serverTimestamp(2, '12:00:00'),
    origin: intensiveCare,
    destination: ward
  });
  const {
    sourceVersion: _omittedSourceVersion,
    ...factWithoutSourceVersion
  } = factWithoutSourceBase;

  const invalidFacts = [
    {
      key: 'without-source-version',
      destination: intensiveCare,
      fact: factWithoutSourceVersion
    },
    {
      key: 'wrong-source-version',
      destination: intensiveCare,
      fact: sectorFact({
        id: 'fact-wrong-source-version',
        patientId: 'patient-wrong-source-version',
        sourceVersion: 'FOUNDATION-1.0-RC1.3.2-OUTCOME-ADMIN'
      })
    },
    {
      key: 'baseline-with-known-origin',
      destination: intensiveCare,
      fact: sectorFact({
        id: 'fact-baseline-with-known-origin',
        patientId: 'patient-baseline-with-known-origin',
        trackingOrigin: 'baseline_observation',
        originEnteredAt: serverTimestamp(2, '08:00:00')
      })
    },
    {
      key: 'invalid-enum',
      destination: intensiveCare,
      fact: sectorFact({
        id: 'fact-invalid-enum',
        patientId: 'patient-invalid-enum',
        movementClassification: 'intra_sector_reassignment',
        destination: intensiveCare
      })
    },
    {
      key: 'canonical-mismatch',
      destination: intensiveCare,
      fact: sectorFact({
        id: 'fact-canonical-mismatch',
        patientId: 'patient-canonical-mismatch',
        origin: { ...emergency, canonicalSectorId: 'observacao_sus' },
        destination: intensiveCare
      })
    },
    {
      key: 'canonical-name-mismatch',
      destination: intensiveCare,
      fact: sectorFact({
        id: 'fact-canonical-name-mismatch',
        patientId: 'patient-canonical-name-mismatch',
        origin: { ...emergency, sectorName: 'Emergencia' },
        destination: intensiveCare
      })
    },
    {
      key: 'invalid-sector-pair',
      destination: intensiveCare,
      fact: sectorFact({
        id: 'fact-invalid-sector-pair',
        patientId: 'patient-invalid-sector-pair',
        origin: observation,
        destination: intensiveCare
      })
    },
    {
      key: 'classification-mismatch',
      destination: emergency,
      fact: sectorFact({
        id: 'fact-classification-mismatch',
        patientId: 'patient-classification-mismatch',
        origin: ward,
        destination: emergency,
        movementClassification: 'sector_transfer'
      })
    }
  ];
  const outcomes = invalidFacts.map(({ key, destination, fact }) => {
    const patientId = `patient-${key}`;
    return trackedOutcome({
      id: `outcome-${key}`,
      patientId,
      episodeId: `patient_episode_${patientId}`,
      createdAt: serverTimestamp(2, '18:00:00'),
      sectorUnit: destination.sectorUnit,
      sectorName: destination.sectorName,
      unit: destination.unit,
      bed: destination.bed,
      sectorTrackingOrigin: String(fact.trackingOrigin),
      sectorEnteredAt: serverTimestamp(2, '12:00:00'),
      lastSectorTransitionFactId: String(fact.factId)
    });
  }).concat(trackedOutcome({
    id: 'outcome-zero-hour-sector',
    patientId: zeroIntervalPatientId,
    createdAt: serverTimestamp(2, '18:00:00'),
    sectorUnit: ward.sectorUnit,
    sectorName: ward.sectorName,
    unit: ward.unit,
    bed: ward.bed,
    sectorEnteredAt: serverTimestamp(2, '12:00:00'),
    lastSectorTransitionFactId: String(zeroIntervalSecondFact.factId)
  }));

  await admin.goto(outcomeSeed(
    outcomes,
    [],
    invalidFacts.map(({ fact }) => fact).concat(
      zeroIntervalFirstFact,
      zeroIntervalSecondFact
    )
  ));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomeTotalV43')).toHaveText('9');
  await expect(page.locator('#outcomeSectorStayStateV80')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#outcomeSectorStayQualityV80')).toHaveText(
    'Completa: 1 • Parcial: 0 • Indisponível: 8'
  );
  await expect(page.locator('#outcomeSectorStayRowsV80 tr')).toHaveCount(3);
  await expect(
    page.locator('#outcomeSectorStayRowsV80 tr').filter({ hasText: 'UTI 1' }).locator('th, td')
  ).toHaveText(['UTI 1', '1', '0 h', '0 h', '0 h']);
});

test('aceita UTI legada canônica e mantém setor percorrido mesmo sem desfecho terminal nele', async ({ admin, page }) => {
  const legacyIntensiveCare = sectorLocation('uti', 'UTI', 'UTI', '101');
  const ward = sectorLocation('enfermaria', 'Enfermaria', '2º andar', '201-1');
  const patientId = 'patient-legacy-uti-to-ward';
  const factId = 'fact-legacy-uti-to-ward';

  await admin.goto(outcomeSeed(
    [
      trackedOutcome({
        id: 'outcome-legacy-uti-to-ward',
        patientId,
        episodeId: `patient_episode_${patientId}`,
        createdAt: serverTimestamp(2, '18:00:00'),
        sectorUnit: ward.sectorUnit,
        sectorName: ward.sectorName,
        unit: ward.unit,
        bed: ward.bed,
        sectorEnteredAt: serverTimestamp(2, '12:00:00'),
        lastSectorTransitionFactId: factId
      })
    ],
    [],
    [
      sectorFact({
        id: factId,
        patientId,
        episodeId: `patient_episode_${patientId}`,
        occurredAt: serverTimestamp(2, '12:00:00'),
        originEnteredAt: serverTimestamp(2, '08:00:00'),
        origin: legacyIntensiveCare,
        destination: ward
      })
    ]
  ));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomeSectorStayQualityV80')).toHaveText(
    'Completa: 1 • Parcial: 0 • Indisponível: 0'
  );
  await expect(
    page.locator('#outcomeSectorStayRowsV80 tr').filter({ hasText: 'UTI (legado)' }).locator('th, td')
  ).toHaveText(['UTI (legado)', '1', '4 h', '4 h', '4 h']);
  await expect(
    page.locator('#outcomeSectorStayRowsV80 tr').filter({ hasText: 'Enfermaria' }).locator('th, td')
  ).toHaveText(['Enfermaria', '1', '6 h', '6 h', '6 h']);

  await page.locator('#outcomeSectorV43').selectOption('uti');
  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#outcomesStateV43')).toContainText(
    'Nenhum Desfecho encerrou no setor selecionado'
  );
  await expect(page.locator('#outcomeTotalV43')).toHaveText('0');
  await expect(page.locator('#outcomeAuditRowsV43 tr')).toHaveCount(1);
  await expect(page.locator('#outcomeAuditRowsV43')).toContainText(
    'Nenhum Desfecho para auditar'
  );
  await expect(page.locator('#outcomeSectorStayRowsV80 tr')).toHaveCount(1);
  await expect(
    page.locator('#outcomeSectorStayRowsV80 tr').filter({ hasText: 'UTI (legado)' }).locator('th, td')
  ).toHaveText(['UTI (legado)', '1', '4 h', '4 h', '4 h']);
});

test('separa óbitos gerais, registro paliativo e cobertura sem inferir legados', async ({ admin, page }) => {
  await admin.goto(outcomeSeed([
    outcome({
      id: 'death-palliative',
      outcomeType: 'death',
      outcomeLabel: 'Óbito',
      primaryIcdCode: 'A41.9',
      palliativeAlertPresentAtOutcome: true
    }),
    outcome({
      id: 'death-without-palliative',
      outcomeType: 'death',
      outcomeLabel: 'Óbito',
      primaryIcdCode: 'J18.9',
      palliativeAlertPresentAtOutcome: false
    }),
    outcome({
      id: 'death-legacy',
      schemaVersion: 1,
      outcomeType: 'death',
      outcomeLabel: 'Óbito',
      primaryIcdCode: 'C34.9'
    }),
    outcome({
      id: 'transferred-palliative',
      outcomeType: 'transferred',
      outcomeLabel: 'Transferência externa',
      palliativeAlertPresentAtOutcome: true
    })
  ]));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomeTotalV43')).toHaveText('4');
  await expect(page.locator('#outcomeDeathsV43')).toHaveText('3');
  await expect(page.locator('#outcomePalliativeDeathsV70')).toHaveText('1');
  await expect(page.locator('#outcomeNonPalliativeDeathsV70')).toHaveText('1');
  await expect(page.locator('#outcomePalliativeDeathShareV70')).toHaveText('Proporção entre óbitos com registro disponível: 50%');
  await expect(page.locator('#outcomePalliativeDeathCoverageV70')).toHaveText('Cobertura do registro: 2/3 óbitos (67%)');
  await expect(page.locator('#outcomeUnknownPalliativeDeathsV70')).toHaveText('1');
  await expect(page.locator('#outcomePalliativeRowsV70')).toContainText('Registro indisponível');
  await expect(page.locator('#outcomePalliativeRowsV70')).toContainText('33%');

  await page.locator('#outcomePalliativeV70').selectOption('registered');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('2');
  await expect(page.locator('#outcomeDeathsV43')).toHaveText('1');

  await page.locator('#outcomeTypeV43').selectOption('death');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('1');
  await expect(page.locator('#outcomeAuditRowsV43 tr')).toHaveCount(1);
  await expect(page.locator('#outcomeAuditRowsV43')).toContainText('Alerta registrado');

  await page.locator('#outcomeTypeV43').selectOption('all');
  await page.locator('#outcomePalliativeV70').selectOption('not-registered');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('1');
  await expect(page.locator('#outcomeAuditRowsV43')).toContainText('Sem alerta registrado');

  await page.locator('#outcomePalliativeV70').selectOption('unknown');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('1');
  await expect(page.locator('#outcomeAuditRowsV43')).toContainText('Registro indisponível');
});

test('mantém denominadores honestos sem registro do alerta ou permanência válida', async ({ admin, page }) => {
  await admin.goto(outcomeSeed([
    outcome({
      id: 'death-legacy-no-los',
      schemaVersion: 1,
      outcomeType: 'death',
      outcomeLabel: 'Óbito',
      primaryIcdCode: 'A41.9',
      admissionDate: 'data-inválida'
    }),
    outcome({
      id: 'treated-no-los',
      outcomeType: 'treated',
      outcomeLabel: 'Alta médica',
      admissionDate: ''
    })
  ]));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomeDeathsV43')).toHaveText('1');
  await expect(page.locator('#outcomePalliativeDeathsV70')).toHaveText('0');
  await expect(page.locator('#outcomeNonPalliativeDeathsV70')).toHaveText('0');
  await expect(page.locator('#outcomeUnknownPalliativeDeathsV70')).toHaveText('1');
  await expect(page.locator('#outcomePalliativeDeathShareV70')).toHaveText('Proporção entre óbitos com registro disponível: —');
  await expect(page.locator('#outcomePalliativeDeathCoverageV70')).toHaveText('Cobertura do registro: 0/1 óbitos (0%)');
  await expect(page.locator('#outcomeAverageLosV43')).toHaveText('—');
  await expect(page.locator('#outcomeMedianLosV43')).toHaveText('—');
  await expect(page.locator('#outcomeAverageCoverageV43')).toHaveText('Cobertura: 0/2 desfechos (0%)');
  await expect(page.locator('#tab-outcomes')).not.toContainText(/NaN|Infinity/);

  await page.locator('#outcomeTypeV43').selectOption('treated');
  await expect(page.locator('#outcomeDeathsV43')).toHaveText('0');
  await expect(page.locator('#outcomePalliativeDeathCoverageV70')).toHaveText('Cobertura do registro: 0/0 óbitos (—)');
  await expect(page.locator('#outcomePalliativeDeathShareV70')).toHaveText('Proporção entre óbitos com registro disponível: —');
});

test('mostra distribuição e permanência segmentada com cobertura parcial', async ({ admin, page }) => {
  const stays = [
    ['stay-1', 'treated', 1],
    ['stay-2', 'treated', 2],
    ['stay-3', 'treated', 3],
    ['stay-4', 'death', 4],
    ['stay-7', 'death', 7],
    ['stay-8', 'transferred', 8],
    ['stay-14', 'death', 14],
    ['stay-15', 'transferred', 15],
    ['stay-30', 'transferred', 30],
    ['stay-31', 'transferred', 31]
  ] as const;
  const projected = stays.map(([id, type, stay]) => outcome({
    id,
    outcomeType: type,
    outcomeLabel: type === 'death' ? 'Óbito' : type === 'transferred' ? 'Transferência externa' : 'Alta médica',
    createdAt: serverTimestamp(2),
    admissionDate: isoDay(2 + stay - 1),
    primaryIcdCode: type === 'death' ? 'A41.9' : ''
  }));
  projected.push(
    outcome({
      id: 'stay-future',
      createdAt: serverTimestamp(2),
      admissionDate: isoDay(1)
    }),
    outcome({
      id: 'stay-invalid',
      createdAt: serverTimestamp(2),
      admissionDate: 'data-inválida'
    }),
    outcome({
      id: 'stay-suffixed',
      createdAt: serverTimestamp(2),
      admissionDate: `${isoDay(2)}XYZ`
    }),
    outcome({
      id: 'stay-impossible',
      createdAt: serverTimestamp(2),
      admissionDate: '2026-02-31'
    })
  );

  await admin.goto(outcomeSeed(projected));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomeAverageLosV43')).toHaveText('11,5 dias');
  await expect(page.locator('#outcomeMedianLosV43')).toHaveText('7,5 dias');
  await expect(page.locator('#outcomeAverageCoverageV43')).toHaveText('Cobertura: 10/14 desfechos (71%)');
  await expect(page.locator('#outcomeLosRowsV70 tr')).toHaveCount(6);
  await expect(page.locator('#outcomeLosRowsV70 tr').nth(0).locator('th, td')).toHaveText(['1 dia', '1', '10%']);
  await expect(page.locator('#outcomeLosRowsV70 tr').nth(1).locator('th, td')).toHaveText(['2–3 dias', '2', '20%']);
  await expect(page.locator('#outcomeLosRowsV70 tr').nth(2).locator('th, td')).toHaveText(['4–7 dias', '2', '20%']);
  await expect(page.locator('#outcomeLosRowsV70 tr').nth(3).locator('th, td')).toHaveText(['8–14 dias', '2', '20%']);
  await expect(page.locator('#outcomeLosRowsV70 tr').nth(4).locator('th, td')).toHaveText(['15–30 dias', '2', '20%']);
  await expect(page.locator('#outcomeLosRowsV70 tr').nth(5).locator('th, td')).toHaveText(['31 dias ou mais', '1', '10%']);
  await expect(page.locator('#outcomeLosByTypeRowsV70 tr')).toHaveCount(3);
  await expect(page.locator('#outcomeLosByTypeRowsV70 tr').nth(0).locator('th, td')).toHaveText(['Alta médica', '7', '2 dias', '2 dias', '3/7 (43%)']);
  await expect(page.locator('#outcomeLosByTypeRowsV70 tr').nth(1).locator('th, td')).toHaveText(['Óbito', '3', '8,3 dias', '7 dias', '3/3 (100%)']);
  await expect(page.locator('#outcomeLosByTypeRowsV70 tr').nth(2).locator('th, td')).toHaveText(['Transferência externa', '4', '21 dias', '22,5 dias', '4/4 (100%)']);

  const chartConfigs = await page.evaluate(() => {
    const harness = (window as typeof window & {
      __adminAssetTestHarness: {
        ChartTestDouble: {
          instances: Array<{
            canvasId: string;
            config: { type: string; data: { labels: string[]; datasets: Array<{ data: number[] }> } };
            destroyed: boolean;
          }>;
        };
      };
    }).__adminAssetTestHarness;
    return Object.fromEntries(
      harness.ChartTestDouble.instances
        .filter(instance => !instance.destroyed && instance.canvasId.startsWith('outcome'))
        .map(instance => [instance.canvasId, instance.config])
    );
  });
  expect(chartConfigs.outcomeLosChartV70.type).toBe('bar');
  expect(chartConfigs.outcomeLosChartV70.data.labels).toEqual([
    '1 dia', '2–3 dias', '4–7 dias', '8–14 dias', '15–30 dias', '31 dias ou mais'
  ]);
  expect(chartConfigs.outcomeLosChartV70.data.datasets[0].data).toEqual([1, 2, 2, 2, 2, 1]);
  expect(chartConfigs.outcomeCidChartV70.data.datasets[0].data).toEqual([0]);
  expect(chartConfigs.outcomeCidChartV70.data.datasets[1].data).toEqual([3]);
  expect(chartConfigs.outcomeCidChartV70.data.datasets[2].data).toEqual([0]);
  expect(chartConfigs.outcomePalliativeChartV70.data.labels).toEqual(['Sem alerta Paliativo registrado']);
  expect(chartConfigs.outcomePalliativeChartV70.data.datasets[0].data).toEqual([3]);

  for(const outcomeId of ['stay-suffixed', 'stay-impossible']){
    const auditCells = page
      .locator('#outcomeAuditRowsV43 tr')
      .filter({ hasText: `patient_outcome_${outcomeId}` })
      .locator('th, td');
    await expect(auditCells.nth(6)).toHaveText('—');
    await expect(auditCells.nth(7)).toHaveText('—');
  }

  await page.evaluate(() => {
    (window as typeof window & { Chart?: unknown }).Chart = undefined;
    window.eval('renderOutcomesV43()');
  });
  await expect(page.locator('#outcomePalliativeChartFallbackV70')).toBeVisible();
  await expect(page.locator('#outcomeLosChartFallbackV70')).toBeVisible();
  await expect(page.locator('#outcomeCidChartFallbackV70')).toBeVisible();
  await expect(page.locator('#outcomeSectorStayChartFallbackV80')).toBeVisible();
  await expect(page.locator('#outcomeLosRowsV70 tr')).toHaveCount(6);

  await page.evaluate(() => {
    (window as typeof window & { Chart?: unknown }).Chart = class {
      constructor(){ throw new Error('Falha fictícia do construtor'); }
    };
    window.eval('renderOutcomesV43()');
  });
  await expect(page.locator('#outcomePalliativeChartFallbackV70')).toBeVisible();
  await expect(page.locator('#outcomeLosChartFallbackV70')).toBeVisible();
  await expect(page.locator('#outcomeCidChartFallbackV70')).toBeVisible();
  await expect(page.locator('#outcomeSectorStayChartFallbackV80')).toBeVisible();
  await expect(page.locator('#outcomeAverageLosV43')).toHaveText('11,5 dias');
  await expect(page.locator('#outcomeLosRowsV70 tr').nth(4).locator('th, td')).toHaveText(['15–30 dias', '2', '20%']);
});

test('distingue projeção vazia e ignora schema 3 incompleto e tipos desconhecidos', async ({ admin, page }) => {
  await admin.goto(outcomeSeed([
    outcome({ id: 'unknown-schema-only', schemaVersion: 3 }),
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

test('falha dos fatos bloqueia somente permanência por setor', async ({ admin, page }) => {
  await admin.goto({
    ...outcomeSeed([
      outcome({
        id: 'outcome-with-sector-facts-unavailable',
        primaryIcdCode: 'A41.9'
      })
    ]),
    readFailures: [{
      pathIncludes: 'admin_sector_transitions',
      code: 'unavailable',
      message: 'Falha controlada nos fatos setoriais.'
    }]
  });
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#outcomesResultsV43')).toBeVisible();
  await expect(page.locator('#outcomeTotalV43')).toHaveText('1');
  await expect(page.locator('#outcomeCidRowsV43')).toContainText('A41.9');
  await expect(page.locator('#outcomeSectorStayStateV80')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#outcomeSectorStayStateV80')).toContainText(
    'Somente a permanência por setor foi bloqueada'
  );
  await expect(page.locator('#outcomeSectorStayResultsV80')).toBeHidden();
});

test('truncamento dos fatos bloqueia somente permanência por setor', async ({ admin, page }) => {
  const adminSectorTransitions = Array.from({ length: 5001 }, (_, index) => ({
    id: `fact-truncated-${String(index).padStart(4, '0')}`,
    occurredAt: serverTimestamp(2, '12:00:00')
  }));
  await admin.goto(outcomeSeed([
    outcome({
      id: 'outcome-with-truncated-sector-facts',
      primaryIcdCode: 'J18.9'
    })
  ], [], adminSectorTransitions));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('1');
  await expect(page.locator('#outcomeSectorStayStateV80')).toHaveAttribute('data-state', 'truncated');
  await expect(page.locator('#outcomeSectorStayStateV80')).toContainText(
    'Somente a permanência por setor foi bloqueada'
  );
  await expect(page.locator('#outcomeSectorStayResultsV80')).toBeHidden();
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
  await expect(page.locator('#outcomeCidRowsV43')).toContainText('Nenhum CID principal em formato esperado');
  await expect(page.locator('#outcomeCidQualityV70')).toHaveText('Cobertura: 0/1 desfechos (0%)');
  expect(await page.evaluate(() => (
    window as typeof window & { __xssTriggered: boolean }
  ).__xssTriggered)).toBe(false);
});

test('limpa filtros históricos ao encerrar a sessão administrativa', async ({ admin, page }) => {
  await admin.goto(outcomeSeed(representativeOutcomes()));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();
  await page.locator('#outcomeTypeV43').selectOption('death');
  await page.locator('#outcomePalliativeV70').selectOption('registered');
  await page.locator('#outcomeCidV80').selectOption('A41.9');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('1');

  await admin.signOutButton.click();
  await expect(admin.accessPanel).toBeVisible();
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomeTypeV43')).toHaveValue('all');
  await expect(page.locator('#outcomePalliativeV70')).toHaveValue('all');
  await expect(page.locator('#outcomeCidV80')).toHaveValue('all');
  await expect(page.locator('#outcomeTotalV43')).toHaveText('4');
});

test('pagina a auditoria em lotes de 50 sem renderizar milhares de linhas de uma vez', async ({ admin, page }) => {
  const adminOutcomes = Array.from({ length: 105 }, (_, index) => {
    const minute = Math.floor(index / 60);
    const second = index % 60;
    return outcome({
      id: `audit-${String(index).padStart(3, '0')}`,
      patientName: `PACIENTE FICTÍCIO AUDITORIA ${String(index).padStart(3, '0')}`,
      createdAt: serverTimestamp(
        1,
        `12:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
      )
    });
  });
  await admin.goto(outcomeSeed(adminOutcomes));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="outcomes"]').click();

  const rows = page.locator('#outcomeAuditRowsV43 tr');
  const visiblePatients = () => rows.locator('th[scope="row"]').allTextContents();
  const patientLabel = (index: number) => (
    `PACIENTE FICTÍCIO AUDITORIA ${String(index).padStart(3, '0')}`
  );
  await expect(rows).toHaveCount(50);
  await expect(page.locator('#outcomeAuditPageStatusV70')).toHaveText('1–50 de 105 Desfechos • Página 1 de 3');
  expect(await visiblePatients()).toEqual(
    Array.from({ length: 50 }, (_, index) => patientLabel(104 - index))
  );
  await expect(page.locator('#outcomeAuditPrevV70')).toBeDisabled();
  await expect(page.locator('#outcomeAuditNextV70')).toBeEnabled();

  await page.locator('#outcomeAuditNextV70').click();
  await expect(rows).toHaveCount(50);
  await expect(page.locator('#outcomeAuditPageStatusV70')).toHaveText('51–100 de 105 Desfechos • Página 2 de 3');
  expect(await visiblePatients()).toEqual(
    Array.from({ length: 50 }, (_, index) => patientLabel(54 - index))
  );

  await page.locator('#outcomeAuditNextV70').click();
  await expect(rows).toHaveCount(5);
  await expect(page.locator('#outcomeAuditPageStatusV70')).toHaveText('101–105 de 105 Desfechos • Página 3 de 3');
  expect(await visiblePatients()).toEqual(
    Array.from({ length: 5 }, (_, index) => patientLabel(4 - index))
  );
  await expect(page.locator('#outcomeAuditNextV70')).toBeDisabled();
  await expect(page.locator('#outcomeAuditPrevV70')).toBeEnabled();

  await page.locator('#outcomeAuditPrevV70').click();
  await expect(page.locator('#outcomeAuditPageStatusV70')).toHaveText('51–100 de 105 Desfechos • Página 2 de 3');
  expect(await visiblePatients()).toEqual(
    Array.from({ length: 50 }, (_, index) => patientLabel(54 - index))
  );
});
