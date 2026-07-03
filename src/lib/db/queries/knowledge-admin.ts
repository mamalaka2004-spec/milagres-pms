// ===========================================================================
// Base de Conhecimento — CRUD admin (Fase 3, #31)
// Guias de imóveis (property_guides) + Artigos/FAQ (kb_articles). Complementa o
// guides.ts (leitura/ferramentas) com escrita gerenciada em Ajustes.
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type { GuideCreate, GuideUpdate, ArticleCreate, ArticleUpdate } from "@/lib/validations/knowledge";

export type GuideRow = Database["public"]["Tables"]["property_guides"]["Row"];
export type KbRow = Database["public"]["Tables"]["kb_articles"]["Row"];

const PRIVATE_BUCKET = "property-guides";

function db() {
  return createAdminClient();
}

// ─── Guias (incl. inativos, p/ gestão) ─────────────────────────────────────
export async function listGuidesAdmin(companyId: string): Promise<GuideRow[]> {
  const { data, error } = await db()
    .from("property_guides")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return (data as GuideRow[]) || [];
}

export async function getGuideAdmin(id: string, companyId: string): Promise<GuideRow | null> {
  const { data } = await db()
    .from("property_guides")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  return (data as GuideRow | null) ?? null;
}

export async function createGuideAdmin(companyId: string, input: GuideCreate): Promise<GuideRow> {
  const { data, error } = await (db().from("property_guides") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({ ...input, company_id: companyId })
    .select()
    .single();
  if (error) throw error;
  return data as GuideRow;
}

export async function updateGuideAdmin(id: string, companyId: string, input: GuideUpdate): Promise<GuideRow> {
  const { data, error } = await (db().from("property_guides") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update(input)
    .eq("id", id)
    .eq("company_id", companyId)
    .select()
    .single();
  if (error) throw error;
  return data as GuideRow;
}

export async function deleteGuideAdmin(id: string, companyId: string): Promise<void> {
  const { error } = await db().from("property_guides").delete().eq("id", id).eq("company_id", companyId);
  if (error) throw error;
}

/** URL assinada (temporária) do PDF privado do guia. */
export async function signGuidePdf(path: string | null, expiresInSeconds = 60 * 60): Promise<string | null> {
  if (!path) return null;
  const { data } = await db().storage.from(PRIVATE_BUCKET).createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

// ─── Artigos / FAQ (incl. inativos) ────────────────────────────────────────
export async function listArticlesAdmin(
  companyId: string,
  opts?: { category?: string; scope?: string }
): Promise<KbRow[]> {
  let q = db().from("kb_articles").select("*").eq("company_id", companyId);
  if (opts?.category) q = q.eq("category", opts.category);
  if (opts?.scope) q = q.eq("scope", opts.scope);
  const { data, error } = await q.order("category").order("sort_order");
  if (error) throw error;
  return (data as KbRow[]) || [];
}

export async function getArticleAdmin(id: string, companyId: string): Promise<KbRow | null> {
  const { data } = await db()
    .from("kb_articles")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  return (data as KbRow | null) ?? null;
}

export async function createArticleAdmin(companyId: string, input: ArticleCreate): Promise<KbRow> {
  const { data, error } = await (db().from("kb_articles") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({ ...input, company_id: companyId })
    .select()
    .single();
  if (error) throw error;
  return data as KbRow;
}

export async function updateArticleAdmin(id: string, companyId: string, input: ArticleUpdate): Promise<KbRow> {
  const { data, error } = await (db().from("kb_articles") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update(input)
    .eq("id", id)
    .eq("company_id", companyId)
    .select()
    .single();
  if (error) throw error;
  return data as KbRow;
}

export async function deleteArticleAdmin(id: string, companyId: string): Promise<void> {
  const { error } = await db().from("kb_articles").delete().eq("id", id).eq("company_id", companyId);
  if (error) throw error;
}
