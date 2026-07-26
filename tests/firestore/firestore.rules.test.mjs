import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setLogLevel,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';

const PROJECT_ID = 'demo-connect-hub-rules';
const CLINICIAN_UID = 'clinician-fixture';
const CLINICIAN_EMAIL = `${CLINICIAN_UID}@example.invalid`;
const ADMIN_UID = 'admin-fixture';
const COORDINATOR_UID = 'coordinator-fixture';
const SECTOR = 'emergencia';
const TARGET_SECTOR = 'uti_1';

let testEnvironment;

setLogLevel('silent');

function emulatorConnection() {
  const value = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const separator = value.lastIndexOf(':');
  return {
    host: value.slice(0, separator),
    port: Number(value.slice(separator + 1))
  };
}

function clinicianDb(uid = CLINICIAN_UID) {
  return testEnvironment.authenticatedContext(uid, {
    email: `${uid}@example.invalid`,
    email_verified: true,
    firebase: { sign_in_provider: 'password' }
  }).firestore();
}

function unverifiedPasswordDb(uid) {
  return testEnvironment.authenticatedContext(uid, {
    email: `${uid}@example.invalid`,
    email_verified: false,
    firebase: { sign_in_provider: 'password' }
  }).firestore();
}

function anonymousDb(uid = 'anonymous-fixture') {
  return testEnvironment.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'anonymous' }
  }).firestore();
}

function providerDb(uid, provider) {
  return testEnvironment.authenticatedContext(uid, {
    email: `${uid}@example.invalid`,
    email_verified: true,
    firebase: { sign_in_provider: provider }
  }).firestore();
}

function realUserDb(uid) {
  return testEnvironment.authenticatedContext(uid, {
    email: `${uid}@example.invalid`,
    email_verified: true,
    firebase: { sign_in_provider: 'password' }
  }).firestore();
}

function patientPath(sectorUnit, patientId) {
  return `connect_hub_v55/${sectorUnit}/pacientes/${patientId}`;
}

function markerPath(sectorUnit, patientId) {
  return `connect_hub_v55/${sectorUnit}/closed_patients/${patientId}`;
}

function outcomeId(sectorUnit, patientId) {
  return `patient_outcome_${sectorUnit}_${encodeURIComponent(patientId)}`;
}

function outcomePath(sectorUnit, patientId) {
  return `historico_eventos/${outcomeId(sectorUnit, patientId)}`;
}

function adminOutcomePath(sectorUnit, patientId) {
  return `admin_outcomes/${outcomeId(sectorUnit, patientId)}`;
}

function fictitiousPatient(patientId, extra = {}) {
  return {
    id: patientId,
    name: 'PACIENTE FICTÍCIO RULES',
    bed: 'Leito F-01',
    specialty: 'Clínica Médica',
    admissionDate: '2026-07-20',
    diagnosis: 'HIPÓTESE FICTÍCIA',
    status: 'Observação',
    severity: 'estavel',
    alerts: [],
    ...extra
  };
}

function fictitiousOutcome(patientId, {
  sectorUnit = SECTOR,
  actorUid = CLINICIAN_UID,
  outcomeType = 'treated'
} = {}) {
  const id = outcomeId(sectorUnit, patientId);
  const patient = fictitiousPatient(patientId);
  return {
    schemaVersion: 1,
    sourceVersion: 'FOUNDATION-1.0-RC1.3.0-OUTCOMES',
    outcomeId: id,
    type: 'patient_outcome',
    outcomeType,
    outcomeLabel: outcomeType === 'death'
      ? 'Óbito'
      : outcomeType === 'transferred'
        ? 'Transferido'
        : 'Tratado',
    createdAt: serverTimestamp(),
    createdAtLocal: '2026-07-24T15:00:00.000Z',
    dateLocal: '2026-07-24',
    patientId,
    patientName: patient.name,
    sectorUnit,
    sectorName: 'Emergência',
    unit: 'Ala Fictícia',
    bed: patient.bed,
    specialty: patient.specialty,
    admissionDate: patient.admissionDate,
    lengthOfStayDays: 5,
    lengthOfStayMethod: 'inclusive_calendar_days',
    responsibleDoctor: 'MÉDICO FICTÍCIO RULES',
    actor: 'MÉDICO FICTÍCIO RULES',
    actorUid,
    primaryIcdCode: outcomeType === 'death' ? 'Z00.0' : '',
    status: patient.status,
    severity: patient.severity,
    alerts: patient.alerts,
    patientSnapshot: patient
  };
}

function closedPatientMarker(patientId, {
  sectorUnit = SECTOR,
  closedByUid = CLINICIAN_UID,
  outcomeType = 'treated'
} = {}) {
  return {
    schemaVersion: 1,
    type: 'patient_closed',
    patientId,
    sectorUnit,
    outcomeId: outcomeId(sectorUnit, patientId),
    outcomeType,
    closedAt: serverTimestamp(),
    closedByUid
  };
}

function fictitiousAdminOutcome(patientId, {
  sectorUnit = SECTOR,
  actorUid = CLINICIAN_UID,
  outcomeType = 'treated'
} = {}) {
  const outcome = fictitiousOutcome(patientId, {
    sectorUnit,
    actorUid,
    outcomeType
  });
  return {
    schemaVersion: outcome.schemaVersion,
    sourceVersion: outcome.sourceVersion,
    type: 'patient_outcome_admin',
    outcomeId: outcome.outcomeId,
    outcomeType: outcome.outcomeType,
    outcomeLabel: outcome.outcomeLabel,
    createdAt: serverTimestamp(),
    patientId: outcome.patientId,
    patientName: outcome.patientName,
    sectorUnit: outcome.sectorUnit,
    sectorName: outcome.sectorName,
    unit: outcome.unit,
    bed: outcome.bed,
    specialty: outcome.specialty,
    admissionDate: outcome.admissionDate,
    lengthOfStayDays: outcome.lengthOfStayDays,
    lengthOfStayMethod: outcome.lengthOfStayMethod,
    responsibleDoctor: outcome.responsibleDoctor,
    primaryIcdCode: outcome.primaryIcdCode,
    actorUid: outcome.actorUid
  };
}

function fictitiousConfirmation({
  sectorUnit = SECTOR,
  actorUid = CLINICIAN_UID
} = {}) {
  return {
    schemaVersion: 1,
    type: 'handover_confirmation',
    sectorUnit,
    actorUid,
    createdAt: serverTimestamp(),
    createdAtLocal: '2026-07-24T15:00:00.000Z',
    handoverDate: '2026-07-24',
    shift: 'Diurno',
    currentDoctor: 'MÉDICO FICTÍCIO A',
    currentDoctor2: '',
    receiverDoctor: 'MÉDICO FICTÍCIO B',
    receiverDoctor2: '',
    wardAssist1R1: '',
    wardAssist2R1: '',
    wardGlobalR2: '',
    wardR2Chief: '',
    obsDoctor1: '',
    obsDoctor2: '',
    obsDoctorNight: '',
    sector: 'Emergência',
    receiverSummary: 'TRANSIÇÃO FICTÍCIA',
    handoverDoctorsText: 'CHECK-OUT E CHECK-IN FICTÍCIOS',
    transitionText: 'TRANSIÇÃO FICTÍCIA',
    confirmedAtText: '24/07/2026, 15:00:00',
    totalPatients: 3,
    criticalPatients: 1,
    severityMetricLabel: 'Críticos',
    statusMetricLabel: 'Aguardando UTI',
    waitingIcuPatients: 1,
    statusMetricPatients: 1,
    dischargeTodayPatients: 0,
    pendingPatients: 2,
    patientsSnapshot: []
  };
}

function fictitiousLegacyConfirmation() {
  const confirmation = fictitiousConfirmation();
  delete confirmation.schemaVersion;
  delete confirmation.type;
  delete confirmation.sectorUnit;
  delete confirmation.actorUid;
  return confirmation;
}

