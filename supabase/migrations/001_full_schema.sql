-- ============================================================
-- MILAGRES PMS — Full Database Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- ─── 1. COMPANIES ───
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  email TEXT,
  phone TEXT,
  website TEXT,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'BR',
  currency TEXT DEFAULT 'BRL',
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. USERS ───
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
  is_active BOOLEAN DEFAULT true,
  language TEXT DEFAULT 'en',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_users_company ON public.users(company_id);
CREATE INDEX idx_users_role ON public.users(role);

-- ─── 3. PROPERTIES ───
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  type TEXT CHECK (type IN ('apartment', 'house', 'studio', 'villa', 'cabin', 'room', 'other')),
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'BR',
  zip_code TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  max_guests INT NOT NULL DEFAULT 2,
  bedrooms INT DEFAULT 1,
  beds INT DEFAULT 1,
  bathrooms INT DEFAULT 1,
  title TEXT,
  subtitle TEXT,
  description TEXT,
  short_description TEXT,
  house_rules TEXT,
  cancellation_policy TEXT,
  check_in_time TIME DEFAULT '15:00',
  check_out_time TIME DEFAULT '11:00',
  min_nights INT DEFAULT 1,
  max_nights INT DEFAULT 30,
  base_price_cents INT NOT NULL DEFAULT 0,
  cleaning_fee_cents INT DEFAULT 0,
  extra_guest_fee_cents INT DEFAULT 0,
  extra_guest_after INT DEFAULT 0,
  instant_booking_enabled BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  meta_title TEXT,
  meta_description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_properties_company ON public.properties(company_id);
CREATE INDEX idx_properties_slug ON public.properties(slug);
CREATE INDEX idx_properties_status ON public.properties(status);

-- ─── 4. PROPERTY IMAGES ───
CREATE TABLE IF NOT EXISTS public.property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INT DEFAULT 0,
  is_cover BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_property_images_property ON public.property_images(property_id);

-- ─── 5. AMENITIES ───
CREATE TABLE IF NOT EXISTS public.amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id),
  name TEXT NOT NULL,
  name_pt TEXT,
  name_es TEXT,
  icon TEXT,
  category TEXT CHECK (category IN ('general', 'kitchen', 'bathroom', 'bedroom', 'outdoor', 'safety', 'entertainment', 'accessibility')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_amenities_category ON public.amenities(category);

-- ─── 6. PROPERTY AMENITIES ───
CREATE TABLE IF NOT EXISTS public.property_amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  amenity_id UUID NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  UNIQUE(property_id, amenity_id)
);

-- ─── 7. OWNERS ───
CREATE TABLE IF NOT EXISTS public.owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document_number TEXT,
  document_type TEXT CHECK (document_type IN ('cpf', 'cnpj', 'passport', 'other')),
  bank_info JSONB,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_owners_company ON public.owners(company_id);

-- ─── 8. PROPERTY OWNERSHIP ───
CREATE TABLE IF NOT EXISTS public.property_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  share_percentage DECIMAL(5,2) NOT NULL CHECK (share_percentage > 0 AND share_percentage <= 100),
  commission_percentage DECIMAL(5,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, owner_id)
);
CREATE INDEX idx_property_ownership_property ON public.property_ownership(property_id);

-- ─── 9. GUESTS ───
CREATE TABLE IF NOT EXISTS public.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document_number TEXT,
  document_type TEXT CHECK (document_type IN ('cpf', 'rg', 'passport', 'id_card', 'other')),
  date_of_birth DATE,
  nationality TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  language TEXT DEFAULT 'pt-BR',
  notes TEXT,
  tags TEXT[],
  is_vip BOOLEAN DEFAULT false,
  total_stays INT DEFAULT 0,
  total_spent_cents INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_guests_company ON public.guests(company_id);
CREATE INDEX idx_guests_email ON public.guests(email);
CREATE INDEX idx_guests_phone ON public.guests(phone);
CREATE INDEX idx_guests_name ON public.guests(full_name);

