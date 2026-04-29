"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Expand } from "lucide-react";

interface PropertyGalleryProps {
  images: Array<{ id: string; url: string; alt_text: string | null; is_cover: boolean; sort_order: number }>;
  fallback?: string | null;
  alt: string;
}

export function PropertyGallery({ images, fallback, alt }: PropertyGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const ordered = [...images].sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1;
    if (!a.is_cover && b.is_cover) return 1;
    return a.sort_order - b.sort_order;
  });

  if (ordered.length === 0) {
    return (
      <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-gradient-to-br from-brand-300 to-brand-600 flex items-center justify-center text-7xl">
        {fallback ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fallback} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <span>🏡</span>
        )}
      </div>
    );
  }

  const main = ordered[activeIndex];
  const thumbs = ordered.slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-gray-100 group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={main.url}
          alt={main.alt_text || alt}
          className="w-full h-full object-cover"
        />
        {ordered.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => setActiveIndex((i) => (i - 1 + ordered.length) % ordered.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-700 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => setActiveIndex((i) => (i + 1) % ordered.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-700 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setLightbox(activeIndex)}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-xs font-semibold text-gray-700 shadow"
        >
          <Expand size={12} /> Ver todas ({ordered.length})
        </button>
      </div>

      {ordered.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {thumbs.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`relative shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden border-2 transition ${
                i === activeIndex ? "border-brand-500" : "border-transparent hover:border-brand-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt_text || `${alt} ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <X size={20} />
          </button>
          {ordered.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((idx) => (idx === null ? 0 : (idx - 1 + ordered.length) % ordered.length));
                }}
                className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((idx) => (idx === null ? 0 : (idx + 1) % ordered.length));
                }}
                className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
          <div className="max-w-5xl w-full max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ordered[lightbox].url}
              alt={ordered[lightbox].alt_text || alt}
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
