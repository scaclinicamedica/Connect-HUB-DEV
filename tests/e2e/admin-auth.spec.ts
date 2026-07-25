import { readFile } from 'node:fs/promises';
import { test, expect } from '../support/admin-fixture';
import type { AdminSeed } from '../support/admin-page';

const ADMIN_EMAIL = 'admin.ficticio@example.test';
const ADMIN_PASSWORD = 'senha-ficticia-segura';
const ADMIN_UID = 'fixture-admin-user';
const CLINICAL_UID = 'fixture-clinical-user';
const CLINICAL_EMAIL = 'clinician.ficticio@example.test';
const adminHtml = await readFile(new URL('../../area_administrativa.html', import.meta.url), 'utf8');
const passagemHtml = await readFile(new URL('../../passagem.html', import.meta.url), 'utf8');

function timestamp(iso: string){
  return { __testTimestamp: true, iso };
}

function authorizedSeed(overrides: Partial<AdminSeed> = {}): AdminSeed {
  return {
    initialAuthUser: {
      uid: CLINICAL_UID,
      email: CLINICAL_EMAIL,
      isAnonymous: false
    },
    adminAccounts: [
      { uid: ADMIN_UID, email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    ],
    adminUsers: [
      { id: ADMIN_UID, active: true, role: 'admin' }
    ],
    patientsByUnit: {
      emergencia: [
        {
          id: 'patient-admin-1',
          name: 'PACIENTE FICTÍCIO ADMIN',
          bed: 'Leito 01',
          severity: 'Crítico',
          dischargeForecast: '2099-12-31'
        }
      ]
    },
    historyEvents: [
      {
        id: 'history-admin-1',
        type: 'patient_created',
        patientName: 'PACIENTE FICTÍCIO ADMIN',
        createdAt: timestamp('2026-07-24T13:00:00Z')
      }
    ],
    adminOutcomes: [],
    ...overrides
  };
}

test('mantém dependências administrativas fixadas e remove o acesso por código local', async () => {
  expect(adminHtml).toContain('chart.js@4.4.3/dist/chart.umd.js');
  expect(adminHtml).toContain('sha384-tgbB5AKnszdcfwcZtTfuhR3Ko1XZdlDfsLtkxiiAZiVkkXCkFmp+FQFh+V/UTo54');
  expect(adminHtml).toContain('xlsx@0.18.5/dist/xlsx.full.min.js');
  expect(adminHtml).toContain('sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw');
  expect(adminHtml).not.toContain('SCACM2026');
  expect(adminHtml).not.toContain('sessionStorage');
  expect(adminHtml).not.toContain('signInAnonymously');
  expect(adminHtml).toContain("ADMIN_FIREBASE_APP_NAME = 'connect-hub-admin'");
  expect(adminHtml).toContain(".collection('historico_eventos')");
  expect(adminHtml).toContain(".where('type','!=','patient_outcome')");
  expect(adminHtml).not.toContain("db.collection('historico_eventos').orderBy(");
  expect(adminHtml).toContain(".collection('admin_outcomes')");
  expect(adminHtml).toContain(".orderBy('createdAt','desc')");
  expect(passagemHtml).not.toContain('SCACM2026');
  expect(passagemHtml).not.toContain('ADMIN_HISTORY_CODE');
  expect(passagemHtml).toContain("location.href='./area_administrativa.html'");
});

test('autoriza somente o perfil administrativo e preserva a sessão clínica nominal separada', async ({ admin, page }) => {
  await admin.goto(authorizedSeed());
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);

  await expect(page.locator('#adminDashboardTitle')).toBeFocused();
  await expect(page.locator('#metricPatients')).toHaveText('1');
  await expect(page.locator('#metricCritical')).toHaveText('1');

  const reads = await admin.firebaseReads();
  expect(reads.some(read => read.path === `admin_users/${ADMIN_UID}`)).toBe(true);
  expect(reads.some(read => read.path === 'historico_eventos')).toBe(true);
  expect(reads.some(read => read.path === 'admin_outcomes')).toBe(true);
  for(const sector of ['emergencia','observacao_sus','convenio','enfermaria','uti','uti_1','uti_2']){
    expect(reads.some(read => read.path === `connect_hub_v55/${sector}/pacientes`)).toBe(true);
  }
  expect(await admin.firebaseWrites()).toEqual([]);
  expect(await page.evaluate(() => (
    window as typeof window & {
      __firebaseTestHarness: { authLog(): Array<Record<string, unknown>> };
    }
  ).__firebaseTestHarness.authLog())).toContainEqual({
    operation: 'setPersistence',
    appName: 'connect-hub-admin',
    value: 'session'
  });

  const signedInState = await admin.authState();
  expect(signedInState['[DEFAULT]']?.uid).toBe(CLINICAL_UID);
  expect(signedInState['[DEFAULT]']?.isAnonymous).toBe(false);
  expect(signedInState['connect-hub-admin']?.uid).toBe(ADMIN_UID);

  await admin.signOutButton.click();
  await expect(admin.accessPanel).toBeVisible();
  await expect(admin.adminContent).toBeHidden();
  await expect(page.locator('#adminEmail')).toBeFocused();
  await expect(page.locator('#metricPatients')).toHaveText('0');
  expect(await page.evaluate(() => window.eval(
    '({patients: allPatients.length, history: allHistoryEventsV41.length, outcomes: allOutcomeEventsV43.length})'
  ))).toEqual({ patients: 0, history: 0, outcomes: 0 });

  const signedOutState = await admin.authState();
  expect(signedOutState['[DEFAULT]']?.uid).toBe(CLINICAL_UID);
  expect(signedOutState['[DEFAULT]']?.isAnonymous).toBe(false);
  expect(signedOutState['connect-hub-admin']).toBeNull();
});

