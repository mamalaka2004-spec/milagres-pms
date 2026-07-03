/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// Precificação em lote — query layer (Fase 4)
// Tabelas da migration 026. Acessadas via `(supabase.from(...) as any)` porque
// não estão nos tipos gerados (mesmo padrão de funnel.ts).
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Holiday,
  PricingQuote,
  PricingRule,
  PropertyGroup,
  PropertySuggestion,
} from "@/types/pricing";
import { minNightsRequired, resolveNights } from "@/lib/pricing/engine";

function db() {
  return createAdminClient();
}

// ─── Grupos de anúncios ─────────────────────────────────────────────────────
export async function listGroups(companyId: string): Promise<PropertyGroup[]> {
  const { data, error } = await (db().from("property_groups") as any)
    .select("*, property_group_members (property_id)")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data as any[]) || []).map((g) => ({
    ...g,
    member_ids: (g.property_group_members || []).map((m: { property_id: string }) => m.property_id),
    property_group_members: undefined,
  })) as PropertyGroup[];
}

export async function createGroup(
  companyId: string,
  input: { name: string; description?: string | null; color?: string }
): Promise<PropertyGroup> {
  const { data, error } = await (db().from("property_groups") as any)
    .insert({ company_id: companyId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as PropertyGroup;
}

export async function updateGroup(
  companyId: string,
  id: string,
  input: Partial<{ name: string; description: string | null; color: string; sort_order: number }>
): Promise<PropertyGroup | null> {
  const { data, error } = await (db().from("property_groups") as any)
    .update(input)
    .eq("id", id)
    .eq("company_id", companyId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as PropertyGroup | null) ?? null;
}

export async function deleteGroup(companyId: string, id: string): Promise<boolean> {
  const { error, count } = await (db().from("property_groups") as any)
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function getGroup(companyId: string, id: string): Promise<PropertyGroup | null> {
  const { data } = await (db().from("property_groups") as any)
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  return (data as PropertyGroup | null) ?? null;
}

/** Substitui os membros do grupo (delete + insert). */
export async function setGroupMembers(groupId: string, propertyIds: string[]): Promise<void> {
  const client = db();
  const { error: delError } = await (client.from("property_group_members") as any)
    .delete()
    .eq("group_id", groupId);
  if (delError) throw delError;
  if (propertyIds.length === 0) return;
  const rows = propertyIds.map((property_id) => ({ group_id: groupId, property_id }));
  const { error } = await (client.from("property_group_members") as any).insert(rows);
  if (error) throw error;
}

// ─── Feriados ───────────────────────────────────────────────────────────────
export async function listHolidays(companyId: string): Promise<Holiday[]> {
  const { data, error } = await (db().from("holidays") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data as Holiday[]) || [];
}

export async function createHoliday(
  companyId: string,
  input: { name: string; date: string; recurring: boolean }
): Promise<Holiday> {
  const { data, error } = await (db().from("holidays") as any)
    .insert({ company_id: companyId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as Holiday;
}

export async function deleteHoliday(companyId: string, id: string): Promise<boolean> {
  const { error, count } = await (db().from("holidays") as any)
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ─── Regras de preço ────────────────────────────────────────────────────────
export async function listRules(companyId: string): Promise<PricingRule[]> {
  const { data, error } = await (db().from("pricing_rules") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as PricingRule[]) || [];
}

export async function getRule(companyId: string, id: string): Promise<PricingRule | null> {
  const { data } = await (db().from("pricing_rules") as any)
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  return (data as PricingRule | null) ?? null;
}

export type RuleRow = Omit<PricingRule, "id" | "company_id" | "created_at" | "updated_at" | "created_by">;

export async function createRule(
  companyId: string,
  createdBy: string | null,
  row: RuleRow
): Promise<PricingRule> {
  const { data, error } = await (db().from("pricing_rules") as any)
    .insert({ company_id: companyId, created_by: createdBy, ...row })
    .select()
    .single();
  if (error) throw error;
  return data as PricingRule;
}

export async function updateRule(
  companyId: string,
  id: string,
  row: Partial<RuleRow>
): Promise<PricingRule | null> {
  const { data, error } = await (db().from("pricing_rules") as any)
    .update(row)
    .eq("id", id)
    .eq("company_id", companyId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as PricingRule | null) ?? null;
}

export async function deleteRule(companyId: string, id: string): Promise<boolean> {
  const { error, count } = await (db().from("pricing_rules") as any)
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * Regras ativas aplicáveis a um imóvel: escopo `all`, os grupos dos quais ele
 * é membro e o próprio imóvel.
 */
export async function getApplicableRules(companyId: string, propertyId: string): Promise<PricingRule[]> {
  const client = db();
  const { data: memberships } = await (client.from("property_group_members") as any)
    .select("group_id")
    .eq("property_id", propertyId);
  const groupIds = ((memberships as { group_id: string }[]) || []).map((m) => m.group_id);

  const orParts = [
    "target_type.eq.all",
    `and(target_type.eq.property,property_id.eq.${propertyId})`,
  ];
  if (groupIds.length > 0) {
    orParts.push(`and(target_type.eq.group,group_id.in.(${groupIds.join(",")}))`);
  }

  const { data, error } = await (client.from("pricing_rules") as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("active", true)
    .or(orParts.join(","));
  if (error) throw error;
  return (data as PricingRule[]) || [];
}

/**
 * Contexto de precificação de um imóvel para a ficha (#9): grupos dos quais é
 * membro + regras ativas que o afetam. Degrada para vazio se a migration 026
 * ainda não tiver sido aplicada.
 */
export async function getPropertyPricingContext(
  companyId: string,
  propertyId: string
): Promise<{ groups: Array<{ id: string; name: string; color: string }>; rules: PricingRule[] }> {
  try {
    const { data: memberships } = await (db().from("property_group_members") as any)
      .select("group:property_groups (id, name, color, company_id)")
      .eq("property_id", propertyId);
    const groups = (((memberships as any[]) || [])
      .map((m) => m.group)
      .filter((g) => g && g.company_id === companyId) as Array<{ id: string; name: string; color: string }>)
      .map(({ id, name, color }) => ({ id, name, color }));
    const rules = await getApplicableRules(companyId, propertyId);
    return { groups, rules };
  } catch {
    return { groups: [], rules: [] };
  }
}

// ─── Quote (motor) ──────────────────────────────────────────────────────────
export async function getQuote(
  companyId: string,
  propertyId: string,
  checkIn: string,
  checkOut: string
): Promise<PricingQuote | null> {
  const client = db();
  const { data: property } = await (client.from("properties") as any)
    .select("id, company_id, base_price_cents")
    .eq("id", propertyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!property || property.company_id !== companyId) return null;

  const [rules, holidays] = await Promise.all([
    getApplicableRules(companyId, propertyId),
    listHolidays(companyId),
  ]);

  const nights = resolveNights(checkIn, checkOut, property.base_price_cents, rules, holidays);
  return {
    property_id: propertyId,
    check_in: checkIn,
    check_out: checkOut,
    nights,
    total_cents: nights.reduce((sum, n) => sum + n.price_cents, 0),
    base_price_cents: property.base_price_cents,
    min_nights_required: minNightsRequired(nights, rules),
  };
}

// ─── Tarifa sugerida (Análise de Mercado) ───────────────────────────────────
/**
 * Última sugestão por imóvel a partir de market_snapshots (Airbnb preferido —
 * benchmark mais fiel; Booking só como fallback).
 */
export async function listSuggestions(companyId: string): Promise<PropertySuggestion[]> {
  const client = db();
  const [{ data: properties, error: propError }, { data: snapshots, error: snapError }] =
    await Promise.all([
      (client.from("properties") as any)
        .select("id, name, code, base_price_cents")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      (client.from("market_snapshots") as any)
        .select("property_id, source, suggested_nightly, sample_size, captured_at")
        .eq("company_id", companyId)
        .not("suggested_nightly", "is", null)
        .order("captured_at", { ascending: false })
        .limit(1000),
    ]);
  if (propError) throw propError;
  if (snapError) throw snapError;

  type Snap = { property_id: string; source: string; suggested_nightly: number; sample_size: number | null; captured_at: string };
  const bestByProperty = new Map<string, Snap>();
  for (const snap of ((snapshots as Snap[]) || [])) {
    const current = bestByProperty.get(snap.property_id);
    // Lista já vem por captured_at desc: guarda o primeiro (mais recente) e
    // só troca se aparecer um airbnb mais recente que um não-airbnb guardado.
    if (!current) {
      bestByProperty.set(snap.property_id, snap);
    } else if (current.source !== "airbnb" && snap.source === "airbnb") {
      bestByProperty.set(snap.property_id, snap);
    }
  }

  return (((properties as any[]) || []).map((p) => {
    const snap = bestByProperty.get(p.id);
    return {
      property_id: p.id,
      name: p.name,
      code: p.code,
      base_price_cents: p.base_price_cents,
      suggested_nightly: snap ? Number(snap.suggested_nightly) : null,
      source: snap?.source ?? null,
      sample_size: snap?.sample_size ?? null,
      captured_at: snap?.captured_at ?? null,
    };
  })) as PropertySuggestion[];
}

export async function updateBasePrice(
  companyId: string,
  propertyId: string,
  priceCents: number
): Promise<{ old_cents: number; new_cents: number } | null> {
  const client = db();
  const { data: property } = await (client.from("properties") as any)
    .select("id, base_price_cents")
    .eq("id", propertyId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!property) return null;
  const { error } = await (client.from("properties") as any)
    .update({ base_price_cents: priceCents })
    .eq("id", propertyId)
    .eq("company_id", companyId);
  if (error) throw error;
  return { old_cents: property.base_price_cents, new_cents: priceCents };
}
