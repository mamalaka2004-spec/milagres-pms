import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTaskById } from "@/lib/db/queries/tasks";
import { parseStoragePublicUrl } from "@/lib/db/queries/ops-jobs";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

export const maxDuration = 30;
const MAX_BYTES = 12 * 1024 * 1024;
const KINDS = new Set(["before", "after", "worker"]);

interface Params { params: Promise<{ id: string }> }

/** Upload a photo (before / after / worker) for a task. Staff-accessible.
 *  Legado (multipart, só imagem). Vídeos e arquivos grandes usam /media (signed URL). */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager", "staff", "camareira"]);
    const { id } = await params;

    const task = await getTaskById(id);
    if (!task) return apiNotFound("Task");
    if (task.company_id !== user.company_id) return apiForbidden();

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const kind = String(form.get("kind") || "");
    if (!file) return apiError("Nenhuma foto enviada", 400);
    if (!KINDS.has(kind)) return apiError("Tipo de foto inválido", 400);
    if (!file.type.startsWith("image/")) return apiError("Envie uma imagem", 400);
    if (file.size > MAX_BYTES) return apiError("Imagem muito grande (máx. 12MB)", 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    const path = `${task.company_id}/${id}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const supabase = createAdminClient();
    const { error: upErr } = await supabase.storage
      .from("task-media")
      .upload(path, bytes, { contentType: file.type, cacheControl: "3600", upsert: false });
    if (upErr) return apiError(`Falha no upload: ${upErr.message}`, 500);

    const { data: { publicUrl } } = supabase.storage.from("task-media").getPublicUrl(path);

    const { data: row, error: insErr } = await (supabase.from("task_photos") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({
        company_id: task.company_id,
        task_id: id,
        kind,
        url: publicUrl,
        media_type: "image",
        storage_bucket: "task-media",
        storage_path: path,
        uploaded_by: user.id,
      })
      .select("id, kind, url, media_type, created_at, uploaded_by")
      .single();
    if (insErr) return apiError(`Falha ao salvar foto: ${insErr.message}`, 500);

    await logActivity({ user, action: "task_photo.create", entityType: "task_photo", entityId: id, details: { kind } });
    return apiSuccess(row, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

/** Remove a task photo (row + objeto no storage). Body: { photo_id }. */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager", "staff", "camareira"]);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const photoId = String((body as { photo_id?: string }).photo_id || "");
    if (!photoId) return apiError("photo_id obrigatório", 400);

    const supabase = createAdminClient();
    const { data: photo } = await supabase
      .from("task_photos")
      .select("id, company_id, task_id, url, storage_bucket, storage_path")
      .eq("id", photoId)
      .maybeSingle();
    const p = photo as {
      id: string; company_id: string; task_id: string;
      url: string; storage_bucket: string | null; storage_path: string | null;
    } | null;
    if (!p || p.company_id !== user.company_id || p.task_id !== id) return apiNotFound("Photo");

    const { error } = await supabase.from("task_photos").delete().eq("id", photoId);
    if (error) throw error;

    // Best-effort: remove o objeto do storage (linhas legadas: deriva da URL pública).
    const loc =
      p.storage_bucket && p.storage_path
        ? { bucket: p.storage_bucket, path: p.storage_path }
        : parseStoragePublicUrl(p.url);
    if (loc) await supabase.storage.from(loc.bucket).remove([loc.path]).catch(() => null);

    await logActivity({ user, action: "task_photo.delete", entityType: "task_photo", entityId: id });
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
