import { test, expect } from '../support/admin-fixture';
import type { AdminSeed } from '../support/admin-page';
import type { Page } from '@playwright/test';

const MANAGER_UID = 'fixture-manager-user';
const MANAGER_EMAIL = 'gestor.ficticio@example.test';
const MANAGER_PASSWORD = 'senha-ficticia-do-gestor';
const DOCTOR_UID = 'fixture-invited-doctor';
const DOCTOR_EMAIL = 'medico.convidado@example.test';
const INVITE_ID = 'invite_0123456789abcdef0123456789abcdef';
const ACCESS_ID = 'access_0123456789abcdef0123456789abcdef';

function timestamp(iso: string){
  return { __testTimestamp: true, iso };
}

function managerProfile(role: 'admin' | 'coordinator' = 'admin'){
  return {
    id: MANAGER_UID,
    schemaVersion: 1,
    active: true,
    role,
    displayName: role === 'admin' ? 'GESTOR FICTÍCIO' : 'COORDENADOR FICTÍCIO',
    email: MANAGER_EMAIL
  };
}

function invitedClinicalProfile(overrides: Record<string, unknown> = {}){
  return {
    id: DOCTOR_UID,
    schemaVersion: 2,
    active: true,
    role: 'clinician',
    displayName: 'DRA. MÉDICA CONVIDADA',
    email: DOCTOR_EMAIL,
    createdAt: timestamp('2026-07-25T12:00:00Z'),
    createdByUid: MANAGER_UID,
    updatedAt: timestamp('2026-07-25T12:00:00Z'),
    updatedByUid: DOCTOR_UID,
    revision: 1,
    inviteId: INVITE_ID,
    lastAccessEventId: ACCESS_ID,
    ...overrides
  };
}

function managementSeed(overrides: Partial<AdminSeed> = {}): AdminSeed {
  return {
    adminAccounts: [{
      uid: MANAGER_UID,
      email: MANAGER_EMAIL,
      password: MANAGER_PASSWORD,
      emailVerified: true
    }],
    adminUsers: [managerProfile()],
    clinicalUsers: [],
    clinicalInvites: [],
    accessAudit: [],
    patientsByUnit: {},
    historyEvents: [],
    adminOutcomes: [],
    ...overrides
  };
}

async function openUsersTab(page: Page){
  const button = page.locator('#usersTabButton');
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('#tab-users')).toBeVisible();
  await expect(page.locator('#usersStatus')).toContainText(/carregado|convite/i);
}

test('somente o Gestor vê e carrega o gerenciamento de usuários', async ({ admin, page }) => {
  await admin.goto(managementSeed({
    adminUsers: [managerProfile('coordinator')]
  }));
  await admin.loginAsAuthorized(MANAGER_EMAIL, MANAGER_PASSWORD);

  await expect(page.locator('#adminRoleLabel')).toHaveText('Coordenador');
  await expect(page.locator('#usersTabButton')).toBeHidden();
  await page.evaluate(() => window.eval("openTab('users')"));
  await expect(page.locator('#tab-users')).toBeHidden();

  const reads = await admin.firebaseReads();
  expect(reads.some(read => read.path === 'clinical_invites')).toBe(false);
  expect(reads.some(read => read.path === 'clinical_users')).toBe(false);
});

