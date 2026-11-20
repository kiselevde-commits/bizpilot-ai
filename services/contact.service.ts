import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import {
  normalizeEmail,
  normalizePhone,
} from "@/lib/utils/normalize";
import { CONTACT_STATUSES } from "@/lib/constants";
import {
  parseSort,
  paginationQuerySchema,
  type PaginationQuery,
} from "@/lib/validation/query";
import type { Contact } from "@prisma/client";

const CONTACT_SORT_ALLOW_LIST: readonly string[] = [
  "createdAt",
  "updatedAt",
  "name",
  "company",
  "status",
];

export type ContactListQuery = PaginationQuery & {
  status?: string;
  search?: string;
};

export type ContactListResult = {
  items: Contact[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function listContacts(
  user: SessionUser,
  query: ContactListQuery,
): Promise<ContactListResult> {
  const parsed = paginationQuerySchema.safeParse({
    page: query.page,
    limit: query.limit,
    search: query.search,
    sort: query.sort,
  });

  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Некорректные параметры запроса");
  }

  const { page, limit, search, sort } = parsed.data;
  const sortSpec = parseSort(
    sort,
    CONTACT_SORT_ALLOW_LIST,
    { field: "createdAt", direction: "desc" },
  );

  const where: Prisma.ContactWhereInput = {
    workspaceId: user.workspaceId,
  };

  if (query.status && CONTACT_STATUSES.includes(query.status as (typeof CONTACT_STATUSES)[number])) {
    where.status = query.status as typeof where.status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { [sortSpec.field]: sortSpec.direction },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { leads: true, tasks: true } },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit) || 0;

  return { items, pagination: { page, limit, total, totalPages } };
}

export async function getContact(
  user: SessionUser,
  id: string,
): Promise<Contact | null> {
  if (!id) {
    throw new AppError("VALIDATION_ERROR", "Не указан ID контакта");
  }

  return prisma.contact.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
      leads: {
        where: { workspaceId: user.workspaceId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          leadScore: true,
        },
      },
      tasks: {
        where: { workspaceId: user.workspaceId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
        },
      },
    },
  });
}

export type ContactCreateInput = {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  status?: string;
  force?: boolean;
};

export type DuplicateCandidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  emailNormalized: string | null;
  phoneNormalized: string | null;
  status: string;
};

export async function createContact(
  user: SessionUser,
  input: ContactCreateInput,
): Promise<{ contact: Contact; duplicateCandidates?: DuplicateCandidate[] }> {
  if (!input.name || input.name.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "Имя контакта обязательно");
  }

  if (input.name.length > 255) {
    throw new AppError("VALIDATION_ERROR", "Имя слишком длинное");
  }

  const normalizedEmail = normalizeEmail(input.email || null);
  const normalizedPhone = normalizePhone(input.phone || null);

  if (normalizedEmail === null && normalizedPhone === null) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Укажите хотя бы email или телефон",
    );
  }

  const candidates: DuplicateCandidate[] = [];

  if (normalizedEmail) {
    const emailMatches = await prisma.contact.findMany({
      where: {
        workspaceId: user.workspaceId,
        emailNormalized: normalizedEmail,
        id: { not: undefined },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        emailNormalized: true,
        phoneNormalized: true,
        status: true,
      },
    });

    for (const m of emailMatches) {
      candidates.push({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        emailNormalized: m.emailNormalized,
        phoneNormalized: m.phoneNormalized,
        status: m.status,
      });
    }
  }

  if (normalizedPhone) {
    const phoneMatches = await prisma.contact.findMany({
      where: {
        workspaceId: user.workspaceId,
        phoneNormalized: normalizedPhone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        emailNormalized: true,
        phoneNormalized: true,
        status: true,
      },
    });

    for (const m of phoneMatches) {
      const already = candidates.some((c) => c.id === m.id);
      if (!already) {
        candidates.push({
          id: m.id,
          name: m.name,
          email: m.email,
          phone: m.phone,
          emailNormalized: m.emailNormalized,
          phoneNormalized: m.phoneNormalized,
          status: m.status,
        });
      }
    }
  }

  if (candidates.length > 0 && !input.force) {
    throw new AppError("DUPLICATE_CONTACT", "Найдены возможные дубли контакта", {
      details: { candidates },
    });
  }

  const status =
    input.status && CONTACT_STATUSES.includes(input.status as (typeof CONTACT_STATUSES)[number])
      ? (input.status as (typeof CONTACT_STATUSES)[number])
      : "NEW";

  const contact = await prisma.$transaction(async (tx) => {
    const created = await tx.contact.create({
      data: {
        name: input.name.trim(),
        company: input.company || null,
        email: input.email || null,
        phone: input.phone || null,
        emailNormalized: normalizedEmail,
        phoneNormalized: normalizedPhone,
        notes: input.notes || null,
        status,
        workspaceId: user.workspaceId,
        createdById: user.id,
        updatedById: user.id,
      },
    });

    await tx.activityLog.create({
      data: {
        workspaceId: user.workspaceId,
        entityType: "contact",
        entityId: created.id,
        action: "contact.created",
        actorId: user.id,
        metadata: { name: input.name.trim() },
      },
    });

    return created;
  });

  return { contact };
}

