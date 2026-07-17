// DADOS EXCLUSIVAMENTE FICTÍCIOS.
import { basePatient } from './patients';
import { arrhythmiaCompleted } from './arrhythmias';

export const eightFictitiousPatients = [
  arrhythmiaCompleted,
  ...Array.from({ length: 7 }, (_, index) => basePatient(`fixture-print-${index + 2}`, index + 2))
];

