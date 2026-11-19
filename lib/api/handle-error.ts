import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError, isAppError } from "@/lib/errors";
import { jsonError } from "@/lib/api/envelope";

type HandledError = {
  status: number;
  body: ReturnType<typeof jsonError>;
};

export function handleApiError(error: unknown): HandledError {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: jsonError(error.code, error.message, error.status, error.details),
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 400,
      body: jsonError("VALIDATION_ERROR", "Invalid request", 400, error.issues),
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        status: 409,
        body: jsonError("CONFLICT", "Resource already exists", 409),
      };
    }

    if (error.code === "P2003") {
      return {
        status: 409,
        body: jsonError("ENTITY_IN_USE", "Entity is in use", 409),
      };
    }

    if (error.code === "P2025") {
      return {
        status: 404,
        body: jsonError("NOT_FOUND", "Resource not found", 404),
      };
    }
  }

  console.error("Unhandled API error", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown error",
  });

  return {
    status: 500,
    body: jsonError("INTERNAL_ERROR", "Internal server error", 500),
  };
}

export function assertNever(value: never): never {
  throw new AppError("INTERNAL_ERROR", `Unexpected value: ${String(value)}`);
}