-- ─── 10. RESERVATIONS ───
CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  guest_id UUID NOT NULL REFERENCES public.guests(id),
  booking_code TEXT UNIQUE NOT NULL,
  channel TEXT NOT NULL DEFAULT 'direct' CHECK (channel IN ('direct', 'airbnb', 'booking', 'expedia', 'vrbo', 'manual', 'other')),
  channel_ref TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INT NOT NULL CHECK (nights > 0),
  num_guests INT NOT NULL DEFAULT 1,
  num_adults INT DEFAULT 1,
  num_children INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('inquiry', 'pending', 'confirmed', 'checked_in', 'checked_out', 'canceled', 'no_show')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'refunded')),
  base_amount_cents INT DEFAULT 0,
  cleaning_fee_cents INT DEFAULT 0,
  extra_guest_fee_cents INT DEFAULT 0,
  discount_cents INT DEFAULT 0,
  subtotal_cents INT DEFAULT 0,
  platform_fee_cents INT DEFAULT 0,
  tax_cents INT DEFAULT 0,
  total_cents INT DEFAULT 0,
  net_amount_cents INT DEFAULT 0,
  owner_payout_cents INT DEFAULT 0,
  special_requests TEXT,
  internal_notes TEXT,
  cancellation_reason TEXT,
  canceled_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_dates CHECK (check_in_date < check_out_date)
);
CREATE INDEX idx_reservations_company ON public.reservations(company_id);
CREATE INDEX idx_reservations_property ON public.reservations(property_id);
CREATE INDEX idx_reservations_guest ON public.reservations(guest_id);
CREATE INDEX idx_reservations_dates ON public.reservations(property_id, check_in_date, check_out_date);
CREATE INDEX idx_reservations_status ON public.reservations(status);
CREATE INDEX idx_reservations_booking_code ON public.reservations(booking_code);
CREATE INDEX idx_reservations_check_in ON public.reservations(check_in_date);

-- ─── 11. RESERVATION GUESTS ───
CREATE TABLE IF NOT EXISTS public.reservation_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document_number TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_reservation_guests_reservation ON public.reservation_guests(reservation_id);

-- ─── 12. PAYMENTS ───
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id),
  amount_cents INT NOT NULL,
  method TEXT CHECK (method IN ('pix', 'credit_card', 'debit_card', 'bank_transfer', 'cash', 'platform', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  reference TEXT,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_payments_reservation ON public.payments(reservation_id);
CREATE INDEX idx_payments_status ON public.payments(status);

-- ─── 13. FINANCIAL ENTRIES ───
CREATE TABLE IF NOT EXISTS public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  reservation_id UUID REFERENCES public.reservations(id),
  property_id UUID REFERENCES public.properties(id),
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense', 'commission', 'payout', 'tax', 'refund')),
  category TEXT,
  description TEXT,
  amount_cents INT NOT NULL,
  date DATE NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_financial_entries_date ON public.financial_entries(date);
CREATE INDEX idx_financial_entries_reservation ON public.financial_entries(reservation_id);
CREATE INDEX idx_financial_entries_property ON public.financial_entries(property_id);
CREATE INDEX idx_financial_entries_type ON public.financial_entries(type);

-- ─── 14. BLOCKED DATES ───
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT CHECK (reason IN ('owner_use', 'maintenance', 'cleaning', 'seasonal', 'other')),
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_block_dates CHECK (start_date < end_date)
);
CREATE INDEX idx_blocked_dates_property ON public.blocked_dates(property_id, start_date, end_date);

-- ─── 15. HOUSEKEEPING TASKS ───
CREATE TABLE IF NOT EXISTS public.housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  reservation_id UUID REFERENCES public.reservations(id),
  type TEXT DEFAULT 'checkout_clean' CHECK (type IN ('checkout_clean', 'checkin_prep', 'deep_clean', 'inspection', 'turnover')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES public.users(id),
  due_date DATE,
  due_time TIME,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_housekeeping_property ON public.housekeeping_tasks(property_id);
CREATE INDEX idx_housekeeping_status ON public.housekeeping_tasks(status);
CREATE INDEX idx_housekeeping_due ON public.housekeeping_tasks(due_date);
CREATE INDEX idx_housekeeping_assigned ON public.housekeeping_tasks(assigned_to);

-- ─── 16. MAINTENANCE TICKETS ───
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  reported_by UUID REFERENCES public.users(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  category TEXT CHECK (category IN ('plumbing', 'electrical', 'appliance', 'structural', 'furniture', 'cleaning', 'other')),
  cost_cents INT DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  photos TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_maintenance_property ON public.maintenance_tickets(property_id);
CREATE INDEX idx_maintenance_status ON public.maintenance_tickets(status);

-- ─── 17. AI CONVERSATIONS ───
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  user_id UUID REFERENCES public.users(id),
  mode TEXT NOT NULL CHECK (mode IN ('guest', 'operations', 'management')),
  title TEXT,
  context JSONB,
  language TEXT DEFAULT 'en',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ai_conversations_user ON public.ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_mode ON public.ai_conversations(mode);

-- ─── 18. AI MESSAGES ───
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ai_messages_conversation ON public.ai_messages(conversation_id);

-- ─── 19. ACTIVITY LOGS ───
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs(created_at);

-- ─── 20. SETTINGS ───
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  category TEXT,
  UNIQUE(company_id, key)
);
CREATE INDEX idx_settings_company_key ON public.settings(company_id, key);


-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- ─── Updated_at trigger ───
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      t
    );
  END LOOP;
END;
$$;

-- ─── Reservation overlap prevention ───
CREATE OR REPLACE FUNCTION check_reservation_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reservations
    WHERE property_id = NEW.property_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status NOT IN ('canceled', 'no_show')
      AND check_in_date < NEW.check_out_date
      AND check_out_date > NEW.check_in_date
  ) THEN
    RAISE EXCEPTION 'Reservation dates overlap with existing booking for this property';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER prevent_reservation_overlap
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  WHEN (NEW.status NOT IN ('canceled', 'no_show'))
  EXECUTE FUNCTION check_reservation_overlap();

