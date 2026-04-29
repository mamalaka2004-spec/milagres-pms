import { NextRequest } from "next/server";
import { addPropertyImage, getPropertyById } from "@/lib/db/queries/properties";
import { requireRole } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;

    // Verify the property exists AND belongs to the user's company before
    // mutating it. Without this, an admin from company A could add images to
    // a property from company B by guessing/iterating UUIDs.
    const property = await getPropertyById(id);
    if (!property) return apiNotFound("Property");
    if (property.company_id !== user.company_id) return apiForbidden();

    const { url, alt_text, is_cover } = await request.json();
    if (!url || typeof url !== "string") return apiError("URL required", 400);
    const image = await addPropertyImage(id, url, alt_text, is_cover);
    return apiSuccess(image, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
