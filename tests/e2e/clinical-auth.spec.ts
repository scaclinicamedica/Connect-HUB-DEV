import { readFile } from 'node:fs/promises';
import { test, expect } from '../support/test-fixture';
import { basePatient } from '../fixtures/patients';
import {
  CLINICAL_TEST_DISPLAY_NAME,
  CLINICAL_TEST_EMAIL,
  CLINICAL_TEST_PASSWORD,
  CLINICAL_TEST_UID,
  clinicalTestProfile,
  clinicalTestUser
} from '../fixtures/auth';

const passagemHtml = await readFile(new URL('../../passagem.html', import.meta.url), 'utf8');
const hubHtml = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('remove autenticação anônima das duas superfícies clínicas', async () => {
  for(const html of [passagemHtml, hubHtml]){
    expect(html).not.toContain('signInAnonymously');
    expect(html).not.toContain('ENABLE_ANONYMOUS_AUTH');
    expect(html).toContain("clinical_users");
    expect(html).toContain('signInWithEmailAndPassword');
    expect(html).toContain('Persistence?.SESSION');
    expect(html).not.toContain(CLINICAL_TEST_PASSWORD);
  }
  expect(passagemHtml).not.toContain('localStorage.setItem(STORAGE_KEY');
  expect(passagemHtml).not.toContain('localStorage.setItem(META_KEY');
  expect(passagemHtml).not.toContain('localStorage.setItem(CONFIRMATIONS_KEY');
  expect(passagemHtml).not.toContain('localStorage.setItem(OUTCOMES_KEY');
  expect(passagemHtml).not.toContain('persistPatientOutcomeLocal');
  expect(hubHtml).not.toContain("localStorage.setItem('clinical");
});

test('não consulta Firestore antes de uma sessão clínica autorizada', async ({ app }) => {
  await app.goto({
    patients: [basePatient('fixture-auth-no-read')]
  }, { session: 'signed-out' });

  await expect(app.authGate).toBeVisible();
  await expect(app.appShell).toBeHidden();
  await expect(app.authEmail).toBeFocused();
  expect(await app.firestoreAccesses()).toEqual([]);
  expect(await app.firebaseWrites()).toEqual([]);
  expect(await app.authState()).toEqual({ '[DEFAULT]': null });
  expect(await app.authLog()).toContainEqual({
    operation: 'setPersistence',
    appName: '[DEFAULT]',
    value: 'session'
  });
});

test('valida o perfil próprio antes de abrir listeners clínicos', async ({ app }) => {
  const patient = basePatient('fixture-auth-authorized');
  await app.goto({ patients: [patient] }, { session: 'signed-out' });
  await app.clearFirestoreAccesses();

  await app.loginAsAuthorized();
  await expect(app.sessionName).toHaveText(CLINICAL_TEST_DISPLAY_NAME);
  await expect(app.cards).toHaveCount(1);

  const accesses = await app.firestoreAccesses();
  expect(accesses.map(access => ({
    operation: access.operation,
    path: access.path
  }))).toEqual([
    { operation: 'get', path: `clinical_users/${CLINICAL_TEST_UID}` },
    { operation: 'listen', path: `clinical_users/${CLINICAL_TEST_UID}` },
    { operation: 'listen', path: 'connect_hub_v55/emergencia/pacientes' },
    { operation: 'listen', path: 'connect_hub_v55/emergencia/meta/atual' },
    { operation: 'listen', path: 'connect_hub_v55/emergencia/confirmacoes' }
  ]);
  expect(accesses[0]).toEqual(expect.objectContaining({ source: 'server' }));
  expect(accesses.some(access => access.path === 'admin_users')).toBe(false);

  expect((await app.authState())['[DEFAULT]']).toEqual({
    uid: CLINICAL_TEST_UID,
    email: CLINICAL_TEST_EMAIL,
    isAnonymous: false
  });
});

