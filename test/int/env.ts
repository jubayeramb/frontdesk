// Connection details for the docker-compose test database (`pnpm db:test:up`).
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/frontdesk_test";
export const TEST_DATABASE_WS_PROXY =
  process.env.TEST_DATABASE_WS_PROXY ?? "localhost:5433/v1";