-- ─── Blocked date conflict check ───
CREATE OR REPLACE FUNCTION check_blocked_date_conflict()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.blocked_dates
    WHERE property_id = NEW.property_id
      AND start_date < NEW.check_out_date
      AND end_date > NEW.check_in_date
  ) THEN
    RAISE EXCEPTION 'Reservation dates conflict with blocked dates for this property';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER prevent_blocked_date_conflict
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  WHEN (NEW.status NOT IN ('canceled', 'no_show'))
  EXECUTE FUNCTION check_blocked_date_conflict();

-- ─── Auto-calculate nights ───
CREATE OR REPLACE FUNCTION calculate_nights()
RETURNS TRIGGER AS $$
BEGIN
  NEW.nights = NEW.check_out_date - NEW.check_in_date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER auto_calculate_nights
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_nights();

-- ─── Booking code sequence ───
CREATE SEQUENCE IF NOT EXISTS booking_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_booking_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_code IS NULL OR NEW.booking_code = '' THEN
    NEW.booking_code = 'MIL-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('booking_code_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER auto_booking_code
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION generate_booking_code();


-- ============================================================
-- SEED DATA
-- ============================================================

-- Company
INSERT INTO public.companies (id, name, slug, email, phone, website, city, state, country)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Milagres Hospedagens',
  'milagres',
  'contato@milagreshospedagens.com',
  '+5582999999999',
  'https://milagreshospedagens.com',
  'São Miguel dos Milagres',
  'AL',
  'BR'
);