test('mantém o shell oculto enquanto a leitura do perfil está pendente', async ({ app }) => {
  await app.goto({
    readDelays: [{
      pathIncludes: `clinical_users/${CLINICAL_TEST_UID}`,
      delayMs: 1_200
    }]
  }, { session: 'signed-out' });

  await app.authEmail.fill(CLINICAL_TEST_EMAIL);
  await app.authPassword.fill(CLINICAL_TEST_PASSWORD);
  await app.loginButton.click();
  await expect.poll(() => app.page.evaluate(clinicalUid => (
    window.__firebaseTestHarness.pendingControls()
      .find(control => control.pathIncludes === `clinical_users/${clinicalUid}`)
      ?.state || ''
  ), CLINICAL_TEST_UID)).toBe('pending');

  await expect(app.authGate).toBeVisible();
  await expect(app.appShell).toBeHidden();
  expect(await app.activeListeners()).toEqual([]);
  expect((await app.firestoreAccesses()).map(access => ({
    operation: access.operation,
    path: access.path
  }))).toEqual([
    { operation: 'get', path: `clinical_users/${CLINICAL_TEST_UID}` }
  ]);

  await expect(app.appShell).toBeVisible();
  await expect.poll(() => app.activeListeners()).toHaveLength(4);
});

test('restaura uma sessão nominal válida sem pedir a senha novamente', async ({ app }) => {
  await app.goto({ patients: [basePatient('fixture-auth-restored')] });

  await expect(app.appShell).toBeVisible();
  await expect(app.authGate).toBeHidden();
  await expect(app.sessionName).toHaveText(CLINICAL_TEST_DISPLAY_NAME);
  expect(await app.authLog()).not.toContainEqual(expect.objectContaining({
    operation: 'signInWithEmailAndPassword'
  }));
  expect((await app.authState())['[DEFAULT]']?.isAnonymous).toBe(false);
});

test('credencial inválida não revela conta e não consulta Firestore', async ({ app }) => {
  await app.goto({}, { session: 'signed-out' });
  await app.clearFirestoreAccesses();

  await app.login('profissional.inexistente@example.test', 'senha-incorreta');

  await expect(app.authError).toHaveText('E-mail ou senha inválidos.');
  await expect(app.authPassword).toHaveValue('');
  await expect(app.authPassword).toBeFocused();
  await expect(app.authGate).toBeVisible();
  expect(await app.firestoreAccesses()).toEqual([]);
  expect(await app.firebaseWrites()).toEqual([]);
});

test('perfil ausente encerra a autenticação sem iniciar listeners', async ({ app }) => {
  await app.goto({
    initialAuthUser: clinicalTestUser,
    clinicalUsers: []
  }, { session: 'as-seeded' });

  await expect(app.authGate).toBeVisible();
  await expect(app.authError).toContainText('não possui um perfil clínico ativo');
  await expect.poll(() => app.authState()).toEqual({ '[DEFAULT]': null });
  expect((await app.firestoreAccesses()).map(access => ({
    operation: access.operation,
    path: access.path
  }))).toEqual([
    { operation: 'get', path: `clinical_users/${CLINICAL_TEST_UID}` }
  ]);
  expect(await app.activeListeners()).toEqual([]);
  expect((await app.firestoreAccesses())[0]).toEqual(expect.objectContaining({
    source: 'server'
  }));
});

for(const invalidProfile of [
  {
    label: 'inativo',
    profile: { ...clinicalTestProfile, active: false }
  },
  {
    label: 'com papel inválido',
    profile: { ...clinicalTestProfile, role: 'coordinator' }
  },
  {
    label: 'com e-mail divergente',
    profile: { ...clinicalTestProfile, email: 'outro.profissional@example.test' }
  }
]){
  test(`perfil ${invalidProfile.label} não abre dados clínicos`, async ({ app }) => {
    await app.goto({
      initialAuthUser: clinicalTestUser,
      clinicalUsers: [invalidProfile.profile]
    }, { session: 'as-seeded' });

    await expect(app.authGate).toBeVisible();
    await expect(app.authError).toContainText('não possui um perfil clínico ativo');
    await expect.poll(() => app.authState()).toEqual({ '[DEFAULT]': null });
    expect((await app.firestoreAccesses()).map(access => access.path)).toEqual([
      `clinical_users/${CLINICAL_TEST_UID}`
    ]);
    expect(await app.activeListeners()).toEqual([]);
  });
}

test('falha ao consultar o perfil permanece fechada e não usa dados locais', async ({ app, page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sbar_breve_santa_casa_v1_emergencia', JSON.stringify([{
      id: 'fixture-local-must-stay-hidden',
      name: 'PACIENTE LOCAL QUE NÃO PODE APARECER'
    }]));
  });
  await app.goto({
    initialAuthUser: clinicalTestUser,
    patients: [basePatient('fixture-auth-profile-read-failure')],
    readFailures: [{
      pathIncludes: `clinical_users/${CLINICAL_TEST_UID}`,
      code: 'permission-denied',
      message: 'Perfil bloqueado pela regra simulada.'
    }]
  }, { session: 'as-seeded' });

  await expect(app.authGate).toBeVisible();
  await expect(app.authError).toContainText('Não foi possível confirmar seu perfil clínico');
  await expect.poll(() => app.authState()).toEqual({ '[DEFAULT]': null });
  await expect(app.cards).toHaveCount(0);
  expect(await app.activeListeners()).toEqual([]);
  expect((await app.firestoreAccesses()).map(access => access.path)).toEqual([
    `clinical_users/${CLINICAL_TEST_UID}`
  ]);
});

