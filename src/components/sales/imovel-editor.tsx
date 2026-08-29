"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowDown, ArrowUp, Check, Eye, EyeOff, ImageIcon, Loader2, Plus, Star, Trash2, X,
} from "lucide-react";
import { salvarImovel } from "@/app/(dashboard)/vendas/imoveis/[id]/actions";
import type { ImovelVenda } from "@/lib/db/queries/imoveis-venda";
import { cn } from "@/lib/utils/cn";

interface Props {
  imovel: ImovelVenda;
  /** Tudo que existe no bucket para este imóvel. */
  fotosDisponiveis: string[];
}

function nomeDoArquivo(url: string): string {
  return decodeURIComponent(url.split("/").pop() ?? url).slice(0, 28);
}

export function ImovelEditor({ imovel, fotosDisponiveis }: Props) {
  const [nome, setNome] = useState(imovel.nome);
  const [condominio, setCondominio] = useState(imovel.condominio ?? "");
  const [slug, setSlug] = useState(imovel.slug ?? "");
  const [preco, setPreco] = useState(String(imovel.preco));
  const [areaM2, setAreaM2] = useState(imovel.area_m2 ? String(imovel.area_m2) : "");
  const [suites, setSuites] = useState(imovel.suites ? String(imovel.suites) : "");
  const [hospedes, setHospedes] = useState(imovel.hospedes ? String(imovel.hospedes) : "");
  const [localizacao, setLocalizacao] = useState(imovel.localizacao ?? "");
  const [distancia, setDistancia] = useState(imovel.distancia_praia ?? "");
  const [tag, setTag] = useState(imovel.tag ?? "");
  const [descricao, setDescricao] = useState(imovel.descricao ?? "");
  const [beneficios, setBeneficios] = useState<string[]>(imovel.beneficios ?? []);
  const [videoUrl, setVideoUrl] = useState(imovel.video_url ?? "");
  const [airbnbUrl, setAirbnbUrl] = useState(imovel.airbnb_url ?? "");
  const [publicado, setPublicado] = useState(imovel.publicado);
  const [fotos, setFotos] = useState<string[]>(imovel.fotos ?? []);
  const [capa, setCapa] = useState<string | null>(imovel.foto_capa);

  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, startTransition] = useTransition();

  const naoSelecionadas = useMemo(
    () => fotosDisponiveis.filter((f) => !fotos.includes(f)),
    [fotosDisponiveis, fotos],
  );

  function adicionar(url: string) {
    setFotos((f) => [...f, url]);
    if (!capa) setCapa(url);
  }

  function remover(url: string) {
    setFotos((f) => {
      const resto = f.filter((x) => x !== url);
      if (capa === url) setCapa(resto[0] ?? null);
      return resto;
    });
  }

  function mover(i: number, delta: number) {
    setFotos((f) => {
      const j = i + delta;
      if (j < 0 || j >= f.length) return f;
      const copia = [...f];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  }

  function salvar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const r = await salvarImovel(
        imovel.id,
        {
          nome: nome.trim(),
          condominio: condominio.trim() || null,
          slug: slug.trim() || null,
          preco: Number(preco),
          area_m2: areaM2 ? Number(areaM2) : null,
          suites: suites ? Number(suites) : null,
          hospedes: hospedes ? Number(hospedes) : null,
          localizacao: localizacao.trim() || null,
          distancia_praia: distancia.trim() || null,
          tag: tag.trim() || null,
          descricao: descricao.trim() || null,
          beneficios: beneficios.map((b) => b.trim()).filter(Boolean),
          video_url: videoUrl.trim() || null,
          airbnb_url: airbnbUrl.trim() || null,
          fotos,
          foto_capa: capa,
          publicado,
        },
        imovel.slug,
      );
      if (r.ok) {
        setSalvo(true);
        setTimeout(() => setSalvo(false), 3000);
      } else {
        setErro(r.erro);
      }
    });
  }

  const campo =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30";
  const rotulo = "mb-1 block text-xs font-medium text-gray-600";

  return (
    <div className="space-y-5 pb-24">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">{imovel.nome}</h1>
          <p className="text-xs text-gray-500">
            {publicado && slug ? (
              <>
                No ar em{" "}
                <a
                  href={`/venda/${slug}`}
                  target="_blank"
                  rel="noopener"
                  className="text-brand-600 underline"
                >
                  /venda/{slug}
                </a>
              </>
            ) : (
              "Rascunho — não aparece no site"
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPublicado((p) => !p)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
            publicado
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "border border-gray-200 text-gray-700 hover:bg-gray-50",
          )}
        >
          {publicado ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
          {publicado ? "Publicado" : "Rascunho"}
        </button>
      </div>

      {/* Dados */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">
          Informações
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label className={rotulo} htmlFor="f-nome">Nome</label>
            <input id="f-nome" className={campo} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className={rotulo} htmlFor="f-cond">Condomínio</label>
            <input id="f-cond" className={campo} value={condominio} onChange={(e) => setCondominio(e.target.value)} />
          </div>
          <div>
            <label className={rotulo} htmlFor="f-slug">Endereço no site</label>
            <div className="flex items-center gap-1">
              <span className="shrink-0 font-mono text-xs text-gray-400">/venda/</span>
              <input
                id="f-slug"
                className={campo}
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              />
            </div>
          </div>
          <div>
            <label className={rotulo} htmlFor="f-preco">Preço (R$)</label>
            <input
              id="f-preco"
              className={`${campo} font-mono tabular-nums`}
              inputMode="numeric"
              value={preco}
              onChange={(e) => setPreco(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="f-tag">Etiqueta</label>
            <input
              id="f-tag"
              className={campo}
              value={tag}
              placeholder="Ex.: Único beira-mar"
              onChange={(e) => setTag(e.target.value)}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="f-area">Área (m²)</label>
            <input id="f-area" className={campo} inputMode="numeric" value={areaM2} onChange={(e) => setAreaM2(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className={rotulo} htmlFor="f-suites">Suítes</label>
            <input id="f-suites" className={campo} inputMode="numeric" value={suites} onChange={(e) => setSuites(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className={rotulo} htmlFor="f-hosp">Hóspedes</label>
            <input id="f-hosp" className={campo} inputMode="numeric" value={hospedes} onChange={(e) => setHospedes(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className={rotulo} htmlFor="f-loc">Localização</label>
            <input id="f-loc" className={campo} value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} />
          </div>
          <div>
            <label className={rotulo} htmlFor="f-dist">Distância da praia</label>
            <input id="f-dist" className={campo} value={distancia} onChange={(e) => setDistancia(e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={rotulo} htmlFor="f-desc">Descrição</label>
            <textarea
              id="f-desc"
              rows={3}
              className={`${campo} resize-y`}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O parágrafo de abertura da página do imóvel."
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="f-video">Vídeo (YouTube)</label>
            <input id="f-video" className={campo} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={rotulo} htmlFor="f-airbnb">Anúncio no Airbnb</label>
            <input id="f-airbnb" className={campo} value={airbnbUrl} onChange={(e) => setAirbnbUrl(e.target.value)} />
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Benefícios <span className="text-gray-300">({beneficios.length})</span>
          </h2>
          <button
            type="button"
            onClick={() => setBeneficios((b) => [...b, ""])}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            <Plus size={13} aria-hidden="true" />
            Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {beneficios.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={campo}
                value={b}
                aria-label={`Benefício ${i + 1}`}
                onChange={(e) =>
                  setBeneficios((lista) => lista.map((x, j) => (j === i ? e.target.value : x)))
                }
              />
              <button
                type="button"
                onClick={() => setBeneficios((lista) => lista.filter((_, j) => j !== i))}
                aria-label={`Remover benefício ${i + 1}`}
                className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          {beneficios.length === 0 && (
            <p className="text-xs text-gray-400">
              Nenhum benefício. Eles aparecem em lista na página do imóvel.
            </p>
          )}
        </div>
      </section>

      {/* Fotos escolhidas */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-400">
          Fotos no site <span className="text-gray-300">({fotos.length})</span>
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          A ordem aqui é a ordem da galeria. A estrela marca a foto de capa, que abre a
          página e vira a prévia ao compartilhar o link.
        </p>

        {fotos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">
            Nenhuma foto escolhida. Selecione abaixo.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {fotos.map((url, i) => (
              <div
                key={url}
                className={cn(
                  "group relative overflow-hidden rounded-lg border-2 bg-gray-100",
                  capa === url ? "border-brand-500" : "border-transparent",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Foto ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />

                {capa === url && (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <Star size={10} aria-hidden="true" /> Capa
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                      aria-label={`Mover foto ${i + 1} para trás`}
                      className="rounded bg-white/90 p-1 text-gray-700 disabled:opacity-30 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    >
                      <ArrowUp size={12} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={i === fotos.length - 1}
                      aria-label={`Mover foto ${i + 1} para frente`}
                      className="rounded bg-white/90 p-1 text-gray-700 disabled:opacity-30 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    >
                      <ArrowDown size={12} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => setCapa(url)}
                      aria-label={`Definir foto ${i + 1} como capa`}
                      className="rounded bg-white/90 p-1 text-gray-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    >
                      <Star size={12} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remover(url)}
                      aria-label={`Remover foto ${i + 1}`}
                      className="rounded bg-white/90 p-1 text-red-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bandeja do bucket */}
      {naoSelecionadas.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
            <ImageIcon size={13} aria-hidden="true" />
            Outras fotos do imóvel <span className="text-gray-300">({naoSelecionadas.length})</span>
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Todas as fotos deste imóvel no acervo. Clique para incluir no site.
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {naoSelecionadas.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => adicionar(url)}
                title={nomeDoArquivo(url)}
                className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-100 transition-all hover:border-brand-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover opacity-70 transition-opacity group-hover:opacity-100" />
                <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-full bg-brand-600 p-1.5 text-white">
                    <Plus size={14} aria-hidden="true" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Barra de salvar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs">
            {erro ? (
              <span className="text-red-600">{erro}</span>
            ) : salvo ? (
              <span className="inline-flex items-center gap-1 text-brand-600">
                <Check size={13} aria-hidden="true" /> Salvo — o site já mostra a nova versão.
              </span>
            ) : (
              <span className="text-gray-400">
                {fotos.length} fotos · {beneficios.length} benefícios
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={salvar}
            disabled={pendente}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
          >
            {pendente && (
              <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            {pendente ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
