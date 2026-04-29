import { z } from "zod";

export const propertySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  code: z.string().min(2, "Code is required").max(20).regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, numbers, and hyphens"),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  status: z.enum(["active", "inactive", "maintenance"]).default("active"),
  type: z.enum(["apartment", "house", "studio", "villa", "cabin", "room", "other"]).optional(),

  // Location
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default("BR"),
  zip_code: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),

  // Capacity
  max_guests: z.coerce.number().int().min(1).max(50),
  bedrooms: z.coerce.number().int().min(0).max(20).default(1),
  beds: z.coerce.number().int().min(0).max(50).default(1),
  bathrooms: z.coerce.number().int().min(0).max(20).default(1),

  // Display
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  short_description: z.string().max(500).optional(),

  // Rules
  house_rules: z.string().max(2000).optional(),
  cancellation_policy: z.string().max(2000).optional(),
  check_in_time: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM").default("15:00"),
  check_out_time: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM").default("11:00"),
  min_nights: z.coerce.number().int().min(1).max(365).default(1),
  max_nights: z.coerce.number().int().min(1).max(365).default(30),

  // Pricing (input as reais, stored as cents)
  base_price: z.coerce.number().min(0, "Price must be positive"),
  cleaning_fee: z.coerce.number().min(0).default(0),
  extra_guest_fee: z.coerce.number().min(0).default(0),
  extra_guest_after: z.coerce.number().int().min(0).default(0),

  // Booking
  instant_booking_enabled: z.boolean().default(false),
  is_featured: z.boolean().default(false),

  // SEO
  meta_title: z.string().max(200).optional(),
  meta_description: z.string().max(500).optional(),

  // Channel sync (Airbnb / Booking iCal feeds + listing URLs)
  airbnb_ical_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  booking_ical_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  airbnb_listing_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  booking_listing_url: z.string().url("Invalid URL").optional().or(z.literal("")),
});

export type PropertyInput = z.infer<typeof propertySchema>;

export const propertyUpdateSchema = propertySchema.partial();
export type PropertyUpdateInput = z.infer<typeof propertyUpdateSchema>;
