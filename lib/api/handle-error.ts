import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError, isAppError } from "@/lib/errors";
import { apiFailure, type ApiFailure } from "@/lib/api/envelope";

type HandledError = {
  status: number;
  body: ApiFailure;
};

export function handleApiError(error: unknown): HandledError {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: apiFailure(error.code, error.message, error.details),
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 400,
      body: apiFailure("VALIDATION_ERROR", "Invalid request", error.issues),
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        status: 409,
        body: apiFailure("CONFLICT", "Resource already exists"),
      };
    }

    if (error.code === "P2003") {
      return {
        status: 409,
        body: apiFailure("ENTITY_IN_USE", "Entity is in use"),
      };
    }

    if (error.code === "P2025") {
      return {
        status: 404,
        body: apiFailure("NOT_FOUND", "Resource not found"),
      };
    }
  }

  console.error("Unhandled API error", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown error",
  });

  return {
    status: 500,
    body: apiFailure("INTERNAL_ERROR", "Internal server error"),
  };
}

export function assertNever(value: never): never {
  throw new AppError("INTERNAL_ERROR", `Unexpected value: ${String(value)}`);
}
