import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

const ALLOWED_FOLDERS = new Set([
  "properties",
  "avatars",
  "documents",
  "housekeeping",
]);

const ALLOWED_EXTENSIONS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Verify the uploaded bytes match the claimed image format. Defends against
 * Content-Type spoofing — e.g. an HTML file with file.type="image/png". */
function detectImageFromMagicBytes(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) return "png";
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) return "webp";
  return null;
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["admin", "manager"]);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderRaw = (formData.get("folder") as string) || "properties";

    if (!file) return apiError("No file provided", 400);

    // Folder must be on the allowlist — blocks path traversal via `../../etc`.
    if (!ALLOWED_FOLDERS.has(folderRaw)) {
      return apiError("Invalid folder", 400);
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return apiError("File too large. Maximum 5MB.", 400);
    }

    // Read bytes once so we can both validate magic bytes and upload.
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const detected = detectImageFromMagicBytes(bytes);
    if (!detected) {
      return apiError("Invalid image — file content does not match an allowed format", 400);
    }
    const trustedContentType =
      detected === "jpeg" ? "image/jpeg" : detected === "png" ? "image/png" : "image/webp";
    const trustedExt = detected === "jpeg" ? "jpg" : detected;

    // Sanity-check the client-claimed type matches what we detected.
    if (!ALLOWED_EXTENSIONS[trustedExt]) {
      return apiError("Invalid file type", 400);
    }

    const supabase = createAdminClient();
    const filename = `${folderRaw}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${trustedExt}`;

    const { error: uploadError } = await supabase.storage
      .from("property-images")
      .upload(filename, bytes, {
        contentType: trustedContentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return apiError(`Upload failed: ${uploadError.message}`, 500);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("property-images").getPublicUrl(filename);

    return apiSuccess({ url: publicUrl, path: filename });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