async function seedDocument(path, data) {
  await testEnvironment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

async function seedPatient(patientId, sectorUnit = SECTOR, extra = {}) {
  await seedDocument(
    patientPath(sectorUnit, patientId),
    fictitiousPatient(patientId, extra)
  );
}

async function seedAdmin(uid, role = 'admin', active = true) {
  await seedDocument(`admin_users/${uid}`, {
    schemaVersion: 1,
    active,
    role,
    displayName: role === 'admin'
      ? 'GESTOR FICTÍCIO'
      : 'COORDENADOR FICTÍCIO',
    email: `${uid}@example.invalid`
  });
}

async function seedClinical(uid = CLINICIAN_UID, {
  schemaVersion = 1,
  active = true,
  role = 'clinician',
  displayName = 'PROFISSIONAL CLÍNICO FICTÍCIO',
  email = `${uid}@example.invalid`,
  extra = {}
} = {}) {
  await seedDocument(`clinical_users/${uid}`, {
    schemaVersion,
    active,
    role,
    displayName,
    email,
    ...extra
  });
}

/*
 * Fixed access-management schemas mirrored by firestore.rules:
 *
 * clinical_users v2:
 * schemaVersion, active, role, displayName, email, createdAt, createdByUid,
 * updatedAt, updatedByUid, revision, inviteId, lastAccessEventId.
 *
 * clinical_invites v1:
 * schemaVersion, status, role, displayName, email, createdAt, createdByUid,
 * expiresAt, updatedAt, updatedByUid, claimedAt, claimedByUid, revokedAt,
 * revokedByUid, revision, lastAccessEventId.
 *
 * access_audit v1:
 * schemaVersion, type, action, actorUid, targetUid, targetEmail,
 * targetDisplayName, inviteId, createdAt.
 */
function fixedInviteId(sequence) {
  return `invite_${Number(sequence).toString(16).padStart(32, '0')}`;
}

function fixedAccessEventId(sequence) {
  return `access_${Number(sequence).toString(16).padStart(32, '0')}`;
}

function invitePath(inviteId) {
  return `clinical_invites/${inviteId}`;
}

function accessAuditPath(eventId) {
  return `access_audit/${eventId}`;
}

function inviteExpiry(hoursFromNow = 71.5) {
  return Timestamp.fromMillis(
    Date.now() + Math.round(hoursFromNow * 60 * 60 * 1000)
  );
}

function pendingInvite({
  managerUid = ADMIN_UID,
  email = 'invited-clinician@example.invalid',
  displayName = 'MÉDICO CONVIDADO FICTÍCIO',
  expiresAt = inviteExpiry(),
  eventId = fixedAccessEventId(1)
} = {}) {
  return {
    schemaVersion: 1,
    status: 'pending',
    role: 'clinician',
    displayName,
    email,
    createdAt: serverTimestamp(),
    createdByUid: managerUid,
    expiresAt,
    updatedAt: serverTimestamp(),
    updatedByUid: managerUid,
    claimedAt: null,
    claimedByUid: null,
    revokedAt: null,
    revokedByUid: null,
    revision: 1,
    lastAccessEventId: eventId
  };
}

function accessAudit({
  action,
  actorUid,
  targetUid = '',
  targetEmail = 'invited-clinician@example.invalid',
  targetDisplayName = 'MÉDICO CONVIDADO FICTÍCIO',
  inviteId
}) {
  return {
    schemaVersion: 1,
    type: 'access_audit',
    action,
    actorUid,
    targetUid,
    targetEmail,
    targetDisplayName,
    inviteId,
    createdAt: serverTimestamp()
  };
}

async function seedInvite(inviteId, {
  managerUid = ADMIN_UID,
  email = 'invited-clinician@example.invalid',
  displayName = 'MÉDICO CONVIDADO FICTÍCIO',
  expiresAt = inviteExpiry(),
  eventId = fixedAccessEventId(1),
  status = 'pending',
  revision = 1,
  claimedAt = null,
  claimedByUid = null,
  revokedAt = null,
  revokedByUid = null,
  updatedByUid = managerUid
} = {}) {
  const now = Timestamp.fromMillis(Date.now() - 1000);
  await seedDocument(invitePath(inviteId), {
    schemaVersion: 1,
    status,
    role: 'clinician',
    displayName,
    email,
    createdAt: now,
    createdByUid: managerUid,
    expiresAt,
    updatedAt: now,
    updatedByUid,
    claimedAt,
    claimedByUid,
    revokedAt,
    revokedByUid,
    revision,
    lastAccessEventId: eventId
  });
}

async function seedClinicalV2(uid, {
  active = true,
  displayName = 'MÉDICO V2 FICTÍCIO',
  email = `${uid}@example.invalid`,
  managerUid = ADMIN_UID,
  inviteId = fixedInviteId(100),
  eventId = fixedAccessEventId(100),
  revision = 1
} = {}) {
  const now = Timestamp.fromMillis(Date.now() - 1000);
  await seedDocument(`clinical_users/${uid}`, {
    schemaVersion: 2,
    active,
    role: 'clinician',
    displayName,
    email,
    createdAt: now,
    createdByUid: managerUid,
    updatedAt: now,
    updatedByUid: uid,
    revision,
    inviteId,
    lastAccessEventId: eventId
  });
}

async function createInvite(db, {
  inviteId = fixedInviteId(1),
  eventId = fixedAccessEventId(1),
  managerUid = ADMIN_UID,
  email = 'invited-clinician@example.invalid',
  displayName = 'MÉDICO CONVIDADO FICTÍCIO',
  expiresAt = inviteExpiry()
} = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, invitePath(inviteId)), pendingInvite({
    managerUid,
    email,
    displayName,
    expiresAt,
    eventId
  }));
  batch.set(doc(db, accessAuditPath(eventId)), accessAudit({
    action: 'invite_created',
    actorUid: managerUid,
    targetEmail: email,
    targetDisplayName: displayName,
    inviteId
  }));
  return batch.commit();
}

async function claimInvite(db, {
  uid,
  inviteId,
  eventId,
  email = `${uid}@example.invalid`,
  displayName = 'MÉDICO CONVIDADO FICTÍCIO',
  managerUid = ADMIN_UID,
  inviteRevision = 1
}) {
  const batch = writeBatch(db);
  batch.update(doc(db, invitePath(inviteId)), {
    status: 'claimed',
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
    claimedAt: serverTimestamp(),
    claimedByUid: uid,
    revision: inviteRevision + 1,
    lastAccessEventId: eventId
  });
  batch.set(doc(db, `clinical_users/${uid}`), {
    schemaVersion: 2,
    active: true,
    role: 'clinician',
    displayName,
    email,
    createdAt: serverTimestamp(),
    createdByUid: managerUid,
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
    revision: 1,
    inviteId,
    lastAccessEventId: eventId
  });
  batch.set(doc(db, accessAuditPath(eventId)), accessAudit({
    action: 'invite_claimed',
    actorUid: uid,
    targetUid: uid,
    targetEmail: email,
    targetDisplayName: displayName,
    inviteId
  }));
  return batch.commit();
}

async function revokeInvite(db, {
  inviteId,
  eventId,
  managerUid = ADMIN_UID,
  email = 'invited-clinician@example.invalid',
  displayName = 'MÉDICO CONVIDADO FICTÍCIO',
  revision = 1
}) {
  const batch = writeBatch(db);
  batch.update(doc(db, invitePath(inviteId)), {
    status: 'revoked',
    updatedAt: serverTimestamp(),
    updatedByUid: managerUid,
    revokedAt: serverTimestamp(),
    revokedByUid: managerUid,
    revision: revision + 1,
    lastAccessEventId: eventId
  });
  batch.set(doc(db, accessAuditPath(eventId)), accessAudit({
    action: 'invite_revoked',
    actorUid: managerUid,
    targetEmail: email,
    targetDisplayName: displayName,
    inviteId
  }));
  return batch.commit();
}

async function updateClinicalV2(db, {
  uid,
  inviteId,
  eventId,
  managerUid = ADMIN_UID,
  email = `${uid}@example.invalid`,
  displayName = 'MÉDICO V2 FICTÍCIO',
  active = true,
  revision = 1,
  action,
  changes
}) {
  const targetDisplayName = changes.displayName ?? displayName;
  const batch = writeBatch(db);
  batch.update(doc(db, `clinical_users/${uid}`), {
    ...changes,
    updatedAt: serverTimestamp(),
    updatedByUid: managerUid,
    revision: revision + 1,
    lastAccessEventId: eventId
  });
  batch.set(doc(db, accessAuditPath(eventId)), accessAudit({
    action,
    actorUid: managerUid,
    targetUid: uid,
    targetEmail: email,
    targetDisplayName,
    inviteId
  }));
  return batch.commit();
}

async function closePatient(db, patientId, {
  sectorUnit = SECTOR,
  actorUid = CLINICIAN_UID,
  outcomeType = 'treated'
} = {}) {
  const batch = writeBatch(db);
  batch.set(
    doc(db, outcomePath(sectorUnit, patientId)),
    fictitiousOutcome(patientId, { sectorUnit, actorUid, outcomeType })
  );
  batch.set(
    doc(db, markerPath(sectorUnit, patientId)),
    closedPatientMarker(patientId, {
      sectorUnit,
      closedByUid: actorUid,
      outcomeType
    })
  );
  batch.set(
    doc(db, adminOutcomePath(sectorUnit, patientId)),
    fictitiousAdminOutcome(patientId, {
      sectorUnit,
      actorUid,
      outcomeType
    })
  );
  batch.delete(doc(db, patientPath(sectorUnit, patientId)));
  return batch.commit();
}

before(async () => {
  const rules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      ...emulatorConnection()
    }
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await seedClinical();
});

after(async () => {
  await testEnvironment?.cleanup();
});

