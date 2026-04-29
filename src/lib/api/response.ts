import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status: number = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, details },
    { status }
  );
}

export function apiUnauthorized() {
  return apiError("Unauthorized", 401);
}

export function apiForbidden() {
  return apiError("Forbidden", 403);
}

export function apiNotFound(resource: string = "Resource") {
  return apiError(`${resource} not found`, 404);
}

export function apiServerError(error: unknown) {
  // Log the full error server-side (caught by Vercel logs / future Sentry)
  console.error("API Error:", error);
  // Don't leak DB schema, stack traces, or internals to clients in production.
  // Dev mode keeps the original message to make debugging easier.
  const isDev = process.env.NODE_ENV === "development";
  const message = isDev && error instanceof Error ? error.message : "Internal server error";
  return apiError(message, 500);
}
