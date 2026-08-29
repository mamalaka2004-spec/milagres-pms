import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalBR } from "@/lib/whatsapp/phone";

/**
 * Recebe o formulário "Tenho interesse" das páginas públicas /venda/[slug].
 *
 * Grava como contato da categoria `lead` em whatsapp_contacts, marcado com
 * a origem `site-venda` e uma tag do imóvel — assim o lead entra no mesmo
 * funil que o time comercial já acompanha. Se o telefone já existir, anexa
 * o novo interesse às notas em vez de duplicar o contato.
 *
 * Rota pública (liberada no middleware); toda a escrita usa service role.
 */

export const dynamic = "force-dynamic";

type Corpo = {
  nome?: string;
  telefone?: string;
  mensagem?: string;
  imovel?: string;
  slug?: string;
  empresa?: string; // honeypot
};

function limpo(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  // Robô preencheu o campo escondido: responde 200 e descarta em silêncio,
  // para não ensinar ao bot como passar.
  if (limpo(corpo.empresa, 100)) {
    return NextResponse.json({ ok: true });
  }

  const nome = limpo(corpo.nome, 120);
  const telefone = limpo(corpo.telefone, 30);
  const mensagem = limpo(corpo.mensagem, 1000);
  const imovel = limpo(corpo.imovel, 120);
  const slug = limpo(corpo.slug, 120);

  if (nome.length < 2) {
    return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });
  }
  const canonical = canonicalBR(telefone);
  if (!canonical) {
    return NextResponse.json(
      { error: "Informe um WhatsApp válido com DDD." },
      { status: 400 },
    );
  }
  const phoneE164 = `+55${canonical}`;

  const db = createAdminClient();

  // company_id vem do imóvel anunciado; se ele não estiver ligado a uma
  // property, cai para a primeira empresa cadastrada.
  let companyId: string | null = null;
  if (slug) {
    const { data: im } = await db
      .from("imoveis_milagres")
      .select("property_id")
      .eq("slug", slug)
      .maybeSingle();
    const propertyId = (im as { property_id: string | null } | null)?.property_id;
    if (propertyId) {
      const { data: prop } = await db
        .from("properties")
        .select("company_id")
        .eq("id", propertyId)
        .maybeSingle();
      companyId = (prop as { company_id: string } | null)?.company_id ?? null;
    }
  }
  if (!companyId) {
    const { data: c } = await db.from("companies").select("id").limit(1).maybeSingle();
    companyId = (c as { id: string } | null)?.id ?? null;
  }
  if (!companyId) {
    return NextResponse.json({ error: "Não foi possível registrar agora." }, { status: 500 });
  }

  const agora = new Date().toISOString();
  const nota = [
    `[site /venda${slug ? `/${slug}` : ""} · ${new Date().toLocaleDateString("pt-BR")}]`,
    imovel ? `Interesse em ${imovel}.` : "Interesse em imóvel à venda.",
    mensagem,
  ]
    .filter(Boolean)
    .join(" ");

  const tag = slug ? `venda:${slug}` : "venda";

  try {
    const { data: existente } = await db
      .from("whatsapp_contacts")
      .select("id, notes, tags")
      .eq("company_id", companyId)
      .eq("phone_canonical", canonical)
      .maybeSingle();

    if (existente) {
      const atual = existente as { id: string; notes: string | null; tags: string[] | null };
      const tags = Array.from(new Set([...(atual.tags ?? []), tag, "site-venda"]));
      // Cast igual ao de contacts.ts: os tipos gerados resolvem o payload
      // de escrita de whatsapp_contacts para `never`.
      await (db.from("whatsapp_contacts") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update({
          notes: [atual.notes, nota].filter(Boolean).join("\n"),
          tags,
          updated_at: agora,
        })
        .eq("id", atual.id);
    } else {
      await (db.from("whatsapp_contacts") as any).insert({ // eslint-disable-line @typescript-eslint/no-explicit-any
        company_id: companyId,
        phone_e164: phoneE164,
        phone_canonical: canonical,
        display_name: nome,
        first_name: nome.split(/\s+/)[0],
        category: "lead",
        source: "site-venda",
        tags: [tag, "site-venda"],
        notes: nota,
        name_source: "manual",
        name_reviewed_at: agora,
      });
    }
  } catch (e) {
    console.error("[venda/lead] falha ao gravar", e);
    return NextResponse.json({ error: "Não foi possível registrar agora." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
