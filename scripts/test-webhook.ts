import { createHmac } from "node:crypto";

/**
 * Manual diagnostic for POST /api/webhooks/n8n.
 *
 * Usage:
 *   pnpm test:webhook -- --idempotency-key "lead.created:<leadId>" --status delivered
 *   pnpm test:webhook -- --idempotency-key "lead.created:<leadId>" --status failed --error "manual test"
 *
 * Requires APP_BASE_URL (default http://localhost:3000) and N8N_CALLBACK_SECRET.
 * The secret and signature are never printed.
 */

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const index = args.indexOf(name);

  return index >= 0 ? args[index + 1] : undefined;
}

const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const secret = process.env.N8N_CALLBACK_SECRET?.trim();
const callbackSecret: string = secret ?? "";
const idempotencyKey = getArg("--idempotency-key")?.trim();
const requestedStatus = (getArg("--status") ?? "delivered").toLowerCase();
const status = requestedStatus === "failed" ? "failed" : "delivered";
const error = getArg("--error") ?? "Manual webhook diagnostic failure";

if (!callbackSecret) {
  console.error("N8N_CALLBACK_SECRET is required");
  process.exit(1);
}

if (!idempotencyKey) {
  console.error(
    'Usage: pnpm test:webhook -- --idempotency-key "lead.created:<id>" [--status delivered|failed] [--error text]',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const body = JSON.stringify({
    idempotencyKey,
    status,
    externalEventId: `manual-${Date.now()}`,
    ...(status === "failed" ? { error } : {}),
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", callbackSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  const response = await fetch(`${baseUrl}/api/webhooks/n8n`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-n8n-signature": signature,
      "x-n8n-timestamp": timestamp,
    },
    body,
  });

  const text = await response.text();
  let parsed: unknown = null;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    parsed = null;
  }

  const envelope = parsed as {
    success?: boolean;
    data?: { status?: string; duplicate?: boolean };
    error?: { code?: string; message?: string };
  } | null;

  console.log(
    JSON.stringify(
      {
        httpStatus: response.status,
        success: envelope?.success ?? false,
        eventStatus: envelope?.data?.status ?? null,
        duplicate: envelope?.data?.duplicate ?? null,
        errorCode: envelope?.error?.code ?? null,
        errorMessage: envelope?.error?.message ?? null,
      },
      null,
      2,
    ),
  );

  process.exit(response.ok ? 0 : 1);
}

void main();