test('mantém sessão, dados e painel ativos quando signOut falha', async ({ admin, page }) => {
  await admin.goto(authorizedSeed());
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page.locator('#metricPatients')).toHaveText('1');

  await page.evaluate(() => {
    const firebaseHarness = (window as typeof window & {
      firebase: {
        apps: Array<{
          name: string;
          auth(): { signOut(): Promise<void> };
        }>;
      };
    }).firebase;
    const adminApp = firebaseHarness.apps.find(app => app.name === 'connect-hub-admin');
    if(!adminApp)throw new Error('Aplicativo Firebase administrativo não encontrado.');
    adminApp.auth().signOut = async () => {
      throw new Error('Falha controlada ao encerrar a sessão.');
    };
  });

  await admin.signOutButton.click();

  await expect(admin.adminContent).toBeVisible();
  await expect(admin.accessPanel).toBeHidden();
  await expect(admin.signOutButton).toBeEnabled();
  await expect(admin.signOutButton).toHaveText('Sair');
  await expect(page.locator('#adminSessionError')).toBeVisible();
  await expect(page.locator('#adminSessionError')).toContainText('permanece ativa');
  await expect(page.locator('#syncStatus')).toHaveText('Sessão administrativa permanece ativa.');
  await expect(page.locator('#metricPatients')).toHaveText('1');

  expect((await admin.authState())['connect-hub-admin']?.uid).toBe(ADMIN_UID);
  expect(await page.evaluate(() => window.eval(`({
    authorizedUid: authorizedAdmin?.uid,
    patients: allPatients.length,
    history: allHistoryEventsV41.length,
    outcomes: allOutcomeEventsV43.length
  })`))).toEqual({
    authorizedUid: ADMIN_UID,
    patients: 1,
    history: 1,
    outcomes: 0
  });
});

test('inclui o setor legado UTI nas consultas e nos totais administrativos', async ({ admin, page }) => {
  await admin.goto(authorizedSeed({
    patientsByUnit: {
      uti: [{
        id: 'patient-legacy-uti',
        name: 'PACIENTE FICTÍCIO UTI LEGADA',
        bed: 'Leito legado',
        severity: 'Estável'
      }]
    }
  }));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);

  await expect(page.locator('#metricPatients')).toHaveText('1');
  await expect(page.locator('#dashboardSummaryRowsV40')).toContainText('UTI (legado)');
  await expect(page.locator('#sectorOccupancy')).toContainText('UTI (legado)');
  await page.locator('#dashboardSectorFilter').selectOption('uti');
  await expect(page.locator('#dashboardSummaryRowsV40 tr').filter({ hasText: 'UTI (legado)' })).toContainText('1');

  const reads = await admin.firebaseReads();
  expect(reads.some(read => read.path === 'connect_hub_v55/uti/pacientes')).toBe(true);
});

