-- 021_market_rating_scale.sql
-- Widen market_comps.rating to numeric(4,2). Booking ratings use a 0–10 scale (a 10.0
-- review score overflows numeric(3,2), whose max is 9.99), while Airbnb uses 0–5. The
-- wider type holds both faithfully; the UI labels the scale per source.

ALTER TABLE market_comps
  ALTER COLUMN rating TYPE numeric(4,2);
