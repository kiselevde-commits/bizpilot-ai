/**
 * Side-effect import: the guard runs while this module is evaluated, which is
 * before the test file's Prisma import and before any `beforeAll` hook can
 * write to the database.
 */
import { assertIsolatedTestDatabase } from "../../helpers/test-database-guard";

assertIsolatedTestDatabase();
