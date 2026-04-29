"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, X, ExternalLink } from "lucide-react";

const AIRBNB_URL_RE = /airbnb\.com(\.br)?\/rooms\/(\d+)/i;

function suggestSlugFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 60);
}

export function ImportAirbnbButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setUrl("");
    setCode("");
    setSlug("");
    setError("");
    setSubmitting(false);
  };

  const onUrlBlur = () => {
    const m = url.match(AIRBNB_URL_RE);
    if (m && !code) {
      const id = m[2];
      setCode(`MIL-AB-${id.slice(-6).toUpperCase()}`);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/properties/import-airbnb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, code, slug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      const propertyId = json.data.propertyId;
      router.push(`/properties/${propertyId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden lg:inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-sm transition"
      >
        <Download size={15} /> Import from Airbnb
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-lg shadow-xl">
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-base text-gray-900">Import from Airbnb</h2>
                <p className="text-xs text-gray-500">Cria uma nova propriedade com fotos e descrição da listagem.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="p-5 space-y-4">
              <Field label="Airbnb listing URL" required>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={onUrlBlur}
                  placeholder="https://www.airbnb.com.br/rooms/12345678"
                  className="form-input"
                  required
                />
                <p className="text-[10px] text-gray-400 mt-1 inline-flex items-center gap-1">
                  <ExternalLink size={10} /> Pegue na tela pública (não a do editor de host).
                </p>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Code" required>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="MIL-AB-ABC123"
                    pattern="[A-Z0-9-]+"
                    className="form-input uppercase"
                    required
                  />
                </Field>
                <Field label="Slug" required>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    onFocus={() => {
                      if (!slug && code) setSlug(suggestSlugFromName(code));
                    }}
                    placeholder="casa-coral-airbnb"
                    pattern="[a-z0-9-]+"
                    className="form-input"
                    required
                  />
                </Field>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                <strong>1 crédito</strong> da GeckoAPI será consumido. Pode levar ~10 segundos para baixar fotos.
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Importing...
                    </>
                  ) : (
                    <>
                      <Download size={14} /> Import
                    </>
                  )}
                </button>
              </div>
            </form>

            <style jsx>{`
              :global(.form-input) {
                width: 100%;
                padding: 9px 12px;
                border-radius: 8px;
                border: 1px solid #e5e5e5;
                font-size: 14px;
                color: #1a1a1a;
                background: #fff;
                transition: all 0.15s;
                font-family: inherit;
              }
              :global(.form-input:focus) {
                outline: none;
                border-color: #8a9b7e;
                box-shadow: 0 0 0 3px rgba(138, 155, 126, 0.15);
              }
            `}</style>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label} {required && "*"}
      </label>
      {children}
    </div>
  );
}
