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

  await admin.goto({
    adminAccounts: [{ uid, email, password }],
    adminUsers: [{ id: uid, active: true, role: 'coordinator' }],
    patientsByUnit: {},
    historyEvents: [],
    adminOutcomes: [
      {
        id: 'outcome-responsive',
        schemaVersion: 1,
        sourceVersion: 'fixture-v1',
        type: 'patient_outcome_admin',
        outcomeType: 'death',
        outcomeLabel: 'Óbito',
        createdAt: {
          __testTimestamp: true,
          iso: `${day}T12:00:00-03:00`
        },
        patientId: 'patient-responsive',
        patientName: 'PACIENTE FICTÍCIO COM NOME EXTENSO PARA TESTE RESPONSIVO',
        sectorUnit: 'observacao_sus',
        sectorName: 'Observação SUS',
        specialty: 'Clínica Médica com descrição extensa',
        admissionDate: day,
        lengthOfStayDays: 1,
        lengthOfStayMethod: 'inclusive_calendar_days',
        responsibleDoctor: 'DRA. FICTÍCIA COM NOME EXTENSO',
        primaryIcdCode: 'A41.9',
        actorUid: uid
      }
    ]
  });
  await admin.loginAsAuthorized(email, password);
  await page.locator('button[data-tab="outcomes"]').click();

  await expect(page.locator('#outcomesStateV43')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#outcomesResultsV43')).toBeVisible();
  await expect(page.locator('#outcomeAuditRowsV43 tr')).toHaveCount(1);
  await expect(page.locator('#outcomeStartV43')).toBeVisible();
  await expect(page.locator('#outcomeTypeV43')).toBeVisible();

  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);

  const viewportWidth = page.viewportSize()?.width || 0;
  for(const selector of ['#outcomeStartV43', '#outcomeEndV43', '#outcomeSectorV43', '#outcomeSpecialtyV43', '#outcomeTypeV43']){
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
  expect(auditViewport.scrollWidth).toBeGreaterThanOrEqual(auditViewport.clientWidth);
});
