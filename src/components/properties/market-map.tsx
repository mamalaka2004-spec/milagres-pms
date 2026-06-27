"use client";

import { useEffect, useRef } from "react";

export interface MapComp {
  id: string;
  name: string | null;
  title: string | null;
  latitude: number | null;
  longitude: number | null;
  nightly_price: number | null;
  source: string;
  url: string | null;
  is_superhost: boolean;
}

interface Props {
  propertyName: string;
  propertyLat: number | null;
  propertyLng: number | null;
  comps: MapComp[];
}

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const BRL = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Map of the property + nearby competitor listings, using Leaflet + OpenStreetMap
 * (no API key). Plain Leaflet (not react-leaflet) loaded lazily on the client to avoid
 * SSR/window issues; comps are circle markers (no icon assets needed).
 */
export default function MarketMap({ propertyName, propertyLat, propertyLng, comps }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    // Ensure Leaflet CSS is present (injected once, avoids bundler global-CSS limits).
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    let cancelled = false;
    const pts = comps.filter((c) => typeof c.latitude === "number" && typeof c.longitude === "number");
    const center: [number, number] =
      propertyLat != null && propertyLng != null
        ? [propertyLat, propertyLng]
        : pts.length > 0
        ? [pts[0].latitude as number, pts[0].longitude as number]
        : [-9.2805, -35.3843];

    import("leaflet").then((mod) => {
      if (cancelled || !containerRef.current) return;
      const L = mod.default;
      // Re-init guard (StrictMode/double-effect).
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(center, 14);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const bounds: [number, number][] = [];

      // Competitor markers (sage circle; premium = amber ring).
      for (const c of pts) {
        const lat = c.latitude as number;
        const lng = c.longitude as number;
        bounds.push([lat, lng]);
        const marker = L.circleMarker([lat, lng], {
          radius: 7,
          color: c.is_superhost ? "#B45309" : "#4A5A40",
          weight: 2,
          fillColor: c.source === "booking" ? "#1D4ED8" : "#6B7F5B",
          fillOpacity: 0.85,
        }).addTo(map);
        const label = c.name || c.title || "Anúncio";
        marker.bindPopup(
          `<div style="font-size:12px"><strong>${label}</strong><br/>${BRL(c.nightly_price)}/noite · ${
            c.source === "booking" ? "Booking" : "Airbnb"
          }${c.url ? `<br/><a href="${c.url}" target="_blank" rel="noopener">abrir anúncio</a>` : ""}</div>`
        );
      }

      // Our property — distinct larger marker.
      if (propertyLat != null && propertyLng != null) {
        bounds.push([propertyLat, propertyLng]);
        L.circleMarker([propertyLat, propertyLng], {
          radius: 11,
          color: "#1F2937",
          weight: 3,
          fillColor: "#F5A623",
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup(`<div style="font-size:12px"><strong>${propertyName}</strong><br/>Seu imóvel</div>`);
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      }
      // Leaflet needs a size invalidation after layout settles.
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, [comps, propertyLat, propertyLng, propertyName]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="h-72 w-full rounded-xl border border-gray-200 z-0" aria-label="Mapa de anúncios próximos" />
      <div className="flex items-center gap-4 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "#F5A623", border: "2px solid #1F2937" }} /> Seu imóvel</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "#6B7F5B" }} /> Airbnb</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "#1D4ED8" }} /> Booking</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ border: "2px solid #B45309" }} /> Superhost/Preferred</span>
      </div>
    </div>
  );
}
