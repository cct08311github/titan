import { NextResponse } from "next/server";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
  fields?: Record<string, string[] | undefined>;
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
  status: number,
  fields?: Record<string, string[] | undefined>,
): NextResponse<ApiResponse> {
  const body: ApiResponse = { ok: false, error: errorName, message };
  if (fields) body.fields = fields;
  return NextResponse.json(body, { status });
}
