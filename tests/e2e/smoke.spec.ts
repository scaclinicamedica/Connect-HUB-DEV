import { test, expect } from '../support/test-fixture';
import { basePatient } from '../fixtures/patients';

test('carrega a V1 localmente sem depender de resposta externa', async ({ app, networkAttempts }) => {
  await app.goto({ patients: [basePatient('fixture-smoke')] });

  await expect(app.cards).toHaveCount(1);
  await expect(app.page.locator('#mTotal')).toHaveText('1');
  await expect(app.page.locator('#sector')).toHaveValue(/Emerg/);

  const stubbed = networkAttempts.filter(attempt => attempt.disposition === 'stubbed');
  expect(stubbed).toHaveLength(3);
  expect(networkAttempts.filter(attempt => attempt.disposition === 'blocked')).toEqual([]);
});

