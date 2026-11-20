import "server-only";
import type { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";

type LeadRelations = {
  contactId?: string | null;
  assignedToId?: string | null;
};

type TaskRelations = {
  leadId?: string | null;
  contactId?: string | null;
  assignedToId?: string | null;
};

async function assertContactInWorkspace(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  contactId: string,
): Promise<void> {
  const contact = await tx.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: { id: true },
  });

  if (!contact) {
    throw new AppError("NOT_FOUND", "Контакт не найден");
  }
}

async function assertUserInWorkspace(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const user = await tx.user.findFirst({
    where: { id: userId, workspaceId },
    select: { id: true },
  });

  if (!user) {
    throw new AppError("NOT_FOUND", "Пользователь не найден");
  }
}

async function assertLeadInWorkspace(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  leadId: string,
): Promise<void> {
  const lead = await tx.lead.findFirst({
    where: { id: leadId, workspaceId },
    select: { id: true },
  });

  if (!lead) {
    throw new AppError("NOT_FOUND", "Заявка не найдена");
  }
}

/**
 * Validates optional Lead relations against the current Workspace.
 * Missing or foreign records produce the same NOT_FOUND response so the caller
 * cannot learn whether an ID exists in another Workspace.
 */
export async function assertLeadRelationsInWorkspace(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  relations: LeadRelations,
): Promise<void> {
  if (relations.contactId) {
    await assertContactInWorkspace(tx, workspaceId, relations.contactId);
  }

  if (relations.assignedToId) {
    await assertUserInWorkspace(tx, workspaceId, relations.assignedToId);
  }
}

/**
 * Validates optional Task relations against the current Workspace.
 * Missing or foreign records produce the same NOT_FOUND response so the caller
 * cannot learn whether an ID exists in another Workspace.
 */
export async function assertTaskRelationsInWorkspace(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  relations: TaskRelations,
): Promise<void> {
  if (relations.leadId) {
    await assertLeadInWorkspace(tx, workspaceId, relations.leadId);
  }

  if (relations.contactId) {
    await assertContactInWorkspace(tx, workspaceId, relations.contactId);
  }

  if (relations.assignedToId) {
    await assertUserInWorkspace(tx, workspaceId, relations.assignedToId);
  }
}
