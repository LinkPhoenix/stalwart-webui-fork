import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5174';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // The dev server bundles its dependencies and compiles modules on the first page loads. With the default
  // worker count (half of the cores) a cold dependency cache leaves several tests stuck on "Loading...".
  workers: process.env.CI ? 1 : 2,
  reporter: 'list',
  // The dev server compiles on demand: the first page loads of a parallel run are slow.
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --mode e2e --host 127.0.0.1 --port 5174 --strictPort',
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      VITE_ACCESS_TOKEN: '',
      VITE_API_BASE_URL: '',
    },
  },
});
