import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * JSON replacer that converts Prisma Decimal values to plain JS numbers so
 * that API responses return numeric values (not Decimal strings) for
 * Decimal fields (e.g. hours, estimatedHours, actualHours).
 */
function decimalReplacer(_key: string, value: unknown): unknown {
  if (Prisma.Decimal.isDecimal(value)) {
    return (value as Prisma.Decimal).toNumber();
  }
  return value;
}

/**
 * Returns a successful JSON response with consistent { ok, data } shape.
 * Prisma Decimal fields are automatically serialized as numbers.
 */
export function success<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  const body = JSON.stringify({ ok: true, data }, decimalReplacer);
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Returns an error JSON response with consistent { ok, error, message } shape.
 */
export function error(
  errorName: string,
  message: string,
  status: number
): NextResponse<ApiResponse> {
  return NextResponse.json({ ok: false, error: errorName, message }, { status });
}
