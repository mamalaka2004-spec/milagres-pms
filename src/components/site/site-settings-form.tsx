"use client";

import { useState } from "react";
import { Save, Globe, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils/cn";
import { SITE_TEMPLATES } from "@/lib/site/templates";
import type { SiteSettings } from "@/lib/db/queries/site";

export function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
  const [form, setForm] = useState({
    site_title: initial.site_title ?? "",
    hero_title: initial.hero_title ?? "",
    hero_subtitle: initial.hero_subtitle ?? "",
    whatsapp_number: initial.whatsapp_number ?? "",
    contact_email: initial.contact_email ?? "",
    template: initial.template || "sage",
    published: initial.published,
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao salvar");
      toast({ title: "Configurações do site salvas", variant: "success" });
    } catch (e) {
      toast({
        title: "Não foi possível salvar",
        description: e instanceof Error ? e.message : "",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Status de publicação */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              form.published ? "bg-green-500/10 text-green-600" : "bg-gray-100 text-gray-400"
            )}
          >
            {form.published ? <Globe size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">
              {form.published ? "Site publicado" : "Site não publicado"}
            </div>
            <p className="text-xs text-gray-500">
              Controla se a landing pública deve aparecer para visitantes.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.published}
          onClick={() => set("published", !form.published)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
            form.published ? "bg-brand-500" : "bg-gray-200"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
              form.published ? "translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {/* Identidade / hero */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">Identidade & hero</h3>
        <div className="space-y-1.5">
          <Label htmlFor="site_title">Nome do site</Label>
          <Input
            id="site_title"
            value={form.site_title}
            onChange={(e) => set("site_title", e.target.value)}
            placeholder="Milagres Hospedagens"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero_title">Título do hero</Label>
          <Input
            id="hero_title"
            value={form.hero_title}
            onChange={(e) => set("hero_title", e.target.value)}
            placeholder="Sua estadia perfeita em São Miguel dos Milagres"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero_subtitle">Subtítulo do hero</Label>
          <Textarea
            id="hero_subtitle"
            rows={2}
            value={form.hero_subtitle}
            onChange={(e) => set("hero_subtitle", e.target.value)}
            placeholder="Propriedades exclusivas no litoral mais bonito do Brasil."
          />
        </div>
      </div>

      {/* Contato */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">Contato</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp_number">WhatsApp (com DDI/DDD)</Label>
            <Input
              id="whatsapp_number"
              value={form.whatsapp_number}
              onChange={(e) => set("whatsapp_number", e.target.value)}
              placeholder="5582999999999"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact_email">E-mail de contato</Label>
            <Input
              id="contact_email"
              type="email"
              value={form.contact_email}
              onChange={(e) => set("contact_email", e.target.value)}
              placeholder="contato@milagreshospedagens.com"
            />
          </div>
        </div>
      </div>

      {/* Templates (#29) */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">Template</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Base extensível — novos temas entram aqui conforme forem desenvolvidos.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SITE_TEMPLATES.map((t) => {
            const active = form.template === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!t.available}
                onClick={() => t.available && set("template", t.id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
                  active
                    ? "border-brand-500 ring-2 ring-brand-500/20"
                    : "border-gray-200 hover:border-brand-300",
                  !t.available && "cursor-not-allowed opacity-60"
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full" style={{ background: t.swatch }} aria-hidden="true" />
                  <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                </div>
                <p className="text-xs text-gray-500">{t.description}</p>
                {!t.available && (
                  <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Em breve
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          <Save size={15} aria-hidden="true" /> Salvar configurações
        </Button>
      </div>
    </div>
  );
}