test('nega conta autenticada sem perfil administrativo ativo antes de ler pacientes', async ({ admin }) => {
  await admin.goto(authorizedSeed({
    adminUsers: [
      { id: ADMIN_UID, active: false, role: 'admin' }
    ]
  }));
  await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);

  await expect(admin.accessDenied).toBeVisible();
  await expect(admin.accessDenied).toContainText('não possui um perfil administrativo ativo');
  await expect(admin.adminContent).toBeHidden();

  const reads = await admin.firebaseReads();
  expect(reads.some(read => read.path === `admin_users/${ADMIN_UID}`)).toBe(true);
  expect(reads.some(read => String(read.path).includes('/pacientes'))).toBe(false);
  expect(reads.some(read => read.path === 'historico_eventos')).toBe(false);
  expect(reads.some(read => read.path === 'admin_outcomes')).toBe(false);

  const authState = await admin.authState();
  expect(authState['[DEFAULT]']?.uid).toBe(CLINICAL_UID);
  expect(authState['connect-hub-admin']).toBeNull();
});

test('escapa conteúdo persistido antes de renderizá-lo no contexto privilegiado', async ({ admin, page }) => {
  const payload = '<img src=x onerror="window.__xssTriggered=true">';
  await admin.goto(authorizedSeed({
    patientsByUnit: {
      emergencia: [
        {
          id: 'patient-xss',
          name: payload,
          bed: 'Leito 01',
          counterflowDate: payload,
          migratedFromName: payload
        }
      ]
    },
    historyEvents: [
      {
        id: 'history-xss',
        type: 'patient_updated',
        patientName: payload,
        actor: payload,
        createdAt: timestamp('2026-07-24T13:00:00Z')
      }
    ]
  }));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.locator('button[data-tab="counterflow"]').click();
  await expect(page.locator('#counterflowRows')).toContainText('<img');
  await expect(page.locator('#counterflowRows img')).toHaveCount(0);
  await expect(page.locator('#bedMaps img')).toHaveCount(0);
  await page.locator('button[data-tab="reports"]').click();
  await page.locator('#reportTypeV40').selectOption('custom');
  await page.locator('#reportStartV40').fill('2026-07-01');
  await page.locator('#reportEndV40').fill('2026-07-31');
  await page.getByRole('button', { name: 'Gerar relatório' }).click();
  await expect(page.locator('#reportPreviewV40')).toContainText('<img');
  await expect(page.locator('#reportPreviewV40 img')).toHaveCount(0);
  expect(await page.evaluate(() => (
    window as typeof window & { __xssTriggered: boolean }
  ).__xssTriggered)).toBe(false);
});

test('mantém dados atuais, mas bloqueia relatório e exportações quando o histórico falha', async ({ admin, page }) => {
  await admin.goto(authorizedSeed({
    readFailures: [
      {
        pathIncludes: 'historico_eventos',
        code: 'unavailable',
        message: 'Histórico indisponível no teste.'
      }
    ]
  }));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);

  await expect(page.locator('#metricPatients')).toHaveText('1');
  await expect(page.locator('#syncStatus')).toContainText('histórico está temporariamente indisponível');
  await page.locator('button[data-tab="reports"]').click();
  await page.getByRole('button', { name: 'Gerar relatório' }).click();
  await expect(page.locator('#reportPreviewV40 [role="alert"]')).toContainText('Não foi possível carregar o histórico');

  await page.getByRole('button', { name: 'Exportar Excel' }).last().click();
  await page.getByRole('button', { name: 'Exportar PDF' }).last().click();
  expect(await page.evaluate(() => {
    const harness = (window as typeof window & {
      __adminAssetTestHarness: { workbookWrites: string[]; printInvocations: number };
    });
    return {
      workbookWrites: harness.__adminAssetTestHarness.workbookWrites,
      printInvocations: harness.__adminAssetTestHarness.printInvocations,
      lastReportData: window.eval('lastReportDataV40')
    };
  })).toEqual({
    workbookWrites: [],
    printInvocations: 0,
    lastReportData: null
  });
});

