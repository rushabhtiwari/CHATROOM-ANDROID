import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run the built portal against the identity service from docker compose
 * (http://localhost:8000, dev login enabled, seed data loaded).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start:standalone",
    url: "http://localhost:3000/signin",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      AUTH_SECRET: "e2e-auth-secret-0123456789abcdef0123456789",
      AUTH_URL: "http://localhost:3000",
      AUTH_ISSUER: "http://localhost:8000",
      AUTH_CLIENT_SECRET: "dev-portal-secret",
      IDENTITY_API_URL: "http://localhost:8000",
      PORT: "3000",
      HOSTNAME: "localhost",
    },
  },
});
