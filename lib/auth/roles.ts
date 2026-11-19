import type { Role } from "@prisma/client";

export const DELETE_ROLES = ["ADMIN", "MANAGER"] as const satisfies readonly Role[];
export const AUTOMATION_ROLES = ["ADMIN", "MANAGER"] as const satisfies readonly Role[];
export const INTEGRATION_ADMIN_ROLES = ["ADMIN"] as const satisfies readonly Role[];

export function canDelete(role: Role): boolean {
  return (DELETE_ROLES as readonly Role[]).includes(role);
}

export function canViewAutomation(role: Role): boolean {
  return (AUTOMATION_ROLES as readonly Role[]).includes(role);
}

export function canManageIntegrations(role: Role): boolean {
  return (INTEGRATION_ADMIN_ROLES as readonly Role[]).includes(role);
}
