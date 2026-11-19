import "server-only";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  workspaceId: string;
  workspaceName: string;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      workspaceId: true,
      workspace: { select: { name: true } },
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    workspaceId: user.workspaceId,
    workspaceName: user.workspace.name,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("UNAUTHORIZED", "Authentication required");
  }

  return user;
}

export function requireRole(user: SessionUser, allowedRoles: readonly Role[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new AppError("FORBIDDEN", "Insufficient permissions");
  }
}