test('sessão anônima legada é expulsa sem qualquer leitura clínica', async ({ app }) => {
  await app.goto({
    initialAuthUser: {
      uid: 'fixture-legacy-anonymous',
      email: '',
      isAnonymous: true
    },
    clinicalUsers: []
  }, { session: 'as-seeded' });

  await expect(app.authGate).toBeVisible();
  await expect(app.authError).toContainText('sessão anônima anterior não é mais aceita');
  await expect.poll(() => app.authState()).toEqual({ '[DEFAULT]': null });
  expect(await app.firestoreAccesses()).toEqual([]);
  expect(await app.authLog()).toContainEqual({
    operation: 'signOut',
    appName: '[DEFAULT]',
    uid: 'fixture-legacy-anonymous'
  });
});

test('logout remove listeners, identidade e todos os campos clínicos da interface', async ({ app }) => {
  const patient = basePatient('fixture-auth-logout');
  await app.goto({
    patients: [patient],
    meta: { currentDoctor: 'MÉDICO FICTÍCIO DA SESSÃO ANTERIOR' },
    confirmations: [{
      id: 'fixture-confirmation-sensitive',
      createdAt: {
        __testTimestamp: true,
        iso: '2026-07-24T10:00:00.000Z'
      },
      createdAtLocal: '2026-07-24T10:00:00.000Z',
      receiverSummary: 'RESUMO FICTÍCIO DA TRANSIÇÃO ANTERIOR'
    }]
  });
  await app.openOutcomeFromCard(patient.id);
  await app.selectOutcome('death');
  await app.fillOutcomeResponsible('MÉDICO FICTÍCIO DO DESFECHO');
  await app.page.locator('#patientOutcomePrimaryCid').fill('Z00.0');
  await app.page.locator('#patientOutcomeCancelBtn').click();
  await expect(app.page.locator('#patientOutcomePatientLabel')).toContainText(patient.name);

  await app.openPatientById(patient.id);
  await expect(app.page.locator('#diagnosis')).not.toHaveValue('');
  await expect(app.page.locator('#background')).not.toHaveValue('');
  await expect(app.page.locator('#assessment')).not.toHaveValue('');
  await expect(app.page.locator('#recommendation')).not.toHaveValue('');
  await expect(app.page.locator('#currentDoctor')).toHaveValue('MÉDICO FICTÍCIO DA SESSÃO ANTERIOR');
  await expect(app.page.locator('#confirmationHistory')).toContainText('RESUMO FICTÍCIO');
  await app.page.evaluate(() => {
    document.getElementById('printArea')!.textContent = 'IMPRESSÃO CLÍNICA FICTÍCIA';
    const prefixes = [
      'sbar_breve_santa_casa_v1_',
      'sbar_breve_santa_casa_meta_v1_',
      'sbar_breve_santa_casa_confirmacoes_v1_',
      'sbar_breve_santa_casa_desfechos_v1_'
    ];
    for(const prefix of prefixes) {
      localStorage.setItem(`${prefix}emergencia`, 'DADO FICTÍCIO');
      localStorage.setItem(`${prefix}uti_2`, 'DADO FICTÍCIO DE OUTRO SETOR');
    }
  });
  await expect(app.activeListeners()).resolves.toHaveLength(4);

  await app.drawer.getByRole('button', { name: 'Fechar' }).click();
  await expect(app.drawer).not.toHaveClass(/open/);
  await app.signOutButton.click();

  await expect(app.authGate).toBeVisible();
  await expect(app.appShell).toBeHidden();
  await expect(app.authStatus).toHaveText('Sessão encerrada com segurança.');
  await expect(app.sessionName).toHaveText('');
  await expect(app.cards).toHaveCount(0);
  await expect(app.drawer).not.toHaveClass(/open/);
  await expect(app.page.locator('#patientId')).toHaveValue('');
  await expect(app.page.locator('#diagnosis')).toHaveValue('');
  await expect(app.page.locator('#background')).toHaveValue('');
  await expect(app.page.locator('#assessment')).toHaveValue('');
  await expect(app.page.locator('#recommendation')).toHaveValue('');
  await expect(app.page.locator('#currentDoctor')).toHaveValue('');
  await expect(app.page.locator('#patientOutcomePatientLabel')).toHaveText('');
  await expect(app.page.locator('#patientOutcomeResponsibleDoctor')).toHaveValue('');
  await expect(app.page.locator('#patientOutcomePrimaryCid')).toHaveValue('');
  await expect(app.page.locator('#printArea')).toBeEmpty();
  await expect(app.page.locator('#confirmationHistory')).toContainText('Nenhuma confirmação');
  expect(await app.page.evaluate(() => {
    const prefixes = [
      'sbar_breve_santa_casa_v1_',
      'sbar_breve_santa_casa_meta_v1_',
      'sbar_breve_santa_casa_confirmacoes_v1_',
      'sbar_breve_santa_casa_desfechos_v1_'
    ];
    return prefixes.flatMap(prefix => (
      ['emergencia', 'uti_2'].map(unit => localStorage.getItem(`${prefix}${unit}`))
    ));
  })).toEqual(Array(8).fill(null));
  await expect.poll(() => app.activeListeners()).toEqual([]);
  expect(await app.authState()).toEqual({ '[DEFAULT]': null });
});

