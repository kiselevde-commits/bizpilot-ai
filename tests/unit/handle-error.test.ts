import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { handleApiError } from "@/lib/api/handle-error";

describe("handleApiError", () => {
  it("returns a plain failure envelope, not a Response", () => {
    const handled = handleApiError(new AppError("NOT_FOUND", "Заявка не найдена"));

    expect(handled.status).toBe(404);
    expect(handled.body).toEqual({
      success: false,
      data: null,
      error: { code: "NOT_FOUND", message: "Заявка не найдена" },
    });
    expect(handled.body).not.toBeInstanceOf(Response);
  });

  it("maps unknown errors to INTERNAL_ERROR without leaking details", () => {
    const handled = handleApiError(new Error("secret stack detail"));

    expect(handled.status).toBe(500);
    expect(handled.body.error.code).toBe("INTERNAL_ERROR");
    expect(handled.body.error.message).toBe("Internal server error");
  });
});
