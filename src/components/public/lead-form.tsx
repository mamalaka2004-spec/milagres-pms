"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

interface LeadFormProps {
  imovelNome: string;
  imovelSlug: string;
}

type Estado = "parado" | "enviando" | "ok" | "erro";

export function LeadForm({ imovelNome, imovelSlug }: LeadFormProps) {
  const [estado, setEstado] = useState<Estado>("parado");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);

    setEstado("enviando");
    setErro(null);
    try {
      const res = await fetch("/api/venda/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: dados.get("nome"),
          telefone: dados.get("telefone"),
          mensagem: dados.get("mensagem"),
          imovel: imovelNome,
          slug: imovelSlug,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Não foi possível enviar agora.");
      setEstado("ok");
      form.reset();
    } catch (err) {
      setEstado("erro");
      setErro(err instanceof Error ? err.message : "Não foi possível enviar agora.");
    }
  }

  if (estado === "ok") {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
        <Check size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
        <p>
          Contato recebido. Nosso time comercial fala com você em breve sobre o{" "}
          <strong className="font-semibold">{imovelNome}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <div>
        <label htmlFor="lead-nome" className="mb-1 block text-xs font-medium text-gray-600">
          Nome
        </label>
        <input
          id="lead-nome"
          name="nome"
          type="text"
          required
          maxLength={120}
          autoComplete="name"
          className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30"
          placeholder="Seu nome"
        />
      </div>

      <div>
        <label htmlFor="lead-telefone" className="mb-1 block text-xs font-medium text-gray-600">
          WhatsApp
        </label>
        <input
          id="lead-telefone"
          name="telefone"
          type="tel"
          required
          maxLength={30}
          autoComplete="tel"
          className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30"
          placeholder="(82) 99999-9999"
        />
      </div>

      <div>
        <label htmlFor="lead-mensagem" className="mb-1 block text-xs font-medium text-gray-600">
          Mensagem <span className="text-gray-400">(opcional)</span>
        </label>
        <textarea
          id="lead-mensagem"
          name="mensagem"
          rows={3}
          maxLength={1000}
          className="w-full resize-y rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30"
          placeholder="Quando pretende visitar? Tem alguma dúvida?"
        />
      </div>

      {/* Isca para robôs: um humano nunca preenche este campo. */}
      <input
        type="text"
        name="empresa"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={estado === "enviando"}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        {estado === "enviando" && (
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        )}
        {estado === "enviando" ? "Enviando…" : "Tenho interesse"}
      </button>
    </form>
  );
}
