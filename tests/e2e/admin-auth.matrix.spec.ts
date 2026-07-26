import { test, expect } from '../support/admin-fixture';

test('login e dashboard administrativo permanecem contidos no viewport', async ({ admin, page }) => {
  const email = 'admin.responsivo@example.test';
  const password = 'senha-ficticia-responsiva';
  const uid = 'fixture-admin-responsive';

  await admin.goto({
    adminAccounts: [{ uid, email, password }],
    adminUsers: [{
      id: uid,
      schemaVersion: 1,
      active: true,
      role: 'coordinator',
      displayName: 'COORDENADOR FICTÍCIO',
      email
    }],
    patientsByUnit: {
      emergencia: [
        {
          id: 'patient-responsive',
          name: 'PACIENTE FICTÍCIO RESPONSIVO',
          bed: 'Leito 01'
        }
      ]
    },
    historyEvents: []
  });

  await expect.poll(() => page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))).toMatchObject({
    width: page.viewportSize()?.width,
    scrollWidth: page.viewportSize()?.width
  });

  await admin.loginAsAuthorized(email, password);
  await expect(page.locator('#adminDashboardTitle')).toBeVisible();
  await expect(page.locator('#signOutBtn')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
});

test('aba Usuários do Gestor permanece contida no viewport', async ({ admin, page }) => {
  const email = 'gestor.responsivo@example.test';
  const password = 'senha-ficticia-responsiva';
  const uid = 'fixture-manager-responsive';
  const doctorUid = 'fixture-doctor-responsive';

  await admin.goto({
    adminAccounts: [{ uid, email, password, emailVerified: true }],
    adminUsers: [{
      id: uid,
      schemaVersion: 1,
      active: true,
      role: 'admin',
      displayName: 'GESTOR RESPONSIVO FICTÍCIO',
      email
    }],
    clinicalUsers: [{
      id: doctorUid,
      schemaVersion: 2,
      active: true,
      role: 'clinician',
      displayName: 'DRA. MÉDICA RESPONSIVA COM NOME EXTENSO',
      email: 'medica.responsiva.com.endereco.extenso@example.test',
      createdAt: { __testTimestamp: true, iso: '2026-07-25T12:00:00Z' },
      createdByUid: uid,
      updatedAt: { __testTimestamp: true, iso: '2026-07-25T12:00:00Z' },
      updatedByUid: doctorUid,
      revision: 1,
      inviteId: 'invite_0123456789abcdef0123456789abcdef',
      lastAccessEventId: 'access_0123456789abcdef0123456789abcdef'
    }],
    clinicalInvites: [],
    accessAudit: [],
    patientsByUnit: {},
    historyEvents: []
  });

  await admin.loginAsAuthorized(email, password);
  await page.locator('#usersTabButton').click();
  await expect(page.locator('#tab-users')).toBeVisible();
  await expect(page.locator('#clinicalUserRows')).toContainText('DRA. MÉDICA RESPONSIVA');
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
  const usersPanel = await page.locator('#tab-users').boundingBox();
  expect(usersPanel).not.toBeNull();
  expect(usersPanel!.x).toBeGreaterThanOrEqual(-1);
  expect(usersPanel!.x + usersPanel!.width).toBeLessThanOrEqual(
    (page.viewportSize()?.width || 0) + 1
  );
});