describe('Autenticação clínica nominal', () => {
  test('permite ao clínico password ler somente o próprio perfil imutável', async () => {
    const db = clinicianDb();
    const ownProfile = doc(db, `clinical_users/${CLINICIAN_UID}`);

    const snapshot = await assertSucceeds(getDoc(ownProfile));
    assert.equal(snapshot.data().email, CLINICIAN_EMAIL);
    await assertFails(getDocs(collection(db, 'clinical_users')));
    await assertFails(getDoc(doc(db, 'clinical_users/another-user')));
    await assertFails(setDoc(doc(db, 'clinical_users/new-user'), {
      schemaVersion: 1,
      active: true,
      role: 'clinician',
      displayName: 'OUTRO PROFISSIONAL FICTÍCIO',
      email: 'new-user@example.invalid'
    }));
    await assertFails(updateDoc(ownProfile, { active: false }));
    await assertFails(deleteDoc(ownProfile));
  });

  test('nega todo acesso clínico para usuário ausente ou anônimo', async () => {
    const patientId = 'fixture-anonymous-denied';
    await seedPatient(patientId);
    const unauthenticatedDb = testEnvironment.unauthenticatedContext().firestore();
    const anonymous = anonymousDb();

    for(const db of [unauthenticatedDb, anonymous]) {
      await assertFails(getDoc(doc(db, patientPath(SECTOR, patientId))));
      await assertFails(getDocs(
        collection(db, `connect_hub_v55/${SECTOR}/pacientes`)
      ));
      await assertFails(getDoc(doc(
        db,
        `connect_hub_v55/${SECTOR}/meta/atual`
      )));
      await assertFails(getDocs(collection(
        db,
        `connect_hub_v55/${SECTOR}/confirmacoes`
      )));
      await assertFails(getDoc(doc(db, markerPath(SECTOR, patientId))));
    }

    await assertFails(getDoc(doc(
      anonymous,
      `clinical_users/${CLINICIAN_UID}`
    )));
    await assertFails(closePatient(
      anonymous,
      patientId,
      { actorUid: 'anonymous-fixture' }
    ));
    await assertFails(setDoc(
      doc(anonymous, patientPath(SECTOR, 'fixture-anonymous-create')),
      fictitiousPatient('fixture-anonymous-create')
    ));
    await assertFails(updateDoc(
      doc(anonymous, patientPath(SECTOR, patientId)),
      { diagnosis: 'ALTERAÇÃO ANÔNIMA FICTÍCIA' }
    ));
    await assertFails(setDoc(
      doc(anonymous, `connect_hub_v55/${SECTOR}/meta/atual`),
      { currentDoctor: 'ANÔNIMO FICTÍCIO' }
    ));
    await assertFails(setDoc(
      doc(
        anonymous,
        `connect_hub_v55/${SECTOR}/confirmacoes/fixture-anonymous`
      ),
      fictitiousConfirmation({ actorUid: 'anonymous-fixture' })
    ));
    await assertFails(setDoc(
      doc(anonymous, 'historico_eventos/fixture-anonymous-legacy'),
      {
        type: 'patient_updated',
        createdAt: serverTimestamp(),
        createdAtLocal: '2026-07-24T15:00:00.000Z',
        patientId,
        sectorUnit: SECTOR,
        actorUid: 'anonymous-fixture'
      }
    ));
  });

  test('nega perfil ausente, inativo, malformado, divergente ou de outro provedor', async () => {
    const patientId = 'fixture-invalid-clinical-profile';
    await seedPatient(patientId);
    const cases = [
      { uid: 'missing-clinical-profile' },
      { uid: 'inactive-clinical-profile', profile: { active: false } },
      { uid: 'wrong-role-clinical-profile', profile: { role: 'coordinator' } },
      { uid: 'wrong-email-clinical-profile', profile: { email: 'different@example.invalid' } },
      { uid: 'extra-field-clinical-profile', profile: { extra: { createdBy: 'fixture' } } },
      { uid: 'wrong-schema-clinical-profile', profile: { schemaVersion: 2 } },
      { uid: 'blank-name-clinical-profile', profile: { displayName: '   ' } },
      { uid: 'long-name-clinical-profile', profile: { displayName: 'A'.repeat(121) } }
    ];

    for(const item of cases) {
      if(item.profile) await seedClinical(item.uid, item.profile);
      await assertFails(getDoc(doc(
        clinicianDb(item.uid),
        patientPath(SECTOR, patientId)
      )));
    }

    const federatedUid = 'federated-clinical-profile';
    await seedClinical(federatedUid);
    await assertFails(getDoc(doc(
      providerDb(federatedUid, 'google.com'),
      patientPath(SECTOR, patientId)
    )));
  });

  test('mantém leitura administrativa de pacientes sem conceder escrita clínica', async () => {
    const patientId = 'fixture-admin-clinical-boundary';
    await seedPatient(patientId);
    await seedAdmin(ADMIN_UID, 'admin', true);
    const adminDb = realUserDb(ADMIN_UID);

    await assertSucceeds(getDoc(doc(
      adminDb,
      patientPath(SECTOR, patientId)
    )));
    await assertSucceeds(getDocs(collection(
      adminDb,
      `connect_hub_v55/${SECTOR}/pacientes`
    )));
    await assertFails(updateDoc(doc(
      adminDb,
      patientPath(SECTOR, patientId)
    ), {
      diagnosis: 'ALTERAÇÃO ADMINISTRATIVA FICTÍCIA'
    }));
    await assertFails(setDoc(doc(
      adminDb,
      patientPath(SECTOR, 'fixture-admin-create-denied')
    ), fictitiousPatient('fixture-admin-create-denied')));
    await assertFails(getDoc(doc(
      adminDb,
      `connect_hub_v55/${SECTOR}/meta/atual`
    )));
  });

  test('acumula permissões somente quando o mesmo UID recebe os dois perfis', async () => {
    const patientId = 'fixture-dual-profile';
    const db = clinicianDb();
    await seedPatient(patientId);
    await assertSucceeds(closePatient(db, patientId));

    await assertFails(getDoc(doc(db, outcomePath(SECTOR, patientId))));
    await seedAdmin(CLINICIAN_UID, 'coordinator', true);
    await assertSucceeds(getDoc(doc(db, outcomePath(SECTOR, patientId))));
    await assertSucceeds(getDoc(doc(
      db,
      adminOutcomePath(SECTOR, patientId)
    )));
  });

  test('revogação do perfil bloqueia a operação clínica seguinte', async () => {
    const patientId = 'fixture-revoked-profile';
    const db = clinicianDb();
    await seedPatient(patientId);
    await assertSucceeds(getDoc(doc(db, patientPath(SECTOR, patientId))));

    await seedClinical(CLINICIAN_UID, { active: false });
    await assertFails(getDoc(doc(db, patientPath(SECTOR, patientId))));
    await assertFails(updateDoc(doc(
      db,
      patientPath(SECTOR, patientId)
    ), {
      diagnosis: 'ALTERAÇÃO APÓS REVOGAÇÃO'
    }));
  });

  test('exige e-mail verificado para qualquer sessão por senha', async () => {
    const uid = 'unverified-clinician';
    const inviteId = fixedInviteId(10);
    const eventId = fixedAccessEventId(10);
    await seedClinical(uid);
    await seedAdmin('unverified-manager', 'admin', true);
    await seedPatient('fixture-unverified');
    await seedInvite(inviteId, { email: `${uid}@example.invalid` });

    const unverified = unverifiedPasswordDb(uid);
    await assertFails(getDoc(doc(unverified, `clinical_users/${uid}`)));
    await assertFails(getDoc(doc(
      unverified,
      patientPath(SECTOR, 'fixture-unverified')
    )));
    await assertFails(getDoc(doc(unverified, invitePath(inviteId))));
    await assertFails(claimInvite(unverified, {
      uid,
      inviteId,
      eventId,
      email: `${uid}@example.invalid`
    }));

    const unverifiedManager = unverifiedPasswordDb('unverified-manager');
    await assertFails(getDocs(collection(
      unverifiedManager,
      'clinical_users'
    )));
    await assertFails(createInvite(unverifiedManager, {
      inviteId: fixedInviteId(11),
      eventId: fixedAccessEventId(11),
      managerUid: 'unverified-manager'
    }));
  });
});

