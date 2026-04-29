import { NextRequest } from "next/server";
import { financialEntrySchema, ENTRY_TYPES } from "@/lib/validations/financial-entry";
import { listEntries, createEntry, type EntryType } from "@/lib/db/queries/finance";
import { requireAuth, requireRole } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");
    const validType = typeParam && (ENTRY_TYPES as readonly string[]).includes(typeParam) ? typeParam : undefined;
    const data = await listEntries(user.company_id, {
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      type: validType as EntryType | undefined,
      property_id: searchParams.get("property_id") || undefined,
    });
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const body = await request.json();
    const validation = financialEntrySchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const data = validation.data;
    const entry = await createEntry({
      company_id: user.company_id,
      reservation_id: data.reservation_id || null,
      property_id: data.property_id || null,
      type: data.type,
      category: data.category || null,
      description: data.description || null,
      amount_cents: Math.round(data.amount * 100),
      date: data.date,
      created_by: user.id,
    });
    return apiSuccess(entry, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
