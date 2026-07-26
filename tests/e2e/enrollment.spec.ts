import { test, expect } from '../support/test-fixture';

const INVITE_ID = 'invite_abcdef0123456789abcdef0123456789';
const CREATE_EVENT_ID = 'access_abcdef0123456789abcdef0123456789';
const MANAGER_UID = 'fixture-manager-user';
const DOCTOR_UID = 'fixture-created-doctor';
const DOCTOR_EMAIL = 'medico.convidado@example.test';
const OTHER_EMAIL = 'outra.pessoa@example.test';
const DOCTOR_PASSWORD = 'SenhaForte!123';
const OLD_PASSWORD = 'SenhaAntiga!123';

function timestamp(iso: string){
  return { __testTimestamp: true, iso };
}

function emailFingerprint(email: string){
  let hash = 2166136261;
  for(const character of email.trim().toLowerCase()){
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function invitationFragment(inviteId = INVITE_ID){
  return `#invite=${inviteId}`;
}

function emailLinkUrl(
  email = DOCTOR_EMAIL,
  inviteId = INVITE_ID,
  oobCode = `fixture_${emailFingerprint(email)}_1`
){
  const query = new URLSearchParams({
    mode: 'signIn',
    oobCode,
    apiKey: 'fixture-api-key'
  });
  return `/cadastro.html?${query.toString()}${invitationFragment(inviteId)}`;
}

function pendingInvite(overrides: Record<string, unknown> = {}){
  return {
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
    lastAccessEventId: CREATE_EVENT_ID,
    ...overrides
  };
}

async function expectCleanEnrollmentUrl(page: import('@playwright/test').Page){
  await expect.poll(() => {
    const url = new URL(page.url());
    return { search: url.search, hash: url.hash, path: url.pathname };
  }).toEqual({ search: '', hash: '', path: '/cadastro.html' });
  expect(page.url().toLowerCase()).not.toContain(encodeURIComponent(DOCTOR_EMAIL).toLowerCase());
  expect(page.url().toLowerCase()).not.toContain(DOCTOR_EMAIL.toLowerCase());
}

test('recusa convite isolado, query arbitrária e fragmento legado sem acessar Firestore', async ({ app, page }) => {
  for(const url of [
    `/cadastro.html${invitationFragment()}`,
    `/cadastro.html?invite=${INVITE_ID}${invitationFragment()}`,
    `/cadastro.html#invite=${INVITE_ID}&email=${encodeURIComponent(DOCTOR_EMAIL)}`
  ]){
    await app.goto({
      initialAuthUser: null,
      authAccounts: [],
      clinicalUsers: [],
      clinicalInvites: [pendingInvite()]
    }, {
      session: 'as-seeded',
      url
    });

    await expect(page.locator('#invalidView')).toBeVisible();
    await expect(page.locator('#authView')).toBeHidden();
    await expect(page.locator('#emailLinkView')).toBeHidden();
    await expectCleanEnrollmentUrl(page);
    expect(await app.firestoreAccesses()).toEqual([]);
    expect(await app.firebaseWrites()).toEqual([]);
  }
});

test('stub gera reenvios Email Link distintos sem colocar o e-mail na URL', async ({ app, page }) => {
  await app.goto({
    initialAuthUser: null,
    authAccounts: [],
    clinicalUsers: [],
    clinicalInvites: [pendingInvite()]
  }, {
    session: 'as-seeded',
    url: emailLinkUrl()
  });

  const continuationUrl = new URL(
    `/cadastro.html${invitationFragment()}`,
    page.url()
  ).toString();
  await page.evaluate(async ({ email, url }) => {
    const testWindow = window as typeof window & {
      firebase: {
        auth(): {
          sendSignInLinkToEmail(
            address: string,
            settings: { url: string; handleCodeInApp: boolean }
          ): Promise<void>;
        };
      };
    };
    await testWindow.firebase.auth().sendSignInLinkToEmail(email,{
      url,
      handleCodeInApp:true
    });
    await testWindow.firebase.auth().sendSignInLinkToEmail(email,{
      url,
      handleCodeInApp:true
    });
  }, { email: DOCTOR_EMAIL, url: continuationUrl });

  const sends = (await app.authLog()).filter(entry => (
    entry.operation === 'sendSignInLinkToEmail'
  ));
  expect(sends).toHaveLength(2);
  const links = sends.map(entry => String(entry.actionLink));
  expect(new Set(links).size).toBe(2);
  for(const link of links){
    const parsed = new URL(link);
    expect(parsed.hash).toBe(invitationFragment());
    expect(parsed.searchParams.has('email')).toBe(false);
    expect(link.toLowerCase()).not.toContain(DOCTOR_EMAIL.toLowerCase());
    expect(link.toLowerCase()).not.toContain(encodeURIComponent(DOCTOR_EMAIL).toLowerCase());
  }
  expect(await app.firestoreAccesses()).toEqual([]);
});

test('conta nova só lê o convite após Email Link, senha, reautenticação Password e token fresh', async ({ app, page }) => {
  const actionUrl = emailLinkUrl();
  expect(actionUrl.toLowerCase()).not.toContain(DOCTOR_EMAIL.toLowerCase());
  expect(actionUrl.toLowerCase()).not.toContain(encodeURIComponent(DOCTOR_EMAIL).toLowerCase());

  await app.goto({
    initialAuthUser: null,
    authAccounts: [],
    clinicalUsers: [],
    clinicalInvites: [pendingInvite()],
    accessAudit: [],
    nextAuthUid: DOCTOR_UID
  }, {
    session: 'as-seeded',
    url: actionUrl
  });

  await expect(page.locator('#emailLinkView')).toBeVisible();
  await expect(page.locator('#authView')).toBeHidden();
  await expect(page.locator('#emailLinkEmail')).toBeFocused();
  await expectCleanEnrollmentUrl(page);
  expect(await app.firestoreAccesses()).toEqual([]);
  expect(await app.firebaseWrites()).toEqual([]);

  await page.locator('#emailLinkEmail').fill(DOCTOR_EMAIL);
  await page.locator('#completeEmailLinkButton').click();
  await expect(page.locator('#passwordView')).toBeVisible();
  expect(await app.firestoreAccesses()).toEqual([]);
  expect(await app.firebaseWrites()).toEqual([]);

  const beforePasswordLog = await app.authLog();
  expect(beforePasswordLog).toEqual(expect.arrayContaining([
    expect.objectContaining({
      operation: 'signInWithEmailLink',
      uid: DOCTOR_UID,
      isNewUser: true
    })
  ]));
  expect(beforePasswordLog.some(entry => entry.operation === 'updatePassword')).toBe(false);

  await page.locator('#createPassword').fill(DOCTOR_PASSWORD);
  await page.locator('#confirmPassword').fill(DOCTOR_PASSWORD);
  await page.locator('#setPasswordButton').click();
  await expect(page.locator('#successView')).toBeVisible();

  const result = await page.evaluate(() => {
    const harness = window.__firebaseTestHarness;
    return {
      snapshot: harness.snapshot(),
      writes: harness.writes(),
      reads: harness.firestoreAccesses(),
      authLog: harness.authLog()
    };
  });
  const profile = result.snapshot[`clinical_users/${DOCTOR_UID}`] as Record<string, unknown>;
  expect(Object.keys(profile).sort()).toEqual([
    'active', 'createdAt', 'createdByUid', 'displayName', 'email', 'inviteId',
    'lastAccessEventId', 'revision', 'role', 'schemaVersion', 'updatedAt', 'updatedByUid'
  ].sort());
  expect(profile).toEqual(expect.objectContaining({
    schemaVersion: 2,
    active: true,
    role: 'clinician',
    displayName: 'DRA. MÉDICA CONVIDADA',
    email: DOCTOR_EMAIL,
    createdByUid: MANAGER_UID,
    updatedByUid: DOCTOR_UID,
    revision: 1,
    inviteId: INVITE_ID
  }));

  const claimed = result.snapshot[`clinical_invites/${INVITE_ID}`] as Record<string, unknown>;
  expect(claimed).toEqual(expect.objectContaining({
    schemaVersion: 1,
    status: 'claimed',
    email: DOCTOR_EMAIL,
    claimedByUid: DOCTOR_UID,
    updatedByUid: DOCTOR_UID,
    revision: 2,
    revokedAt: null,
    revokedByUid: null
  }));
  expect(profile.lastAccessEventId).toBe(claimed.lastAccessEventId);

  const auditPath = Object.keys(result.snapshot).find(path => (
    path.startsWith('access_audit/') &&
    (result.snapshot[path] as Record<string, unknown>).action === 'invite_claimed'
  ));
  expect(auditPath).toMatch(/^access_audit\/access_[0-9a-f]{32}$/);
  expect(result.snapshot[auditPath!]).toEqual(expect.objectContaining({
    schemaVersion: 1,
    type: 'access_audit',
    action: 'invite_claimed',
    actorUid: DOCTOR_UID,
    targetUid: DOCTOR_UID,
    targetEmail: DOCTOR_EMAIL,
    inviteId: INVITE_ID
  }));
  expect(result.reads.map(entry => entry.path)).toEqual([
    `clinical_invites/${INVITE_ID}`,
    `clinical_users/${DOCTOR_UID}`
  ]);
  expect(result.reads.every(entry => entry.transaction === true)).toBe(true);

  const operations = result.authLog.map(entry => entry.operation);
  const updatePasswordIndex = operations.indexOf('updatePassword');
  const signOutIndex = operations.indexOf('signOut', updatePasswordIndex);
  const passwordSignInIndex = operations.indexOf('signInWithEmailAndPassword', signOutIndex);
  const freshTokenIndex = operations.indexOf('getIdTokenResult', passwordSignInIndex);
  expect(updatePasswordIndex).toBeGreaterThan(-1);
  expect(signOutIndex).toBeGreaterThan(updatePasswordIndex);
  expect(passwordSignInIndex).toBeGreaterThan(signOutIndex);
  expect(freshTokenIndex).toBeGreaterThan(passwordSignInIndex);
  expect(operations).not.toContain('createUserWithEmailAndPassword');
  expect(JSON.stringify(result.writes)).not.toContain(DOCTOR_PASSWORD);
});

test('e-mail errado não consome o Email Link nem permite qualquer leitura', async ({ app, page }) => {
  await app.goto({
    initialAuthUser: null,
    authAccounts: [],
    clinicalUsers: [],
    clinicalInvites: [pendingInvite()],
    nextAuthUid: DOCTOR_UID
  }, {
    session: 'as-seeded',
    url: emailLinkUrl()
  });

  await page.locator('#emailLinkEmail').fill(OTHER_EMAIL);
  await page.locator('#completeEmailLinkButton').click();
  await expect(page.locator('#emailLinkView')).toBeVisible();
  await expect(page.locator('#emailLinkMessage')).toContainText('não corresponde');
  expect(await app.firestoreAccesses()).toEqual([]);
  expect(await app.firebaseWrites()).toEqual([]);
  expect((await app.authState())['[DEFAULT]']).toBeNull();
  await expectCleanEnrollmentUrl(page);

  await page.locator('#emailLinkEmail').fill(DOCTOR_EMAIL);
  await page.locator('#completeEmailLinkButton').click();
  await expect(page.locator('#passwordView')).toBeVisible();
  expect(await app.firestoreAccesses()).toEqual([]);
});

test('resposta perdida após o commit retoma o claim de forma idempotente na mesma navegação', async ({ app, page }) => {
  await app.goto({
    initialAuthUser: null,
    authAccounts: [],
    clinicalUsers: [],
    clinicalInvites: [pendingInvite()],
    accessAudit: [],
    nextAuthUid: DOCTOR_UID
  }, {
    session: 'as-seeded',
    url: emailLinkUrl()
  });

  await page.locator('#emailLinkEmail').fill(DOCTOR_EMAIL);
  await page.locator('#completeEmailLinkButton').click();
  await expect(page.locator('#passwordView')).toBeVisible();
  await app.failAfterNextFirebaseTransactionCommit(
    'Resposta da reivindicação perdida após o commit.'
  );
  await page.locator('#createPassword').fill(DOCTOR_PASSWORD);
  await page.locator('#confirmPassword').fill(DOCTOR_PASSWORD);
  await page.locator('#setPasswordButton').click();
  await expect(page.locator('#unavailableView')).toBeVisible();
  await expect(page.locator('#retryClaimButton')).toBeVisible();

  const writesAfterCommit = await app.firebaseWrites();
  expect(writesAfterCommit).toHaveLength(3);
  await page.locator('#retryClaimButton').click();
  await expect(page.locator('#successView')).toBeVisible();
  const afterRetry = await page.evaluate(uid => ({
    writes: window.__firebaseTestHarness.writes(),
    profile: window.__firebaseTestHarness.document(`clinical_users/${uid}`)
  }), DOCTOR_UID);
  expect(afterRetry.writes).toEqual(writesAfterCommit);
  expect(afterRetry.profile).toEqual(
    expect.objectContaining({
      schemaVersion: 2,
      email: DOCTOR_EMAIL,
      inviteId: INVITE_ID
    })
  );
});

for(const linkCase of [
  { label: 'inválido', code: 'invalid_action_code' },
  { label: 'expirado', code: `expired_${emailFingerprint(DOCTOR_EMAIL)}_1` }
]){
  test(`Email Link ${linkCase.label} falha fechado sem ler o convite`, async ({ app, page }) => {
    await app.goto({
      initialAuthUser: null,
      authAccounts: [],
      clinicalUsers: [],
      clinicalInvites: [pendingInvite()]
    }, {
      session: 'as-seeded',
      url: emailLinkUrl(DOCTOR_EMAIL, INVITE_ID, linkCase.code)
    });

    await expect(page.locator('#emailLinkView')).toBeVisible();
    await page.locator('#emailLinkEmail').fill(DOCTOR_EMAIL);
    await page.locator('#completeEmailLinkButton').click();
    await expect(page.locator('#emailLinkView')).toBeVisible();
    await expect(page.locator('#emailLinkMessage')).toContainText('expirou');
    expect(await app.firestoreAccesses()).toEqual([]);
    expect(await app.firebaseWrites()).toEqual([]);
    expect((await app.authState())['[DEFAULT]']).toBeNull();
    await expectCleanEnrollmentUrl(page);
  });
}

test('pre-hijacking unverified é invalidado e não recebe senha nem acesso automaticamente', async ({ app, page }) => {
  await app.goto({
    initialAuthUser: {
      uid: DOCTOR_UID,
      email: DOCTOR_EMAIL,
      isAnonymous: false,
      emailVerified: false
    },
    authAccounts: [{
      uid: DOCTOR_UID,
      email: DOCTOR_EMAIL,
      password: OLD_PASSWORD,
      emailVerified: false
    }],
    clinicalUsers: [],
    clinicalInvites: [pendingInvite()]
  }, {
    session: 'as-seeded',
    url: emailLinkUrl()
  });

  await expect(page.locator('#emailLinkView')).toBeVisible();
  expect((await app.authState())['[DEFAULT]']).toBeNull();
  expect(await app.firestoreAccesses()).toEqual([]);

  await page.locator('#emailLinkEmail').fill(DOCTOR_EMAIL);
  await page.locator('#completeEmailLinkButton').click();
  await expect(page.locator('#unavailableView')).toBeVisible();
  await expect(page.locator('#authView')).toBeHidden();
  await expect(page.locator('#passwordView')).toBeHidden();

  const afterLinkLog = await app.authLog();
  expect(afterLinkLog).toEqual(expect.arrayContaining([
    expect.objectContaining({
      operation: 'invalidateUnverifiedCredential',
      uid: DOCTOR_UID,
      sessionsRevoked: true
    }),
    expect.objectContaining({
      operation: 'signInWithEmailLink',
      uid: DOCTOR_UID,
      isNewUser: false
    })
  ]));
  expect(afterLinkLog.some(entry => entry.operation === 'updatePassword')).toBe(false);
  expect(await app.firestoreAccesses()).toEqual([]);
  expect(await app.firebaseWrites()).toEqual([]);
  expect((await app.authState())['[DEFAULT]']).toBeNull();
  expect(afterLinkLog.some(entry => (
    entry.operation === 'sendPasswordResetEmail' ||
    entry.operation === 'signInWithEmailAndPassword'
  ))).toBe(false);
  await expectCleanEnrollmentUrl(page);
});

test('conta Password preexistente é bloqueada mesmo após consumir Email Link', async ({ app, page }) => {
  await app.goto({
    initialAuthUser: null,
    authAccounts: [{
      uid: DOCTOR_UID,
      email: DOCTOR_EMAIL,
      password: DOCTOR_PASSWORD,
      emailVerified: true
    }],
    clinicalUsers: [],
    clinicalInvites: [pendingInvite()],
    accessAudit: []
  }, {
    session: 'as-seeded',
    url: emailLinkUrl()
  });

  await page.locator('#emailLinkEmail').fill(DOCTOR_EMAIL);
  await page.locator('#completeEmailLinkButton').click();
  await expect(page.locator('#unavailableView')).toBeVisible();
  await expect(page.locator('#authView')).toBeHidden();
  expect(await app.firestoreAccesses()).toEqual([]);
  expect(await app.firebaseWrites()).toEqual([]);
  expect((await app.authState())['[DEFAULT]']).toBeNull();
  const operations = (await app.authLog()).map(entry => entry.operation);
  expect(operations.indexOf('signInWithEmailLink')).toBeGreaterThan(-1);
  expect(operations).not.toContain('signInWithEmailAndPassword');
  expect(operations).not.toContain('updatePassword');
});

test('restauração tardia de sessão é observada e descartada antes do Email Link', async ({ app, page }) => {
  await app.goto({
    initialAuthUser: {
      uid: 'fixture-restored-user',
      email: OTHER_EMAIL,
      isAnonymous: false,
      emailVerified: true
    },
    authAccounts: [{
      uid: 'fixture-restored-user',
      email: OTHER_EMAIL,
      password: OLD_PASSWORD,
      emailVerified: true
    }],
    authInitialStateDelayMs: 400,
    clinicalUsers: [],
    clinicalInvites: [pendingInvite()]
  }, {
    session: 'as-seeded',
    url: emailLinkUrl()
  });

  await expectCleanEnrollmentUrl(page);
  await expect(page.locator('#loadingView')).toBeVisible();
  await expect(page.locator('#emailLinkView')).toBeVisible();
  expect((await app.authState())['[DEFAULT]']).toBeNull();
  expect(await app.authLog()).toEqual(expect.arrayContaining([
    expect.objectContaining({
      operation: 'signOut',
      uid: 'fixture-restored-user'
    })
  ]));
  expect(await app.firestoreAccesses()).toEqual([]);
});

test('cadastro permanece contido nos oito viewports homologados', async ({ app, page }) => {
  const viewports = [
    { width: 390, height: 844 },
    { width: 494, height: 900 },
    { width: 759, height: 900 },
    { width: 760, height: 900 },
    { width: 761, height: 900 },
    { width: 768, height: 1024 },
    { width: 1180, height: 900 },
    { width: 1440, height: 1000 }
  ];

  for(const viewport of viewports){
    await page.setViewportSize(viewport);
    await app.goto({
      initialAuthUser: null,
      authAccounts: [],
      clinicalUsers: [],
      clinicalInvites: [pendingInvite()]
    }, {
      session: 'as-seeded',
      url: emailLinkUrl()
    });
    await expect(page.locator('#emailLinkView')).toBeVisible();
    const layout = await page.evaluate(() => {
      const card = document.querySelector('.card')!.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        cardLeft: card.left,
        cardRight: card.right
      };
    });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.innerWidth);
    expect(layout.cardLeft).toBeGreaterThanOrEqual(0);
    expect(layout.cardRight).toBeLessThanOrEqual(layout.innerWidth);
  }
});

