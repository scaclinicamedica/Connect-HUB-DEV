import { test, expect } from '../support/admin-fixture';

test('aba Desfechos permanece utilizável e contida em toda a matriz responsiva', async ({ admin, page }) => {
  const email = 'admin.desfechos.responsivo@example.test';
  const password = 'senha-ficticia-responsiva';
  const uid = 'fixture-admin-outcomes-responsive';
  const date = new Date();
  date.setDate(date.getDate() - 2);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const day = `${values.year}-${values.month}-${values.day}`;
  const adminOutcomes = Array.from({ length: 12 }, (_, index) => {
    const outcomeType = index % 3 === 0
      ? 'death'
      : index % 3 === 1
        ? 'treated'
        : 'transferred';
    return {
      id: `outcome-responsive-${index}`,
      schemaVersion: 2,
      sourceVersion: 'fixture-v2',
      type: 'patient_outcome_admin',
      outcomeType,
      outcomeLabel: outcomeType === 'death'
        ? 'Óbito'
        : outcomeType === 'treated'
          ? 'Alta médica'
          : 'Transferência externa',
      createdAt: {
        __testTimestamp: true,
        iso: `${day}T${String(10 + (index % 10)).padStart(2, '0')}:00:00-03:00`
      },
      patientId: `patient-responsive-${index}`,
      patientName: `PACIENTE FICTÍCIO COM NOME EXTENSO PARA TESTE RESPONSIVO ${index}`,
      sectorUnit: index % 2 ? 'observacao_sus' : 'uti',
      sectorName: index % 2 ? 'Observação SUS' : 'UTI',
      specialty: index % 2 ? 'Clínica Médica com descrição extensa' : 'Cardiologia',
      admissionDate: day,
      lengthOfStayDays: 1,
      lengthOfStayMethod: 'inclusive_calendar_days',
      responsibleDoctor: 'DRA. FICTÍCIA COM NOME EXTENSO',
      primaryIcdCode: outcomeType === 'death'
        ? ['A41.9', 'J18.9', 'C34.9'][Math.floor(index / 3) % 3]
        : '',
      palliativeAlertPresentAtOutcome: index % 2 === 0,
      actorUid: uid
    };
  });
  const trackedPatientId = 'patient-responsive-tracked';
  const trackedEpisodeId = `patient_episode_${trackedPatientId}`;
  const trackedFactId = 'fact-responsive-emergency-to-ward';
  const trackedSourceVersion =
    'FOUNDATION-1.0-RC1.3.3-OUTCOME-NOSOLOGY-SECTOR-LOS';
  adminOutcomes.push({
    id: 'outcome-responsive-tracked',
    schemaVersion: 3,
    sourceVersion: trackedSourceVersion,
    type: 'patient_outcome_admin',
    outcomeType: 'treated',
    outcomeLabel: 'Alta médica',
    createdAt: {
      __testTimestamp: true,
      iso: `${day}T18:00:00-03:00`
    },
    patientId: trackedPatientId,
    patientName: 'PACIENTE FICTÍCIO COM PERMANÊNCIA SETORIAL RESPONSIVA',
    sectorUnit: 'enfermaria',
    sectorName: 'Enfermaria',
    unit: '2º andar',
    bed: '201-1',
    specialty: 'Clínica Médica',
    admissionDate: day,
    lengthOfStayDays: 1,
    lengthOfStayMethod: 'inclusive_calendar_days',
    responsibleDoctor: 'DRA. FICTÍCIA',
    primaryIcdCode: 'I10',
    palliativeAlertPresentAtOutcome: false,
    actorUid: uid,
    sectorTrackingVersion: 1,
    episodeId: trackedEpisodeId,
    sectorTrackingOrigin: 'initial_entry',
    lastSectorTransitionFactId: trackedFactId,
    sectorEnteredAt: {
      __testTimestamp: true,
      iso: `${day}T12:00:00-03:00`
    }
  });
  const adminSectorTransitions = [{
    id: trackedFactId,
    schemaVersion: 1,
    sourceVersion: trackedSourceVersion,
    type: 'patient_sector_transition_admin',
    factId: trackedFactId,
    episodeId: trackedEpisodeId,
    patientId: trackedPatientId,
    occurredAt: {
      __testTimestamp: true,
      iso: `${day}T12:00:00-03:00`
    },
    actorUid: uid,
    predecessorFactId: '',
    movementClassification: 'sector_transfer',
    trackingOrigin: 'initial_entry',
    originEnteredAt: {
      __testTimestamp: true,
      iso: `${day}T08:00:00-03:00`
    },
    origin: {
      catalogVersion: 1,
      canonicalSectorId: 'emergencia',
      sectorUnit: 'emergencia',
      sectorName: 'Emergência',
      unit: '',
      bed: 'Maca 01'
    },
    destination: {
      catalogVersion: 1,
      canonicalSectorId: 'enfermaria',
      sectorUnit: 'enfermaria',
      sectorName: 'Enfermaria',
      unit: '2º andar',
      bed: '201-1'
    }
  }];

  await admin.goto({
    adminAccounts: [{ uid, email, password }],
    adminUsers: [{ id: uid, active: true, role: 'coordinator' }],
    patientsByUnit: {},
    historyEvents: [],
    adminOutcomes,
    adminSectorTransitions
  });
  await admin.loginAsAuthorized(email, password);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#outcomesResultsV43')).toBeVisible();
  await expect(page.locator('#outcomeAuditRowsV43 tr')).toHaveCount(13);
  await expect(page.locator('#outcomeStartV43')).toBeVisible();
  await expect(page.locator('#outcomeTypeV43')).toBeVisible();
  await expect(page.locator('#outcomeSectorStayStateV80')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#outcomeSectorStayQualityV80')).toHaveText(
    'Completa: 1 • Parcial: 0 • Indisponível: 12'
  );
  await expect(page.locator('#outcomeSectorStayResultsV80')).toBeVisible();
  await expect(
    page.locator('#outcomeSectorStayRowsV80 tr').filter({ hasText: 'Emergência' }).locator('th, td')
  ).toHaveText(['Emergência', '1', '4 h', '4 h', '4 h']);
  await expect(
    page.locator('#outcomeSectorStayRowsV80 tr').filter({ hasText: 'Enfermaria' }).locator('th, td')
  ).toHaveText(['Enfermaria', '1', '6 h', '6 h', '6 h']);
  const sectorChart = await page.evaluate(() => {
    const instances = (
      window as typeof window & {
        __adminAssetTestHarness: {
          ChartTestDouble: {
            instances: Array<{
              canvasId: string;
              destroyed: boolean;
              config: {
                type: string;
                data: {
                  labels: string[];
                  datasets: Array<{ label: string; data: number[] }>;
                };
                options: { indexAxis: string };
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
  expect(sectorChart?.type).toBe('bar');
  expect(sectorChart?.options.indexAxis).toBe('y');
  expect(sectorChart?.data.datasets.map(dataset => dataset.label)).toEqual([
    'Média (horas)', 'Mediana (horas)'
  ]);
  const sectorChartValues = Object.fromEntries(
    (sectorChart?.data.labels || []).map((label, index) => [
      label,
      sectorChart?.data.datasets.map(dataset => dataset.data[index])
    ])
  );
  expect(sectorChartValues).toEqual({
    Enfermaria: [6, 6],
    Emergência: [4, 4]
  });

  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
  await expect.poll(() => page.evaluate(() => (
    [...document.querySelectorAll('.outcomes-card-v43')].every(card => {
      const rect = card.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
    })
  ))).toBe(true);

  const viewportWidth = page.viewportSize()?.width || 0;
  for(const selector of ['#outcomeStartV43', '#outcomeEndV43', '#outcomeSectorV43', '#outcomeSpecialtyV43', '#outcomeTypeV43', '#outcomePalliativeV70', '#outcomeCidV80']){
    const box = await page.locator(selector).boundingBox();
    expect(box, `${selector} deve permanecer visível`).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
  }

  const auditViewport = await page.locator('#outcomeAuditRowsV43').locator('xpath=ancestor::div[contains(@class,"table-wrap")]').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    documentWidth: document.documentElement.clientWidth
  }));
  expect(auditViewport.clientWidth).toBeLessThanOrEqual(auditViewport.documentWidth);
  expect(auditViewport.scrollWidth).toBeGreaterThan(auditViewport.clientWidth);
  expect(await page.locator('#outcomeAuditRowsV43').locator('xpath=ancestor::div[contains(@class,"table-wrap")]').evaluate(element => {
    element.scrollLeft = element.scrollWidth;
    return element.scrollLeft > 0;
  })).toBe(true);
});
