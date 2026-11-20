import "server-only";
import { prisma } from "@/lib/database/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/utils/labels";
import type { SelectOption } from "@/components/leads/lead-form";

/**
 * Workspace-scoped select options for forms (contacts, workspace members).
 * Only ids and display labels leave the server; no sensitive fields.
 */

export async function listContactOptions(user: SessionUser): Promise<SelectOption[]> {
  const contacts = await prisma.contact.findMany({
    where: { workspaceId: user.workspaceId },
    select: { id: true, name: true, company: true },
    orderBy: { name: "asc" },
    take: 500,
  });

  return contacts.map((contact) => ({
    value: contact.id,
    label: contact.company ? `${contact.name} — ${contact.company}` : contact.name,
  }));
}

export async function listLeadOptions(user: SessionUser): Promise<SelectOption[]> {
  const leads = await prisma.lead.findMany({
    where: { workspaceId: user.workspaceId },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return leads.map((lead) => ({ value: lead.id, label: lead.title }));
}

export async function listMemberOptions(user: SessionUser): Promise<SelectOption[]> {
  const members = await prisma.user.findMany({
    where: { workspaceId: user.workspaceId },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return members.map((member) => ({
    value: member.id,
    label: `${member.name} · ${ROLE_LABELS[member.role]}`,
  }));
}