test('mantém o resumo disponível quando a biblioteca de gráficos falha', async ({ admin, page }) => {
  await admin.goto(authorizedSeed());
  await page.evaluate(() => {
    Object.defineProperty(window, 'Chart', {
      configurable: true,
      value: class {
        constructor(){ throw new Error('Falha controlada do gráfico.'); }
      }
    });
  });
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);

  await expect(page.locator('#dashboardSummaryRowsV40 tr')).toHaveCount(7);
  await expect(page.locator('#dashboardSummaryRowsV40')).toContainText('Emergência');
  await expect(page.locator('#dashboardSummaryRowsV40')).toContainText('1');
  await page.locator('#dashboardSectorFilter').selectOption('emergencia');
  await expect(page.locator('#dashboardSummaryRowsV40 tr')).toHaveCount(7);
  await expect(page.locator('#metricPatients')).toHaveText('1');
});

test('preserva período e relatório ao alternar abas', async ({ admin, page }) => {
  await admin.goto(authorizedSeed());
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.locator('button[data-tab="reports"]').click();
  await page.locator('#reportTypeV40').selectOption('custom');
  await page.locator('#reportStartV40').fill('2026-07-01');
  await page.locator('#reportEndV40').fill('2026-07-31');
  await page.getByRole('button', { name: 'Gerar relatório' }).click();
  await expect(page.locator('#reportPreviewV40')).toContainText('Relatório histórico');

  await page.locator('button[data-tab="dashboard"]').click();
  await page.locator('button[data-tab="reports"]').click();
  await expect(page.locator('#reportStartV40')).toHaveValue('2026-07-01');
  await expect(page.locator('#reportEndV40')).toHaveValue('2026-07-31');
  await expect(page.locator('#reportPreviewV40')).toContainText('Relatório histórico');
});

test('relatório histórico usa createdAt do servidor e ignora relógios locais sem timestamp', async ({ admin, page }) => {
  await admin.goto(authorizedSeed({
    historyEvents: [
      {
        id: 'history-authoritative',
        type: 'patient_updated',
        patientName: 'PACIENTE COM DATA AUTORITATIVA',
        createdAt: timestamp('2026-07-24T13:00:00Z'),
        createdAtLocal: '2026-06-01T00:00:00-03:00',
        dateLocal: '2026-06-01'
      },
      {
        id: 'history-without-server-time',
        type: 'patient_updated',
        patientName: 'PACIENTE SEM DATA AUTORITATIVA',
        createdAtLocal: '2026-07-24T10:00:00-03:00',
        dateLocal: '2026-07-24'
      }
    ]
  }));
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.locator('button[data-tab="reports"]').click();
  await page.locator('#reportTypeV40').selectOption('custom');
  await page.locator('#reportStartV40').fill('2026-07-24');
  await page.locator('#reportEndV40').fill('2026-07-24');
  await page.getByRole('button', { name: 'Gerar relatório' }).click();

  await expect(page.locator('#reportPreviewV40')).toContainText('PACIENTE COM DATA AUTORITATIVA');
  await expect(page.locator('#reportPreviewV40')).toContainText('10:00:00');
  await expect(page.locator('#reportPreviewV40')).not.toContainText('PACIENTE SEM DATA AUTORITATIVA');
  expect(await page.evaluate(() => window.eval(
    'allHistoryEventsV41.every(event => !("createdAtLocal" in event) && !("dateLocal" in event))'
  ))).toBe(true);
});

