// The app under test runs against its own database in the docker-compose
// Postgres (`pnpm db:test:up`), never the developer's DATABASE_URL.
export const E2E_DATABASE_NAME = "frontdesk_e2e";
export const E2E_ENV = {
  DATABASE_URL: `postgres://postgres:postgres@localhost:5432/${E2E_DATABASE_NAME}`,
  DATABASE_WS_PROXY: "localhost:5433/v1",
  GROQ_API_KEY: "e2e-never-calls-groq",
  STAFF_PASSWORD: "e2e-staff-password",
  STAFF_SESSION_SECRET: "e2e-session-secret-that-is-at-least-32-chars",
};
