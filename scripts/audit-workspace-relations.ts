import { PrismaClient } from "@prisma/client";

/**
 * Read-only audit of historical Workspace relations.
 *
 * It prints only relation names and counts. Names, emails, phones, lead/task
 * texts and other record values are never selected or logged.
 *
 * Run with an explicit target DATABASE_URL:
 *   DATABASE_URL="postgresql://.../target?schema=public" \
 *     pnpm exec tsx scripts/audit-workspace-relations.ts
 *
 * Windows PowerShell (bash env-prefix syntax does not work there):
 *   $env:DATABASE_URL = "postgresql://.../target?schema=public"
 *   pnpm exec tsx scripts/audit-workspace-relations.ts
 *   Remove-Item Env:DATABASE_URL
 *
 * Do not run it against the local dev/seed database without explicit approval.
 * Exit code 2 means cross-workspace or unresolved references were found.
 */

type CountRow = {
  total: bigint | number;
  unset: bigint | number;
  correct: bigint | number;
  cross_workspace: bigint | number;
  missing: bigint | number;
};

type RelationAudit = {
  relation: string;
  total: number;
  unset: number;
  correct: number;
  crossWorkspace: number;
  missing: number;
};

const prisma = new PrismaClient();

function toNumber(value: bigint | number): number {
  return Number(value);
}

function formatRelation(relation: string, row: CountRow | undefined): RelationAudit {
  if (!row) {
    throw new Error(`Audit query returned no row for ${relation}`);
  }

  return {
    relation,
    total: toNumber(row.total),
    unset: toNumber(row.unset),
    correct: toNumber(row.correct),
    crossWorkspace: toNumber(row.cross_workspace),
    missing: toNumber(row.missing),
  };
}

async function main(): Promise<void> {
  const audits = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;

    const leadContact = await tx.$queryRaw<CountRow[]>`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE l."contactId" IS NULL) AS unset,
        COUNT(*) FILTER (
          WHERE l."contactId" IS NOT NULL
            AND c.id IS NOT NULL
            AND c."workspaceId" = l."workspaceId"
        ) AS correct,
        COUNT(*) FILTER (
          WHERE l."contactId" IS NOT NULL
            AND c.id IS NOT NULL
            AND c."workspaceId" <> l."workspaceId"
        ) AS cross_workspace,
        COUNT(*) FILTER (
          WHERE l."contactId" IS NOT NULL AND c.id IS NULL
        ) AS missing
      FROM "Lead" l
      LEFT JOIN "Contact" c ON c.id = l."contactId"
    `;

    const leadAssignedTo = await tx.$queryRaw<CountRow[]>`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE l."assignedToId" IS NULL) AS unset,
        COUNT(*) FILTER (
          WHERE l."assignedToId" IS NOT NULL
            AND u.id IS NOT NULL
            AND u."workspaceId" = l."workspaceId"
        ) AS correct,
        COUNT(*) FILTER (
          WHERE l."assignedToId" IS NOT NULL
            AND u.id IS NOT NULL
            AND u."workspaceId" <> l."workspaceId"
        ) AS cross_workspace,
        COUNT(*) FILTER (
          WHERE l."assignedToId" IS NOT NULL AND u.id IS NULL
        ) AS missing
      FROM "Lead" l
      LEFT JOIN "User" u ON u.id = l."assignedToId"
    `;

    const taskLead = await tx.$queryRaw<CountRow[]>`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE t."leadId" IS NULL) AS unset,
        COUNT(*) FILTER (
          WHERE t."leadId" IS NOT NULL
            AND l.id IS NOT NULL
            AND l."workspaceId" = t."workspaceId"
        ) AS correct,
        COUNT(*) FILTER (
          WHERE t."leadId" IS NOT NULL
            AND l.id IS NOT NULL
            AND l."workspaceId" <> t."workspaceId"
        ) AS cross_workspace,
        COUNT(*) FILTER (
          WHERE t."leadId" IS NOT NULL AND l.id IS NULL
        ) AS missing
      FROM "Task" t
      LEFT JOIN "Lead" l ON l.id = t."leadId"
    `;

    const taskContact = await tx.$queryRaw<CountRow[]>`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE t."contactId" IS NULL) AS unset,
        COUNT(*) FILTER (
          WHERE t."contactId" IS NOT NULL
            AND c.id IS NOT NULL
            AND c."workspaceId" = t."workspaceId"
        ) AS correct,
        COUNT(*) FILTER (
          WHERE t."contactId" IS NOT NULL
            AND c.id IS NOT NULL
            AND c."workspaceId" <> t."workspaceId"
        ) AS cross_workspace,
        COUNT(*) FILTER (
          WHERE t."contactId" IS NOT NULL AND c.id IS NULL
        ) AS missing
      FROM "Task" t
      LEFT JOIN "Contact" c ON c.id = t."contactId"
    `;

    const taskAssignedTo = await tx.$queryRaw<CountRow[]>`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE t."assignedToId" IS NULL) AS unset,
        COUNT(*) FILTER (
          WHERE t."assignedToId" IS NOT NULL
            AND u.id IS NOT NULL
            AND u."workspaceId" = t."workspaceId"
        ) AS correct,
        COUNT(*) FILTER (
          WHERE t."assignedToId" IS NOT NULL
            AND u.id IS NOT NULL
            AND u."workspaceId" <> t."workspaceId"
        ) AS cross_workspace,
        COUNT(*) FILTER (
          WHERE t."assignedToId" IS NOT NULL AND u.id IS NULL
        ) AS missing
      FROM "Task" t
      LEFT JOIN "User" u ON u.id = t."assignedToId"
    `;

    return [
      formatRelation("Lead.contactId", leadContact[0]),
      formatRelation("Lead.assignedToId", leadAssignedTo[0]),
      formatRelation("Task.leadId", taskLead[0]),
      formatRelation("Task.contactId", taskContact[0]),
      formatRelation("Task.assignedToId", taskAssignedTo[0]),
    ];
  });

  console.log("Workspace relation audit (read-only): counts only");
  for (const audit of audits) {
    console.log(
      `${audit.relation}: total=${audit.total}, correct=${audit.correct}, ` +
        `crossWorkspace=${audit.crossWorkspace}, missing=${audit.missing}, unset=${audit.unset}`,
    );
  }

  const problems = audits.reduce((sum, audit) => sum + audit.crossWorkspace + audit.missing, 0);

  if (problems > 0) {
    process.exitCode = 2;
  }
}

void main()
  .catch((error: unknown) => {
    console.error(
      "Workspace relation audit failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
