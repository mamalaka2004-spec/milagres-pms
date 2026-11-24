/**
 * Copia as mídias do chat (bucket Supabase "whatsapp-media") para o Cloudflare R2 e
 * reaponta whatsapp_messages.media_url para a URL nova.
 *
 * Seguro por padrão:
 *   npx tsx scripts/migrate-whatsapp-media-to-r2.ts              → só relatório (dry-run)
 *   npx tsx scripts/migrate-whatsapp-media-to-r2.ts --apply      → copia + reaponta URLs
 *   npx tsx scripts/migrate-whatsapp-media-to-r2.ts --apply --delete-source
 *        → além disso apaga do Supabase SÓ o que foi conferido no R2 (mesmo tamanho)
 *
 * Idempotente: pode rodar de novo; mensagens já no R2 são ignoradas.
 * Requer .env.local com SUPABASE_* e R2_* (ver src/lib/storage/r2.ts).
 */
import { resolve } from "path";
import { config } from "dotenv";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { r2Upload } from "../src/lib/storage/r2";

const BUCKET = "whatsapp-media";
const MARKER = `/storage/v1/object/public/${BUCKET}/`;
const PAGE = 200;

const apply = process.argv.includes("--apply");
const deleteSource = process.argv.includes("--delete-source");

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  let copied = 0, failed = 0, deleted = 0, bytes = 0, seen = 0;
  const toDelete: string[] = [];
  let lastId: string | null = null;

  for (;;) {
    let q = sb
      .from("whatsapp_messages")
      .select("id, media_url, media_mime_type")
      .like("media_url", `%${MARKER}%`)
      .order("id")
      .limit(PAGE);
    if (lastId) q = q.gt("id", lastId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    lastId = data[data.length - 1].id;

    for (const m of data) {
      seen++;
      const key = decodeURIComponent(m.media_url!.split(MARKER)[1].split("?")[0]);
      if (!apply) continue;
      try {
        const res = await fetch(m.media_url!);
        if (!res.ok) throw new Error(`download ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const type = res.headers.get("content-type") || m.media_mime_type || "application/octet-stream";
        const newUrl = await r2Upload(key, buf, { contentType: type });

        // Confere no R2 antes de reapontar
        const head = await fetch(newUrl, { method: "HEAD" });
        const len = Number(head.headers.get("content-length") || -1);
        if (!head.ok || len !== buf.length) throw new Error(`verificação R2 falhou (${head.status}, ${len}/${buf.length})`);

        const { error: upErr } = await sb.from("whatsapp_messages").update({ media_url: newUrl }).eq("id", m.id);
        if (upErr) throw upErr;
        copied++;
        bytes += buf.length;
        toDelete.push(key);
      } catch (e) {
        failed++;
        console.error(`✗ ${m.id} ${key}: ${e instanceof Error ? e.message : e}`);
      }
    }
    console.log(`… ${seen} mensagens vistas, ${copied} copiadas, ${failed} falhas`);
  }

  if (apply && deleteSource && toDelete.length) {
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { error } = await sb.storage.from(BUCKET).remove(batch);
      if (error) console.error(`✗ remoção do lote ${i}: ${error.message}`);
      else deleted += batch.length;
    }
  }

  console.log(
    `\n${apply ? "APLICADO" : "DRY-RUN"}: ${seen} mensagens com mídia no Supabase` +
      (apply ? ` · ${copied} copiadas (${(bytes / 1048576).toFixed(1)} MB) · ${failed} falhas` : "") +
      (deleteSource ? ` · ${deleted} removidas do Supabase` : ""),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