test('logout clínico não encerra a sessão administrativa isolada', async ({ app }) => {
  await app.goto({
    initialAuthByApp: {
      'connect-hub-admin': {
        uid: 'fixture-admin-isolated',
        email: 'admin.isolado@example.test',
        isAnonymous: false
      }
    }
  });

  await app.signOutButton.click();
  await expect(app.authGate).toBeVisible();

  expect(await app.authState()).toEqual({
    '[DEFAULT]': null,
    'connect-hub-admin': {
      uid: 'fixture-admin-isolated',
      email: 'admin.isolado@example.test',
      isAnonymous: false
    }
  });
});

test('entrega atrasada de listener não repovoa a interface após logout', async ({ app }) => {
  await app.goto({
    initialAuthUser: clinicalTestUser,
    patients: [basePatient('fixture-auth-late-listener')],
    listenerDelays: [{
      pathIncludes: 'connect_hub_v55/emergencia',
      delayMs: 500
    }]
  }, { session: 'as-seeded' });

  await expect(app.appShell).toBeVisible();
  await expect.poll(() => app.activeListeners()).toHaveLength(4);
  await app.signOutButton.click();
  await expect(app.authGate).toBeVisible();

  await app.page.waitForTimeout(650);
  await expect(app.cards).toHaveCount(0);
  expect(await app.activeListeners()).toEqual([]);
  expect(await app.authState()).toEqual({ '[DEFAULT]': null });
});

test('callback atrasado do watcher de perfil não restaura sessão após logout', async ({ app }) => {
  await app.goto({
    patients: [basePatient('fixture-auth-late-profile-listener')],
    listenerDelays: [{
      pathIncludes: `clinical_users/${CLINICAL_TEST_UID}`,
      delayMs: 1000
    }]
  });

  await expect(app.appShell).toBeVisible();
  await expect.poll(() => app.activeListeners()).toHaveLength(4);
  expect((await app.listenerDeliveries()).some(delivery => (
    delivery.path === `clinical_users/${CLINICAL_TEST_UID}`
  ))).toBe(false);
  await app.signOutButton.click();
  await expect(app.authGate).toBeVisible();

  await expect.poll(() => app.listenerDeliveries()).toContainEqual(expect.objectContaining({
    path: `clinical_users/${CLINICAL_TEST_UID}`,
    initial: true
  }));
  await expect(app.appShell).toBeHidden();
  await expect(app.cards).toHaveCount(0);
  expect(await app.activeListeners()).toEqual([]);
  expect(await app.authState()).toEqual({ '[DEFAULT]': null });
});

test('permission-denied em listener revoga a sessão e limpa os pacientes', async ({ app }) => {
  await app.goto({ patients: [basePatient('fixture-auth-revoked-listener')] });
  expect(await app.failActiveListener(
    'connect_hub_v55/emergencia/pacientes'
  )).toBe(1);

  await expect(app.authGate).toBeVisible();
  await expect(app.authError).toContainText('autorização clínica não está mais ativa');
  await expect.poll(() => app.authState()).toEqual({ '[DEFAULT]': null });
  await expect(app.cards).toHaveCount(0);
  expect(await app.activeListeners()).toEqual([]);
});