describe('Perfis administrativos e fronteiras de gestão', () => {
  test('aceita somente o schema administrativo exato e e-mail do token', async () => {
    const patientId = 'fixture-admin-schema';
    await seedPatient(patientId);
    await seedAdmin(ADMIN_UID, 'admin', true);
    await seedAdmin(COORDINATOR_UID, 'coordinator', true);

    for(const uid of [ADMIN_UID, COORDINATOR_UID]) {
      await assertSucceeds(getDoc(doc(
        realUserDb(uid),
        patientPath(SECTOR, patientId)
      )));
    }

    const malformed = [
      {
        uid: 'admin-missing-schema',
        data: {
          active: true,
          role: 'admin',
          displayName: 'GESTOR SEM SCHEMA',
          email: 'admin-missing-schema@example.invalid'
        }
      },
      {
        uid: 'admin-extra-field',
        data: {
          schemaVersion: 1,
          active: true,
          role: 'admin',
          displayName: 'GESTOR COM CAMPO EXTRA',
          email: 'admin-extra-field@example.invalid',
          elevated: true
        }
      },
      {
        uid: 'admin-wrong-email',
        data: {
          schemaVersion: 1,
          active: true,
          role: 'admin',
          displayName: 'GESTOR EMAIL DIVERGENTE',
          email: 'different@example.invalid'
        }
      },
      {
        uid: 'admin-wrong-role',
        data: {
          schemaVersion: 1,
          active: true,
          role: 'clinician',
          displayName: 'GESTOR PAPEL INVÁLIDO',
          email: 'admin-wrong-role@example.invalid'
        }
      }
    ];

    for(const item of malformed) {
      await seedDocument(`admin_users/${item.uid}`, item.data);
      await assertFails(getDoc(doc(
        realUserDb(item.uid),
        patientPath(SECTOR, patientId)
      )));
    }
  });

  test('não permite escrita de navegador em admin_users', async () => {
    await seedAdmin(ADMIN_UID, 'admin', true);
    const db = realUserDb(ADMIN_UID);
    const ownProfile = doc(db, `admin_users/${ADMIN_UID}`);

    await assertFails(updateDoc(ownProfile, { active: false }));
    await assertFails(deleteDoc(ownProfile));
    await assertFails(setDoc(doc(db, 'admin_users/new-manager'), {
      schemaVersion: 1,
      active: true,
      role: 'admin',
      displayName: 'NOVO GESTOR FICTÍCIO',
      email: 'new-manager@example.invalid'
    }));
    await assertFails(getDocs(collection(db, 'admin_users')));
  });

  test('Gestor administra; coordenador não consulta coleções de gestão', async () => {
    await seedAdmin(ADMIN_UID, 'admin', true);
    await seedAdmin(COORDINATOR_UID, 'coordinator', true);
    await seedPatient('fixture-coordinator-read-only');
    const inviteId = fixedInviteId(20);
    const eventId = fixedAccessEventId(20);

    await assertSucceeds(createInvite(realUserDb(ADMIN_UID), {
      inviteId,
      eventId
    }));

    const coordinator = realUserDb(COORDINATOR_UID);
    await assertSucceeds(getDoc(doc(
      coordinator,
      patientPath(SECTOR, 'fixture-coordinator-read-only')
    )));
    await assertFails(getDoc(doc(
      coordinator,
      invitePath(inviteId)
    )));
    await assertFails(getDocs(collection(coordinator, 'clinical_invites')));
    await assertFails(getDoc(doc(
      coordinator,
      `clinical_users/${CLINICIAN_UID}`
    )));
    await assertFails(getDocs(collection(coordinator, 'clinical_users')));
    await assertFails(getDoc(doc(
      coordinator,
      accessAuditPath(eventId)
    )));
    await assertFails(getDocs(collection(coordinator, 'access_audit')));
    await assertFails(createInvite(coordinator, {
      inviteId: fixedInviteId(21),
      eventId: fixedAccessEventId(21),
      managerUid: COORDINATOR_UID
    }));
    await assertFails(revokeInvite(coordinator, {
      inviteId,
      eventId: fixedAccessEventId(22),
      managerUid: COORDINATOR_UID
    }));
  });
});

describe('Convites clínicos auditados', () => {
  test('Gestor cria convite de 72h e auditoria somente no mesmo batch', async () => {
    await seedAdmin(ADMIN_UID, 'admin', true);
    const db = realUserDb(ADMIN_UID);
    const inviteId = fixedInviteId(30);
    const eventId = fixedAccessEventId(30);

    await assertSucceeds(createInvite(db, { inviteId, eventId }));
    const invite = await assertSucceeds(getDoc(doc(db, invitePath(inviteId))));
    const audit = await assertSucceeds(getDoc(
      doc(db, accessAuditPath(eventId))
    ));
    assert.equal(invite.data().status, 'pending');
    assert.equal(invite.data().revision, 1);
    assert.equal(invite.data().lastAccessEventId, eventId);
    assert.equal(audit.data().action, 'invite_created');
    assert.equal(audit.data().targetUid, '');

    await assertFails(setDoc(
      doc(db, invitePath(fixedInviteId(31))),
      pendingInvite({ eventId: fixedAccessEventId(31) })
    ));
    await assertFails(setDoc(
      doc(db, accessAuditPath(fixedAccessEventId(32))),
      accessAudit({
        action: 'invite_created',
        actorUid: ADMIN_UID,
        inviteId: fixedInviteId(32)
      })
    ));
  });

  test('nega IDs, campos e duração fora do contrato fechado', async () => {
    await seedAdmin(ADMIN_UID, 'admin', true);
    const db = realUserDb(ADMIN_UID);

    await assertFails(createInvite(db, {
      inviteId: 'invite_not-hex',
      eventId: fixedAccessEventId(33)
    }));
    await assertFails(createInvite(db, {
      inviteId: fixedInviteId(34),
      eventId: 'access_not-hex'
    }));
    await assertFails(createInvite(db, {
      inviteId: fixedInviteId(35),
      eventId: fixedAccessEventId(35),
      expiresAt: inviteExpiry(72.5)
    }));
    await assertFails(createInvite(db, {
      inviteId: fixedInviteId(36),
      eventId: fixedAccessEventId(36),
      expiresAt: inviteExpiry(70)
    }));

    const inviteId = fixedInviteId(37);
    const eventId = fixedAccessEventId(37);
    const batch = writeBatch(db);
    batch.set(doc(db, invitePath(inviteId)), {
      ...pendingInvite({ eventId }),
      arbitraryField: 'NEGADO'
    });
    batch.set(doc(db, accessAuditPath(eventId)), accessAudit({
      action: 'invite_created',
      actorUid: ADMIN_UID,
      inviteId
    }));
    await assertFails(batch.commit());
  });

  test('Gestor revoga somente convite pendente com auditoria atômica', async () => {
    await seedAdmin(ADMIN_UID, 'admin', true);
    const db = realUserDb(ADMIN_UID);
    const inviteId = fixedInviteId(40);
    await seedInvite(inviteId);

    await assertSucceeds(revokeInvite(db, {
      inviteId,
      eventId: fixedAccessEventId(40)
    }));
    const revoked = await assertSucceeds(getDoc(
      doc(db, invitePath(inviteId))
    ));
    assert.equal(revoked.data().status, 'revoked');
    assert.equal(revoked.data().revision, 2);

    const isolatedId = fixedInviteId(41);
    await seedInvite(isolatedId);
    await assertFails(updateDoc(doc(db, invitePath(isolatedId)), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
      updatedByUid: ADMIN_UID,
      revokedAt: serverTimestamp(),
      revokedByUid: ADMIN_UID,
      revision: 2,
      lastAccessEventId: fixedAccessEventId(41)
    }));

    await assertFails(deleteDoc(doc(db, invitePath(inviteId))));
    await assertFails(revokeInvite(db, {
      inviteId,
      eventId: fixedAccessEventId(42),
      revision: 2
    }));
  });

  test('médico não cria, revoga, lista nem apaga convites ou auditorias', async () => {
    const db = clinicianDb();
    const inviteId = fixedInviteId(43);
    const eventId = fixedAccessEventId(43);
    await seedInvite(inviteId, { email: CLINICIAN_EMAIL });
    await seedDocument(accessAuditPath(eventId), {
      ...accessAudit({
        action: 'invite_created',
        actorUid: ADMIN_UID,
        targetEmail: CLINICIAN_EMAIL,
        inviteId
      }),
      createdAt: Timestamp.fromMillis(Date.now() - 1000)
    });

    await assertSucceeds(getDoc(doc(db, invitePath(inviteId))));
    await assertFails(getDocs(collection(db, 'clinical_invites')));
    await assertFails(getDocs(collection(db, 'access_audit')));
    await assertFails(getDoc(doc(db, accessAuditPath(eventId))));
    await assertFails(createInvite(db, {
      inviteId: fixedInviteId(44),
      eventId: fixedAccessEventId(44),
      managerUid: CLINICIAN_UID
    }));
    await assertFails(revokeInvite(db, {
      inviteId,
      eventId: fixedAccessEventId(45),
      managerUid: CLINICIAN_UID,
      email: CLINICIAN_EMAIL
    }));
    await assertFails(deleteDoc(doc(db, invitePath(inviteId))));
  });

  test('destinatário acessa somente convite exato cujo e-mail coincide', async () => {
    const uid = 'invite-recipient';
    const ownInvite = fixedInviteId(46);
    const otherInvite = fixedInviteId(47);
    await seedInvite(ownInvite, { email: `${uid}@example.invalid` });
    await seedInvite(otherInvite, { email: 'someone-else@example.invalid' });
    const db = realUserDb(uid);

    await assertSucceeds(getDoc(doc(db, invitePath(ownInvite))));
    await assertFails(getDoc(doc(db, invitePath(otherInvite))));
    await assertFails(getDocs(collection(db, 'clinical_invites')));
  });
});

