import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTaskById } from "@/lib/db/queries/tasks";
import {
  TASK_MEDIA_MIME,
  TASK_MEDIA_IMAGE_MAX_BYTES,
  TASK_MEDIA_VIDEO_MAX_BYTES,
} from "@/lib/validations/operations";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

const BUCKET = "task-media";
const KINDS = ["before", "after", "worker"] as const;

const signSchema = z.object({
  kind: z.enum(KINDS),
  content_type: z.string().min(3).max(80),
  size: z.number().int().positive(),
});

const confirmSchema = z.object({
  kind: z.enum(KINDS),
  path: z.string().min(3).max(400),
});

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Passo 1 — assina o upload: o cliente manda o arquivo DIRETO ao Supabase Storage
 * (vídeos passam do limite de body da Vercel; imagens usam o mesmo caminho).
 * Body: { kind, content_type, size } → { upload_url, path, media_type }.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager", "staff", "camareira"]);
    const { id } = await params;

    const task = await getTaskById(id);
    if (!task) return apiNotFound("Task");
    if (task.company_id !== user.company_id) return apiForbidden();

    const body = await request.json();
    const v = signSchema.safeParse(body);
    if (!v.success) return apiError("Validation failed", 400, v.error.flatten());

    const mime = TASK_MEDIA_MIME[v.data.content_type];
    if (!mime) return apiError("Formato não suportado. Envie JPG/PNG/WebP ou MP4/MOV/WebM.", 400);
    const maxBytes = mime.media_type === "video" ? TASK_MEDIA_VIDEO_MAX_BYTES : TASK_MEDIA_IMAGE_MAX_BYTES;
    if (v.data.size > maxBytes) {
      const mb = Math.round(maxBytes / 1024 / 1024);
      return apiError(`Arquivo muito grande (máx. ${mb}MB para ${mime.media_type === "video" ? "vídeo" : "imagem"}).`, 400);
    }

    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${task.company_id}/${id}/${v.data.kind}-${Date.now()}-${rand}.${mime.ext}`;

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return apiError(`Falha ao preparar upload: ${error?.message || "?"}`, 500);

    return apiSuccess({ upload_url: data.signedUrl, path: data.path, media_type: mime.media_type });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

/**
 * Passo 2 — confirma o upload e registra a mídia na tarefa.
 * Body: { kind, path } → linha de task_photos (com URL pública).
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager", "staff", "camareira"]);
    const { id } = await params;

    const task = await getTaskById(id);
    if (!task) return apiNotFound("Task");
    if (task.company_id !== user.company_id) return apiForbidden();

    const body = await request.json();
    const v = confirmSchema.safeParse(body);
    if (!v.success) return apiError("Validation failed", 400, v.error.flatten());

    // O path precisa pertencer a esta tarefa (não deixa registrar objeto alheio).
    const prefix = `${task.company_id}/${id}/`;
    if (!v.data.path.startsWith(prefix)) return apiError("Caminho inválido", 400);

    const ext = (v.data.path.split(".").pop() || "").toLowerCase();
    const media_type = ["mp4", "mov", "webm"].includes(ext) ? "video" : "image";

    const supabase = createAdminClient();
    // Existência: um signed URL de leitura só é emitido para objeto presente.
    const { error: checkErr } = await supabase.storage.from(BUCKET).createSignedUrl(v.data.path, 60);
    if (checkErr) return apiError("Upload não encontrado no storage. Tente novamente.", 400);

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(v.data.path);

    const { data: row, error: insErr } = await (supabase.from("task_photos") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({
        company_id: task.company_id,
        task_id: id,
        kind: v.data.kind,
        url: publicUrl,
        media_type,
        storage_bucket: BUCKET,
        storage_path: v.data.path,
        uploaded_by: user.id,
      })
      .select("id, kind, url, media_type, created_at, uploaded_by")
      .single();
    if (insErr) return apiError(`Falha ao salvar mídia: ${insErr.message}`, 500);

    await logActivity({
      user,
      action: "task_photo.create",
      entityType: "task_photo",
      entityId: id,
      details: { kind: v.data.kind, media_type },
    });
    return apiSuccess(row, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
