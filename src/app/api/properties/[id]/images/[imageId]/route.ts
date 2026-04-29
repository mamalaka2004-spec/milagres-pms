import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deletePropertyImage } from "@/lib/db/queries/properties";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

interface Params { params: Promise<{ id: string; imageId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireRole(["admin", "manager"]);
    const { id, imageId } = await params;
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

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    await requireRole(["admin", "manager"]);
    const { imageId } = await params;
    await deletePropertyImage(imageId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