test('detecta histórico truncado e impede métricas incompletas', async ({ admin, page }) => {
  const historyEvents = Array.from({ length: 5001 }, (_, index) => ({
    id: `history-${String(index).padStart(4, '0')}`,
    type: 'patient_updated',
    patientName: `PACIENTE FICTÍCIO ${index}`,
    createdAt: timestamp('2026-07-24T13:00:00Z')
  }));
  await admin.goto(authorizedSeed({ historyEvents }));
  await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);

  await expect(admin.adminContent).toBeVisible();
  await expect(page.locator('#syncStatus')).toContainText('excede o limite seguro de 5.000 eventos');
  await page.locator('button[data-tab="reports"]').click();
  await page.getByRole('button', { name: 'Gerar relatório' }).click();
  await expect(page.locator('#reportPreviewV40 [role="alert"]')).toContainText('excede 5.000 eventos');
  expect(await page.evaluate(() => window.eval('lastReportDataV40'))).toBeNull();
});

test('rejeita credencial inválida sem consultar qualquer dado administrativo', async ({ admin, page }) => {
  await admin.goto(authorizedSeed());
  await admin.login(ADMIN_EMAIL, 'senha-incorreta');

  await expect(admin.accessError).toContainText('E-mail ou senha inválidos');
  await expect(page.locator('#adminPassword')).toHaveValue('');
  await expect(page.locator('#adminPassword')).toBeFocused();
  expect(await admin.firebaseReads()).toEqual([]);
  await expect(admin.adminContent).toBeHidden();
});

test('rejeita perfil ativo com papel não administrativo', async ({ admin }) => {
  await admin.goto(authorizedSeed({
    adminUsers: [
      { id: ADMIN_UID, active: true, role: 'clinician' }
    ]
  }));
  await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);

  await expect(admin.accessDenied).toContainText('não possui um perfil administrativo ativo');
  await expect(admin.adminContent).toBeHidden();
  const reads = await admin.firebaseReads();
  expect(reads.map(read => read.path)).toEqual([`admin_users/${ADMIN_UID}`]);
});

test('invalida relatório anterior se uma atualização perder acesso ao histórico', async ({ admin, page }) => {
  await admin.goto(authorizedSeed());
  await admin.loginAsAuthorized(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.locator('button[data-tab="reports"]').click();
  await page.locator('#reportTypeV40').selectOption('custom');
  await page.locator('#reportStartV40').fill('2026-07-01');
  await page.locator('#reportEndV40').fill('2026-07-31');
  await page.getByRole('button', { name: 'Gerar relatório' }).click();
  await expect(page.locator('#reportPreviewV40')).toContainText('Relatório histórico');

  await page.evaluate(() => (
    window as typeof window & {
      __firebaseTestHarness: {
        failNext(operation: string, pathIncludes: string, message: string): string;
      };
    }
  ).__firebaseTestHarness.failNext('get', 'historico_eventos', 'Falha histórica após relatório.'));
  await page.locator('#refreshBtn').click();

  await expect(page.locator('#syncStatus')).toContainText('histórico está temporariamente indisponível');
  await expect(page.locator('#reportPreviewV40 [role="alert"]')).toContainText('Não foi possível carregar o histórico');
  expect(await page.evaluate(() => window.eval('lastReportDataV40'))).toBeNull();
});

test('logout durante leitura atrasada não repovoa o painel', async ({ admin, page }) => {
  await admin.goto(authorizedSeed());
  await page.evaluate(() => (
    window as typeof window & {
      __firebaseTestHarness: {
        delayNext(operation: string, pathIncludes: string, delayMs: number): string;
      };
    }
  ).__firebaseTestHarness.delayNext('get', 'connect_hub_v55/emergencia/pacientes', 500));
  await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(admin.adminContent).toBeVisible();
  await admin.signOutButton.click();

  await expect(admin.accessPanel).toBeVisible();
  await page.waitForTimeout(650);
  await expect(admin.adminContent).toBeHidden();
  await expect(page.locator('#metricPatients')).toHaveText('0');
  expect(await page.evaluate(() => window.eval(
    '({patients: allPatients.length, history: allHistoryEventsV41.length, outcomes: allOutcomeEventsV43.length})'
  ))).toEqual({ patients: 0, history: 0, outcomes: 0 });
});