test('desativação do perfil revoga a sessão sem aguardar outra operação clínica', async ({ app }) => {
  await app.goto({ patients: [basePatient('fixture-auth-profile-revoked')] });

  await app.replaceFirebaseDocument(`clinical_users/${CLINICAL_TEST_UID}`, {
    schemaVersion: 1,
    active: false,
    role: 'clinician',
    displayName: CLINICAL_TEST_DISPLAY_NAME,
    email: CLINICAL_TEST_EMAIL
  });

  await expect(app.authGate).toBeVisible();
  await expect(app.authError).toContainText('autorização clínica foi desativada');
  await expect.poll(() => app.authState()).toEqual({ '[DEFAULT]': null });
  await expect(app.cards).toHaveCount(0);
  expect(await app.activeListeners()).toEqual([]);
});

test('falha de logout mantém sessão e conteúdo explicitamente ativos', async ({ app }) => {
  await app.goto({ patients: [basePatient('fixture-auth-signout-failure')] });
  await app.failNextAuth(
    'signOut',
    'Falha controlada ao encerrar a sessão.',
    'auth/network-request-failed'
  );

  await app.signOutButton.click();

  await expect(app.appShell).toBeVisible();
  await expect(app.authGate).toBeHidden();
  await expect(app.signOutButton).toBeEnabled();
  await expect(app.signOutButton).toHaveText('Sair');
  await expect(app.page.locator('#toast')).toContainText('permanece ativa');
  await expect(app.cards).toHaveCount(1);
  expect((await app.authState())['[DEFAULT]']?.uid).toBe(CLINICAL_TEST_UID);
  await expect(app.activeListeners()).resolves.toHaveLength(4);
});

test('impede logout enquanto um autosave clínico está em voo', async ({ app }) => {
  const patient = {
    ...basePatient('fixture-auth-autosave-logout'),
    bed: 'Leito 01'
  };
  await app.goto({ patients: [patient] });
  await app.openPatientById(patient.id);
  await app.waitForAutosaveHydration();
  const pendingAutosave = await app.delayNextFirebaseWrite(
    'set',
    `connect_hub_v55/emergencia/pacientes/${patient.id}`,
    700
  );

  await app.page.locator('#diagnosis').fill('HIPÓTESE FICTÍCIA EM SALVAMENTO');
  await app.waitForFirebaseControl(pendingAutosave, 'pending');
  await app.signOutButton.click();

  await expect(app.page.locator('#toast')).toContainText('Aguarde a conclusão do salvamento');
  await expect(app.appShell).toBeVisible();
  await expect(app.authGate).toBeHidden();
  expect((await app.authState())['[DEFAULT]']?.uid).toBe(CLINICAL_TEST_UID);
  expect(await app.authLog()).not.toContainEqual(expect.objectContaining({
    operation: 'signOut'
  }));

  await expect.poll(async () => (
    (await app.persistedPatient(patient.id))?.diagnosis
  )).toBe('HIPÓTESE FICTÍCIA EM SALVAMENTO');
  await expect.poll(() => app.page.evaluate(() => (
    window.eval('hasClinicalWriteInFlight()')
  ))).toBe(false);

  await app.signOutButton.click();
  await expect(app.authGate).toBeVisible();
  expect(await app.authState()).toEqual({ '[DEFAULT]': null });
});

