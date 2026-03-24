import { NextResponse } from "next/server";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Returns a successful JSON response with consistent { ok, data } shape.
 */
export function success<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status });
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
