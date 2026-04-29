import { createAdminClient } from "@/lib/supabase/admin";

type OwnerInsert = {
  company_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  document_number?: string | null;
  document_type?: "cpf" | "cnpj" | "passport" | "other" | null;
  notes?: string | null;
  is_active?: boolean;
};

export type OwnerRow = {
  id: string;
  company_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  document_number: string | null;
  document_type: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getOwners(companyId: string): Promise<OwnerRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("owners")
    .select("*")
    .eq("company_id", companyId)
    .order("full_name");
  if (error) throw error;
  return (data as unknown as OwnerRow[]) || [];
}

export type OwnerWithProperties = OwnerRow & {
  property_ownership: Array<{
    id: string;
    share_percentage: number;
    commission_percentage: number;
    is_active: boolean;
    property: { id: string; name: string; code: string } | null;
  }>;
};

export async function getOwnerById(id: string): Promise<OwnerWithProperties | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("owners")
    .select(`
      *,
      property_ownership (
        id, share_percentage, commission_percentage, is_active,
        property:properties (id, name, code)
      )
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as OwnerWithProperties | null) || null;
}

export async function createOwner(data: OwnerInsert) {
  const supabase = createAdminClient();
  const { data: owner, error } = await (supabase.from("owners") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return owner;
}

export async function updateOwner(id: string, data: Partial<OwnerInsert>) {
  const supabase = createAdminClient();
  const { data: owner, error } = await (supabase.from("owners") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return owner;
}

export async function assignOwnerToProperty(params: {
  property_id: string;
  owner_id: string;
  share_percentage: number;
  commission_percentage?: number;
}) {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from("property_ownership") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({
      property_id: params.property_id,
      owner_id: params.owner_id,
      share_percentage: params.share_percentage,
      commission_percentage: params.commission_percentage || 0,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeOwnership(ownershipId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("property_ownership")
    .delete()
    .eq("id", ownershipId);
  if (error) throw error;
  return { success: true };
}
