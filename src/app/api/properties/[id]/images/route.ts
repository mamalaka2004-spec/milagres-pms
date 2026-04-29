import { NextRequest } from "next/server";
import { addPropertyImage } from "@/lib/db/queries/properties";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin", "manager"]);
    const { id } = await params;
    const { url, alt_text, is_cover } = await request.json();
    if (!url) return apiError("URL required", 400);
    const image = await addPropertyImage(id, url, alt_text, is_cover);
    return apiSuccess(image, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
