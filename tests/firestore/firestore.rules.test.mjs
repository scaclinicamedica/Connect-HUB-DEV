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
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';

const PROJECT_ID = 'demo-connect-hub-rules';
const CLINICIAN_UID = 'clinician-fixture';
const ADMIN_UID = 'admin-fixture';
const COORDINATOR_UID = 'coordinator-fixture';
const SECTOR = 'emergencia';
const TARGET_SECTOR = 'uti_1';
const SOURCE_VERSION =
  'FOUNDATION-1.0-RC1.3.3-OUTCOME-NOSOLOGY-SECTOR-LOS';
const TRACKING_ENTERED_AT = Timestamp.fromDate(
  new Date('2026-07-20T10:00:00.000Z')
);
const SECTOR_NAMES = {
  emergencia: 'Emergência',
  observacao_sus: 'Observação SUS',
  convenio: 'Convênio',
  enfermaria: 'Enfermaria',
  uti: 'UTI',
  uti_1: 'UTI 1',
  uti_2: 'UTI 2'
};

let testEnvironment;

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
    firebase: { sign_in_provider: 'anonymous' }
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

function transitionPath(factId) {
  return `admin_sector_transitions/${factId}`;
}

function expectedEpisodeId(patientId) {
  return `patient_episode_${patientId}`;
}

function legacyOutcomeTracking() {
  return {
    sectorTrackingVersion: 0,
    episodeId: '',
    sectorTrackingOrigin: '',
    lastSectorTransitionFactId: '',
    sectorEnteredAt: null
  };
}

function trackedPatientFields({
  episodeId = 'episode-fixture',
  sectorTrackingOrigin = 'initial_entry',
  lastSectorTransitionFactId = '',
  sectorEnteredAt = TRACKING_ENTERED_AT
} = {}) {
  return {
    sectorTrackingVersion: 1,
    episodeId,
    sectorTrackingOrigin,
    lastSectorTransitionFactId,
    sectorEnteredAt
  };
}

function fictitiousPatient(patientId, extra = {}) {
  return {
    id: patientId,
    name: 'PACIENTE FICTÍCIO RULES',
    bed: 'Leito F-01',
    unit: 'Ala Fictícia',
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
  outcomeType = 'treated',
  alerts = [],
  primaryIcdCode = 'Z00.0',
  tracking = legacyOutcomeTracking()
} = {}) {
  const id = outcomeId(sectorUnit, patientId);
  const patient = fictitiousPatient(patientId, {
    alerts,
    ...(tracking.sectorTrackingVersion === 1 ? tracking : {})
  });
  return {
    schemaVersion: 2,
    sourceVersion: SOURCE_VERSION,
    outcomeId: id,
    type: 'patient_outcome',
    outcomeType,
    outcomeLabel: outcomeType === 'death'
      ? 'Óbito'
      : outcomeType === 'transferred'
        ? 'Transferência externa'
        : 'Alta médica',
    createdAt: serverTimestamp(),
    createdAtLocal: '2026-07-24T15:00:00.000Z',
    dateLocal: '2026-07-24',
    patientId,
    patientName: patient.name,
    sectorUnit,
    sectorName: SECTOR_NAMES[sectorUnit],
    unit: 'Ala Fictícia',
    bed: patient.bed,
    specialty: patient.specialty,
    admissionDate: patient.admissionDate,
    lengthOfStayDays: 5,
    lengthOfStayMethod: 'inclusive_calendar_days',
    responsibleDoctor: 'MÉDICO FICTÍCIO RULES',
    actor: 'MÉDICO FICTÍCIO RULES',
    actorUid,
    primaryIcdCode,
    ...tracking,
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
  outcomeType = 'treated',
  alerts = [],
  primaryIcdCode = 'Z00.0',
  tracking = legacyOutcomeTracking()
} = {}) {
  const outcome = fictitiousOutcome(patientId, {
    sectorUnit,
    actorUid,
    outcomeType,
    alerts,
    primaryIcdCode,
    tracking
  });
  return {
    schemaVersion: 3,
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
    palliativeAlertPresentAtOutcome: outcome.alerts.includes('Paliativo'),
    sectorTrackingVersion: outcome.sectorTrackingVersion,
    episodeId: outcome.episodeId,
    sectorTrackingOrigin: outcome.sectorTrackingOrigin,
    lastSectorTransitionFactId: outcome.lastSectorTransitionFactId,
    sectorEnteredAt: outcome.sectorEnteredAt,
    actorUid: outcome.actorUid
  };
}

function migrationFactId(patientId) {
  return `sector-transition-${patientId}`;
}