test('logout invalida consulta tardia de leitos e limpa todo o estado de migração', async ({ app }) => {
  const patient = basePatient('fixture-auth-migration-session');
  await app.goto({
    patients: [patient],
    patientsByUnit: {
      uti_1: [{
        ...basePatient('fixture-target-bed', 2),
        bed: 'UTI-02',
        unit: 'UTI 1'
      }]
    },
    readDelays: [{
      pathIncludes: 'connect_hub_v55/uti_1/pacientes',
      delayMs: 700
    }]
  });

  await app.page.evaluate(patientId => {
    const scope = window as typeof window & {
      toggleMigrationChooser(id: string): void;
      setMigrationTarget(unit: string): Promise<void>;
    };
    scope.toggleMigrationChooser(patientId);
    void scope.setMigrationTarget('uti_1');
  }, patient.id);
  await expect.poll(async () => (
    (await app.firestoreAccesses()).some(access => (
      access.path === 'connect_hub_v55/uti_1/pacientes'
    ))
  )).toBe(true);

  await app.signOutButton.click();
  await expect(app.authGate).toBeVisible();
  await expect.poll(async () => {
    const access = (await app.firestoreAccesses()).find(item => (
      item.path === 'connect_hub_v55/uti_1/pacientes'
    ));
    return Array.isArray(access?.returnedPaths) ? access.returnedPaths.length : -1;
  }).toBe(1);

  const signedOutState = await app.page.evaluate(() => window.eval(`({
    openMigrationPatientId,
    selectedMigrationTarget,
    selectedMigrationUnitV37,
    selectedMigrationBedV37,
    selectedMigrationObsV37,
    occupiedBeds: occupiedTargetBedsV37.size,
    loadingTargetBedsV37
  })`));
  expect(signedOutState).toEqual({
    openMigrationPatientId: null,
    selectedMigrationTarget: '',
    selectedMigrationUnitV37: '',
    selectedMigrationBedV37: '',
    selectedMigrationObsV37: '',
    occupiedBeds: 0,
    loadingTargetBedsV37: false
  });

  await app.loginAsAuthorized();
  expect(await app.page.evaluate(() => window.eval(`({
    openMigrationPatientId,
    selectedMigrationTarget,
    occupiedBeds: occupiedTargetBedsV37.size
  })`))).toEqual({
    openMigrationPatientId: null,
    selectedMigrationTarget: '',
    occupiedBeds: 0
  });
});

test('serializa confirmação dupla e impede logout durante a gravação', async ({ app }) => {
  await app.goto({
    patients: [basePatient('fixture-auth-confirmation-lock')],
    meta: {
      currentDoctor: 'MÉDICO FICTÍCIO CHECK-OUT',
      receiverDoctor: 'MÉDICO FICTÍCIO CHECK-IN'
    }
  });
  await expect(app.page.locator('#currentDoctor')).toHaveValue('MÉDICO FICTÍCIO CHECK-OUT');
  await expect(app.page.locator('#receiverDoctor')).toHaveValue('MÉDICO FICTÍCIO CHECK-IN');
  const pendingConfirmation = await app.delayNextFirebaseWrite(
    'set',
    'connect_hub_v55/emergencia/confirmacoes',
    700
  );

  await app.page.evaluate(() => {
    const scope = window as typeof window & { confirmHandover(): Promise<void> };
    void scope.confirmHandover();
    void scope.confirmHandover();
  });
  await app.waitForFirebaseControl(pendingConfirmation, 'pending');
  await expect(app.page.locator('#confirmHandoverBtn')).toBeDisabled();
  await app.signOutButton.click();

  await expect(app.page.locator('#toast')).toContainText('Aguarde a conclusão do salvamento');
  expect((await app.authState())['[DEFAULT]']?.uid).toBe(CLINICAL_TEST_UID);

  await expect.poll(async () => {
    const snapshot = await app.firebaseSnapshot();
    return Object.keys(snapshot).filter(path => path.includes('/confirmacoes/')).length;
  }).toBe(1);
  await expect.poll(() => app.page.evaluate(() => (
    window.eval('hasClinicalWriteInFlight()')
  ))).toBe(false);
  const completedSnapshot = await app.firebaseSnapshot();
  expect(Object.keys(completedSnapshot).filter(path => path.includes('/confirmacoes/'))).toHaveLength(1);
  expect((await app.firebaseWrites()).filter(write => (
    String(write.path || '').includes('/confirmacoes/')
  ))).toHaveLength(1);
  await expect(app.page.locator('#confirmHandoverBtn')).toBeEnabled();

  await app.signOutButton.click();
  await expect(app.authGate).toBeVisible();
  expect(await app.authState()).toEqual({ '[DEFAULT]': null });
});

test('identidade nominal é renderizada como texto, sem executar HTML persistido', async ({ app, page }) => {
  const maliciousName = '<img src=x onerror="window.__clinicalXss=true">';
  await page.addInitScript(() => {
    (window as typeof window & { __clinicalXss?: boolean }).__clinicalXss = false;
  });
  await app.goto({
    clinicalUsers: [{
      id: CLINICAL_TEST_UID,
      schemaVersion: 1,
      active: true,
      role: 'clinician',
      displayName: maliciousName,
      email: CLINICAL_TEST_EMAIL
    }]
  });

  await expect(app.sessionName).toHaveText(maliciousName);
  await expect(app.sessionName.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => (
    window as typeof window & { __clinicalXss?: boolean }
  ).__clinicalXss)).toBe(false);
});