test('Gestor cria convite auditado e envia Email Link somente à caixa postal informada', async ({ admin, page }) => {
  await admin.goto(managementSeed());
  await admin.loginAsAuthorized(MANAGER_EMAIL, MANAGER_PASSWORD);
  await openUsersTab(page);

  const unsafeName = '<img src=x onerror="window.__xssTriggered=true">';
  await page.locator('#inviteDisplayName').fill(unsafeName);
  await page.locator('#inviteEmail').fill(DOCTOR_EMAIL.toUpperCase());
  await page.locator('#createInviteBtn').click();

  const inviteRow = page.locator('#inviteRows tr[data-invite-id^="invite_"]');
  await expect(inviteRow).toHaveCount(1);
  await expect(inviteRow).toContainText(unsafeName);
  await expect(inviteRow.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => (
    window as typeof window & { __xssTriggered: boolean }
  ).__xssTriggered)).toBe(false);

  const snapshot = await admin.firebaseSnapshot();
  const invitePath = Object.keys(snapshot).find(path => path.startsWith('clinical_invites/'));
  const auditPath = Object.keys(snapshot).find(path => path.startsWith('access_audit/'));
  expect(invitePath).toMatch(/^clinical_invites\/invite_[0-9a-f]{32}$/);
  expect(auditPath).toMatch(/^access_audit\/access_[0-9a-f]{32}$/);

  const invite = snapshot[invitePath!] as Record<string, unknown>;
  expect(Object.keys(invite).sort()).toEqual([
    'claimedAt', 'claimedByUid', 'createdAt', 'createdByUid', 'displayName',
    'email', 'expiresAt', 'lastAccessEventId', 'revision', 'revokedAt',
    'revokedByUid', 'role', 'schemaVersion', 'status', 'updatedAt', 'updatedByUid'
  ].sort());
  expect(invite).toEqual(expect.objectContaining({
    schemaVersion: 1,
    status: 'pending',
    role: 'clinician',
    displayName: unsafeName,
    email: DOCTOR_EMAIL,
    createdByUid: MANAGER_UID,
    updatedByUid: MANAGER_UID,
    revision: 1,
    claimedAt: null,
    claimedByUid: null,
    revokedAt: null,
    revokedByUid: null
  }));

  const audit = snapshot[auditPath!] as Record<string, unknown>;
  expect(Object.keys(audit).sort()).toEqual([
    'action', 'actorUid', 'createdAt', 'inviteId', 'schemaVersion',
    'targetDisplayName', 'targetEmail', 'targetUid', 'type'
  ].sort());
  expect(audit).toEqual(expect.objectContaining({
    schemaVersion: 1,
    type: 'access_audit',
    action: 'invite_created',
    actorUid: MANAGER_UID,
    targetUid: '',
    targetEmail: DOCTOR_EMAIL,
    targetDisplayName: unsafeName,
    inviteId: invitePath!.split('/')[1]
  }));

  const sends = (await admin.authLog()).filter(
    entry => entry.operation === 'sendSignInLinkToEmail'
  );
  expect(sends).toHaveLength(1);
  expect(sends[0]).toEqual(expect.objectContaining({
    appName: 'connect-hub-admin',
    email: DOCTOR_EMAIL,
    handleCodeInApp: true
  }));
  const continueUrl = new URL(String(sends[0].continueUrl));
  expect(continueUrl.pathname).toMatch(/\/cadastro\.html$/);
  expect(continueUrl.search).toBe('');
  const fragment = new URLSearchParams(continueUrl.hash.slice(1));
  expect(fragment.get('invite')).toBe(invitePath!.split('/')[1]);
  expect(fragment.has('email')).toBe(false);
  expect([...fragment.keys()]).toEqual(['invite']);
  expect(String(sends[0].actionLink)).toContain('mode=signIn');
  expect(await admin.clipboardWrites()).toEqual([]);

  const writesBeforeResend = await admin.firebaseWrites();
  await inviteRow.locator('button[data-action="resend-invite"]').click();
  await expect(page.locator('#usersStatus')).toContainText('reenviado');
  const sendsAfterResend = (await admin.authLog()).filter(
    entry => entry.operation === 'sendSignInLinkToEmail'
  );
  expect(sendsAfterResend).toHaveLength(2);
  expect(sendsAfterResend[1]).toEqual(expect.objectContaining({
    appName: 'connect-hub-admin',
    email: DOCTOR_EMAIL,
    continueUrl: continueUrl.href,
    handleCodeInApp: true
  }));
  expect(await admin.firebaseWrites()).toEqual(writesBeforeResend);
});

