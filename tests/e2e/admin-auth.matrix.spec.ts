import { test, expect } from '../support/admin-fixture';

test('login e dashboard administrativo permanecem contidos no viewport', async ({ admin, page }) => {
  const email = 'admin.responsivo@example.test';
  const password = 'senha-ficticia-responsiva';
  const uid = 'fixture-admin-responsive';

  await admin.goto({
    adminAccounts: [{ uid, email, password }],
    adminUsers: [{ id: uid, active: true, role: 'coordinator' }],
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
