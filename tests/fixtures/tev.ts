// DADOS EXCLUSIVAMENTE FICTÍCIOS.
import { basePatient } from './patients';

export const tevCompleted = {
  ...basePatient('fixture-tev-completed', 6),
  alerts: ['Profilaxia de TEV'],
  paduaFactors: ['mobilidade_reduzida'],
  paduaScore: 3,
  paduaRisk: 'Baixo risco',
  tevProtocol: {
    status: 'complete',
    patientType: 'clinico',
    paduaFactors: ['mobilidade_reduzida'],
    paduaScore: 3,
    completed: true
  }
};

