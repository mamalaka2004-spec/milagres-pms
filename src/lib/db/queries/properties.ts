import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Property = Database["public"]["Tables"]["properties"]["Row"];
// Looser insert/update types — DB has many auto-set columns + new sync fields,
// listing them all in route bodies is brittle. The admin client persists whatever fields are passed.
type PropertyInsert = Record<string, unknown>;
type PropertyUpdate = Record<string, unknown>;

export interface PropertyFilters {
  status?: string;
  search?: string;
  is_featured?: boolean;
}

// ─── List ───
export type PropertyListItem = Property & {
  property_images: Array<{ id: string; url: string; is_cover: boolean; sort_order: number }>;
};

export async function getProperties(
  companyId: string,
  filters: PropertyFilters = {}
): Promise<PropertyListItem[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("properties")
    .select(`
      *,
      property_images (id, url, is_cover, sort_order)
    `)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,code.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
    );
  }

  if (filters.is_featured !== undefined) {
    query = query.eq("is_featured", filters.is_featured);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as PropertyListItem[]) || [];
}

// ─── Get by ID ───
export type PropertyWithRelations = Property & {
  airbnb_ical_url: string | null;
  booking_ical_url: string | null;
  airbnb_listing_url: string | null;
  booking_listing_url: string | null;
  airbnb_last_synced_at: string | null;
  booking_last_synced_at: string | null;
  property_images: Array<{
    id: string;
    url: string;
    alt_text: string | null;
    sort_order: number;
    is_cover: boolean;
  }>;
  property_amenities: Array<{
    amenity: { id: string; name: string; name_pt: string | null; name_es: string | null; icon: string | null; category: string | null };
  }>;
  property_ownership: Array<{
    id: string;
    share_percentage: number;
    commission_percentage: number;
    is_active: boolean;
    owner: { id: string; full_name: string; email: string | null; phone: string | null } | null;
  }>;
};

export async function getPropertyById(id: string): Promise<PropertyWithRelations | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("properties")
    .select(`
      *,
      property_images (id, url, alt_text, sort_order, is_cover),
      property_amenities (
        amenity:amenities (id, name, name_pt, name_es, icon, category)
      ),
      property_ownership (
        id, share_percentage, commission_percentage, is_active,
        owner:owners (id, full_name, email, phone)
      )
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as PropertyWithRelations | null) || null;
}

// ─── Get by slug (public) ───
export type PublicProperty = {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  code: string;
  type: string | null;
  city: string | null;
  state: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  max_guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  short_description: string | null;
  house_rules: string | null;
  cancellation_policy: string | null;
  check_in_time: string;
  check_out_time: string;
  min_nights: number;
  max_nights: number;
  base_price_cents: number;
  cleaning_fee_cents: number;
  extra_guest_fee_cents: number;
  extra_guest_after: number;
  instant_booking_enabled: boolean;
  cover_image_url: string | null;
  property_images: Array<{ id: string; url: string; alt_text: string | null; sort_order: number; is_cover: boolean }>;
  property_amenities: Array<{ amenity: { id: string; name: string; name_pt: string | null; icon: string | null; category: string | null } }>;
};

export async function getPropertyBySlug(slug: string): Promise<PublicProperty | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("properties")
    .select(`
      *,
      property_images (id, url, alt_text, sort_order, is_cover),
      property_amenities (
        amenity:amenities (id, name, name_pt, name_es, icon, category)
      )
    `)
    .eq("slug", slug)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as PublicProperty | null) || null;
}

export async function listActivePublicProperties() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("properties")
    .select(`
      id, name, slug, code, type, city, latitude, longitude,
      max_guests, bedrooms, beds, bathrooms,
      title, subtitle, description, short_description,
      base_price_cents, cleaning_fee_cents,
      cover_image_url, instant_booking_enabled, is_featured,
      property_images (id, url, is_cover, sort_order)
    `)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("is_featured", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data as unknown as Array<PublicProperty & { is_featured: boolean }>) || [];
}

// ─── Create ───
export async function createProperty(data: PropertyInsert) {
  const supabase = createAdminClient();

  const { data: property, error } = await (supabase.from("properties") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return property;
}

// ─── Update ───
export async function updateProperty(id: string, data: PropertyUpdate) {
  const supabase = createAdminClient();

  const { data: property, error } = await (supabase.from("properties") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return property;
}

// ─── Soft delete ───
export async function deleteProperty(id: string) {
  const supabase = createAdminClient();

  const { error } = await (supabase.from("properties") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}

// ─── Property images ───
export async function addPropertyImage(
  propertyId: string,
  url: string,
  altText?: string,
  isCover: boolean = false
) {
  const supabase = createAdminClient();

  // If setting as cover, unset other covers
  if (isCover) {
    await (supabase.from("property_images") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ is_cover: false })
      .eq("property_id", propertyId);
  }

  const { data, error } = await (supabase.from("property_images") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({
      property_id: propertyId,
      url,
      alt_text: altText || null,
      is_cover: isCover,
    })
    .select()
    .single();

  if (error) throw error;

  // Update property cover_image_url if this is the cover
  if (isCover) {
    await (supabase.from("properties") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ cover_image_url: url })
      .eq("id", propertyId);
  }

  return data;
}

export async function deletePropertyImage(imageId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("property_images")
    .delete()
    .eq("id", imageId);
  if (error) throw error;
  return { success: true };
}

// ─── Amenities ───
export async function setPropertyAmenities(
  propertyId: string,
  amenityIds: string[]
) {
  const supabase = createAdminClient();

  // Remove existing
  await supabase
    .from("property_amenities")
    .delete()
    .eq("property_id", propertyId);

  // Insert new
  if (amenityIds.length > 0) {
    const { error } = await (supabase.from("property_amenities") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert(amenityIds.map((id) => ({ property_id: propertyId, amenity_id: id })));
    if (error) throw error;
  }

  return { success: true };
}

export async function getAllAmenities(companyId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("amenities")
    .select("*")
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .order("category")
    .order("name");
  if (error) throw error;
  return data;
}
