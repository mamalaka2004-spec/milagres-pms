"use client";

import { useState, useRef } from "react";
import { Upload, X, Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface PropertyImage {
  id: string;
  url: string;
  is_cover: boolean;
  alt_text?: string | null;
}

interface PhotoGalleryProps {
  propertyId: string;
  initialImages?: PropertyImage[];
}

export function PhotoGallery({ propertyId, initialImages = [] }: PhotoGalleryProps) {
  const [images, setImages] = useState<PropertyImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError("");

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", `properties/${propertyId}`);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Upload failed");

        // Link to property
        const linkRes = await fetch(`/api/properties/${propertyId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: result.data.url, is_cover: images.length === 0 }),
        });
        const linkResult = await linkRes.json();
        if (linkRes.ok) setImages((prev) => [...prev, linkResult.data]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const setCover = async (imageId: string) => {
    await fetch(`/api/properties/${propertyId}/images/${imageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_cover: true }),
    });
    setImages(images.map((img) => ({ ...img, is_cover: img.id === imageId })));
  };

  const deleteImage = async (imageId: string) => {
    if (!confirm("Delete this image?")) return;
    await fetch(`/api/properties/${propertyId}/images/${imageId}`, { method: "DELETE" });
    setImages(images.filter((img) => img.id !== imageId));
  };

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 border-dashed border-brand-300 hover:border-brand-500 hover:bg-brand-50/50 text-brand-600 font-semibold text-sm transition w-full justify-center disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Uploading...
            </>
          ) : (
            <>
              <Upload size={18} /> Upload Photos
            </>
          )}
        </button>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      {/* Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((image) => (
            <div
              key={image.id}
              className={cn(
                "relative group aspect-[4/3] rounded-lg overflow-hidden border-2",
                image.is_cover ? "border-brand-500 ring-2 ring-brand-500/20" : "border-gray-200"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt_text || ""} className="w-full h-full object-cover" />

              {image.is_cover && (
                <div className="absolute top-2 left-2 bg-brand-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <Star size={10} fill="currentColor" /> Cover
                </div>
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                {!image.is_cover && (
                  <button
                    type="button"
                    onClick={() => setCover(image.id)}
                    className="p-2 rounded-full bg-white/90 hover:bg-white text-gray-700"
                    title="Set as cover"
                  >
                    <Star size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteImage(image.id)}
                  className="p-2 rounded-full bg-white/90 hover:bg-red-500 hover:text-white text-red-500 transition"
                  title="Delete"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