test('link direto para paciente espera o login e a primeira leitura autorizada', async ({ app }) => {
  const patient = basePatient('fixture-auth-deep-link');
  await app.goto({ patients: [patient] }, {
    session: 'signed-out',
    url: `/passagem.html?setor=emergencia&paciente=${patient.id}`
  });
  await expect(app.drawer).not.toHaveClass(/open/);

  await app.loginAsAuthorized();

  await expect(app.drawer).toHaveClass(/open/);
  await expect(app.page.locator('#patientId')).toHaveValue(patient.id);
});

test('HUB remove caches clínicos legados compartilhados antes do login', async ({ app, page }) => {
  await page.addInitScript(() => {
    const prefixes = [
      'sbar_breve_santa_casa_v1_',
      'sbar_breve_santa_casa_meta_v1_',
      'sbar_breve_santa_casa_confirmacoes_v1_',
      'sbar_breve_santa_casa_desfechos_v1_'
    ];
    for(const prefix of prefixes) {
      localStorage.setItem(`${prefix}emergencia`, 'DADO CLÍNICO FICTÍCIO');
      localStorage.setItem(`${prefix}uti_1`, 'DADO CLÍNICO FICTÍCIO DE OUTRO SETOR');
    }
  });
  await app.goto({}, {
    session: 'signed-out',
    url: '/index.html'
  });

  expect(await page.evaluate(() => {
    const prefixes = [
      'sbar_breve_santa_casa_v1_',
      'sbar_breve_santa_casa_meta_v1_',
      'sbar_breve_santa_casa_confirmacoes_v1_',
      'sbar_breve_santa_casa_desfechos_v1_'
    ];
    return prefixes.flatMap(prefix => (
      ['emergencia', 'uti_1'].map(unit => localStorage.getItem(`${prefix}${unit}`))
    ));
  })).toEqual(Array(8).fill(null));
  expect(await app.firestoreAccesses()).toEqual([]);
});

test('HUB também bloqueia indicadores até validar o perfil nominal', async ({ app, page }) => {
  await app.goto({
    patientsByUnit: {
      emergencia: [basePatient('fixture-hub-auth')]
    }
  }, {
    session: 'signed-out',
    url: '/index.html'
  });
  expect(await app.firestoreAccesses()).toEqual([]);

  await app.loginAsAuthorized();

  await expect(page.locator('#metric-total')).toHaveText('1');
  await expect(page.locator('#count-emergencia')).toHaveText('1');
  await expect(app.sessionName).toHaveText(CLINICAL_TEST_DISPLAY_NAME);
  expect((await app.firestoreAccesses()).map(access => access.path)).toEqual([
    `clinical_users/${CLINICAL_TEST_UID}`,
    `clinical_users/${CLINICAL_TEST_UID}`,
    'connect_hub_v55/emergencia/pacientes',
    'connect_hub_v55/observacao_sus/pacientes',
    'connect_hub_v55/convenio/pacientes',
    'connect_hub_v55/enfermaria/pacientes',
    'connect_hub_v55/uti_1/pacientes',
    'connect_hub_v55/uti_2/pacientes'
  ]);
  expect((await app.firestoreAccesses())[0]).toEqual(expect.objectContaining({
    source: 'server'
  }));

  await page.evaluate(() => {
    localStorage.setItem('sbar_breve_santa_casa_v1_uti_2', 'DADO CLÍNICO FICTÍCIO');
  });
  await app.signOutButton.click();
  await expect(app.authGate).toBeVisible();
  await expect(page.locator('#metric-total')).toHaveText('—');
  expect(await page.evaluate(() => (
    localStorage.getItem('sbar_breve_santa_casa_v1_uti_2')
  ))).toBeNull();
  expect(await app.authState()).toEqual({ '[DEFAULT]': null });
});

test('HUB revoga a sessão quando uma leitura setorial perde permissão', async ({ app, page }) => {
  await app.goto({
    readFailures: [{
      pathIncludes: 'connect_hub_v55/observacao_sus/pacientes',
      code: 'permission-denied',
      message: 'Acesso setorial revogado no teste.'
    }]
  }, {
    session: 'signed-out',
    url: '/index.html'
  });

  await app.login(CLINICAL_TEST_EMAIL, CLINICAL_TEST_PASSWORD);

  await expect(app.authGate).toBeVisible();
  await expect(app.authError).toContainText('autorização clínica não está mais ativa');
  await expect(page.locator('#metric-total')).toHaveText('—');
  await expect.poll(() => app.authState()).toEqual({ '[DEFAULT]': null });
  expect(await app.firebaseWrites()).toEqual([]);
  expect(await app.activeListeners()).toEqual([]);
});