describe('Aceite atômico do convite', () => {
  test('destinatário verificado reivindica uma vez e recebe perfil clínico v2', async () => {
    const uid = 'claimed-clinician';
    const email = `${uid}@example.invalid`;
    const inviteId = fixedInviteId(50);
    const eventId = fixedAccessEventId(50);
    await seedInvite(inviteId, { email });
    const db = realUserDb(uid);

    await assertSucceeds(claimInvite(db, {
      uid,
      inviteId,
      eventId,
      email
    }));
    const profile = await assertSucceeds(getDoc(
      doc(db, `clinical_users/${uid}`)
    ));
    const invite = await assertSucceeds(getDoc(
      doc(db, invitePath(inviteId))
    ));
    assert.equal(profile.data().schemaVersion, 2);
    assert.equal(profile.data().revision, 1);
    assert.equal(profile.data().lastAccessEventId, eventId);
    assert.equal(invite.data().status, 'claimed');
    assert.equal(invite.data().revision, 2);

    await seedPatient('fixture-claimed-clinician');
    await assertSucceeds(getDoc(doc(
      db,
      patientPath(SECTOR, 'fixture-claimed-clinician')
    )));
    await assertFails(claimInvite(db, {
      uid,
      inviteId,
      eventId: fixedAccessEventId(51),
      email,
      inviteRevision: 2
    }));
  });

  test('nega e-mail incorreto, convite expirado ou revogado', async () => {
    const wrongEmailUid = 'claim-wrong-email';
    const wrongEmailInvite = fixedInviteId(52);
    await seedInvite(wrongEmailInvite, {
      email: 'different@example.invalid'
    });
    await assertFails(claimInvite(realUserDb(wrongEmailUid), {
      uid: wrongEmailUid,
      inviteId: wrongEmailInvite,
      eventId: fixedAccessEventId(52)
    }));

    const expiredUid = 'claim-expired';
    const expiredInvite = fixedInviteId(53);
    await seedInvite(expiredInvite, {
      email: `${expiredUid}@example.invalid`,
      expiresAt: Timestamp.fromMillis(Date.now() - 100)
    });
    await assertFails(claimInvite(realUserDb(expiredUid), {
      uid: expiredUid,
      inviteId: expiredInvite,
      eventId: fixedAccessEventId(53)
    }));

    const revokedUid = 'claim-revoked';
    const revokedInvite = fixedInviteId(54);
    const revokedAt = Timestamp.fromMillis(Date.now() - 100);
    await seedInvite(revokedInvite, {
      email: `${revokedUid}@example.invalid`,
      status: 'revoked',
      revision: 2,
      revokedAt,
      revokedByUid: ADMIN_UID
    });
    await assertFails(claimInvite(realUserDb(revokedUid), {
      uid: revokedUid,
      inviteId: revokedInvite,
      eventId: fixedAccessEventId(54),
      inviteRevision: 2
    }));
  });

  test('nega aceite incompleto ou com perfil/auditoria divergente', async () => {
    const uid = 'claim-non-atomic';
    const email = `${uid}@example.invalid`;
    const inviteId = fixedInviteId(55);
    const eventId = fixedAccessEventId(55);
    await seedInvite(inviteId, { email });
    const db = realUserDb(uid);

    await assertFails(updateDoc(doc(db, invitePath(inviteId)), {
      status: 'claimed',
      updatedAt: serverTimestamp(),
      updatedByUid: uid,
      claimedAt: serverTimestamp(),
      claimedByUid: uid,
      revision: 2,
      lastAccessEventId: eventId
    }));

    const wrongAuditBatch = writeBatch(db);
    wrongAuditBatch.update(doc(db, invitePath(inviteId)), {
      status: 'claimed',
      updatedAt: serverTimestamp(),
      updatedByUid: uid,
      claimedAt: serverTimestamp(),
      claimedByUid: uid,
      revision: 2,
      lastAccessEventId: eventId
    });
    wrongAuditBatch.set(doc(db, `clinical_users/${uid}`), {
      schemaVersion: 2,
      active: true,
      role: 'clinician',
      displayName: 'MÉDICO CONVIDADO FICTÍCIO',
      email,
      createdAt: serverTimestamp(),
      createdByUid: ADMIN_UID,
      updatedAt: serverTimestamp(),
      updatedByUid: uid,
      revision: 1,
      inviteId,
      lastAccessEventId: eventId
    });
    wrongAuditBatch.set(doc(db, accessAuditPath(eventId)), accessAudit({
      action: 'invite_claimed',
      actorUid: uid,
      targetUid: 'another-user',
      targetEmail: email,
      inviteId
    }));
    await assertFails(wrongAuditBatch.commit());
  });

  test('duas reivindicações concorrentes produzem exatamente uma vencedora', async () => {
    const uid = 'concurrent-claim';
    const email = `${uid}@example.invalid`;
    const inviteId = fixedInviteId(56);
    await seedInvite(inviteId, { email });
    const db = realUserDb(uid);

    const results = await Promise.allSettled([
      claimInvite(db, {
        uid,
        inviteId,
        eventId: fixedAccessEventId(56),
        email
      }),
      claimInvite(db, {
        uid,
        inviteId,
        eventId: fixedAccessEventId(57),
        email
      })
    ]);
    assert.equal(
      results.filter(result => result.status === 'fulfilled').length,
      1
    );
    assert.equal(
      results.filter(result => result.status === 'rejected').length,
      1
    );

    const invite = await assertSucceeds(getDoc(
      doc(db, invitePath(inviteId))
    ));
    assert.equal(invite.data().status, 'claimed');
    assert.equal(invite.data().revision, 2);
  });
});

describe('Gestão auditada de perfis clínicos v2', () => {
  test('Gestor renomeia OU desativa/reativa com revisão e auditoria', async () => {
    const uid = 'managed-v2';
    const inviteId = fixedInviteId(60);
    await seedAdmin(ADMIN_UID, 'admin', true);
    await seedClinicalV2(uid, { inviteId });
    await seedPatient('fixture-managed-v2-access');
    const db = realUserDb(ADMIN_UID);

    await assertSucceeds(updateClinicalV2(db, {
      uid,
      inviteId,
      eventId: fixedAccessEventId(60),
      action: 'user_name_updated',
      changes: { displayName: 'MÉDICO V2 RENOMEADO' }
    }));
    await assertSucceeds(updateClinicalV2(db, {
      uid,
      inviteId,
      eventId: fixedAccessEventId(61),
      displayName: 'MÉDICO V2 RENOMEADO',
      revision: 2,
      action: 'user_deactivated',
      changes: { active: false }
    }));
    await assertFails(getDoc(doc(
      realUserDb(uid),
      patientPath(SECTOR, 'fixture-managed-v2-access')
    )));
    await assertSucceeds(updateClinicalV2(db, {
      uid,
      inviteId,
      eventId: fixedAccessEventId(62),
      displayName: 'MÉDICO V2 RENOMEADO',
      active: false,
      revision: 3,
      action: 'user_reactivated',
      changes: { active: true }
    }));
    await assertSucceeds(getDoc(doc(
      realUserDb(uid),
      patientPath(SECTOR, 'fixture-managed-v2-access')
    )));

    const profile = await assertSucceeds(getDoc(
      doc(db, `clinical_users/${uid}`)
    ));
    assert.equal(profile.data().displayName, 'MÉDICO V2 RENOMEADO');
    assert.equal(profile.data().active, true);
    assert.equal(profile.data().revision, 4);
    assert.equal(
      profile.data().lastAccessEventId,
      fixedAccessEventId(62)
    );
  });

  test('nega mutação sem auditoria, ação incorreta ou duas mudanças juntas', async () => {
    const uid = 'managed-v2-denied';
    const inviteId = fixedInviteId(63);
    await seedAdmin(ADMIN_UID, 'admin', true);
    await seedClinicalV2(uid, { inviteId });
    const db = realUserDb(ADMIN_UID);

    await assertFails(updateDoc(doc(db, `clinical_users/${uid}`), {
      active: false,
      updatedAt: serverTimestamp(),
      updatedByUid: ADMIN_UID,
      revision: 2,
      lastAccessEventId: fixedAccessEventId(63)
    }));

    await assertFails(updateClinicalV2(db, {
      uid,
      inviteId,
      eventId: fixedAccessEventId(64),
      action: 'user_reactivated',
      changes: { active: false }
    }));

    await assertFails(updateClinicalV2(db, {
      uid,
      inviteId,
      eventId: fixedAccessEventId(65),
      action: 'user_name_updated',
      changes: {
        active: false,
        displayName: 'DUAS MUDANÇAS NEGADAS'
      }
    }));
  });

  test('nega alterações de identidade, criação, convite ou metadados', async () => {
    const uid = 'managed-v2-immutable';
    const inviteId = fixedInviteId(66);
    await seedAdmin(ADMIN_UID, 'admin', true);
    await seedClinicalV2(uid, { inviteId });
    const db = realUserDb(ADMIN_UID);
    const immutableChanges = [
      { email: 'changed@example.invalid' },
      { role: 'coordinator' },
      { inviteId: fixedInviteId(999) },
      { createdByUid: 'another-manager' },
      { createdAt: serverTimestamp() }
    ];

    for(const [index, changes] of immutableChanges.entries()) {
      await assertFails(updateClinicalV2(db, {
        uid,
        inviteId,
        eventId: fixedAccessEventId(67 + index),
        action: 'user_name_updated',
        changes: {
          displayName: `MUDANÇA IMUTÁVEL ${index}`,
          ...changes
        }
      }));
    }
  });

  test('não permite ao Gestor alterar perfil bootstrap v1', async () => {
    await seedAdmin(ADMIN_UID, 'admin', true);
    const db = realUserDb(ADMIN_UID);

    await assertFails(updateClinicalV2(db, {
      uid: CLINICIAN_UID,
      inviteId: fixedInviteId(73),
      eventId: fixedAccessEventId(73),
      email: CLINICIAN_EMAIL,
      displayName: 'PROFISSIONAL CLÍNICO FICTÍCIO',
      action: 'user_deactivated',
      changes: { active: false }
    }));
  });

  test('coordenador e médicos não alteram perfis; médicos não listam usuários', async () => {
    const uid = 'managed-v2-role-boundary';
    const inviteId = fixedInviteId(74);
    await seedAdmin(COORDINATOR_UID, 'coordinator', true);
    await seedClinicalV2(uid, { inviteId });

    await assertFails(updateClinicalV2(realUserDb(COORDINATOR_UID), {
      uid,
      inviteId,
      eventId: fixedAccessEventId(74),
      managerUid: COORDINATOR_UID,
      action: 'user_deactivated',
      changes: { active: false }
    }));

    const doctor = clinicianDb();
    await assertFails(updateClinicalV2(doctor, {
      uid,
      inviteId,
      eventId: fixedAccessEventId(75),
      managerUid: CLINICIAN_UID,
      action: 'user_deactivated',
      changes: { active: false }
    }));
    await assertFails(getDocs(collection(doctor, 'clinical_users')));
    await assertFails(getDoc(doc(doctor, `clinical_users/${uid}`)));
    await assertSucceeds(getDoc(doc(
      doctor,
      `clinical_users/${CLINICIAN_UID}`
    )));
  });

  test('auditoria é legível só pelo Gestor e sempre imutável', async () => {
    const eventId = fixedAccessEventId(76);
    const inviteId = fixedInviteId(76);
    await seedAdmin(ADMIN_UID, 'admin', true);
    await seedAdmin(COORDINATOR_UID, 'coordinator', true);
    await seedDocument(accessAuditPath(eventId), {
      ...accessAudit({
        action: 'invite_created',
        actorUid: ADMIN_UID,
        inviteId
      }),
      createdAt: Timestamp.fromMillis(Date.now() - 1000)
    });

    const manager = realUserDb(ADMIN_UID);
    await assertSucceeds(getDoc(doc(manager, accessAuditPath(eventId))));
    await assertSucceeds(getDocs(collection(manager, 'access_audit')));
    await assertFails(updateDoc(doc(manager, accessAuditPath(eventId)), {
      action: 'invite_revoked'
    }));
    await assertFails(deleteDoc(doc(manager, accessAuditPath(eventId))));

    const coordinator = realUserDb(COORDINATOR_UID);
    await assertFails(getDoc(doc(coordinator, accessAuditPath(eventId))));
    await assertFails(getDocs(collection(coordinator, 'access_audit')));
    await assertFails(getDoc(doc(
      clinicianDb(),
      accessAuditPath(eventId)
    )));
  });
});

