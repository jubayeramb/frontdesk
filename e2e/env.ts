// The app under test runs against its own database in the docker-compose
// Postgres (`pnpm db:test:up`), never the developer's DATABASE_URL.
export const E2E_DATABASE_NAME = "frontdesk_e2e";
export const FAKE_GROQ_PORT = 3101;
export const E2E_ENV = {
  DATABASE_URL: `postgres://postgres:postgres@localhost:5432/${E2E_DATABASE_NAME}`,
  DATABASE_WS_PROXY: "localhost:5433/v1",
  GROQ_API_KEY: "e2e-never-calls-groq",
  // The agent talks to e2e/fake-groq.ts instead of Groq.
  GROQ_BASE_URL: `http://localhost:${FAKE_GROQ_PORT}/openai/v1`,
  KAPSO_API_KEY: "e2e-never-calls-kapso",
  KAPSO_PHONE_NUMBER_ID: "1000000000000001",
  KAPSO_WEBHOOK_SECRET: "test-webhook-secret",
  NEXT_PUBLIC_WHATSAPP_NUMBER: "15550000000",
  // Stubbed in e2e/inbox.spec.ts; the token must never reach a public page.
  KAPSO_INBOX_EMBED_URL: "https://inbox.kapso.example/embed/e2e-embed-token",
  STAFF_PASSWORD: "e2e-staff-password",
  STAFF_SESSION_SECRET: "e2e-session-secret-that-is-at-least-32-chars",
  CHAT_COOKIE_SECRET: "e2e-chat-cookie-secret-at-least-32-chars",
};
