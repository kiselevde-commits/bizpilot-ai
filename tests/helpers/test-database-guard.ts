/**
 * Fail-fast guard for destructive integration tests.
 *
 * A test database must be designated explicitly through `TEST_DATABASE_URL`,
 * and Prisma must point at exactly the same URL. The database name or schema
 * must also carry an explicit `test` marker. Everything else is refused before
 * a test module can issue its first Prisma query.
 *
 * The guard never includes the connection string (or any part of it) in an
 * error message, so credentials cannot leak into test output or CI logs.
 */

export type TestDatabaseEnv = {
  DATABASE_URL?: string;
  TEST_DATABASE_URL?: string;
  NODE_ENV?: string;
};

const TEST_MARKER = /(?:^|[_-])test(?:[_-]|$)/i;
const UNSAFE_MARKER = /(?:^|[_-])(?:prod|production|dev|development|demo|seed)(?:[_-]|$)/i;

// Strict embedded allowlist: integration fixtures may only talk to a local
// PostgreSQL instance or the CI service alias. A remote host is refused even
// when its database name contains a "test" marker.
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "postgres"]);

function fail(message: string): never {
  throw new Error(`Integration DB guard: ${message}`);
}

type ParsedTarget = {
  database: string;
  schema: string;
  host: string;
};

function parseTarget(url: string): ParsedTarget {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    fail("TEST_DATABASE_URL is not a valid URL.");
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    fail("TEST_DATABASE_URL must use the postgres:// or postgresql:// protocol.");
  }

  let database: string;

  try {
    database = decodeURIComponent(parsed.pathname.replace(/^\/+/, "")).trim();
  } catch {
    fail("TEST_DATABASE_URL contains an invalid database name.");
  }

  if (!database) {
    fail("TEST_DATABASE_URL must include a database name.");
  }

  return {
    database,
    schema: parsed.searchParams.get("schema")?.trim() || "public",
    host: parsed.hostname.toLowerCase(),
  };
}

export function assertIsolatedTestDatabase(env: TestDatabaseEnv = process.env): void {
  if (env.NODE_ENV === "production") {
    fail("production mode is never allowed for integration tests.");
  }

  const testUrl = env.TEST_DATABASE_URL?.trim();

  if (!testUrl) {
    fail(
      "TEST_DATABASE_URL is required. Point it at an explicitly dedicated test database or test schema.",
    );
  }

  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    fail("DATABASE_URL must be set to the same explicitly dedicated test target.");
  }

  if (databaseUrl !== testUrl) {
    fail(
      "DATABASE_URL must exactly match TEST_DATABASE_URL so Prisma cannot target another database.",
    );
  }

  const { database, schema, host } = parseTarget(testUrl);

  if (!ALLOWED_HOSTS.has(host)) {
    fail(
      "only local or dedicated test-service hosts are allowed (localhost, 127.0.0.1, IPv6 loopback, postgres).",
    );
  }

  if (UNSAFE_MARKER.test(database) || UNSAFE_MARKER.test(schema)) {
    fail("development, production, demo and seed targets are refused.");
  }

  if (!TEST_MARKER.test(database) && !TEST_MARKER.test(schema)) {
    fail(
      "the database name or schema must contain an explicit 'test' marker (for example bizpilot_test or schema=test_dashboard).",
    );
  }
}
