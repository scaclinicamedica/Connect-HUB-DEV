// DADOS EXCLUSIVAMENTE FICTÍCIOS.
import { basePatient, type FixturePatient } from './patients';

const completedProfile = {
  applicable: true,
  completed: true,
  episodePattern: 'first',
  episodeLabel: 'Primeiro episódio conhecido',
  onsetWindow: 'lt24',
  onsetLabel: 'Início estimado < 24 h',
  preexcitation: 'no',
  preexcitationLabel: 'Sem evidência de pré-excitação',
  priorAnticoagulation: 'none',
  priorAnticoagulationLabel: 'Sem anticoagulação prévia',
  triggers: ['infection'],
  triggerLabels: ['Infecção / sepse'],
  otherTrigger: ''
};

function arrhythmiaPatient(id: string, data: Record<string, unknown>, index = 1): FixturePatient {
  return {
    ...basePatient(id, index),
    alerts: ['Arritmias'],
    arrhythmiasCleanData: {
      version: 'FOUNDATION-1.0-RC1.2.8-COMPLETION-STATE-SEMANTIC-ALIGNMENT',
      diagnosis: 'af',
      diagnosisLabel: 'Fibrilação atrial',
      otherDiagnosis: '',
      clinicalPath: 'routine',
      ...data
    }
  };
}

export const arrhythmiaCompleted = arrhythmiaPatient('fixture-arrhythmia-completed', {
  finalized: true,
  status: 'Avaliação concluída',
  instabilityCriteria: ['none'],
  instabilityLabels: ['Nenhum dos critérios acima'],
  gravityCompleted: true,
  causalRelation: '',
  priorityCompleted: false,
  stabilized: '',
  hemodynamicStatus: 'stable',
  clinicalProfile: completedProfile
});

export const arrhythmiaInProgress = arrhythmiaPatient('fixture-arrhythmia-progress', {
  finalized: false,
  status: 'Em andamento',
  instabilityCriteria: [],
  instabilityLabels: [],
  gravityCompleted: false,
  causalRelation: '',
  priorityCompleted: false,
  stabilized: '',
  hemodynamicStatus: 'pending',
  clinicalProfile: { ...completedProfile, completed: false }
}, 2);

export const arrhythmiaConductRecorded = arrhythmiaPatient('fixture-arrhythmia-conduct', {
  finalized: false,
  status: 'Em andamento',
  instabilityCriteria: ['shock'],
  instabilityLabels: ['Sinais de choque'],
  gravityCompleted: true,
  causalRelation: 'yes',
  priorityCompleted: true,
  stabilized: 'yes',
  clinicalPath: 'priority-immediate',
  hemodynamicStatus: 'unstable',
  clinicalProfile: { ...completedProfile, completed: false, episodePattern: '', episodeLabel: '' }
}, 3);

export const arrhythmiaCompletedAfterConduct = arrhythmiaPatient('fixture-arrhythmia-completed-conduct', {
  finalized: true,
  status: 'Avaliação concluída',
  instabilityCriteria: ['shock'],
  instabilityLabels: ['Sinais de choque'],
  gravityCompleted: true,
  causalRelation: 'yes',
  priorityCompleted: true,
  stabilized: 'yes',
  clinicalPath: 'priority-immediate',
  hemodynamicStatus: 'unstable',
  clinicalProfile: completedProfile
}, 4);

export const arrhythmiaPriority = arrhythmiaPatient('fixture-arrhythmia-priority', {
  finalized: true,
  status: 'Avaliação concluída',
  instabilityCriteria: ['shock'],
  instabilityLabels: ['Sinais de choque'],
  gravityCompleted: true,
  causalRelation: 'yes',
  priorityCompleted: true,
  stabilized: 'no',
  clinicalPath: 'priority-immediate',
  hemodynamicStatus: 'unstable',
  clinicalProfile: { applicable: false, completed: false, triggers: [], triggerLabels: [] }
}, 5);

