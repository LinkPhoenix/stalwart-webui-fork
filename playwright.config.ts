import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5174';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
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
