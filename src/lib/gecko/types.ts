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