describe('Desfecho atômico', () => {
  test('aceita evento + projeção mínima + lápide + exclusão no mesmo commit', async () => {
    const patientId = 'fixture-valid-outcome';
    const db = clinicianDb();
    await seedPatient(patientId);

    await assertSucceeds(closePatient(db, patientId));

    let persisted;
    await testEnvironment.withSecurityRulesDisabled(async context => {
      const uncheckedDb = context.firestore();
      persisted = {
        patient: await getDoc(doc(uncheckedDb, patientPath(SECTOR, patientId))),
        marker: await getDoc(doc(uncheckedDb, markerPath(SECTOR, patientId))),
        outcome: await getDoc(doc(uncheckedDb, outcomePath(SECTOR, patientId))),
        projection: await getDoc(
          doc(uncheckedDb, adminOutcomePath(SECTOR, patientId))
        )
      };
    });
    assert.equal(persisted.patient.exists(), false);
    assert.equal(persisted.marker.data().patientId, patientId);
    assert.equal(persisted.marker.data().closedByUid, CLINICIAN_UID);
    assert.equal(persisted.outcome.data().actorUid, CLINICIAN_UID);
    assert.deepEqual(
      Object.keys(persisted.projection.data()).sort(),
      [
        'actorUid',
        'admissionDate',
        'bed',
        'createdAt',
        'lengthOfStayDays',
        'lengthOfStayMethod',
        'outcomeId',
        'outcomeLabel',
        'outcomeType',
        'patientId',
        'patientName',
        'primaryIcdCode',
        'responsibleDoctor',
        'schemaVersion',
        'sectorName',
        'sectorUnit',
        'sourceVersion',
        'specialty',
        'type',
        'unit'
      ].sort()
    );
    assert.equal(
      persisted.projection.data().type,
      'patient_outcome_admin'
    );
    assert.equal('patientSnapshot' in persisted.projection.data(), false);
  });

  test('nega partes isoladas e qualquer fechamento sem as quatro mutações', async () => {
    const db = clinicianDb();

    await seedPatient('fixture-outcome-only');
    await assertFails(setDoc(
      doc(db, outcomePath(SECTOR, 'fixture-outcome-only')),
      fictitiousOutcome('fixture-outcome-only')
    ));

    await seedPatient('fixture-marker-only');
    await assertFails(setDoc(
      doc(db, markerPath(SECTOR, 'fixture-marker-only')),
      closedPatientMarker('fixture-marker-only')
    ));

    await seedPatient('fixture-projection-only');
    await assertFails(setDoc(
      doc(db, adminOutcomePath(SECTOR, 'fixture-projection-only')),
      fictitiousAdminOutcome('fixture-projection-only')
    ));

    await seedPatient('fixture-delete-only');
    await assertFails(deleteDoc(
      doc(db, patientPath(SECTOR, 'fixture-delete-only'))
    ));

    const patientId = 'fixture-without-delete';
    await seedPatient(patientId);
    const incompleteBatch = writeBatch(db);
    incompleteBatch.set(
      doc(db, outcomePath(SECTOR, patientId)),
      fictitiousOutcome(patientId)
    );
    incompleteBatch.set(
      doc(db, markerPath(SECTOR, patientId)),
      closedPatientMarker(patientId)
    );
    await assertFails(incompleteBatch.commit());

    const missingProjectionId = 'fixture-without-projection';
    await seedPatient(missingProjectionId);
    const missingProjectionBatch = writeBatch(db);
    missingProjectionBatch.set(
      doc(db, outcomePath(SECTOR, missingProjectionId)),
      fictitiousOutcome(missingProjectionId)
    );
    missingProjectionBatch.set(
      doc(db, markerPath(SECTOR, missingProjectionId)),
      closedPatientMarker(missingProjectionId)
    );
    missingProjectionBatch.delete(
      doc(db, patientPath(SECTOR, missingProjectionId))
    );
    await assertFails(missingProjectionBatch.commit());
  });

  test('nega actorUid ou closedByUid diferentes do usuário autenticado', async () => {
    const db = clinicianDb();

    await seedPatient('fixture-wrong-outcome-actor');
    await assertFails(closePatient(db, 'fixture-wrong-outcome-actor', {
      actorUid: 'another-user'
    }));

    const patientId = 'fixture-wrong-marker-actor';
    await seedPatient(patientId);
    const batch = writeBatch(db);
    batch.set(
      doc(db, outcomePath(SECTOR, patientId)),
      fictitiousOutcome(patientId)
    );
    batch.set(
      doc(db, markerPath(SECTOR, patientId)),
      closedPatientMarker(patientId, { closedByUid: 'another-user' })
    );
    batch.set(
      doc(db, adminOutcomePath(SECTOR, patientId)),
      fictitiousAdminOutcome(patientId)
    );
    batch.delete(doc(db, patientPath(SECTOR, patientId)));
    await assertFails(batch.commit());
  });

  test('nega outcome sem médico responsável ou Óbito com CID em branco', async () => {
    const db = clinicianDb();

    const missingDoctorId = 'fixture-missing-doctor';
    await seedPatient(missingDoctorId);
    const missingDoctorOutcome = fictitiousOutcome(missingDoctorId);
    delete missingDoctorOutcome.responsibleDoctor;
    const missingDoctorBatch = writeBatch(db);
    missingDoctorBatch.set(
      doc(db, outcomePath(SECTOR, missingDoctorId)),
      missingDoctorOutcome
    );
    missingDoctorBatch.set(
      doc(db, markerPath(SECTOR, missingDoctorId)),
      closedPatientMarker(missingDoctorId)
    );
    missingDoctorBatch.set(
      doc(db, adminOutcomePath(SECTOR, missingDoctorId)),
      fictitiousAdminOutcome(missingDoctorId)
    );
    missingDoctorBatch.delete(
      doc(db, patientPath(SECTOR, missingDoctorId))
    );
    await assertFails(missingDoctorBatch.commit());

    const blankCidId = 'fixture-blank-death-cid';
    await seedPatient(blankCidId);
    const blankCidOutcome = {
      ...fictitiousOutcome(blankCidId, { outcomeType: 'death' }),
      primaryIcdCode: '   '
    };
    const blankCidBatch = writeBatch(db);
    blankCidBatch.set(
      doc(db, outcomePath(SECTOR, blankCidId)),
      blankCidOutcome
    );
    blankCidBatch.set(
      doc(db, markerPath(SECTOR, blankCidId)),
      closedPatientMarker(blankCidId, { outcomeType: 'death' })
    );
    blankCidBatch.set(
      doc(db, adminOutcomePath(SECTOR, blankCidId)),
      fictitiousAdminOutcome(blankCidId, { outcomeType: 'death' })
    );
    blankCidBatch.delete(doc(db, patientPath(SECTOR, blankCidId)));
    await assertFails(blankCidBatch.commit());
  });

  test('nega projeção com campo extra ou divergente do evento privado', async () => {
    const db = clinicianDb();

    const extraFieldId = 'fixture-projection-extra-field';
    await seedPatient(extraFieldId);
    const extraFieldBatch = writeBatch(db);
    extraFieldBatch.set(
      doc(db, outcomePath(SECTOR, extraFieldId)),
      fictitiousOutcome(extraFieldId)
    );
    extraFieldBatch.set(
      doc(db, markerPath(SECTOR, extraFieldId)),
      closedPatientMarker(extraFieldId)
    );
    extraFieldBatch.set(
      doc(db, adminOutcomePath(SECTOR, extraFieldId)),
      {
        ...fictitiousAdminOutcome(extraFieldId),
        patientSnapshot: fictitiousPatient(extraFieldId)
      }
    );
    extraFieldBatch.delete(doc(db, patientPath(SECTOR, extraFieldId)));
    await assertFails(extraFieldBatch.commit());

    const divergentId = 'fixture-projection-divergent';
    await seedPatient(divergentId);
    const divergentBatch = writeBatch(db);
    divergentBatch.set(
      doc(db, outcomePath(SECTOR, divergentId)),
      fictitiousOutcome(divergentId)
    );
    divergentBatch.set(
      doc(db, markerPath(SECTOR, divergentId)),
      closedPatientMarker(divergentId)
    );
    divergentBatch.set(
      doc(db, adminOutcomePath(SECTOR, divergentId)),
      {
        ...fictitiousAdminOutcome(divergentId),
        specialty: 'ESPECIALIDADE FICTÍCIA DIVERGENTE'
      }
    );
    divergentBatch.delete(doc(db, patientPath(SECTOR, divergentId)));
    await assertFails(divergentBatch.commit());
  });

  test('nega qualquer campo extra na lápide mínima', async () => {
    const patientId = 'fixture-marker-extra-field';
    const db = clinicianDb();
    await seedPatient(patientId);

    const batch = writeBatch(db);
    batch.set(
      doc(db, outcomePath(SECTOR, patientId)),
      fictitiousOutcome(patientId)
    );
    batch.set(
      doc(db, markerPath(SECTOR, patientId)),
      {
        ...closedPatientMarker(patientId),
        createdAtLocal: '2026-07-24T15:00:00.000Z'
      }
    );
    batch.set(
      doc(db, adminOutcomePath(SECTOR, patientId)),
      fictitiousAdminOutcome(patientId)
    );
    batch.delete(doc(db, patientPath(SECTOR, patientId)));

    await assertFails(batch.commit());
  });
});