export type ContactUpdateInput = Partial<ContactCreateInput>;

export async function updateContact(
  user: SessionUser,
  id: string,
  input: ContactUpdateInput,
): Promise<Contact> {
  const existing = await prisma.contact.findFirst({
    where: { id, workspaceId: user.workspaceId },
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Контакт не найден");
  }

  const normalizedEmail = input.email !== undefined
    ? normalizeEmail(input.email || null)
    : existing.emailNormalized;

  const normalizedPhone = input.phone !== undefined
    ? normalizePhone(input.phone || null)
    : existing.phoneNormalized;

  const candidates: DuplicateCandidate[] = [];

  if (
    (input.email !== undefined || input.phone !== undefined) &&
    (normalizedEmail || normalizedPhone)
  ) {
    const where: Prisma.ContactWhereInput = {
      workspaceId: user.workspaceId,
      id: { not: id },
    };

    if (normalizedEmail && normalizedPhone) {
      where.OR = [
        { emailNormalized: normalizedEmail },
        { phoneNormalized: normalizedPhone },
      ];
    } else if (normalizedEmail) {
      where.emailNormalized = normalizedEmail;
    } else if (normalizedPhone) {
      where.phoneNormalized = normalizedPhone;
    }

    const matches = await prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        emailNormalized: true,
        phoneNormalized: true,
        status: true,
      },
    });

    for (const m of matches) {
      candidates.push({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        emailNormalized: m.emailNormalized,
        phoneNormalized: m.phoneNormalized,
        status: m.status,
      });
    }
  }

  if (candidates.length > 0 && !input.force) {
    throw new AppError("DUPLICATE_CONTACT", "Найдены возможные дубли контакта", {
      details: { candidates },
    });
  }

  const status =
    input.status !== undefined
      ? CONTACT_STATUSES.includes(input.status as (typeof CONTACT_STATUSES)[number])
        ? (input.status as (typeof CONTACT_STATUSES)[number])
        : existing.status
      : existing.status;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.contact.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.company !== undefined && { company: input.company || null }),
        ...(input.email !== undefined && { email: input.email || null }),
        ...(input.phone !== undefined && { phone: input.phone || null }),
        ...(input.email !== undefined && { emailNormalized: normalizedEmail }),
        ...(input.phone !== undefined && { phoneNormalized: normalizedPhone }),
        ...(input.notes !== undefined && { notes: input.notes || null }),
        ...(input.status !== undefined && { status }),
        updatedById: user.id,
      },
    });

    await tx.activityLog.create({
      data: {
        workspaceId: user.workspaceId,
        entityType: "contact",
        entityId: id,
        action: "contact.updated",
        actorId: user.id,
        metadata: { fields: Object.keys(input) },
      },
    });

    return updated;
  });
}

export async function deleteContact(
  user: SessionUser,
  id: string,
): Promise<void> {
  const existing = await prisma.contact.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: {
      _count: { select: { leads: true, tasks: true } },
    },
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Контакт не найден");
  }

  if (existing._count.leads > 0 || existing._count.tasks > 0) {
    throw new AppError(
      "ENTITY_IN_USE",
      "Контакт связан с заявками или задачами. Сначала отвяжите их.",
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityLog.create({
      data: {
        workspaceId: user.workspaceId,
        entityType: "contact",
        entityId: id,
        action: "contact.deleted",
        actorId: user.id,
        metadata: { name: existing.name },
      },
    });

    await tx.contact.delete({ where: { id } });
  });
}

export async function getContactDuplicateCandidates(
  user: SessionUser,
  email?: string | null,
  phone?: string | null,
): Promise<DuplicateCandidate[]> {
  const normalizedEmail = normalizeEmail(email || null);
  const normalizedPhone = normalizePhone(phone || null);

  if (!normalizedEmail && !normalizedPhone) {
    return [];
  }

  const where: Prisma.ContactWhereInput = {
    workspaceId: user.workspaceId,
  };

  if (normalizedEmail && normalizedPhone) {
    where.OR = [
      { emailNormalized: normalizedEmail },
      { phoneNormalized: normalizedPhone },
    ];
  } else if (normalizedEmail) {
    where.emailNormalized = normalizedEmail;
  } else if (normalizedPhone) {
    where.phoneNormalized = normalizedPhone;
  }

  const matches = await prisma.contact.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailNormalized: true,
      phoneNormalized: true,
      status: true,
    },
  });

  return matches.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    emailNormalized: m.emailNormalized,
    phoneNormalized: m.phoneNormalized,
    status: m.status,
  }));
}
