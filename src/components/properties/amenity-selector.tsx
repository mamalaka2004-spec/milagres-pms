"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Amenity {
  id: string;
  name: string;
  name_pt: string | null;
  category: string | null;
}

interface AmenitySelectorProps {
  propertyId: string;
  initialSelectedIds?: string[];
}

const categoryLabels: Record<string, string> = {
  general: "General",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  bedroom: "Bedroom",
  outdoor: "Outdoor",
  safety: "Safety",
  entertainment: "Entertainment",
  accessibility: "Accessibility",
};

export function AmenitySelector({ propertyId, initialSelectedIds = [] }: AmenitySelectorProps) {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    fetch("/api/amenities")
      .then((r) => r.json())
      .then((res) => res.data && setAmenities(res.data));
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const save = async () => {
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await fetch(`/api/properties/${propertyId}/amenities`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amenity_ids: Array.from(selected) }),
      });
      if (res.ok) setSavedMsg("✓ Saved");
      setTimeout(() => setSavedMsg(""), 2000);
    } finally {
      setSaving(false);
    }
  };

  // Group by category
  const grouped = amenities.reduce((acc, a) => {
    const cat = a.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {} as Record<string, Amenity[]>);

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            {categoryLabels[category] || category}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {items.map((amenity) => {
              const isSelected = selected.has(amenity.id);
              return (
                <button
                  key={amenity.id}
                  type="button"
                  onClick={() => toggle(amenity.id)}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition",
                    isSelected
                      ? "bg-brand-50 border-brand-400 text-brand-700"
                      : "bg-white border-gray-200 text-gray-600 hover:border-brand-300"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
                      isSelected ? "bg-brand-500 border-brand-500" : "border-gray-300"
                    )}
                  >
                    {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                  </div>
                  <span className="truncate">{amenity.name_pt || amenity.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Amenities"}
        </button>
        {savedMsg && <span className="text-sm text-green-600 font-semibold">{savedMsg}</span>}
        <span className="text-xs text-gray-400 ml-auto">{selected.size} selected</span>
      </div>
    </div>
  );
}
