import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPropertyById } from "@/lib/db/queries/properties";
import { requireRole } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

interface Params {
  params: Promise<{ id: string; imageId: string }>;
}

/** Verify the image belongs to the given property AND that property belongs to the user's company. */
async function assertImageOwnership(
  imageId: string,
  propertyId: string,
  userCompanyId: string
): Promise<{ ok: true } | { ok: false; reason: "image_not_found" | "image_property_mismatch" | "forbidden" }> {
  const property = await getPropertyById(propertyId);
  if (!property) return { ok: false, reason: "image_not_found" };
  if (property.company_id !== userCompanyId) return { ok: false, reason: "forbidden" };

  // Confirm the image actually belongs to this property — prevents an attacker
  // from deleting another property's image via /api/properties/<own>/images/<victim-image-id>.
  const supabase = createAdminClient();
  const { data: img } = await supabase
    .from("property_images")
    .select("id, property_id")
    .eq("id", imageId)
    .maybeSingle();
  const row = img as { id: string; property_id: string } | null;
  if (!row) return { ok: false, reason: "image_not_found" };
  if (row.property_id !== propertyId) return { ok: false, reason: "image_property_mismatch" };
  return { ok: true };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id, imageId } = await params;

    const guard = await assertImageOwnership(imageId, id, user.company_id);
    if (!guard.ok) {
      if (guard.reason === "forbidden") return apiForbidden();
      return apiNotFound("Image");
    }

    const { is_cover } = await request.json();
    const supabase = createAdminClient();

    if (is_cover) {
      await (supabase.from("property_images") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update({ is_cover: false })
        .eq("property_id", id);
    }
    const { data, error } = await (supabase.from("property_images") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ is_cover })
      .eq("id", imageId)
      .select()
      .single();
    if (error) throw error;

    const row = data as { id: string; url: string } | null;
    if (is_cover && row) {
      await (supabase.from("properties") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update({ cover_image_url: row.url })
        .eq("id", id);
    }
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id, imageId } = await params;

    const guard = await assertImageOwnership(imageId, id, user.company_id);
    if (!guard.ok) {
      if (guard.reason === "forbidden") return apiForbidden();
      return apiNotFound("Image");
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("property_images").delete().eq("id", imageId);
    if (error) throw error;
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
