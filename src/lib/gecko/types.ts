/** Subset of the Gecko API "airbnb.com.br/pdp" response that we use. */
export interface GeckoListing {
  url: string;
  listingId: string;
  name: string | null;
  title: string | null;
  propertyType: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  personCapacity: number | null;
  roomType: string | null;
  isSuperhost: boolean | null;
  aggregateRating?: { rating: number | null; reviewCount: number | null };
  mainImage?: { url: string | null };
  image: Array<{ url: string }>;
  description: string | null;
  highlights: string[];
  amenities: string[];
  host?: {
    name: string | null;
    isSuperhost: boolean | null;
    avatarUrl: string | null;
    highlights?: string[];
  };
  cancellationPolicy: string | null;
  badges?: string[];
}

export interface GeckoExtractResponse {
  requestId: string;
  executionId: string;
  data: {
    source: string;
    type: string;
    requestUrl: string;
    extractedAt: string;
    data: GeckoListing;
  };
}

/** One result row from a PLP (listing) extraction — Airbnb shape. */
export interface GeckoPlpItem {
  position: number;
  listingId: string;
  url: string;
  title: string | null;
  name: string | null;
  category: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  thumbnail: string | null;
  images?: Array<{ url: string }>;
  currency: string | null;
  currencyRaw: string | null;
  price: number | null; // total for the searched window (not per night)
  regularPrice: number | null;
  totalPriceLabel: string | null;
  aggregateRating: { rating: number | null; reviewCount: number | null } | null;
  badges?: string[];
  highlights?: string[]; // e.g. ["1 quarto", "2 camas", "1 banheiro"] or ["Studio"]
  superhost?: boolean;
  guestFavorite?: boolean;
}

/** One result row from a Booking PLP extraction. */
export interface GeckoBookingItem {
  url: string;
  propertyId: number | string;
  pageName?: string | null;
  name: string | null;
  address: string | null;
  city: string | null;
  countryCode?: string | null;
  latitude: number | null;
  longitude: number | null;
  distance?: string | null;
  distanceMeters?: number | null;
  thumbnail: string | null;
  currency: string | null;
  price: number | null; // total for the window
  regularPrice: number | null;
  averagePricePerNight: number | null; // already per night (preferred for nightly)
  aggregateRating: { rating: number | null; reviewCount: number | null } | null; // 0–10 scale
  starRating: number | null;
  mealPlan?: string | null;
  freeCancellation?: boolean;
  preferred?: boolean; // Booking "Preferred" property → premium signal
  preferredPlus?: boolean;
  badges?: string[];
}

export type GeckoPlpAnyItem = GeckoPlpItem | GeckoBookingItem;

/** PLP (listing) extraction response — `data.items` holds the rows. */
export interface GeckoPlpResponse {
  requestId: string;
  executionId: string;
  data: {
    source: string;
    type: string;
    url: string;
    requestUrl: string;
    extractedAt: string;
    address: string | null;
    query: string | null;
    startDate: string | null;
    endDate: string | null;
    numAdults: number | null;
    latitude: number | null;
    longitude: number | null;
    coordinateRadiusKm: number | null;
    totalResults: number | null;
    primaryResults: number | null;
    page: number | null;
    resultsPerPage: number | null;
    offset: number | null;
    nextPage: number | null;
    nextPageUrl: string | null;
    items: GeckoPlpAnyItem[];
  };
}

export type MarketSource = "airbnb" | "booking";

export interface GeckoPlpParams {
  source: MarketSource;
  /** Search URL (Airbnb /s/<place>/homes or Booking searchresults). */
  url: string;
  page?: number;
  address?: string;
  keyword?: string; // Booking PLP
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  numAdults?: number;
  numChildren?: number;
  numRooms?: number;
  latitude?: number;
  longitude?: number;
  lang?: string;
  currency?: string;
}
