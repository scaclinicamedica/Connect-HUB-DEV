export const CLINICAL_TEST_UID = 'fixture-clinical-user';
export const CLINICAL_TEST_EMAIL = 'clinician.ficticio@example.test';
export const CLINICAL_TEST_PASSWORD = 'senha-clinica-ficticia-segura';
export const CLINICAL_TEST_DISPLAY_NAME = 'DRA. CLÍNICA FICTÍCIA';

export const clinicalTestAccount = {
  uid: CLINICAL_TEST_UID,
  email: CLINICAL_TEST_EMAIL,
  password: CLINICAL_TEST_PASSWORD,
  emailVerified: true
};

export const clinicalTestUser = {
  uid: CLINICAL_TEST_UID,
  email: CLINICAL_TEST_EMAIL,
  isAnonymous: false,
  emailVerified: true
};

export const clinicalTestProfile = {
  id: CLINICAL_TEST_UID,
  schemaVersion: 1,
  active: true,
  role: 'clinician',
  displayName: CLINICAL_TEST_DISPLAY_NAME,
  email: CLINICAL_TEST_EMAIL
};
