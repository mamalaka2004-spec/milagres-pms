"use server";

import { revalidatePath } from "next/cache";
import { requirePageAuth } from "@/lib/auth";
import { updateImovelVenda, type ImovelVendaPatch } from "@/lib/db/queries/imoveis-venda";

export type SalvarResultado = { ok: true } | { ok: false; erro: string };

/**
 * Salva as edições de um imóvel do site de vendas.
 *
 * Revalida as páginas públicas afetadas para a mudança aparecer sem esperar
 * o cache expirar.
 */
export async function salvarImovel(
  id: string,
  patch: ImovelVendaPatch,
  slugAnterior: string | null,
): Promise<SalvarResultado> {
  await requirePageAuth();

  if (patch.preco !== undefined && (!Number.isFinite(patch.preco) || patch.preco < 0)) {
    return { ok: false, erro: "Preço inválido." };
  }
  if (patch.nome !== undefined && !patch.nome.trim()) {
    return { ok: false, erro: "O nome não pode ficar vazio." };
  }
  if (patch.slug !== undefined && patch.slug && !/^[a-z0-9-]+$/.test(patch.slug)) {
    return { ok: false, erro: "O endereço só aceita letras minúsculas, números e hífen." };
  }
  // A capa precisa estar entre as fotos escolhidas, senão a página abre vazia.
  if (patch.foto_capa && patch.fotos && !patch.fotos.includes(patch.foto_capa)) {
    return { ok: false, erro: "A foto de capa precisa estar entre as fotos selecionadas." };
  }

  try {
    const atualizado = await updateImovelVenda(id, patch);

    revalidatePath("/venda");
    revalidatePath("/vendas/imoveis");
    revalidatePath(`/vendas/imoveis/${id}`);
    if (atualizado.slug) revalidatePath(`/venda/${atualizado.slug}`);
    if (slugAnterior && slugAnterior !== atualizado.slug) revalidatePath(`/venda/${slugAnterior}`);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Não foi possível salvar.";
    // Índice único do slug — a mensagem crua do Postgres não ajuda o usuário.
    if (msg.includes("imoveis_milagres_slug_key")) {
      return { ok: false, erro: "Já existe outro imóvel com este endereço." };
    }
    return { ok: false, erro: msg };
  }
}