test('falha no envio preserva convite pendente e permite reenvio posterior', async ({ admin, page }) => {
  await admin.goto(managementSeed());
  await admin.loginAsAuthorized(MANAGER_EMAIL, MANAGER_PASSWORD);
  await openUsersTab(page);

  await admin.failNextAuth(
    'sendSignInLinkToEmail',
    'connect-hub-admin',
    'auth/quota-exceeded',
    'Cota diária simulada.'
  );
  await page.locator('#inviteDisplayName').fill('DR. REENVIO SEGURO');
  await page.locator('#inviteEmail').fill(DOCTOR_EMAIL);
  await page.locator('#createInviteBtn').click();

  await expect(page.locator('#usersStatus')).toContainText(
    'convite foi criado, mas o e-mail não pôde ser enviado'
  );
  const inviteRow = page.locator('#inviteRows tr[data-invite-id^="invite_"]');
  await expect(inviteRow).toHaveCount(1);
  await expect(inviteRow).toContainText('Pendente');
  expect((await admin.authLog()).filter(
    entry => entry.operation === 'sendSignInLinkToEmail'
  )).toHaveLength(0);

  const snapshotAfterFailure = await admin.firebaseSnapshot();
  const invitePath = Object.keys(snapshotAfterFailure).find(
    path => path.startsWith('clinical_invites/')
  );
  expect(snapshotAfterFailure[invitePath!]).toEqual(expect.objectContaining({
    status: 'pending',
    email: DOCTOR_EMAIL,
    revision: 1
  }));

  await inviteRow.locator('button[data-action="resend-invite"]').click();
  await expect(page.locator('#usersStatus')).toContainText('reenviado');
  expect((await admin.authLog()).filter(
    entry => entry.operation === 'sendSignInLinkToEmail'
  )).toHaveLength(1);
  expect(await admin.firebaseSnapshot()).toEqual(snapshotAfterFailure);
});

test('Gestor revoga convite pendente em transação auditada', async ({ admin, page }) => {
  await admin.goto(managementSeed({
    clinicalInvites: [{
      id: INVITE_ID,
      schemaVersion: 1,
      status: 'pending',
      role: 'clinician',
      displayName: 'DRA. MÉDICA CONVIDADA',
      email: DOCTOR_EMAIL,
      createdAt: timestamp('2026-07-25T12:00:00Z'),
      createdByUid: MANAGER_UID,
      expiresAt: timestamp('2099-07-28T12:00:00Z'),
      updatedAt: timestamp('2026-07-25T12:00:00Z'),
      updatedByUid: MANAGER_UID,
      claimedAt: null,
      claimedByUid: null,
      revokedAt: null,
      revokedByUid: null,
      revision: 1,
      lastAccessEventId: ACCESS_ID
    }]
  }));
  await admin.loginAsAuthorized(MANAGER_EMAIL, MANAGER_PASSWORD);
  await openUsersTab(page);

  page.once('dialog', dialog => void dialog.accept());
  await page.locator(`#inviteRows tr[data-invite-id="${INVITE_ID}"] button[data-action="revoke-invite"]`).click();
  await expect(page.locator(`#inviteRows tr[data-invite-id="${INVITE_ID}"]`)).toContainText('Revogado');

  const snapshot = await admin.firebaseSnapshot();
  expect(snapshot[`clinical_invites/${INVITE_ID}`]).toEqual(expect.objectContaining({
    status: 'revoked',
    revokedByUid: MANAGER_UID,
    updatedByUid: MANAGER_UID,
    revision: 2
  }));
  const revokeAudits = Object.entries(snapshot)
    .filter(([path, value]) => (
      path.startsWith('access_audit/') &&
      (value as Record<string, unknown>).action === 'invite_revoked'
    ));
  expect(revokeAudits).toHaveLength(1);
  expect(revokeAudits[0][1]).toEqual(expect.objectContaining({
    actorUid: MANAGER_UID,
    targetEmail: DOCTOR_EMAIL,
    inviteId: INVITE_ID
  }));
});

