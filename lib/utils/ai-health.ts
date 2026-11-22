export type AiHealthState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

export type AiHealthResponse = { status?: string; configured?: boolean };

/**
 * Maps the public `/api/ai/health` payload to the UI state.
 *
 * A missing or non-true `configured` flag must never be presented as "ready":
 * an unconfigured provider is reported explicitly so the UI does not confirm
 * availability that does not exist.
 */
export function resolveAiHealthState(payload: AiHealthResponse | null | undefined): AiHealthState {
  if (!payload || payload.status !== "ok") {
    return { status: "error", message: "AI-провайдер недоступен" };
  }

  return payload.configured === true ? { status: "ready" } : { status: "unconfigured" };
}

/**
 * AI actions (analysis, draft reply) are allowed only when the provider is
 * explicitly ready. Loading, unknown and unconfigured states block them so the
 * UI never starts a request that is guaranteed to fail.
 */
export function canRunAiActions(state: AiHealthState): boolean {
  return state.status === "ready";
}
