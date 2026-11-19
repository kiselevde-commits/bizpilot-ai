import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type WorkflowNode = {
  name: string;
  type: string;
  parameters?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
};

type Workflow = {
  name: string;
  active: boolean;
  nodes: WorkflowNode[];
  connections: Record<
    string,
    { main?: Array<Array<{ node: string; type: string; index: number }>> }
  >;
};

function loadWorkflow(): Workflow {
  const path = resolve(process.cwd(), "n8n/workflows/lead_created_notification.json");

  return JSON.parse(readFileSync(path, "utf8")) as Workflow;
}

describe("n8n workflow draft", () => {
  const workflow = loadWorkflow();
  const names = new Set(workflow.nodes.map((node) => node.name));

  it("is explicitly marked as a draft and inactive", () => {
    expect(workflow.name).toContain("DRAFT");
    expect(workflow.active).toBe(false);
    expect(workflow.nodes.some((node) => node.name === "DRAFT README")).toBe(true);
  });

  it("contains the required automation nodes", () => {
    for (const required of [
      "Webhook",
      "Verify signature",
      "Claim idempotency",
      "Lookup dedupe state",
      "Reclaim failed",
      "Send Telegram",
      "Mark SENT",
      "Record failure",
      "Post callback",
    ]) {
      expect(names.has(required)).toBe(true);
    }
  });

  it("references only existing nodes in connections", () => {
    for (const [source, outputs] of Object.entries(workflow.connections)) {
      expect(names.has(source)).toBe(true);

      for (const branch of outputs.main ?? []) {
        for (const target of branch) {
          expect(names.has(target.node)).toBe(true);
        }
      }
    }
  });

  it("uses atomic INSERT ... ON CONFLICT DO NOTHING and FAILED-only reclaim", () => {
    const claim = workflow.nodes.find((node) => node.name === "Claim idempotency");
    const reclaim = workflow.nodes.find((node) => node.name === "Reclaim failed");
    const claimQuery = String(claim?.parameters?.query ?? "");
    const reclaimQuery = String(reclaim?.parameters?.query ?? "");

    expect(claimQuery).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
    expect(claimQuery).toContain("RETURNING idempotency_key");
    expect(reclaimQuery).toContain("status = 'FAILED'");
    expect(reclaimQuery).toContain("RETURNING idempotency_key");
  });

  it("keeps secrets out of the workflow JSON", () => {
    const serialized = JSON.stringify(workflow);

    expect(serialized).not.toMatch(/bot\d+:[A-Za-z0-9_-]+/);
    expect(serialized).not.toMatch(/postgres(?:ql)?:\/\/[^"\\s]+/);
    expect(serialized).not.toContain("AI_API_KEY=");
    expect(serialized).not.toContain("TELEGRAM_BOT_TOKEN=");
    expect(serialized).not.toContain("N8N_WEBHOOK_SECRET=");
    expect(serialized).not.toContain("N8N_CALLBACK_SECRET=");
  });

  it("sends only notification fields to Telegram", () => {
    const telegram = workflow.nodes.find((node) => node.name === "Send Telegram");
    const text = String(telegram?.parameters?.text ?? "");

    for (const field of ["title", "priority", "category", "summary", "url"]) {
      expect(text).toContain(`payload.data.${field}`);
    }

    expect(text).not.toContain("payload.data.message");
    expect(text).not.toContain("email");
    expect(text).not.toContain("phone");
  });

  it("signs callbacks from the exact JSON string", () => {
    const callback = workflow.nodes.find((node) => node.name === "Post callback");
    const code = String(callback?.parameters?.jsCode ?? "");

    expect(code).toContain("createHmac('sha256'");
    expect(code).toContain("timestamp + '.' + body");
    expect(code).toContain("N8N_CALLBACK_SECRET");
    expect(code).toContain("baseUrl + '/api/webhooks/n8n'");
  });
});