function patientLocationUnit(patient) {
  return patient.inpatientUnit
    || patient.wardUnit
    || patient.unit
    || patient.obsLocation
    || '';
}

function transitionLocation(sectorUnit, patient) {
  return {
    catalogVersion: 1,
    canonicalSectorId: sectorUnit,
    sectorUnit,
    sectorName: SECTOR_NAMES[sectorUnit],
    unit: patientLocationUnit(patient),
    bed: patient.bed || ''
  };
}

function migrationDocuments(patientId, {
  sourceSector = SECTOR,
  targetSector = TARGET_SECTOR,
  legacySource = false
} = {}) {
  const id = migrationFactId(patientId);
  const episodeId = expectedEpisodeId(patientId);
  const predecessorFactId = '';
  const trackingOrigin = legacySource
    ? 'baseline_observation'
    : 'initial_entry';
  const source = fictitiousPatient(patientId, {
    unit: sourceSector === 'emergencia'
      ? 'Sala Vermelha'
      : SECTOR_NAMES[sourceSector],
    bed: 'Leito F-01',
    ...(legacySource
      ? {}
      : trackedPatientFields({
          episodeId,
          sectorTrackingOrigin: trackingOrigin,
          lastSectorTransitionFactId: predecessorFactId
        }))
  });
  const target = {
    ...source,
    unit: SECTOR_NAMES[targetSector],
    inpatientUnit: SECTOR_NAMES[targetSector],
    bed: 'UTI F-01',
    migratedFrom: sourceSector,
    migratedFromName: SECTOR_NAMES[sourceSector],
    migratedTo: targetSector,
    migratedToName: SECTOR_NAMES[targetSector],
    ...trackedPatientFields({
      episodeId,
      sectorTrackingOrigin: trackingOrigin,
      lastSectorTransitionFactId: id,
      sectorEnteredAt: serverTimestamp()
    })
  };
  const fact = {
    schemaVersion: 1,
    sourceVersion: SOURCE_VERSION,
    type: 'patient_sector_transition_admin',
    factId: id,
    episodeId,
    patientId,
    occurredAt: serverTimestamp(),
    actorUid: CLINICIAN_UID,
    predecessorFactId,
    movementClassification:
      sourceSector === 'enfermaria' && targetSector === 'emergencia'
        ? 'counterflow_transfer'
        : sourceSector === 'convenio' && targetSector === 'emergencia'
          ? 'counterflow_transfer'
          : 'sector_transfer',
    trackingOrigin,
    originEnteredAt: legacySource ? null : TRACKING_ENTERED_AT,
    origin: transitionLocation(sourceSector, source),
    destination: transitionLocation(targetSector, target)
  };
  return { factId: id, source, target, fact };
}

async function migratePatient(db, patientId, documents) {
  const {
    factId,
    source,
    target,
    fact
  } = documents;
  const batch = writeBatch(db);
  batch.set(doc(db, transitionPath(factId)), fact);
  batch.set(
    doc(db, patientPath(fact.destination.sectorUnit, patientId)),
    target
  );
  batch.delete(
    doc(db, patientPath(fact.origin.sectorUnit, patientId))
  );
  await batch.commit();
  return { factId, source, target, fact };
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
  await seedDocument(`admin_users/${uid}`, { active, role });
}

async function closePatient(db, patientId, {
  sectorUnit = SECTOR,
  actorUid = CLINICIAN_UID,
  outcomeType = 'treated',
  alerts = [],
  primaryIcdCode = 'Z00.0',
  tracking = legacyOutcomeTracking()
} = {}) {
  const batch = writeBatch(db);
  batch.set(
    doc(db, outcomePath(sectorUnit, patientId)),
    fictitiousOutcome(patientId, {
      sectorUnit,
      actorUid,
      outcomeType,
      alerts,
      primaryIcdCode,
      tracking
    })
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
      outcomeType,
      alerts,
      primaryIcdCode,
      tracking
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
});

