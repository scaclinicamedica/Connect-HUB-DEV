// DADOS EXCLUSIVAMENTE FICTÍCIOS.

import { basePatient, type FixturePatient } from './patients';

export const OUTCOME_TEST_DOCTOR = 'DRA. MÉDICA FICTÍCIA';

export function outcomePatient(id = 'fixture-outcome', index = 1): FixturePatient {
  return {
    ...basePatient(id, index),
    bed: `Leito ${String(index).padStart(2, '0')}`,
    admissionDate: '2026-07-10',
    status: 'Alta provável',
    alerts: ['Profilaxia de TEV', 'Fibrilação atrial/Flutter'],
    paduaScore: 4,
    paduaRisk: 'Alto risco',
    arrhythmiasCleanData: {
      rhythm: 'FA',
      hemodynamicState: 'stable',
      finalized: true,
      clinicalProfile: { completed: true }
    }
  };
}