for(const persistenceCase of [
  {
    label: 'ausente',
    seed: { authPersistenceUnavailable: true }
  },
  {
    label: 'rejeitada com fallback de descarte',
    seed: {
      authPersistenceFailure: true,
      authSignOutFailure: true
    }
  }
]){
  test(`persistência SESSION ${persistenceCase.label} falha fechada e descarta sessão restaurada`, async ({ app, page }) => {
    await app.goto({
      initialAuthUser: {
        uid: 'fixture-restored-user',
        email: OTHER_EMAIL,
        isAnonymous: false,
        emailVerified: true
      },
      authAccounts: [{
        uid: 'fixture-restored-user',
        email: OTHER_EMAIL,
        password: OLD_PASSWORD,
        emailVerified: true
      }],
      clinicalUsers: [],
      clinicalInvites: [pendingInvite()],
      ...persistenceCase.seed
    }, {
      session: 'as-seeded',
      url: emailLinkUrl()
    });

    await expect(page.locator('#unavailableView')).toBeVisible();
    expect((await app.authState())['[DEFAULT]']).toBeNull();
    expect(await app.firestoreAccesses()).toEqual([]);
    expect(await app.firebaseWrites()).toEqual([]);
    await expectCleanEnrollmentUrl(page);
    if(persistenceCase.seed.authSignOutFailure){
      expect(await app.authLog()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          operation: 'updateCurrentUser',
          nextUid: null
        })
      ]));
    }
  });
}