describe('Imutabilidade e guard contra ressurreição', () => {
  test('nega update e delete do evento, projeção e lápide', async () => {
    const patientId = 'fixture-immutable';
    const db = clinicianDb();
    await seedPatient(patientId);
    await assertSucceeds(closePatient(db, patientId));

    await assertFails(updateDoc(
      doc(db, outcomePath(SECTOR, patientId)),
      { outcomeLabel: 'ALTERAÇÃO FICTÍCIA' }
    ));
    await assertFails(deleteDoc(doc(db, outcomePath(SECTOR, patientId))));
    await assertFails(updateDoc(
      doc(db, adminOutcomePath(SECTOR, patientId)),
      { outcomeLabel: 'ALTERAÇÃO FICTÍCIA' }
    ));
    await assertFails(deleteDoc(
      doc(db, adminOutcomePath(SECTOR, patientId))
    ));
    await assertFails(updateDoc(
      doc(db, markerPath(SECTOR, patientId)),
      { outcomeType: 'transferred' }
    ));
    await assertFails(deleteDoc(doc(db, markerPath(SECTOR, patientId))));
  });

  test('nega recriação do paciente quando a lápide já existe', async () => {
    const patientId = 'fixture-resurrection';
    const db = clinicianDb();
    await seedPatient(patientId);
    await assertSucceeds(closePatient(db, patientId));

    await assertFails(setDoc(
      doc(db, patientPath(SECTOR, patientId)),
      fictitiousPatient(patientId, { diagnosis: 'RESSURREIÇÃO FICTÍCIA' })
    ));
  });

  test('nega recriação manual do mesmo ID em outro setor', async () => {
    const patientId = 'fixture-cross-sector-resurrection';
    const db = clinicianDb();
    await seedPatient(patientId);
    await assertSucceeds(closePatient(db, patientId));

    await assertFails(setDoc(
      doc(db, patientPath(TARGET_SECTOR, patientId)),
      fictitiousPatient(patientId, {
        diagnosis: 'RESSURREIÇÃO FICTÍCIA EM OUTRO SETOR'
      })
    ));
  });

  test('nega combinar desfecho e migração na mesma operação', async () => {
    const patientId = 'fixture-close-and-migrate';
    const db = clinicianDb();
    await seedPatient(patientId);

    const batch = writeBatch(db);
    batch.set(
      doc(db, outcomePath(SECTOR, patientId)),
      fictitiousOutcome(patientId)
    );
    batch.set(
      doc(db, markerPath(SECTOR, patientId)),
      closedPatientMarker(patientId)
    );
    batch.set(
      doc(db, adminOutcomePath(SECTOR, patientId)),
      fictitiousAdminOutcome(patientId)
    );
    batch.set(
      doc(db, patientPath(TARGET_SECTOR, patientId)),
      fictitiousPatient(patientId, {
        migratedFrom: SECTOR,
        migratedTo: TARGET_SECTOR
      })
    );
    batch.delete(doc(db, patientPath(SECTOR, patientId)));

    await assertFails(batch.commit());
  });
});

describe('Separação de leitura clínica e administrativa', () => {
  test('clínico lê a lápide por get, mas não lista lápides nem lê histórico', async () => {
    const patientId = 'fixture-clinical-read';
    const db = clinicianDb();
    await seedPatient(patientId);
    await assertSucceeds(closePatient(db, patientId));

    await assertSucceeds(getDoc(doc(db, markerPath(SECTOR, patientId))));
    await assertFails(getDocs(
      collection(db, `connect_hub_v55/${SECTOR}/closed_patients`)
    ));
    await assertFails(getDoc(doc(db, outcomePath(SECTOR, patientId))));
    await assertFails(getDocs(collection(db, 'historico_eventos')));
    await assertFails(getDoc(
      doc(db, adminOutcomePath(SECTOR, patientId))
    ));
    await assertFails(getDocs(collection(db, 'admin_outcomes')));

    const unknownMarkerPath =
      'connect_hub_v55/setor_desconhecido/closed_patients/fixture-unknown';
    await seedDocument(unknownMarkerPath, {
      schemaVersion: 1,
      type: 'patient_closed',
      patientId: 'fixture-unknown',
      sectorUnit: 'setor_desconhecido',
      outcomeId: 'fixture-unknown-outcome',
      outcomeType: 'treated',
      closedAt: serverTimestamp(),
      closedByUid: CLINICIAN_UID
    });
    await assertFails(getDoc(doc(db, unknownMarkerPath)));
  });

  test('somente admin/coordenador real e ativo lê histórico e projeção', async () => {
    const patientId = 'fixture-admin-read';
    const clinicalDb = clinicianDb();
    await seedPatient(patientId);
    await assertSucceeds(closePatient(clinicalDb, patientId));

    await seedAdmin(ADMIN_UID, 'admin', true);
    await seedAdmin(COORDINATOR_UID, 'coordinator', true);
    await seedAdmin('inactive-admin', 'admin', false);
    await seedAdmin('federated-admin', 'admin', true);

    const adminDb = realUserDb(ADMIN_UID);
    const coordinatorDb = realUserDb(COORDINATOR_UID);
    const inactiveDb = realUserDb('inactive-admin');
    const federatedAdminDb = providerDb('federated-admin', 'google.com');

    await assertSucceeds(getDoc(doc(adminDb, outcomePath(SECTOR, patientId))));
    await assertSucceeds(getDocs(collection(adminDb, 'historico_eventos')));
    await assertSucceeds(getDoc(
      doc(adminDb, adminOutcomePath(SECTOR, patientId))
    ));
    await assertSucceeds(getDocs(collection(adminDb, 'admin_outcomes')));
    await assertSucceeds(getDocs(
      collection(adminDb, `connect_hub_v55/${SECTOR}/closed_patients`)
    ));
    await assertSucceeds(getDoc(doc(
      coordinatorDb,
      outcomePath(SECTOR, patientId)
    )));
    await assertSucceeds(getDoc(doc(
      coordinatorDb,
      adminOutcomePath(SECTOR, patientId)
    )));
    await assertFails(getDoc(doc(
      clinicalDb,
      outcomePath(SECTOR, patientId)
    )));
    await assertFails(getDoc(doc(
      clinicalDb,
      adminOutcomePath(SECTOR, patientId)
    )));
    await assertFails(getDoc(doc(
      inactiveDb,
      outcomePath(SECTOR, patientId)
    )));
    await assertFails(getDoc(doc(
      inactiveDb,
      adminOutcomePath(SECTOR, patientId)
    )));
    await assertFails(getDoc(doc(
      federatedAdminDb,
      outcomePath(SECTOR, patientId)
    )));
    await assertFails(getDocs(collection(
      federatedAdminDb,
      `connect_hub_v55/${SECTOR}/pacientes`
    )));
    await assertFails(getDoc(doc(
      federatedAdminDb,
      'admin_users/federated-admin'
    )));
  });
});