after(async () => {
  await testEnvironment?.cleanup();
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
        'episodeId',
        'lastSectorTransitionFactId',
        'lengthOfStayDays',
        'lengthOfStayMethod',
        'outcomeId',
        'outcomeLabel',
        'outcomeType',
        'palliativeAlertPresentAtOutcome',
        'patientId',
        'patientName',
        'primaryIcdCode',
        'responsibleDoctor',
        'schemaVersion',
        'sectorEnteredAt',
        'sectorName',
        'sectorTrackingOrigin',
        'sectorTrackingVersion',
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
    assert.equal(persisted.outcome.data().schemaVersion, 2);
    assert.equal(persisted.projection.data().schemaVersion, 3);
    assert.equal(persisted.outcome.data().sectorTrackingVersion, 0);
    assert.equal(persisted.outcome.data().episodeId, '');
    assert.equal(persisted.outcome.data().sectorTrackingOrigin, '');
    assert.equal(
      persisted.outcome.data().lastSectorTransitionFactId,
      ''
    );
    assert.equal(persisted.outcome.data().sectorEnteredAt, null);
    assert.equal('patientSnapshot' in persisted.projection.data(), false);

    const extendedId = 'fixture-valid-outcome-with-legacy-extension';
    const extendedPatient = fictitiousPatient(extendedId, {
      updatedAt: TRACKING_ENTERED_AT,
      legacyClinicalExtension: {
        note: 'EXTENSÃO CLÍNICA FICTÍCIA',
        score: 7
      }
    });
    await seedDocument(patientPath(SECTOR, extendedId), extendedPatient);
    const extendedOutcome = fictitiousOutcome(extendedId);
    extendedOutcome.patientSnapshot = extendedPatient;
    const extendedBatch = writeBatch(db);
    extendedBatch.set(
      doc(db, outcomePath(SECTOR, extendedId)),
      extendedOutcome
    );
    extendedBatch.set(
      doc(db, markerPath(SECTOR, extendedId)),
      closedPatientMarker(extendedId)
    );
    extendedBatch.set(
      doc(db, adminOutcomePath(SECTOR, extendedId)),
      fictitiousAdminOutcome(extendedId)
    );
    extendedBatch.delete(doc(db, patientPath(SECTOR, extendedId)));
    await assertSucceeds(extendedBatch.commit());
  });

  test('propaga tracking v1 exato e nega envelope divergente do ativo', async () => {
    const db = clinicianDb();
    const tracking = trackedPatientFields({
      episodeId: 'episode-outcome-tracked',
      lastSectorTransitionFactId: 'transition-before-outcome'
    });
    const patientId = 'fixture-tracked-outcome';
    await seedPatient(patientId, SECTOR, tracking);

    await assertSucceeds(closePatient(db, patientId, { tracking }));

    let persisted;
    await testEnvironment.withSecurityRulesDisabled(async context => {
      const uncheckedDb = context.firestore();
      persisted = {
        outcome: (
          await getDoc(doc(uncheckedDb, outcomePath(SECTOR, patientId)))
        ).data(),
        projection: (
          await getDoc(doc(
            uncheckedDb,
            adminOutcomePath(SECTOR, patientId)
          ))
        ).data()
      };
    });
    assert.equal(persisted.outcome.sectorTrackingVersion, 1);
    assert.equal(persisted.outcome.episodeId, tracking.episodeId);
    assert.equal(
      persisted.outcome.lastSectorTransitionFactId,
      tracking.lastSectorTransitionFactId
    );
    assert.equal(
      persisted.outcome.sectorEnteredAt.toMillis(),
      TRACKING_ENTERED_AT.toMillis()
    );
    assert.equal(
      persisted.projection.episodeId,
      persisted.outcome.episodeId
    );

    const divergentId = 'fixture-tracked-outcome-divergent';
    await seedPatient(divergentId, SECTOR, tracking);
    await assertFails(closePatient(db, divergentId, {
      tracking: {
        ...tracking,
        lastSectorTransitionFactId: 'forged-transition'
      }
    }));
  });

  test('exige v3, preserva leitura legada no painel e nega divergência', async () => {
    const db = clinicianDb();

    const palliativeId = 'fixture-palliative-outcome';
    await seedPatient(palliativeId, SECTOR, { alerts: ['Paliativo'] });
    await assertSucceeds(closePatient(db, palliativeId, {
      alerts: ['Paliativo']
    }));

    let palliativeProjection;
    await testEnvironment.withSecurityRulesDisabled(async context => {
      palliativeProjection = (
        await getDoc(doc(
          context.firestore(),
          adminOutcomePath(SECTOR, palliativeId)
        ))
      ).data();
    });
    assert.equal(palliativeProjection.schemaVersion, 3);
    assert.equal(palliativeProjection.palliativeAlertPresentAtOutcome, true);

    const legacyId = 'fixture-legacy-admin-projection';
    await seedPatient(legacyId);
    const legacyProjection = fictitiousAdminOutcome(legacyId);
    legacyProjection.schemaVersion = 2;
    delete legacyProjection.palliativeAlertPresentAtOutcome;
    const legacyBatch = writeBatch(db);
    legacyBatch.set(
      doc(db, outcomePath(SECTOR, legacyId)),
      fictitiousOutcome(legacyId)
    );
    legacyBatch.set(
      doc(db, markerPath(SECTOR, legacyId)),
      closedPatientMarker(legacyId)
    );
    legacyBatch.set(
      doc(db, adminOutcomePath(SECTOR, legacyId)),
      legacyProjection
    );
    legacyBatch.delete(doc(db, patientPath(SECTOR, legacyId)));
    await assertFails(legacyBatch.commit());

    const divergentId = 'fixture-divergent-palliative-projection';
    await seedPatient(divergentId, SECTOR, { alerts: ['Paliativo'] });
    const divergentBatch = writeBatch(db);
    divergentBatch.set(
      doc(db, outcomePath(SECTOR, divergentId)),
      fictitiousOutcome(divergentId, { alerts: ['Paliativo'] })
    );
    divergentBatch.set(
      doc(db, markerPath(SECTOR, divergentId)),
      closedPatientMarker(divergentId)
    );
    divergentBatch.set(
      doc(db, adminOutcomePath(SECTOR, divergentId)),
      {
        ...fictitiousAdminOutcome(divergentId, {
          alerts: ['Paliativo']
        }),
        palliativeAlertPresentAtOutcome: false
      }
    );
    divergentBatch.delete(doc(db, patientPath(SECTOR, divergentId)));
    await assertFails(divergentBatch.commit());

    async function assertRejectedProjection(patientId, {
      activeAlerts = [],
      outcomeAlerts = activeAlerts,
      mutateProjection = projection => projection
    } = {}) {
      await seedPatient(patientId, SECTOR, { alerts: activeAlerts });
      const outcome = fictitiousOutcome(patientId, { alerts: outcomeAlerts });
      const projection = mutateProjection(
        fictitiousAdminOutcome(patientId, { alerts: outcomeAlerts })
      );
      const batch = writeBatch(db);
      batch.set(doc(db, outcomePath(SECTOR, patientId)), outcome);
      batch.set(
        doc(db, markerPath(SECTOR, patientId)),
        closedPatientMarker(patientId)
      );
      batch.set(
        doc(db, adminOutcomePath(SECTOR, patientId)),
        projection
      );
      batch.delete(doc(db, patientPath(SECTOR, patientId)));
      await assertFails(batch.commit());
    }

    await assertRejectedProjection('fixture-v3-without-palliative-field', {
      mutateProjection(projection) {
        delete projection.palliativeAlertPresentAtOutcome;
        return projection;
      }
    });
    await assertRejectedProjection('fixture-v3-invalid-palliative-field', {
      mutateProjection(projection) {
        projection.palliativeAlertPresentAtOutcome = 'true';
        return projection;
      }
    });
    await assertRejectedProjection('fixture-v2-with-v3-field', {
      mutateProjection(projection) {
        projection.schemaVersion = 2;
        return projection;
      }
    });
    await assertRejectedProjection('fixture-forged-palliative-event', {
      activeAlerts: [],
      outcomeAlerts: ['Paliativo']
    });
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

  test('exige CID estruturado em Alta, Óbito e Transferência externa', async () => {
    const db = clinicianDb();
    const matrix = [
      ['treated', 'Alta médica'],
      ['death', 'Óbito'],
      ['transferred', 'Transferência externa']
    ];

    for (const [outcomeType, outcomeLabel] of matrix) {
      const validId = `fixture-valid-cid-${outcomeType}`;
      await seedPatient(validId);
      await assertSucceeds(closePatient(db, validId, {
        outcomeType,
        primaryIcdCode: 'I48.0'
      }));
      let persistedOutcome;
      await testEnvironment.withSecurityRulesDisabled(async context => {
        persistedOutcome = (
          await getDoc(doc(
            context.firestore(),
            outcomePath(SECTOR, validId)
          ))
        ).data();
      });
      assert.equal(persistedOutcome.outcomeLabel, outcomeLabel);
      assert.equal(persistedOutcome.primaryIcdCode, 'I48.0');

      const blankId = `fixture-blank-cid-${outcomeType}`;
      await seedPatient(blankId);
      await assertFails(closePatient(db, blankId, {
        outcomeType,
        primaryIcdCode: ''
      }));

      const invalidId = `fixture-invalid-cid-${outcomeType}`;
      await seedPatient(invalidId);
      await assertFails(closePatient(db, invalidId, {
        outcomeType,
        primaryIcdCode: 'TEXTO IDENTIFICÁVEL'
      }));

      const lowercaseId = `fixture-lowercase-cid-${outcomeType}`;
      await seedPatient(lowercaseId);
      await assertFails(closePatient(db, lowercaseId, {
        outcomeType,
        primaryIcdCode: 'i48.0'
      }));

      const paddedId = `fixture-padded-cid-${outcomeType}`;
      await seedPatient(paddedId);
      await assertFails(closePatient(db, paddedId, {
        outcomeType,
        primaryIcdCode: ' I48.0 '
      }));
    }
  });

  test('nega médico ausente ou DIH fora do formato', async () => {
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

    const invalidAdmissionId = 'fixture-invalid-admission-date';
    await seedPatient(invalidAdmissionId);
    const invalidAdmissionOutcome = {
      ...fictitiousOutcome(invalidAdmissionId),
      admissionDate: '2026-07-20XYZ'
    };
    const invalidAdmissionProjection = {
      ...fictitiousAdminOutcome(invalidAdmissionId),
      admissionDate: '2026-07-20XYZ'
    };
    const invalidAdmissionBatch = writeBatch(db);
    invalidAdmissionBatch.set(
      doc(db, outcomePath(SECTOR, invalidAdmissionId)),
      invalidAdmissionOutcome
    );
    invalidAdmissionBatch.set(
      doc(db, markerPath(SECTOR, invalidAdmissionId)),
      closedPatientMarker(invalidAdmissionId)
    );
    invalidAdmissionBatch.set(
      doc(db, adminOutcomePath(SECTOR, invalidAdmissionId)),
      invalidAdmissionProjection
    );
    invalidAdmissionBatch.delete(
      doc(db, patientPath(SECTOR, invalidAdmissionId))
    );
    await assertFails(invalidAdmissionBatch.commit());
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

  test('vincula evento e snapshot às dimensões essenciais do paciente ativo', async () => {
    const db = clinicianDb();

    async function assertRejected(patientId, mutate, activeExtra = {}) {
      await seedPatient(patientId, SECTOR, activeExtra);
      const outcome = fictitiousOutcome(patientId);
      const projection = fictitiousAdminOutcome(patientId);
      mutate(outcome, projection);
      const batch = writeBatch(db);
      batch.set(doc(db, outcomePath(SECTOR, patientId)), outcome);
      batch.set(
        doc(db, markerPath(SECTOR, patientId)),
        closedPatientMarker(patientId)
      );
      batch.set(
        doc(db, adminOutcomePath(SECTOR, patientId)),
        projection
      );
      batch.delete(doc(db, patientPath(SECTOR, patientId)));
      await assertFails(batch.commit());
    }

    await assertRejected('fixture-private-outcome-extra-field', outcome => {
      outcome.arbitraryTopLevelField = 'CONTEÚDO FICTÍCIO';
    });
    await assertRejected(
      'fixture-active-id-divergent',
      () => {},
      { id: 'fixture-active-id-forged' }
    );
    await assertRejected(
      'fixture-forged-outcome-name',
      (outcome, projection) => {
        outcome.patientName = 'NOME FICTÍCIO FORJADO';
        outcome.patientSnapshot = {
          ...outcome.patientSnapshot,
          name: 'NOME FICTÍCIO FORJADO'
        };
        projection.patientName = outcome.patientName;
      }
    );
    await assertRejected(
      'fixture-forged-outcome-location',
      (outcome, projection) => {
        outcome.unit = 'UNIDADE FICTÍCIA FORJADA';
        outcome.bed = 'LEITO FICTÍCIO FORJADO';
        outcome.patientSnapshot = {
          ...outcome.patientSnapshot,
          unit: outcome.unit,
          bed: outcome.bed
        };
        projection.unit = outcome.unit;
        projection.bed = outcome.bed;
      }
    );
    await assertRejected(
      'fixture-forged-outcome-snapshot',
      outcome => {
        outcome.patientSnapshot = {
          ...outcome.patientSnapshot,
          specialty: 'ESPECIALIDADE FICTÍCIA FORJADA'
        };
      }
    );
    await assertRejected(
      'fixture-forged-outcome-clinical-snapshot',
      outcome => {
        outcome.patientSnapshot = {
          ...outcome.patientSnapshot,
          diagnosis: 'HIPÓTESE FICTÍCIA FORJADA'
        };
      }
    );
    await assertRejected(
      'fixture-forged-outcome-sector-name',
      (outcome, projection) => {
        outcome.sectorName = 'SETOR FICTÍCIO FORJADO';
        projection.sectorName = outcome.sectorName;
      }
    );
    await assertRejected(
      'fixture-forged-outcome-alerts',
      (outcome, projection) => {
        outcome.alerts = ['Isolamento'];
        outcome.patientSnapshot = {
          ...outcome.patientSnapshot,
          alerts: ['Isolamento']
        };
        projection.palliativeAlertPresentAtOutcome = false;
      }
    );
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
  });

  test('somente admin/coordenador real e ativo lê histórico e projeção', async () => {
    const patientId = 'fixture-admin-read';
    const clinicalDb = clinicianDb();
    await seedPatient(patientId);
    await assertSucceeds(closePatient(clinicalDb, patientId));

    await seedAdmin(ADMIN_UID, 'admin', true);
    await seedAdmin(COORDINATOR_UID, 'coordinator', true);
    await seedAdmin(CLINICIAN_UID, 'admin', true);
    await seedAdmin('inactive-admin', 'admin', false);

    const adminDb = realUserDb(ADMIN_UID);
    const coordinatorDb = realUserDb(COORDINATOR_UID);
    const inactiveDb = realUserDb('inactive-admin');

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
  });
});

describe('Pacientes ativos e migração', () => {
  test('mantém create v1, update, get e list para o clínico autenticado anônimo', async () => {
    const patientId = 'fixture-active-clinical';
    const db = clinicianDb();
    const patientRef = doc(db, patientPath(SECTOR, patientId));

    await assertSucceeds(setDoc(patientRef, fictitiousPatient(patientId, {
      ...trackedPatientFields({
        episodeId: expectedEpisodeId(patientId),
        sectorEnteredAt: serverTimestamp()
      })
    })));
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

  test('cria tracking inicial válido e impede adulteração em update comum', async () => {
    const patientId = 'fixture-tracked-active';
    const db = clinicianDb();
    const patientRef = doc(db, patientPath(SECTOR, patientId));
    await assertSucceeds(setDoc(patientRef, fictitiousPatient(patientId, {
      ...trackedPatientFields({
        episodeId: expectedEpisodeId(patientId),
        sectorEnteredAt: serverTimestamp()
      })
    })));
    await assertSucceeds(updateDoc(patientRef, {
      diagnosis: 'HIPÓTESE FICTÍCIA ATUALIZADA'
    }));
    await assertFails(updateDoc(patientRef, {
      lastSectorTransitionFactId: 'forged-transition'
    }));
    await assertFails(updateDoc(patientRef, {
      episodeId: 'forged-episode'
    }));
    await assertFails(updateDoc(patientRef, {
      id: 'forged-patient-id'
    }));

    const invalidBaselineRef = doc(
      db,
      patientPath(SECTOR, 'fixture-invalid-baseline-create')
    );
    await assertFails(setDoc(
      invalidBaselineRef,
      fictitiousPatient('fixture-invalid-baseline-create', {
        ...trackedPatientFields({
          episodeId: expectedEpisodeId('fixture-invalid-baseline-create'),
          sectorTrackingOrigin: 'baseline_observation',
          sectorEnteredAt: serverTimestamp()
        })
      })
    ));

    const legacyCreateId = 'fixture-rejected-legacy-create';
    await assertFails(setDoc(
      doc(db, patientPath(SECTOR, legacyCreateId)),
      fictitiousPatient(legacyCreateId)
    ));

    const wrongEpisodeId = 'fixture-wrong-initial-episode';
    await assertFails(setDoc(
      doc(db, patientPath(SECTOR, wrongEpisodeId)),
      fictitiousPatient(wrongEpisodeId, {
        ...trackedPatientFields({
          episodeId: 'patient_episode_forged',
          sectorEnteredAt: serverTimestamp()
        })
      })
    ));

    const wrongDocumentId = 'fixture-wrong-document-id';
    await assertFails(setDoc(
      doc(db, patientPath(SECTOR, wrongDocumentId)),
      fictitiousPatient('different-patient-id', {
        ...trackedPatientFields({
          episodeId: expectedEpisodeId(wrongDocumentId),
          sectorEnteredAt: serverTimestamp()
        })
      })
    ));
  });

  test('aceita fato atômico em migração de paciente rastreado', async () => {
    const patientId = 'fixture-valid-tracked-migration';
    const db = clinicianDb();
    const documents = migrationDocuments(patientId);
    await seedDocument(
      patientPath(SECTOR, patientId),
      documents.source
    );

    await assertSucceeds(migratePatient(db, patientId, documents));

    const source = await assertSucceeds(
      getDoc(doc(db, patientPath(SECTOR, patientId)))
    );
    const target = await assertSucceeds(
      getDoc(doc(db, patientPath(TARGET_SECTOR, patientId)))
    );
    assert.equal(source.exists(), false);
    assert.equal(target.data().migratedFrom, SECTOR);
    assert.equal(target.data().migratedTo, TARGET_SECTOR);
    assert.equal(target.data().sectorTrackingVersion, 1);
    assert.equal(target.data().episodeId, documents.fact.episodeId);
    assert.equal(
      target.data().lastSectorTransitionFactId,
      documents.factId
    );
    assert.equal(
      target.data().sectorTrackingOrigin,
      documents.source.sectorTrackingOrigin
    );

    let persistedFact;
    await testEnvironment.withSecurityRulesDisabled(async context => {
      persistedFact = (
        await getDoc(doc(
          context.firestore(),
          transitionPath(documents.factId)
        ))
      ).data();
    });
    assert.equal(persistedFact.patientId, patientId);
    assert.equal(
      persistedFact.predecessorFactId,
      documents.source.lastSectorTransitionFactId
    );
    assert.equal(
      persistedFact.originEnteredAt.toMillis(),
      TRACKING_ENTERED_AT.toMillis()
    );
    assert.equal(
      persistedFact.occurredAt.toMillis(),
      target.data().sectorEnteredAt.toMillis()
    );
  });

  test('nega reaproveitar fato válido para migrar outro paciente no mesmo batch', async () => {
    const db = clinicianDb();
    const validPatientId = 'fixture-fact-owner';
    const reusedPatientId = 'fixture-fact-cross-patient';
    const valid = migrationDocuments(validPatientId);
    const reused = migrationDocuments(reusedPatientId);
    await seedDocument(
      patientPath(SECTOR, validPatientId),
      valid.source
    );
    await seedDocument(
      patientPath(SECTOR, reusedPatientId),
      reused.source
    );

    const batch = writeBatch(db);
    batch.set(doc(db, transitionPath(valid.factId)), valid.fact);
    batch.set(
      doc(db, patientPath(TARGET_SECTOR, validPatientId)),
      valid.target
    );
    batch.delete(doc(db, patientPath(SECTOR, validPatientId)));
    batch.set(
      doc(db, patientPath(TARGET_SECTOR, reusedPatientId)),
      {
        ...reused.target,
        lastSectorTransitionFactId: valid.factId
      }
    );
    batch.delete(doc(db, patientPath(SECTOR, reusedPatientId)));

    await assertFails(batch.commit());
  });

  test('nega reaproveitar fato do paciente em outro par de setores', async () => {
    const db = clinicianDb();
    const patientId = 'fixture-fact-cross-sector';
    const valid = migrationDocuments(patientId);
    const reused = migrationDocuments(patientId, {
      sourceSector: 'enfermaria',
      targetSector: 'convenio'
    });
    await seedDocument(patientPath(SECTOR, patientId), valid.source);
    await seedDocument(
      patientPath('enfermaria', patientId),
      reused.source
    );

    const batch = writeBatch(db);
    batch.set(doc(db, transitionPath(valid.factId)), valid.fact);
    batch.set(
      doc(db, patientPath(TARGET_SECTOR, patientId)),
      valid.target
    );
    batch.delete(doc(db, patientPath(SECTOR, patientId)));
    batch.set(
      doc(db, patientPath('convenio', patientId)),
      {
        ...reused.target,
        lastSectorTransitionFactId: valid.factId
      }
    );
    batch.delete(doc(db, patientPath('enfermaria', patientId)));

    await assertFails(batch.commit());
  });

  test('faz bootstrap baseline_observation ao migrar paciente legado', async () => {
    const patientId = 'fixture-valid-legacy-migration-%';
    const db = clinicianDb();
    const documents = migrationDocuments(patientId, {
      legacySource: true
    });
    await seedDocument(
      patientPath(SECTOR, patientId),
      documents.source
    );

    await assertSucceeds(migratePatient(db, patientId, documents));

    const target = await assertSucceeds(
      getDoc(doc(db, patientPath(TARGET_SECTOR, patientId)))
    );
    assert.equal(target.data().sectorTrackingVersion, 1);
    assert.equal(
      target.data().sectorTrackingOrigin,
      'baseline_observation'
    );
    assert.equal(target.data().episodeId, expectedEpisodeId(patientId));

    let persistedFact;
    await testEnvironment.withSecurityRulesDisabled(async context => {
      persistedFact = (
        await getDoc(doc(
          context.firestore(),
          transitionPath(documents.factId)
        ))
      ).data();
    });
    assert.equal(persistedFact.predecessorFactId, '');
    assert.equal(persistedFact.trackingOrigin, 'baseline_observation');
    assert.equal(persistedFact.originEnteredAt, null);
  });

  test('aceita counterflow_transfer somente no contrafluxo homologado', async () => {
    const patientId = 'fixture-valid-counterflow-transition';
    const db = clinicianDb();
    const documents = migrationDocuments(patientId, {
      sourceSector: 'convenio',
      targetSector: 'emergencia',
      legacySource: true
    });
    await seedDocument(
      patientPath('convenio', patientId),
      documents.source
    );

    await assertSucceeds(migratePatient(db, patientId, documents));

    let persistedFact;
    await testEnvironment.withSecurityRulesDisabled(async context => {
      persistedFact = (
        await getDoc(doc(
          context.firestore(),
          transitionPath(documents.factId)
        ))
      ).data();
    });
    assert.equal(
      persistedFact.movementClassification,
      'counterflow_transfer'
    );
    assert.equal(persistedFact.origin.sectorUnit, 'convenio');
    assert.equal(persistedFact.destination.sectorUnit, 'emergencia');
  });

  test('nega fato isolado e migração sem fato', async () => {
    const db = clinicianDb();
    const isolatedId = 'fixture-isolated-transition-fact';
    const isolated = migrationDocuments(isolatedId);
    await seedDocument(patientPath(SECTOR, isolatedId), isolated.source);
    await assertFails(setDoc(
      doc(db, transitionPath(isolated.factId)),
      isolated.fact
    ));

    const missingFactId = 'fixture-migration-without-fact';
    const missingFact = migrationDocuments(missingFactId);
    await seedDocument(patientPath(SECTOR, missingFactId), missingFact.source);
    const batch = writeBatch(db);
    batch.set(
      doc(db, patientPath(TARGET_SECTOR, missingFactId)),
      missingFact.target
    );
    batch.delete(doc(db, patientPath(SECTOR, missingFactId)));
    await assertFails(batch.commit());

    const forgedEpisodeId = 'fixture-legacy-bootstrap-forged-episode';
    const forgedEpisode = migrationDocuments(forgedEpisodeId, {
      legacySource: true
    });
    await seedDocument(
      patientPath(SECTOR, forgedEpisodeId),
      forgedEpisode.source
    );
    await assertFails(migratePatient(db, forgedEpisodeId, {
      ...forgedEpisode,
      target: {
        ...forgedEpisode.target,
        episodeId: 'patient_episode_forged'
      },
      fact: {
        ...forgedEpisode.fact,
        episodeId: 'patient_episode_forged'
      }
    }));
  });

  test('nega fato divergente da origem, predecessor ou destino', async () => {
    const db = clinicianDb();
    const patientId = 'fixture-divergent-transition';
    const documents = migrationDocuments(patientId);
    await seedDocument(patientPath(SECTOR, patientId), documents.source);

    await assertFails(migratePatient(db, patientId, {
      ...documents,
      fact: {
        ...documents.fact,
        predecessorFactId: 'forged-predecessor',
        destination: {
          ...documents.fact.destination,
          bed: 'LEITO DIVERGENTE'
        }
      }
    }));

    await assertFails(migratePatient(db, patientId, {
      ...documents,
      fact: {
        ...documents.fact,
        movementClassification: 'counterflow_transfer'
      }
    }));

    await assertFails(migratePatient(db, patientId, {
      ...documents,
      fact: {
        ...documents.fact,
        arbitraryTopLevelField: 'CONTEÚDO FICTÍCIO'
      }
    }));

    await assertFails(migratePatient(db, patientId, {
      ...documents,
      fact: {
        ...documents.fact,
        sourceVersion: 'FOUNDATION-1.0-RC1.3.2-SECTOR-TRACKING'
      }
    }));
  });

  test('torna fato imutável e restringe sua leitura ao histórico admin', async () => {
    const db = clinicianDb();
    const patientId = 'fixture-immutable-transition';
    const documents = migrationDocuments(patientId);
    await seedDocument(patientPath(SECTOR, patientId), documents.source);
    await assertSucceeds(migratePatient(db, patientId, documents));

    const factRef = doc(db, transitionPath(documents.factId));
    await assertFails(getDoc(factRef));
    await assertFails(updateDoc(factRef, {
      movementClassification: 'counterflow_transfer'
    }));
    await assertFails(deleteDoc(factRef));

    await seedAdmin(ADMIN_UID, 'admin', true);
    const adminDb = realUserDb(ADMIN_UID);
    await assertSucceeds(getDoc(
      doc(adminDb, transitionPath(documents.factId))
    ));
    await assertSucceeds(getDocs(
      collection(adminDb, 'admin_sector_transitions')
    ));
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
