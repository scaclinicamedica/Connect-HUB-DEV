// DADOS EXCLUSIVAMENTE FICTÍCIOS.

export type FixturePatient = Record<string, unknown> & { id: string; name: string };

export function basePatient(id: string, index = 1): FixturePatient {
  return {
    id,
    bed: `F-${String(index).padStart(2, '0')}`,
    name: `PACIENTE FICTÍCIO ${String.fromCharCode(64 + index)}`,
    age: String(40 + index),
    admissionDate: '2026-07-10',
    dischargeForecast: '2099-12-31',
    healthPlan: '',
    severity: 'estavel',
    status: 'Observação',
    specialty: 'Clínica Médica',
    diagnosis: `HIPÓTESE FICTÍCIA ${index}`,
    background: 'ANTECEDENTE FICTÍCIO PARA CARACTERIZAÇÃO',
    assessment: 'PLANO FICTÍCIO PARA CARACTERIZAÇÃO',
    recommendation: `PENDÊNCIA FICTÍCIA ${index}`,
    alerts: [],
    sortOrder: index - 1,
    updatedAtLocal: '2026-07-16T12:00:00.000Z'
  };
}
