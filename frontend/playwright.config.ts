import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    baseURL: process.env['UI_BASE_URL'] || 'http://localhost:5173',
    // Tokens and entered credentials must not be saved in trace/network artifacts.
    trace: 'off', video: 'off', screenshot: 'off'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
