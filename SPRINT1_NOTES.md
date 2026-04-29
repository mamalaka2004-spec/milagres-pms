# Sprint 1 — Properties Module ✅

## What Was Built

### Database
- `002_storage_buckets.sql` — `property-images` bucket with RLS policies

### Validation
- `src/lib/validations/property.ts` — Full Zod schema with reais→cents conversion
- `src/lib/validations/owner.ts` — Owner validation

### Database Queries
- `src/lib/db/queries/properties.ts` — Full CRUD + images + amenities
- `src/lib/db/queries/owners.ts` — Owner CRUD + property ownership assignment

### Auth & API Helpers
- `src/lib/auth.ts` — `requireAuth`, `requireRole`
- `src/lib/api/response.ts` — Standard API response helpers

### API Routes
- `GET/POST /api/properties`
- `GET/PATCH/DELETE /api/properties/[id]`
- `POST /api/properties/[id]/images` — Link uploaded image
- `PATCH/DELETE /api/properties/[id]/images/[imageId]` — Set cover / delete
- `PUT /api/properties/[id]/amenities` — Set amenities
- `POST /api/upload` — Upload to Supabase Storage
- `GET /api/amenities`
- `GET/POST /api/owners`
- `GET/PATCH /api/owners/[id]`

### Components
- `PropertyCard` — Reusable card for list grid with cover image, status, price
- `PropertyForm` — Multi-section form: Basic, Display, Location, Capacity, Pricing, Rules, Booking Settings
- `PhotoGallery` — Upload (multiple), set cover, delete with hover actions
- `AmenitySelector` — Grouped by category with checkbox UI and save button
- `EmptyState` — Shared empty state for all list pages

### Pages
- `/properties` — Real Supabase data, filter by status, mobile FAB, empty state
- `/properties/new` — Create with PropertyForm
- `/properties/[id]` — Detail view with Photos gallery and Amenity selector inline
- `/properties/[id]/edit` — Edit with pre-filled PropertyForm
- `/owners` — Owner list with table
- `/owners/new` — Create owner form

### Navigation
- Added "Owners" link to sidebar

## How to Test

1. Start the dev server: `npm run dev`
2. Log in as admin
3. Go to `/properties` → click "+ Add Property"
4. Fill in the form (try `Casa Coral`, code `MIL-01`, slug `casa-coral`)
5. After creating, go to the detail page
6. Upload photos → they appear in the gallery
7. Select amenities → click "Save Amenities"
8. Click "Edit" to modify
9. Go to `/owners` → create an owner

## Next: Sprint 2 — Guests + Reservations
- Guest CRM (profiles, search, history)
- Reservation create/edit with availability check
- Financial breakdown calculation
- Status workflow (pending → confirmed → checked-in → checked-out)
- Reservation overlap prevention (already in DB trigger)