test('Gestor renomeia, desativa, reativa e recupera senha sem alterar identidade imutável', async ({ admin, page }) => {
  await admin.goto(managementSeed({
    clinicalUsers: [invitedClinicalProfile()]
  }));
  await admin.loginAsAuthorized(MANAGER_EMAIL, MANAGER_PASSWORD);
  await openUsersTab(page);

  const row = page.locator(`#clinicalUserRows tr[data-user-id="${DOCTOR_UID}"]`);
  await expect(row).toContainText('DRA. MÉDICA CONVIDADA');
  await row.locator('button[data-action="rename-user"]').click();
  await page.locator('#renameUserName').fill('DRA. MÉDICA ATUALIZADA');
  await page.locator('#saveRenameUserBtn').click();
  await expect(row).toContainText('DRA. MÉDICA ATUALIZADA');

  page.once('dialog', dialog => void dialog.accept());
  await row.locator('button[data-action="deactivate-user"]').click();
  await expect(row).toContainText('Inativo');

  await row.locator('button[data-action="reactivate-user"]').click();
  await expect(row).toContainText('Ativo');

  await row.locator('button[data-action="password-reset"]').click();
  await expect(page.locator('#usersStatus')).toContainText('Se existir uma conta correspondente');
  expect(await admin.authLog()).toContainEqual({
    operation: 'sendPasswordResetEmail',
    appName: 'connect-hub-admin',
    email: DOCTOR_EMAIL
  });

  const snapshot = await admin.firebaseSnapshot();
  const profile = snapshot[`clinical_users/${DOCTOR_UID}`] as Record<string, unknown>;
  expect(profile).toEqual(expect.objectContaining({
    schemaVersion: 2,
    active: true,
    role: 'clinician',
    displayName: 'DRA. MÉDICA ATUALIZADA',
    email: DOCTOR_EMAIL,
    createdByUid: MANAGER_UID,
    inviteId: INVITE_ID,
    revision: 4,
    updatedByUid: MANAGER_UID
  }));
  expect(Object.keys(profile).sort()).toEqual([
    'active', 'createdAt', 'createdByUid', 'displayName', 'email', 'inviteId',
    'lastAccessEventId', 'revision', 'role', 'schemaVersion', 'updatedAt', 'updatedByUid'
  ].sort());

  const actions = Object.entries(snapshot)
    .filter(([path]) => path.startsWith('access_audit/'))
    .map(([, value]) => (value as Record<string, unknown>).action);
  expect(actions).toEqual(expect.arrayContaining([
    'user_name_updated',
    'user_deactivated',
    'user_reactivated'
  ]));
});

test('falha de mutação mantém perfil e auditoria inalterados', async ({ admin, page }) => {
  await admin.goto(managementSeed({
    clinicalUsers: [invitedClinicalProfile()]
  }));
  await admin.loginAsAuthorized(MANAGER_EMAIL, MANAGER_PASSWORD);
  await openUsersTab(page);

  await page.evaluate(uid => {
    const harness = (window as typeof window & {
      __firebaseTestHarness: {
        failNext(operation: string, pathIncludes: string, message?: string): string;
      };
    }).__firebaseTestHarness;
    harness.failNext('set', `clinical_users/${uid}`, 'Falha controlada na transação.');
  }, DOCTOR_UID);

  const row = page.locator(`#clinicalUserRows tr[data-user-id="${DOCTOR_UID}"]`);
  page.once('dialog', dialog => void dialog.accept());
  await row.locator('button[data-action="deactivate-user"]').click();

  await expect(page.locator('#usersStatus')).toContainText('Não foi possível concluir');
  await expect(row).toContainText('Ativo');
  const snapshot = await admin.firebaseSnapshot();
  expect(snapshot[`clinical_users/${DOCTOR_UID}`]).toEqual(expect.objectContaining({
    active: true,
    revision: 1,
    lastAccessEventId: ACCESS_ID
  }));
  expect(Object.keys(snapshot).filter(path => path.startsWith('access_audit/'))).toEqual([]);
  expect(await admin.firebaseWrites()).toEqual([]);
});

test('revogação do perfil do Gestor encerra a sessão e limpa a gestão em tempo real', async ({ admin, page }) => {
  await admin.goto(managementSeed({
    clinicalUsers: [invitedClinicalProfile()]
  }));
  await admin.loginAsAuthorized(MANAGER_EMAIL, MANAGER_PASSWORD);
  await openUsersTab(page);
  await expect(page.locator(`#clinicalUserRows tr[data-user-id="${DOCTOR_UID}"]`)).toBeVisible();

  await admin.replaceFirebaseDocument(`admin_users/${MANAGER_UID}`, {
    schemaVersion: 1,
    active: false,
    role: 'admin',
    displayName: 'GESTOR FICTÍCIO',
    email: MANAGER_EMAIL
  });

  await expect(admin.accessPanel).toBeVisible();
  await expect(admin.adminContent).toBeHidden();
  await expect(admin.accessDenied).toContainText('Acesso revogado');
  await expect.poll(async () => (
    await admin.authState()
  )['connect-hub-admin']).toBeNull();
  await expect(page.locator('#usersTabButton')).toBeHidden();
  await expect(page.locator('#clinicalUserRows tr[data-user-id]')).toHaveCount(0);
});
