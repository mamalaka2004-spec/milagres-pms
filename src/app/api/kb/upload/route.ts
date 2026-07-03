import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { UPLOAD_KINDS, UPLOAD_MIME, UPLOAD_MAX_BYTES, type UploadKind } from "@/lib/validations/knowledge";

const GUIDE_MEDIA_BUCKET = "guide-media"; // público (imagens/vídeos)
const GUIDE_PDF_BUCKET = "property-guides"; // privado (PDF com dados sensíveis)

function safeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(-80) || "arquivo";
}

/**
 * Upload de mídia de guia. multipart/form-data com { file, kind }.
 *  - image/video → bucket público `guide-media` → devolve { url } público.
 *  - pdf         → bucket privado `property-guides` → devolve { path, url } (url assinada).
 * Server-side (service_role) → escrita segura por empresa via prefixo do path.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);

    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") || "") as UploadKind;

    if (!(file instanceof File)) return apiError("Arquivo ausente", 400);
    if (!UPLOAD_KINDS.includes(kind)) return apiError("Tipo inválido (image|video|pdf)", 400);

    const contentType = file.type || "application/octet-stream";
    if (!UPLOAD_MIME[kind].includes(contentType)) {
      return apiError(`Formato não permitido para ${kind}: ${contentType}`, 415);
    }
    if (file.size > UPLOAD_MAX_BYTES[kind]) {
      return apiError(`Arquivo excede o limite (${Math.round(UPLOAD_MAX_BYTES[kind] / 1024 / 1024)}MB)`, 413);
    }

    const bucket = kind === "pdf" ? GUIDE_PDF_BUCKET : GUIDE_MEDIA_BUCKET;
    const path = `${user.company_id}/${kind}/${Date.now()}-${safeName(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const admin = createAdminClient();
    const { error: upErr } = await admin.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (upErr) throw upErr;

    if (kind === "pdf") {
      const { data: signed } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60);
      return apiSuccess({ kind, bucket, path, url: signed?.signedUrl ?? null });
    }

    const { data: pub } = admin.storage.from(bucket).getPublicUrl(path);
    return apiSuccess({ kind, bucket, path, url: pub.publicUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export const dynamic = "force-dynamic";