describe('Pacientes ativos e migração', () => {
  test('mantém create, update, get e list para o clínico nominal autorizado', async () => {
    const patientId = 'fixture-active-clinical';
    const db = clinicianDb();
    const patientRef = doc(db, patientPath(SECTOR, patientId));

    await assertSucceeds(setDoc(patientRef, fictitiousPatient(patientId)));
    await assertSucceeds(updateDoc(patientRef, {
      diagnosis: 'HIPÓTESE FICTÍCIA ATUALIZADA'
    }));
    const patient = await assertSucceeds(getDoc(patientRef));
    const patientList = await assertSucceeds(getDocs(
      collection(db, `connect_hub_v55/${SECTOR}/pacientes`)
    ));

    assert.equal(patient.data().diagnosis, 'HIPÓTESE FICTÍCIA ATUALIZADA');
    assert.equal(patientList.size, 1);
  });

  test('preserva migração válida e atômica entre setores', async () => {
    const patientId = 'fixture-valid-migration';
    const db = clinicianDb();
    await seedPatient(patientId);

    const migratedPatient = fictitiousPatient(patientId, {
      bed: 'UTI F-01',
      unit: 'UTI 1',
      migratedFrom: SECTOR,
      migratedTo: TARGET_SECTOR
    });
    const batch = writeBatch(db);
    batch.set(
      doc(db, patientPath(TARGET_SECTOR, patientId)),
      migratedPatient
    );
    batch.delete(doc(db, patientPath(SECTOR, patientId)));

    await assertSucceeds(batch.commit());
    const source = await assertSucceeds(
      getDoc(doc(db, patientPath(SECTOR, patientId)))
    );
    const target = await assertSucceeds(
      getDoc(doc(db, patientPath(TARGET_SECTOR, patientId)))
    );
    assert.equal(source.exists(), false);
    assert.equal(target.data().migratedFrom, SECTOR);
    assert.equal(target.data().migratedTo, TARGET_SECTOR);
  });

  test('preserva atualizações atômicas de vários pacientes ativos', async () => {
    const db = clinicianDb();
    const patientIds = Array.from(
      { length: 25 },
      (_, index) => `fixture-bulk-active-${index + 1}`
    );
    await testEnvironment.withSecurityRulesDisabled(async context => {
      const uncheckedDb = context.firestore();
      const seedBatch = writeBatch(uncheckedDb);
      patientIds.forEach(patientId => {
        seedBatch.set(
          doc(uncheckedDb, patientPath(SECTOR, patientId)),
          fictitiousPatient(patientId)
        );
      });
      await seedBatch.commit();
    });

    const reorderBatch = writeBatch(db);
    patientIds.forEach((patientId, sortOrder) => {
      reorderBatch.update(
        doc(db, patientPath(SECTOR, patientId)),
        { sortOrder }
      );
    });

    await assertSucceeds(reorderBatch.commit());
  });

  test('nega delete avulso do paciente ativo', async () => {
    const patientId = 'fixture-standalone-delete';
    const db = clinicianDb();
    await seedPatient(patientId);

    await assertFails(deleteDoc(doc(db, patientPath(SECTOR, patientId))));
    const patient = await assertSucceeds(
      getDoc(doc(db, patientPath(SECTOR, patientId)))
    );
    assert.equal(patient.exists(), true);
  });
});

describe('Auditoria incremental existente', () => {
  test('mantém criação imutável de evento legado sem liberar sua leitura clínica', async () => {
    const patientId = 'fixture-legacy-audit';
    const db = clinicianDb();
    const eventRef = doc(collection(db, 'historico_eventos'));

    await assertSucceeds(setDoc(eventRef, {
      type: 'patient_updated',
      createdAt: serverTimestamp(),
      createdAtLocal: '2026-07-24T15:00:00.000Z',
      dateLocal: '2026-07-24',
      actor: 'MÉDICO FICTÍCIO RULES',
      actorUid: CLINICIAN_UID,
      patientId,
      patientName: 'PACIENTE FICTÍCIO RULES',
      sectorUnit: SECTOR,
      sectorName: 'Emergência',
      description: 'Paciente fictício editado',
      changes: {
        bed: { before: 'Leito F-01', after: 'Leito F-02' }
      }
    }));
    await assertFails(getDoc(eventRef));
    await assertFails(updateDoc(eventRef, {
      description: 'ALTERAÇÃO FICTÍCIA'
    }));
    await assertFails(deleteDoc(eventRef));

    await assertFails(setDoc(doc(collection(db, 'historico_eventos')), {
      type: 'patient_updated',
      createdAt: serverTimestamp(),
      createdAtLocal: '2026-07-24T15:00:00.000Z',
      patientId,
      sectorUnit: SECTOR
    }));
    await assertFails(setDoc(doc(collection(db, 'historico_eventos')), {
      type: 'patient_updated',
      createdAt: serverTimestamp(),
      createdAtLocal: '2026-07-24T15:00:00.000Z',
      patientId,
      sectorUnit: SECTOR,
      actorUid: 'outro-clinico-ficticio'
    }));
  });

  test('reserva o ID determinístico de Desfecho contra evento legado', async () => {
    const patientId = 'fixture-reserved-outcome-id';
    const db = clinicianDb();
    const reservedRef = doc(db, outcomePath(SECTOR, patientId));
    await seedPatient(patientId);

    await assertFails(setDoc(reservedRef, {
      type: 'patient_updated',
      createdAt: serverTimestamp(),
      createdAtLocal: '2026-07-24T15:00:00.000Z',
      patientId,
      sectorUnit: SECTOR
    }));
    await assertSucceeds(closePatient(db, patientId));
  });
});

describe('Confirmações de transição de cuidados', () => {
  test('permite criar o contrato atual e ler, mas impede alterar ou apagar', async () => {
    const db = clinicianDb();
    const confirmationRef = doc(
      db,
      `connect_hub_v55/${SECTOR}/confirmacoes/fixture-confirmation`
    );
    const confirmation = fictitiousConfirmation();

    await assertSucceeds(setDoc(confirmationRef, confirmation));
    await assertSucceeds(getDoc(confirmationRef));
    await assertSucceeds(getDocs(
      collection(db, `connect_hub_v55/${SECTOR}/confirmacoes`)
    ));
    await assertFails(updateDoc(confirmationRef, {
      totalPatients: 4
    }));
    await assertFails(deleteDoc(confirmationRef));
  });

  test('nega confirmação anônima ausente ou com identidade/setor inválidos', async () => {
    const db = clinicianDb();
    const unauthenticatedDb = testEnvironment
      .unauthenticatedContext()
      .firestore();

    await assertFails(setDoc(
      doc(
        unauthenticatedDb,
        `connect_hub_v55/${SECTOR}/confirmacoes/fixture-unauthenticated`
      ),
      fictitiousConfirmation()
    ));

    const missingSchema = fictitiousConfirmation();
    delete missingSchema.schemaVersion;
    await assertFails(setDoc(
      doc(
        db,
        `connect_hub_v55/${SECTOR}/confirmacoes/fixture-missing-schema`
      ),
      missingSchema
    ));

    await assertFails(setDoc(
      doc(
        db,
        `connect_hub_v55/${SECTOR}/confirmacoes/fixture-wrong-type`
      ),
      {
        ...fictitiousConfirmation(),
        type: 'patient_updated'
      }
    ));

    await assertFails(setDoc(
      doc(
        db,
        `connect_hub_v55/${SECTOR}/confirmacoes/fixture-wrong-sector`
      ),
      fictitiousConfirmation({ sectorUnit: TARGET_SECTOR })
    ));

    await assertFails(setDoc(
      doc(
        db,
        `connect_hub_v55/${SECTOR}/confirmacoes/fixture-wrong-actor`
      ),
      fictitiousConfirmation({ actorUid: 'another-user' })
    ));

    await assertFails(setDoc(
      doc(
        db,
        `connect_hub_v55/${SECTOR}/confirmacoes/fixture-client-timestamp`
      ),
      {
        ...fictitiousConfirmation(),
        createdAt: '2026-07-24T15:00:00.000Z'
      }
    ));

    await assertFails(setDoc(
      doc(
        db,
        `connect_hub_v55/${SECTOR}/confirmacoes/fixture-extra-field`
      ),
      {
        ...fictitiousConfirmation(),
        arbitraryTopLevelField: 'CONTEÚDO FICTÍCIO'
      }
    ));
  });

  test('aceita legado estrito e nega campo extra ou timestamp do cliente', async () => {
    const db = clinicianDb();
    const confirmationRoot = `connect_hub_v55/${SECTOR}/confirmacoes`;

    await assertSucceeds(setDoc(
      doc(db, `${confirmationRoot}/fixture-legacy-valid`),
      fictitiousLegacyConfirmation()
    ));

    await assertFails(setDoc(
      doc(db, `${confirmationRoot}/fixture-legacy-extra-field`),
      {
        ...fictitiousLegacyConfirmation(),
        arbitraryTopLevelField: 'CONTEÚDO FICTÍCIO'
      }
    ));

    await assertFails(setDoc(
      doc(db, `${confirmationRoot}/fixture-legacy-client-timestamp`),
      {
        ...fictitiousLegacyConfirmation(),
        createdAt: '2026-07-24T15:00:00.000Z'
      }
    ));
  });
});
