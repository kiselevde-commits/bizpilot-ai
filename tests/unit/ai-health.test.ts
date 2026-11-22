import { describe, expect, it } from "vitest";
import { canRunAiActions, resolveAiHealthState } from "@/lib/utils/ai-health";

describe("resolveAiHealthState", () => {
  it("reports ready only when the provider is explicitly configured", () => {
    expect(resolveAiHealthState({ status: "ok", configured: true })).toEqual({
      status: "ready",
    });
  });

  it("reports an unconfigured provider instead of a false ready state", () => {
    expect(resolveAiHealthState({ status: "ok", configured: false })).toEqual({
      status: "unconfigured",
    });
  });

  it("treats a missing configured flag as unconfigured", () => {
    expect(resolveAiHealthState({ status: "ok" })).toEqual({ status: "unconfigured" });
  });

  it("reports an error for a missing or unhealthy payload", () => {
    expect(resolveAiHealthState(null)).toEqual({
      status: "error",
      message: "AI-провайдер недоступен",
    });
    expect(resolveAiHealthState({ status: "degraded", configured: true })).toEqual({
      status: "error",
      message: "AI-провайдер недоступен",
    });
  });
});

describe("canRunAiActions", () => {
  it("allows actions only when the provider is ready", () => {
    expect(canRunAiActions({ status: "ready" })).toBe(true);
    expect(canRunAiActions({ status: "unconfigured" })).toBe(false);
    expect(canRunAiActions({ status: "loading" })).toBe(false);
    expect(canRunAiActions({ status: "error", message: "AI-провайдер недоступен" })).toBe(false);
  });
});
