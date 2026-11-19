import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import { canDelete, canManageIntegrations, canViewAutomation } from "@/lib/auth/roles";

describe("role helpers", () => {
  it("canDelete: ADMIN/MANAGER true, OPERATOR false", () => {
    expect(canDelete("ADMIN")).toBe(true);
    expect(canDelete("MANAGER")).toBe(true);
    expect(canDelete("OPERATOR")).toBe(false);
  });

  it("canViewAutomation: ADMIN/MANAGER true, OPERATOR false", () => {
    expect(canViewAutomation("ADMIN")).toBe(true);
    expect(canViewAutomation("MANAGER")).toBe(true);
    expect(canViewAutomation("OPERATOR")).toBe(false);
  });

  it("canManageIntegrations: ADMIN true only", () => {
    expect(canManageIntegrations("ADMIN")).toBe(true);
    expect(canManageIntegrations("MANAGER")).toBe(false);
    expect(canManageIntegrations("OPERATOR")).toBe(false);
  });
});

it("Role type accepts all enum values", () => {
  const roles: Role[] = ["ADMIN", "MANAGER", "OPERATOR"];
  expect(roles).toHaveLength(3);
});