test('HUB revoga a sessão quando o perfil nominal é desativado', async ({ app, page }) => {
  await app.goto({
    patientsByUnit: {
      emergencia: [basePatient('fixture-hub-profile-revoked')]
    }
  }, {
    session: 'signed-out',
    url: '/index.html'
  });
  await app.loginAsAuthorized();
  await expect(page.locator('#metric-total')).toHaveText('1');

  await app.replaceFirebaseDocument(`clinical_users/${CLINICAL_TEST_UID}`, {
    schemaVersion: 1,
    active: false,
    role: 'clinician',
    displayName: CLINICAL_TEST_DISPLAY_NAME,
    email: CLINICAL_TEST_EMAIL
  });

  await expect(app.authGate).toBeVisible();
  await expect(app.authError).toContainText('autorização clínica foi desativada');
  await expect(page.locator('#metric-total')).toHaveText('—');
  await expect.poll(() => app.authState()).toEqual({ '[DEFAULT]': null });
  expect(await app.activeListeners()).toEqual([]);
});

for(const surface of [
  { label: 'Passagem', url: '/passagem.html?setor=emergencia' },
  { label: 'HUB', url: '/index.html' }
]){
  for(const persistenceFailure of [
    { label: 'ausente', seed: { authPersistenceUnavailable: true } },
    { label: 'rejeitada', seed: { authPersistenceFailure: true } }
  ]){
    test(`${surface.label}: persistência SESSION ${persistenceFailure.label} encerra credencial restaurada`, async ({ app }) => {
      await app.goto({
        initialAuthUser: clinicalTestUser,
        ...persistenceFailure.seed
      }, {
        session: 'as-seeded',
        url: surface.url
      });

      await expect(app.authGate).toBeVisible();
      await expect(app.appShell).toBeHidden();
      await expect(app.authError).toContainText('Não foi possível iniciar a autenticação');
      expect(await app.firestoreAccesses()).toEqual([]);
      expect(await app.firebaseWrites()).toEqual([]);
      await expect.poll(() => app.authState()).toEqual({ '[DEFAULT]': null });
      expect(await app.authLog()).toContainEqual({
        operation: 'signOut',
        appName: '[DEFAULT]',
        uid: CLINICAL_TEST_UID
      });
    });
  }
}

test('configuração Firebase ausente não abre fallback nem cache local', async ({ app, page }) => {
  await page.addInitScript(() => {
    const prefixes = [
      'sbar_breve_santa_casa_v1_',
      'sbar_breve_santa_casa_meta_v1_',
      'sbar_breve_santa_casa_confirmacoes_v1_',
      'sbar_breve_santa_casa_desfechos_v1_'
    ];
    for(const prefix of prefixes) {
      localStorage.setItem(`${prefix}emergencia`, 'DADO CLÍNICO FICTÍCIO');
      localStorage.setItem(`${prefix}enfermaria`, 'DADO CLÍNICO FICTÍCIO DE OUTRO SETOR');
    }
  });
  await page.route('**/passagem.html*', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      'apiKey: "AIzaSyDkkz0icUp8sbF7nWkE626fOgJvGL8lRc4"',
      'apiKey: "COLE_AQUI"'
    );
    await route.fulfill({ response, body });
  });

  await app.goto({}, { session: 'as-seeded' });

  await expect(app.authGate).toBeVisible();
  await expect(app.appShell).toBeHidden();
  await expect(app.authError).toContainText('configuração segura do Firebase está indisponível');
  await expect(app.cards).toHaveCount(0);
  expect(await app.firestoreAccesses()).toEqual([]);
  expect(await app.firebaseWrites()).toEqual([]);
  expect(await page.evaluate(() => {
    const prefixes = [
      'sbar_breve_santa_casa_v1_',
      'sbar_breve_santa_casa_meta_v1_',
      'sbar_breve_santa_casa_confirmacoes_v1_',
      'sbar_breve_santa_casa_desfechos_v1_'
    ];
    return prefixes.flatMap(prefix => (
      ['emergencia', 'enfermaria'].map(unit => localStorage.getItem(`${prefix}${unit}`))
    ));
  })).toEqual(Array(8).fill(null));
});
