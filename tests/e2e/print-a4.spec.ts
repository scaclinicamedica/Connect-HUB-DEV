import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { test, expect } from '../support/test-fixture';
import { eightFictitiousPatients } from '../fixtures/handover-eight-patients';

test('imprime oito pacientes fictícios em uma página A4 com o resumo assistencial', async ({ app }, testInfo) => {
  await app.goto({ patients: eightFictitiousPatients });
  await app.page.locator('button[onclick="printHandover()"]').click();
  await expect.poll(() => app.page.evaluate(() => window.__printInvocations)).toBe(1);

  await expect(app.page.locator('#printArea .print-card')).toHaveCount(8);
  await expect(app.page.locator('#printArea .print-clinical-copilot')).toHaveCount(1);
  await expect(app.page.locator('#printArea')).toContainText('Clinical Copilot');

  await app.page.emulateMedia({ media: 'print' });
  const pdfPath = testInfo.outputPath('passagem-oito-pacientes-a4.pdf');
  await app.page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
  const pdf = await PDFDocument.load(await readFile(pdfPath));
  expect(pdf.getPageCount()).toBe(1);
  const size = pdf.getPage(0).getSize();
  expect(size.width).toBeGreaterThan(590);
  expect(size.width).toBeLessThan(600);
  expect(size.height).toBeGreaterThan(838);
  expect(size.height).toBeLessThan(846);
});