-- Amenities
INSERT INTO public.amenities (company_id, name, name_pt, name_es, icon, category) VALUES
('a0000000-0000-0000-0000-000000000001', 'Wi-Fi', 'Wi-Fi', 'Wi-Fi', 'Wifi', 'general'),
('a0000000-0000-0000-0000-000000000001', 'Air Conditioning', 'Ar Condicionado', 'Aire Acondicionado', 'AirVent', 'general'),
('a0000000-0000-0000-0000-000000000001', 'Parking', 'Estacionamento', 'Estacionamiento', 'Car', 'general'),
('a0000000-0000-0000-0000-000000000001', 'Swimming Pool', 'Piscina', 'Piscina', 'Waves', 'outdoor'),
('a0000000-0000-0000-0000-000000000001', 'Full Kitchen', 'Cozinha Completa', 'Cocina Completa', 'UtensilsCrossed', 'kitchen'),
('a0000000-0000-0000-0000-000000000001', 'Smart TV', 'Smart TV', 'Smart TV', 'Tv', 'entertainment'),
('a0000000-0000-0000-0000-000000000001', 'Coffee Maker', 'Cafeteira', 'Cafetera', 'Coffee', 'kitchen'),
('a0000000-0000-0000-0000-000000000001', 'Refrigerator', 'Geladeira', 'Refrigerador', 'Refrigerator', 'kitchen'),
('a0000000-0000-0000-0000-000000000001', 'BBQ Grill', 'Churrasqueira', 'Parrilla', 'Flame', 'outdoor'),
('a0000000-0000-0000-0000-000000000001', 'Garden', 'Jardim', 'Jardín', 'TreePine', 'outdoor'),
('a0000000-0000-0000-0000-000000000001', 'Hammock', 'Rede', 'Hamaca', 'Sun', 'outdoor'),
('a0000000-0000-0000-0000-000000000001', 'Ceiling Fan', 'Ventilador', 'Ventilador', 'Wind', 'bedroom'),
('a0000000-0000-0000-0000-000000000001', 'Towels', 'Toalhas', 'Toallas', 'Bath', 'bathroom'),
('a0000000-0000-0000-0000-000000000001', 'Bed Linens', 'Roupa de Cama', 'Ropa de Cama', 'BedDouble', 'bedroom'),
('a0000000-0000-0000-0000-000000000001', 'Iron', 'Ferro de Passar', 'Plancha', 'Shirt', 'general'),
('a0000000-0000-0000-0000-000000000001', 'Washing Machine', 'Máquina de Lavar', 'Lavadora', 'Droplets', 'general'),
('a0000000-0000-0000-0000-000000000001', 'First Aid Kit', 'Kit Primeiros Socorros', 'Botiquín', 'Heart', 'safety'),
('a0000000-0000-0000-0000-000000000001', 'Fire Extinguisher', 'Extintor', 'Extintor', 'Shield', 'safety'),
('a0000000-0000-0000-0000-000000000001', 'Smoke Detector', 'Detector de Fumaça', 'Detector de Humo', 'AlertCircle', 'safety'),
('a0000000-0000-0000-0000-000000000001', 'Beach Access', 'Acesso à Praia', 'Acceso a la Playa', 'Waves', 'outdoor');

-- Default settings
INSERT INTO public.settings (company_id, key, value, category) VALUES
('a0000000-0000-0000-0000-000000000001', 'default_currency', '"BRL"', 'general'),
('a0000000-0000-0000-0000-000000000001', 'default_language', '"pt-BR"', 'general'),
('a0000000-0000-0000-0000-000000000001', 'supported_languages', '["pt-BR", "en", "es"]', 'general'),
('a0000000-0000-0000-0000-000000000001', 'booking_confirmation_email', 'true', 'booking'),
('a0000000-0000-0000-0000-000000000001', 'default_booking_mode', '"request"', 'booking'),
('a0000000-0000-0000-0000-000000000001', 'ai_enabled_modes', '["guest", "operations", "management"]', 'ai'),
('a0000000-0000-0000-0000-000000000001', 'whatsapp_number', '"+5582999999999"', 'general');


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their company data
CREATE POLICY "Users can view own company" ON public.companies
  FOR SELECT USING (id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- Users can read their own row (used by getAuthUser); cross-company reads go via service_role.
-- Self-only policy avoids infinite recursion that would happen if the policy queried public.users.
CREATE POLICY "Users can view themselves" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can view company properties" ON public.properties
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can view company guests" ON public.guests
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can view company reservations" ON public.reservations
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can view company payments" ON public.payments
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can view company tasks" ON public.housekeeping_tasks
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can view amenities" ON public.amenities
  FOR SELECT USING (true);

CREATE POLICY "Users can view property amenities" ON public.property_amenities
  FOR SELECT USING (true);

CREATE POLICY "Users can view property images" ON public.property_images
  FOR SELECT USING (true);

CREATE POLICY "Users can view settings" ON public.settings
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- Public read for active properties (for booking pages)
CREATE POLICY "Public can view active properties" ON public.properties
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL);

-- Admin/Manager write policies
CREATE POLICY "Admin can manage properties" ON public.properties
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin can manage reservations" ON public.reservations
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin can manage guests" ON public.guests
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin can manage payments" ON public.payments
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Staff can update tasks" ON public.housekeeping_tasks
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Admin can manage tasks" ON public.housekeeping_tasks
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Service role bypass for API routes
-- (Supabase service role key bypasses RLS by default)
