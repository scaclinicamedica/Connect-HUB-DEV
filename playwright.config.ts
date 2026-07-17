import { defineConfig, type Project } from '@playwright/test';

const port = Number(process.env.PW_TEST_PORT || 4173);
const baseURL = `http://127.0.0.1:${port}`;

const matrix: Array<{ name: string; width: number; height: number; touch?: boolean }> = [
  { name: 'viewport-390', width: 390, height: 844, touch: true },
  { name: 'viewport-494', width: 494, height: 900, touch: true },
  { name: 'viewport-759', width: 759, height: 900 },
  { name: 'viewport-760', width: 760, height: 900 },
  { name: 'viewport-761', width: 761, height: 900 },
  { name: 'viewport-768', width: 768, height: 1024 },
  { name: 'viewport-1180', width: 1180, height: 900 },
  { name: 'viewport-1440', width: 1440, height: 1000 }
];

const matrixProjects: Project[] = matrix.map(({ name, width, height, touch }) => ({
  name,
  testMatch: /.*\.matrix\.spec\.ts/,
  use: {
    browserName: 'chromium',
    viewport: { width, height },
    hasTouch: Boolean(touch),
    isMobile: Boolean(touch)
  }
}));

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 7_500 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: './test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL,
    browserName: 'chromium',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 7_500,
    navigationTimeout: 15_000
  },
  webServer: {
    command: `node tests/support/static-server.mjs ${port}`,
    url: `${baseURL}/passagem.html`,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe'
  },
  projects: [
    {
      name: 'functional-1180',
      testIgnore: [/.*\.matrix\.spec\.ts/, /.*\.stress\.spec\.ts/],
      use: { viewport: { width: 1180, height: 900 } }
    },
    ...matrixProjects,
    {
      name: 'stability-1440',
      testMatch: /.*\.stress\.spec\.ts/,
      use: { viewport: { width: 1440, height: 1000 } }
    }
  ]
});

