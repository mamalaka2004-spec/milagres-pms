"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ListPlus, Megaphone, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { FunnelTargetSelect } from "@/components/campaigns/funnel-target-select";

type Action = "list" | "campaign" | "prospect";

const META: Record<Action, { title: string; icon: typeof ListPlus; cta: string }> = {
  list: { title: "Nova lista com a seleção", icon: ListPlus, cta: "Criar lista" },
  campaign: { title: "Nova campanha com a seleção", icon: Megaphone, cta: "Criar e abrir compositor" },
  prospect: { title: "Enviar seleção para o funil", icon: Target, cta: "Adicionar ao funil" },
};

function defaultName(action: Action): string {
  const d = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return action === "campaign" ? `Campanha ${d}` : `Seleção ${d}`;
}

/** Transforma a seleção de contatos em Lista, Campanha (rascunho) ou Prospecção. */
export function SelectionActionDialog({
  action,
  contactIds,
  onClose,
  onDone,
}: {
  action: Action | null;
  contactIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [target, setTarget] = useState<{ pipelineId: string | null; stageId: string | null }>({
    pipelineId: null,
    stageId: null,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (action) setName(defaultName(action));
  }, [action]);

  if (!action) return null;
  const act: Action = action;
  const meta = META[act];
  const count = contactIds.length;

  async function submit() {
    if (busy || count === 0) return;
    setBusy(true);
    try {
      if (act === "prospect") {
        if (!target.pipelineId || !target.stageId) {
          toast({ title: "Escolha o funil e a etapa", variant: "error" });
          setBusy(false);
          return;
        }
        const res = await api<{ created: number }>(`/api/funnel/prospect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipeline_id: target.pipelineId,
            stage_id: target.stageId,
            contact_ids: contactIds,
          }),
        });
        toast({ title: "Prospecção criada", description: `${res.created} negócio(s) no funil`, variant: "success" });
        onDone();
        return;
      }

      const res = await api<{ list_id: string; campaign_id: string | null; member_count: number }>(
        `/api/contacts/to-campaign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contact_ids: contactIds,
            list_name: name.trim() || defaultName(act),
            create_campaign: act === "campaign",
          }),
        }
      );
      if (act === "campaign" && res.campaign_id) {
        toast({ title: "Campanha criada", description: `${res.member_count} contato(s) na lista`, variant: "success" });
        router.push(`/campaigns?edit=${res.campaign_id}`);
      } else {
        toast({ title: "Lista criada", description: `${res.member_count} contato(s)`, variant: "success" });
      }
      onDone();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <meta.icon size={16} className="text-brand-600" /> {meta.title}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <p className="text-xs text-gray-500">
            <b className="text-gray-800">{count}</b> contato(s) selecionado(s).
          </p>

          {act !== "prospect" ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                {act === "campaign" ? "Nome da campanha" : "Nome da lista"}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              />
              {act === "campaign" && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Cria a lista + uma campanha rascunho e abre o compositor para você escrever as
                  mensagens e ajustar o antiban.
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="mb-2 text-xs text-gray-500">
                Cria um negócio por contato na etapa escolhida.
              </p>
              <FunnelTargetSelect
                onChange={(v) => setTarget({ pipelineId: v.pipelineId, stageId: v.stageId })}
              />
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy || count === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />} {meta.cta}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
