import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173/Elfo-Navidad/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173/Elfo-Navidad/',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium-ipad',
      use: {
        ...devices['iPad Pro 11 landscape'],
        browserName: 'chromium',
        launchOptions: { executablePath: '/usr/bin/chromium' },
      },
    },
  ],
});
