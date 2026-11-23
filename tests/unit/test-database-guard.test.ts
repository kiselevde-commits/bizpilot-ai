import { describe, expect, it } from "vitest";
import { assertIsolatedTestDatabase, type TestDatabaseEnv } from "../helpers/test-database-guard";

const TEST_URL = "postgresql://test_user:test_password@localhost:5432/bizpilot_test?schema=public";

function env(overrides: Partial<TestDatabaseEnv>): TestDatabaseEnv {
  return { NODE_ENV: "test", ...overrides };
}

describe("integration test database guard", () => {
  it("accepts an explicitly named test database", () => {
    expect(() =>
      assertIsolatedTestDatabase(env({ DATABASE_URL: TEST_URL, TEST_DATABASE_URL: TEST_URL })),
    ).not.toThrow();
  });

  it("accepts an explicitly named test schema inside another database", () => {
    const url =
      "postgresql://test_user:test_password@localhost:5432/bizpilot?schema=test_dashboard";

    expect(() =>
      assertIsolatedTestDatabase(env({ DATABASE_URL: url, TEST_DATABASE_URL: url })),
    ).not.toThrow();
  });

  it("accepts the CI service alias and IPv6 loopback for a test database", () => {
    for (const url of [
      "postgresql://test_user:test_password@postgres:5432/bizpilot_test?schema=public",
      "postgresql://test_user:test_password@[::1]:5432/bizpilot_test?schema=public",
    ]) {
      expect(() =>
        assertIsolatedTestDatabase(env({ DATABASE_URL: url, TEST_DATABASE_URL: url })),
      ).not.toThrow();
    }
  });

  it("refuses a remote host even when the database is test-marked", () => {
    const url =
      "postgresql://test_user:test_password@db.production.example.com:5432/bizpilot_test?schema=public";

    expect(() =>
      assertIsolatedTestDatabase(env({ DATABASE_URL: url, TEST_DATABASE_URL: url })),
    ).toThrow(/only local or dedicated test-service hosts/);
  });

  it("refuses a missing TEST_DATABASE_URL even when DATABASE_URL is set", () => {
    expect(() => assertIsolatedTestDatabase(env({ DATABASE_URL: TEST_URL }))).toThrow(
      /TEST_DATABASE_URL is required/,
    );
  });

  it("refuses a missing DATABASE_URL", () => {
    expect(() => assertIsolatedTestDatabase(env({ TEST_DATABASE_URL: TEST_URL }))).toThrow(
      /DATABASE_URL must be set/,
    );
  });

  it("refuses a regular non-test database", () => {
    const regular = "postgresql://test_user:test_password@localhost:5432/bizpilot?schema=public";

    expect(() =>
      assertIsolatedTestDatabase(env({ DATABASE_URL: regular, TEST_DATABASE_URL: regular })),
    ).toThrow(/explicit 'test' marker/);
  });

  it("refuses mismatched DATABASE_URL and TEST_DATABASE_URL", () => {
    const other = "postgresql://test_user:test_password@localhost:5432/bizpilot_test_other";

    expect(() =>
      assertIsolatedTestDatabase(env({ DATABASE_URL: other, TEST_DATABASE_URL: TEST_URL })),
    ).toThrow(/must exactly match/);
  });

  it("refuses development, production, demo and seed targets even when test-marked", () => {
    for (const name of [
      "bizpilot_test_dev",
      "test_production",
      "bizpilot_demo_test",
      "seed_test",
    ]) {
      const url = `postgresql://test_user:test_password@localhost:5432/${name}`;

      expect(() =>
        assertIsolatedTestDatabase(env({ DATABASE_URL: url, TEST_DATABASE_URL: url })),
      ).toThrow(/development, production, demo and seed targets are refused/);
    }
  });

  it("refuses production mode regardless of the URL", () => {
    expect(() =>
      assertIsolatedTestDatabase(
        env({ NODE_ENV: "production", DATABASE_URL: TEST_URL, TEST_DATABASE_URL: TEST_URL }),
      ),
    ).toThrow(/production mode/);
  });

  it("refuses malformed or non-PostgreSQL URLs without echoing them", () => {
    for (const url of ["not a url", "mysql://localhost/bizpilot_test", "postgresql://localhost/"]) {
      let message = "";

      try {
        assertIsolatedTestDatabase(env({ DATABASE_URL: url, TEST_DATABASE_URL: url }));
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toMatch(/Integration DB guard/);
      expect(message).not.toContain("test_password");
      expect(message).not.toContain(url);
    }
  });
});
