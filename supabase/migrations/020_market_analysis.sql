-- 020_market_analysis.sql
-- Market analysis / suggested-rate module. Stores competitor listings pulled from
-- GeckoAPI (Airbnb / Booking PLP) and per-property snapshots with the computed
-- suggested nightly rate. Source is abstracted so other providers can plug in later.

-- One row per competitor listing captured in a collection run.
CREATE TABLE IF NOT EXISTS market_comps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  property_id   uuid REFERENCES properties(id) ON DELETE CASCADE,
  snapshot_id   uuid,                                  -- FK added after snapshots table
  source        text NOT NULL DEFAULT 'airbnb',        -- 'airbnb' | 'booking'
  listing_id    text,                                  -- external listing id
  url           text,
  title         text,
  name          text,
  category      text,
  city          text,
  latitude      double precision,
  longitude     double precision,
  bedrooms      integer,                               -- parsed (studio = 0)
  capacity      integer,
  nightly_price numeric(12,2),                         -- price normalized per night
  total_price   numeric(12,2),                         -- price for the searched window
  currency      text DEFAULT 'BRL',
  rating        numeric(3,2),
  reviews_count integer,
  is_superhost  boolean DEFAULT false,
  guest_favorite boolean DEFAULT false,
  thumbnail     text,
  check_in      date,
  check_out     date,
  nights        integer,
  captured_at   timestamptz NOT NULL DEFAULT now(),
  raw           jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_market_comps_company ON market_comps(company_id);
CREATE INDEX IF NOT EXISTS idx_market_comps_property ON market_comps(property_id);
CREATE INDEX IF NOT EXISTS idx_market_comps_snapshot ON market_comps(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_market_comps_captured ON market_comps(captured_at DESC);

-- One row per collection run for a property + date window: the aggregate + suggestion.
CREATE TABLE IF NOT EXISTS market_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  property_id     uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source          text NOT NULL DEFAULT 'airbnb',
  check_in        date NOT NULL,
  check_out       date NOT NULL,
  nights          integer NOT NULL,
  radius_km       numeric(6,2),
  total_results   integer,                  -- market size reported by the provider
  sample_size     integer NOT NULL DEFAULT 0,  -- comparable listings used in the stats
  price_min       numeric(12,2),
  price_p25       numeric(12,2),
  price_median    numeric(12,2),
  price_p75       numeric(12,2),
  price_max       numeric(12,2),
  suggested_nightly numeric(12,2),
  your_nightly    numeric(12,2),            -- our base price at capture time
  credits_used    integer DEFAULT 0,
  captured_at     timestamptz NOT NULL DEFAULT now(),
  raw_meta        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_company ON market_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_property ON market_snapshots(property_id, captured_at DESC);

-- Link comps to their snapshot (kept nullable so a comp can exist without a snapshot).
DO $$ BEGIN
  ALTER TABLE market_comps
    ADD CONSTRAINT fk_market_comps_snapshot
    FOREIGN KEY (snapshot_id) REFERENCES market_snapshots(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS: this module is operated server-side via the service role (admin client), which
-- bypasses RLS. We still enable RLS and add a company-scoped read policy for
-- authenticated users, matching the rest of the schema.
ALTER TABLE market_comps ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY market_comps_company_read ON market_comps
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY market_snapshots_company_read ON market_snapshots
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
