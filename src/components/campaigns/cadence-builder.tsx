"use client";

import { useState } from "react";
import { MessageSquareText, Sparkles, Plus, Trash2, Clock, Eye, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { expandSpintax, substituteVars } from "@/lib/campaigns/template";

/** Dados de exemplo do preview — mesmas chaves que o worker injeta no envio. */
const SAMPLE_VARS = {
  nome: "Marina Costa",
  primeiro_nome: "Marina",
  telefone: "+55 82 99999-9999",
};

/** Passo em edição no compose (vira campaign_steps no PUT /steps). */
export interface CadenceStepDraft {
  kind: "template" | "ai";
  body: string;
  ai_prompt: string;
  wait_hours: number;
}

export const EMPTY_STEP: CadenceStepDraft = { kind: "template", body: "", ai_prompt: "", wait_hours: 48 };

const MAX_STEPS = 5;

/**
 * Cadência de mensagens: passo 0 sai no disparo; os seguintes só saem para
 * quem NÃO respondeu, após `wait_hours`. Resposta interrompe a sequência.
 */
export function CadenceBuilder({
  steps,
  onChange,
}: {
  steps: CadenceStepDraft[];
  onChange: (steps: CadenceStepDraft[]) => void;
}) {
  function patch(i: number, p: Partial<CadenceStepDraft>) {
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }
  function remove(i: number) {
    onChange(steps.filter((_, idx) => idx !== i));
  }
  function add() {
    if (steps.length >= MAX_STEPS) return;
    onChange([...steps, { ...EMPTY_STEP }]);
  }

  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/40 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">
              {i === 0 ? "Mensagem inicial" : `Follow-up ${i}`}
            </span>
            {i > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                <Clock size={11} /> esperar
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={s.wait_hours}
                  onChange={(e) => patch(i, { wait_hours: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-16 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                />
                horas sem resposta
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
                {(
                  [
                    { id: "template", label: "Template", icon: MessageSquareText },
                    { id: "ai", label: "IA", icon: Sparkles },
                  ] as const
                ).map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => patch(i, { kind: k.id })}
                    className={cn(
                      "flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium",
                      s.kind === k.id ? "bg-brand-500 text-white" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <k.icon size={11} /> {k.label}
                  </button>
                ))}
              </div>
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-lg p-1 text-gray-300 hover:text-red-500"
                  title="Remover passo"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {s.kind === "template" ? (
            <>
              <textarea
                value={s.body}
                onChange={(e) => patch(i, { body: e.target.value })}
                rows={3}
                placeholder={
                  i === 0
                    ? "{Olá|Oi} {{primeiro_nome}}! Temos uma novidade pra você…"
                    : "{Oi|Olá} {{primeiro_nome}}, conseguiu ver minha mensagem?"
                }
                className="w-full resize-y rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              />
              <p className="mt-1 text-[10px] text-gray-400">
                Variáveis: <code className="rounded bg-gray-100 px-1">{"{{nome}}"}</code>{" "}
                <code className="rounded bg-gray-100 px-1">{"{{primeiro_nome}}"}</code> · Variação (antiban):{" "}
                <code className="rounded bg-gray-100 px-1">{"{Olá|Oi|E aí}"}</code> sorteia uma opção por envio
              </p>
              <StepPreview body={s.body} />
            </>
          ) : (
            <>
              <textarea
                value={s.ai_prompt}
                onChange={(e) => patch(i, { ai_prompt: e.target.value })}
                rows={3}
                placeholder="Instrução para a IA. Ex.: Escreva um follow-up curto e pessoal para {{primeiro_nome}}, que não respondeu sobre imóveis em Milagres; traga um ângulo novo, sem pressão."
                className="w-full resize-y rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              />
              <p className="mt-1 text-[10px] text-gray-400">
                A IA (agente da linha) redige a mensagem com base nesta instrução + histórico da conversa.
              </p>
            </>
          )}
        </div>
      ))}

      {steps.length < MAX_STEPS && (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
        >
          <Plus size={13} /> Adicionar follow-up (se não responder)
        </button>
      )}
    </div>
  );
}

/**
 * Prévia do que o contato recebe: spintax sorteado + variáveis substituídas.
 * Como o spintax varia a cada envio, o botão regenera outra combinação.
 */
function StepPreview({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState(0);
  if (!body.trim()) return null;

  const rendered = substituteVars(expandSpintax(body), SAMPLE_VARS);
  void seed; // recomputa a cada clique em "outra variação"

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-brand-600"
      >
        <Eye size={11} /> {open ? "Ocultar prévia" : "Ver prévia"}
      </button>
      {open && (
        <div className="mt-1 rounded-lg bg-[#e7f7d8] px-3 py-2">
          <p className="whitespace-pre-wrap text-sm text-gray-800">{rendered}</p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[10px] text-gray-500">exemplo: {SAMPLE_VARS.nome}</span>
            {/[{][^{}]*\|[^{}]*[}]/.test(body) && (
              <button
                type="button"
                onClick={() => setSeed((s) => s + 1)}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-600 hover:text-brand-600"
              >
                <RefreshCw size={10} /> outra variação
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
