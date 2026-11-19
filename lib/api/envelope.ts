import { NextResponse } from "next/server";
import type { ErrorCode } from "@/lib/errors";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  error: null;
};

export type ApiFailure = {
  success: false;
  data: null;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function jsonSuccess<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      error: null,
    },
    init,
  );
}

export function jsonError(
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}
