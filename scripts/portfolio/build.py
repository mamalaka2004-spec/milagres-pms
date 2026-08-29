#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera as apresentações de vendas da Milagres Hospedagens.

Saídas (em public/portfolio/):
  portfolio-milagres.html   deck geral, os 6 imóveis
  <slug>.html               um deck por imóvel

Dois modos de imagem:
  --mode web      (padrão) aponta para o bucket público property-images.
                  HTML leve, bom para o repositório e para servir online.
  --mode inline   embute as fotos em base64. Arquivo autocontido —
                  é o que usamos para gerar o PDF e para publicar no Claude.

Fonte dos dados: docs/base-conhecimento/imoveis-venda-milagres.md
Fonte das fotos: bucket property-images (as mesmas do anúncio no Airbnb).

Uso:
    python3 scripts/portfolio/build.py                 # HTMLs web
    python3 scripts/portfolio/build.py --mode inline --out /tmp/x
    python3 scripts/portfolio/build.py --pdf           # HTMLs web + PDFs
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CSS_PATH = os.path.join(HERE, "deck.css")
FOTOS_DIR = os.path.join(HERE, "fotos")          # cache local das fotos
OUT_DEFAULT = os.path.join(ROOT, "public", "portfolio")

SUPABASE = "https://xmmuenaaodlqubfotwzr.supabase.co"
BUCKET = f"{SUPABASE}/storage/v1/object/public/property-images/properties"

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
LIMITE_ESPERA_PDF = 90        # segundos por PDF

DATA_ATUALIZACAO = "24/07/2026"

LEAF = ('<svg viewBox="0 0 24 24" aria-hidden="true">'
        '<path class="mark-leaf" d="M12 2.2c4.6 3.4 6.7 7.2 6.7 10.8 0 3.7-3 6.9-6.7 8.8'
        '-3.7-1.9-6.7-5.1-6.7-8.8C5.3 9.4 7.4 5.6 12 2.2z"/>'
        '<path class="mark-vein" d="M12 5.6v13.4"/></svg>')

# ───────────────────────────────────────────────────────────────────
# Dados
# ───────────────────────────────────────────────────────────────────
IMOVEIS = [
    {
        "slug": "tamona07", "nome": "Tamoná 07", "cond": "Villa Tamoná",
        "onde": "São Miguel dos Milagres · 100 m da praia",
        "area": "57 m²", "suites": 2, "hospedes": 6, "preco": 720000,
        "hero": "airbnb-00", "tag": "Menor ticket do portfólio",
        "alt": "Piscina privativa do Tamoná 07 ao lado da sala envidraçada",
        "desc": "Dois dormitórios em suíte, sala e cozinha integradas e piscina privativa, "
                "a cem metros da praia. O caminho mais curto para entrar na Rota Ecológica.",
        "benefits": [
            "Piscina privativa em 57 m² bem resolvidos",
            "Porteira fechada: móveis planejados, decoração e enxoval",
            "Cozinha equipada, churrasqueira e internet de alta velocidade",
            "Ticket de entrada — libera capital para um segundo imóvel",
        ],
        "video": "https://youtu.be/fM0CkgSLDSw",
        "airbnb": "https://www.airbnb.com/rooms/1107152754410327331",
    },
    {
        "slug": "villagreen", "nome": "Villa Green", "cond": "Essence · unidade B001",
        "onde": "Praia de Tatuamunha, Porto de Pedras · beira-mar",
        "area": "70 m²", "suites": 2, "hospedes": 6, "preco": 850000,
        "hero": "airbnb-02", "tag": "Único beira-mar",
        "alt": "Piscina do Essence com deck de madeira, coqueiros e o mar ao fundo",
        "desc": "O único beira-mar do portfólio, e também o único térreo: 70 m² com varanda "
                "gourmet, assinados por arquitetos de nome e entregues decorados.",
        "benefits": [
            "Beira-mar em Tatuamunha, na Rota Ecológica",
            "Térreo — acessibilidade total, sem escadas",
            "Varanda gourmet integrada à sala e à cozinha",
            "Projeto e decoração de arquitetos renomados",
        ],
        "video": "https://youtu.be/UNBHUlm_5mo",
        "airbnb": "https://www.airbnb.com/rooms/1021250066188459698",
    },
    {
        "slug": "tamona18", "nome": "Tamoná 18", "cond": "Villa Tamoná",
        "onde": "São Miguel dos Milagres · 100 m da praia",
        "area": "83 m²", "suites": 2, "hospedes": 6, "preco": 890000,
        "hero": "airbnb-00", "tag": "Rooftop privativo",
        "alt": "Piscina privativa no rooftop do Tamoná 18, com coqueiral e céu aberto",
        "desc": "83 m² com duas suítes e um rooftop exclusivo — piscina privativa, banheiro "
                "e vista aberta para os coqueirais. O andar de cima é só seu.",
        "benefits": [
            "Rooftop exclusivo com piscina privativa e banheiro",
            "Vista aberta para os coqueirais",
            "Churrasqueira e área de convivência no terraço",
            "Porteira fechada, pronto para morar ou locar",
        ],
        "video": "https://youtu.be/2z_6sJ1qNRo",
        "airbnb": "https://www.airbnb.com/rooms/1147040384147329715",
    },
    {
        "slug": "cotinguiba08", "nome": "Cotinguiba 08", "curto": "Cotinguiba",
        "cond": "Villa Cotinguiba",
        "onde": "Porto de Pedras · 200 m da Praia de Tatuamunha",
        "area": "103 m²", "suites": 2, "hospedes": 6, "preco": 890000,
        "hero": "airbnb-00", "tag": "Melhor m² por real",
        "alt": "Piscina privativa do Cotinguiba 08 com deck de madeira e fecho de bambu",
        "desc": "103 m² pelo mesmo preço do Tamoná 18 — a maior área entre os imóveis de duas "
                "suítes, com hall, sala de TV, sala de jantar, lavabo e depósito.",
        "benefits": [
            "Maior área entre os de 2 suítes: 103 m²",
            "Ambientes separados — hall, sala de TV e sala de jantar",
            "Piscina privativa, lavabo e depósito",
            "200 m da Praia de Tatuamunha",
        ],
        "video": "https://youtu.be/-O6pCbzXKgM",
        "airbnb": "https://www.airbnb.com/rooms/1013319415577854212",
    },
    {
        "slug": "duplex116", "nome": "Duplex 116", "cond": "Villa Kanui",
        "onde": "São Miguel dos Milagres · 200 m da Praia do Riacho",
        "area": "155 m²", "suites": 3, "hospedes": 10, "preco": 1250000,
        "hero": "airbnb-00", "tag": "Maior capacidade",
        "alt": "Piscina privativa do Duplex 116 integrada à área gourmet e à sala envidraçada",
        "desc": "155 m² em dois pavimentos, três suítes e quatro banheiros. Acomoda dez "
                "hóspedes — a maior diária do portfólio, com área gourmet e piscina privativa.",
        "benefits": [
            "Até 10 hóspedes — a melhor relação diária/receita",
            "155 m² em duplex, 3 suítes e 4 banheiros",
            "Área gourmet com piscina privativa e churrasqueira",
            "200 m da Praia do Riacho",
        ],
        "video": "https://youtu.be/zoW2sOMuuac",
        "airbnb": "https://www.airbnb.com/rooms/891364268727118660",
    },
    {
        "slug": "marbella", "nome": "Cobertura Mar Bella", "curto": "Mar Bella",
        "cond": "Villa Kanui · unidade 201",
        "onde": "São Miguel dos Milagres",
        "area": "Cobertura", "suites": 3, "hospedes": 10, "preco": 2200000,
        "hero": "airbnb-05", "tag": "Produto premium",
        "alt": "Varanda gourmet da Cobertura Mar Bella com mesa posta para oito, "
               "piscina, rede e coqueiral ao fundo",
        "desc": "A cobertura do portfólio: três suítes, área gourmet com piscina de borda "
                "infinita e uma vista contínua sobre o coqueiral. Anunciada como "
                "“Cobertura Vista Coqueiros”.",
        "benefits": [
            "Piscina privativa suspensa sobre o coqueiral",
            "3 suítes e área gourmet completa, até 10 hóspedes",
            "Vista panorâmica ininterrupta — o diferencial que não se constrói",
            "Produto de topo, para o comprador de maior ticket",
        ],
        "video": "https://youtu.be/YoxkOJ4T2Aw",
        "airbnb": "https://www.airbnb.com.br/rooms/885070988722208207",
    },
]

# foto de capa do deck geral: o coqueiral que dá nome à Rota Ecológica
CAPA = ("marbella", "airbnb-07")


# ───────────────────────────────────────────────────────────────────
# Fotos
# ───────────────────────────────────────────────────────────────────
def carregar_manifesto() -> dict:
    with open(os.path.join(HERE, "fotos.json"), encoding="utf-8") as f:
        return json.load(f)


MANIFESTO = carregar_manifesto()


def arquivo_de(slug: str, prefixo: str) -> str:
    """Resolve 'airbnb-05' para o nome completo do arquivo daquele imóvel."""
    for nome in MANIFESTO[slug]["files"]:
        if nome.startswith(prefixo + "-"):
            return nome
    raise KeyError(f"{slug}: nenhuma foto começa com {prefixo!r}")


def baixar_se_faltar(slug: str, nome: str) -> str:
    """Caminho local da foto, baixando do bucket público se o cache não a tiver.

    O cache (scripts/portfolio/fotos/) é gitignorado — as fotos vivem no
    bucket. O modo inline precisa dos bytes, então buscamos sob demanda.
    Aceita também a variante .jpg de um original .png (o cache é recomprimido).
    """
    destino = os.path.join(FOTOS_DIR, slug, nome)
    if os.path.exists(destino):
        return destino
    alt = os.path.splitext(destino)[0] + ".jpg"
    if os.path.exists(alt):
        return alt

    url = f"{BUCKET}/{MANIFESTO[slug]['property_id']}/{nome}"
    print(f"    baixando {slug}/{nome}", file=sys.stderr)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as r, open(destino, "wb") as f:
        f.write(r.read())
    return destino


class Fotos:
    """Resolve uma foto para src de <img>, conforme o modo."""

    def __init__(self, modo: str):
        self.modo = modo
        self._cache: dict[tuple[str, str], str] = {}

    def src(self, slug: str, prefixo: str) -> str:
        chave = (slug, prefixo)
        if chave in self._cache:
            return self._cache[chave]
        nome = arquivo_de(slug, prefixo)
        if self.modo == "web":
            pid = MANIFESTO[slug]["property_id"]
            out = f"{BUCKET}/{pid}/{nome}"
        else:
            caminho = baixar_se_faltar(slug, nome)
            with open(caminho, "rb") as f:
                mime = "png" if caminho.endswith(".png") else "jpeg"
                out = f"data:image/{mime};base64," + base64.b64encode(f.read()).decode()
        self._cache[chave] = out
        return out

    def prefixos(self, slug: str) -> list[str]:
        return ["-".join(n.split("-")[:2]) for n in MANIFESTO[slug]["files"]]


# ───────────────────────────────────────────────────────────────────
# Helpers de texto
# ───────────────────────────────────────────────────────────────────
def money(v: int) -> str:
    return "R$ " + f"{v:,.0f}".replace(",", ".")


def money_curto(v: int) -> str:
    return (f"{v/1000000:.2f}".replace(".", ",") + " mi") if v >= 1000000 else f"{v//1000} mil"


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def marca(claro: bool = False) -> str:
    cls = "mark mark--light" if claro else "mark"
    return (f'<div class="{cls}"><span class="mark-badge">{LEAF}</span>'
            f'<span class="mark-name"><b>Milagres</b><span>Hospedagens</span></span></div>')


def cabecalho(rotulo: str) -> str:
    return f'<div class="head">{marca()}<span class="head-num">{esc(rotulo)}</span></div>'


def specs(im: dict, cls: str = "") -> str:
    return (f'<div class="unit-specs {cls}">'
            f'<div class="spec"><b>{im["area"]}</b><span>Área</span></div>'
            f'<div class="spec"><b>{im["suites"]}</b><span>Suítes</span></div>'
            f'<div class="spec"><b>{im["hospedes"]}</b><span>Hóspedes</span></div>'
            f'</div>')


# ───────────────────────────────────────────────────────────────────
# Slides reutilizáveis
# ───────────────────────────────────────────────────────────────────
def slide_regiao(idx: int) -> str:
    return f'''
  <div class="slide-wrap" id="s{idx}">
    <section class="slide" aria-label="A região">
      {cabecalho("A REGIÃO")}
      <div class="region">
        <div class="region-top">
          <h2 class="display region-title">Onde o metro quadrado ainda é <em>escasso</em></h2>
          <p class="lede">A Rota Ecológica dos Milagres tem orla preservada, piscinas naturais
            e poucos grandes empreendimentos — é essa escassez que sustenta a exclusividade e a
            valorização. Fica a ~100 km de Maceió, 1h30 do aeroporto.</p>
        </div>
        <div class="pillars">
          <div class="pillar"><span class="k">Demanda</span>
            <h3>Capela dos Milagres</h3>
            <p>Palco dos casamentos de famosos mais desejados do Brasil. Referência nacional
               que puxa mídia e demanda para a região o ano inteiro.</p></div>
          <div class="pillar"><span class="k">Sazonalidade</span>
            <h3>Réveillon disputado</h3>
            <p>Um dos eventos de virada mais concorridos do país. Datas e hospedagens esgotam
               cedo e sustentam a diária no pico.</p></div>
          <div class="pillar"><span class="k">Ocupação</span>
            <h3>Clima o ano todo</h3>
            <p>Temporada longa e menos sazonalidade que o litoral sul. Mais noites vendidas
               por ano, receita melhor distribuída.</p></div>
          <div class="pillar"><span class="k">Prova</span>
            <h3>Operação já ativa</h3>
            <p>Todos os imóveis já operam no Airbnb hoje. O investidor compra histórico real
               de locação, não projeção.</p></div>
        </div>
      </div>
    </section>
  </div>'''


def slide_unidade(im: dict, fotos: Fotos, idx: int, flip: bool) -> str:
    bens = "\n            ".join(f"<li>{esc(b)}</li>" for b in im["benefits"])
    cls = " unit--flip" if flip else ""
    return f'''
  <div class="slide-wrap" id="s{idx}">
    <section class="slide" aria-label="{esc(im["nome"])}">
      <div class="unit{cls}">
        <div class="unit-photo">
          <img src="{fotos.src(im["slug"], im["hero"])}" alt="{esc(im["alt"])}">
          <span class="photo-tag"><i></i>{esc(im["tag"])}</span>
        </div>
        <div class="unit-body">
          <span class="eyebrow unit-cond">{esc(im["cond"])}</span>
          <h2 class="display unit-name">{esc(im["nome"])}</h2>
          <p class="unit-where">{esc(im["onde"])}</p>
          {specs(im)}
          <p class="unit-desc">{im["desc"]}</p>
          <ul class="benefits">
            {bens}
          </ul>
          <div class="unit-foot">
            <span class="price unit-price"><small>Valor de venda</small>{money(im["preco"])}</span>
            <span class="links">
              <a href="{im["video"]}" target="_blank" rel="noopener">Ver o vídeo do imóvel</a>
              <a href="{im["airbnb"]}" target="_blank" rel="noopener">Ver anúncio no Airbnb</a>
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>'''


# ───────────────────────────────────────────────────────────────────
# Deck geral
# ───────────────────────────────────────────────────────────────────
def deck_geral(fotos: Fotos) -> tuple[str, list[str]]:
    total_vgv = sum(i["preco"] for i in IMOVEIS)
    rampa = ["#B4C0A6", "#A3B195", "#93A284", "#829373", "#6B7F5E", "#4A5A40"]

    cards = []
    for im in IMOVEIS:
        cards.append(f'''<article class="card">
            <img class="card-img" src="{fotos.src(im["slug"], im["hero"])}" alt="{esc(im["alt"])}">
            <div class="card-body">
              <span class="card-cond">{esc(im["cond"].split(" · ")[0])}</span>
              <h3 class="card-name">{esc(im.get("curto", im["nome"]))}</h3>
              <span class="card-specs">{im["area"]} · {im["suites"]} suítes<br>{im["hospedes"]} hóspedes</span>
              <span class="price card-price">{money(im["preco"])}</span>
            </div>
          </article>''')

    segs = []
    for i, im in enumerate(IMOVEIS):
        pct = im["preco"] / total_vgv * 100
        segs.append(
            f'<div class="vgv-seg" style="flex:0 0 {pct:.2f}%">'
            f'<span class="vgv-bar" style="background:{rampa[i]}"></span>'
            f'<b>{esc(im.get("curto", im["nome"]))}</b>'
            f'<span>R$ {money_curto(im["preco"])} · {pct:.0f}%</span></div>')

    entrada = min(i["preco"] for i in IMOVEIS)
    topo = max(i["preco"] for i in IMOVEIS)

    partes = [f'''
  <div class="slide-wrap" id="s0">
    <section class="slide cover" aria-label="Capa">
      <img class="cover-img" src="{fotos.src(*CAPA)}"
           alt="Coqueiral da Rota Ecológica dos Milagres com o mar ao fundo">
      <div class="cover-veil"></div>
      <div class="cover-inner">
        {marca(claro=True)}
        <div>
          <h1 class="display cover-title">Seis imóveis na <em>Rota Ecológica</em></h1>
          <p class="cover-sub">Prontos, mobiliados e com operação de locação por temporada já
            rodando. São Miguel dos Milagres e Porto de Pedras, litoral norte de Alagoas.</p>
        </div>
        <div class="cover-foot">
          <div class="cover-stats">
            <div class="cover-stat"><b>{len(IMOVEIS)}</b><span>Imóveis</span></div>
            <div class="cover-stat"><b>R$ {money_curto(entrada)}</b><span>Entrada</span></div>
            <div class="cover-stat"><b>R$ {money_curto(topo)}</b><span>Topo</span></div>
            <div class="cover-stat"><b>R$ {money_curto(total_vgv)}</b><span>VGV total</span></div>
          </div>
          <div class="cover-stat" style="text-align:right">
            <b style="font-size:1.5cqi">2026</b><span>Portfólio de vendas</span></div>
        </div>
      </div>
    </section>
  </div>''', slide_regiao(1), f'''
  <div class="slide-wrap" id="s2">
    <section class="slide" aria-label="O portfólio">
      {cabecalho(f"PORTFÓLIO · {len(IMOVEIS)} IMÓVEIS")}
      <div class="folio">
        <h2 class="display folio-title">O portfólio completo</h2>
        <p class="folio-lede">Todos entregues em porteira fechada — mobiliados, decorados e com
          enxoval — e com anúncio ativo no Airbnb. Ordenados por valor, do menor ticket ao
          produto premium.</p>
        <div class="grid6">
          {"".join(cards)}
        </div>
        <div class="ladder">
          <div class="ladder-head">
            <span>COMPOSIÇÃO DO VGV</span>
            <span>total <b>{money(total_vgv)}</b> · ticket médio <b>{money(round(total_vgv/len(IMOVEIS)))}</b></span>
          </div>
          <div class="vgv">{"".join(segs)}</div>
        </div>
      </div>
    </section>
  </div>''']

    for i, im in enumerate(IMOVEIS):
        partes.append(slide_unidade(im, fotos, i + 3, flip=bool(i % 2)))

    partes.append(f'''
  <div class="slide-wrap" id="s{len(IMOVEIS) + 3}">
    <section class="slide close" aria-label="Próximos passos">
      <div class="close-inner">
        {marca(claro=True)}
        <h2 class="display close-title">Renda desde o primeiro mês, em uma praia que
          <em>não se repete</em></h2>
        <div class="close-cols">
          <div class="close-col"><h4>O que o comprador leva</h4>
            <p>Imóvel pronto: móveis planejados, decoração completa e enxoval de cama, mesa e banho.</p>
            <p>Anúncio ativo no Airbnb, com histórico de reservas já formado.</p></div>
          <div class="close-col"><h4>Três perfis atendidos</h4>
            <p>Uso próprio na alta temporada, segunda residência para a família e investimento
               em short stay — normalmente os três ao mesmo tempo.</p></div>
          <div class="close-col"><h4>Próximo passo</h4>
            <p>Escolhido o imóvel, enviamos o vídeo completo, o link do anúncio e o histórico
               de ocupação.</p>
            <p>Condições de pagamento e fechamento são tratados direto com o time comercial.</p></div>
        </div>
      </div>
    </section>
  </div>''')

    rotulos = (["capa", "a região", "o portfólio"]
               + [i["nome"] for i in IMOVEIS] + ["próximos passos"])
    return "".join(partes), rotulos


# ───────────────────────────────────────────────────────────────────
# Deck de um imóvel
# ───────────────────────────────────────────────────────────────────
def deck_unidade(im: dict, fotos: Fotos) -> tuple[str, list[str]]:
    slug = im["slug"]
    # 5 fotos fecham a grade 4x2 com o destaque ocupando 2x2
    galeria = [p for p in fotos.prefixos(slug) if p != im["hero"]][:5]

    figs = "".join(
        f'<figure><img src="{fotos.src(slug, p)}" '
        f'alt="Ambiente do {esc(im["nome"])}"></figure>' for p in galeria)

    partes = [f'''
  <div class="slide-wrap" id="s0">
    <section class="slide cover" aria-label="Capa">
      <img class="uc-img" src="{fotos.src(slug, im["hero"])}" alt="{esc(im["alt"])}">
      <div class="uc-veil"></div>
      <div class="uc-inner">
        {marca(claro=True)}
        <div>
          <span class="uc-cond">{esc(im["cond"])}</span>
          <h1 class="display uc-name">{esc(im["nome"])}</h1>
          <p class="uc-where">{esc(im["onde"])}</p>
        </div>
        <div class="uc-foot">
          {specs(im, "uc-specs").replace("unit-specs uc-specs", "uc-specs")}
          <span class="uc-price"><small>Valor de venda</small>{money(im["preco"])}</span>
        </div>
      </div>
    </section>
  </div>''', slide_unidade(im, fotos, 1, flip=False), f'''
  <div class="slide-wrap" id="s2">
    <section class="slide" aria-label="Galeria">
      {cabecalho("GALERIA")}
      <div class="gal">
        <h2 class="display gal-title">Por dentro</h2>
        <p class="gal-lede">As mesmas fotos do anúncio ativo no Airbnb — o imóvel exatamente
          como ele é entregue, mobiliado e decorado.</p>
        <div class="gal-grid">{figs}</div>
      </div>
    </section>
  </div>''', slide_regiao(3), f'''
  <div class="slide-wrap" id="s4">
    <section class="slide close" aria-label="Próximos passos">
      <div class="close-inner">
        {marca(claro=True)}
        <h2 class="display close-title">Pronto para render desde o <em>primeiro mês</em></h2>
        <div class="close-cols">
          <div class="close-col"><h4>O que você leva</h4>
            <p>Porteira fechada: móveis planejados, decoração completa e enxoval de cama,
               mesa e banho.</p>
            <p>Anúncio ativo no Airbnb, com histórico de reservas já formado.</p></div>
          <div class="close-col"><h4>Por que este</h4>
            <p>{esc(im["benefits"][0])}.</p>
            <p>{esc(im["benefits"][1])}.</p></div>
          <div class="close-col"><h4>Próximo passo</h4>
            <p>Enviamos o vídeo completo e o histórico de ocupação do imóvel.</p>
            <p>Condições de pagamento e fechamento são tratados direto com o time comercial.</p></div>
        </div>
        <div class="uclose-cta">
          <span class="uclose-price"><small>{esc(im["nome"])} · valor de venda</small>{money(im["preco"])}</span>
          <span class="uclose-links">
            <a href="{im["video"]}" target="_blank" rel="noopener">Ver o vídeo do imóvel</a>
            <a href="{im["airbnb"]}" target="_blank" rel="noopener">Ver anúncio no Airbnb</a>
          </span>
        </div>
      </div>
    </section>
  </div>''']

    return "".join(partes), ["capa", "a ficha", "galeria", "a região", "próximos passos"]


# ───────────────────────────────────────────────────────────────────
# Montagem da página
# ───────────────────────────────────────────────────────────────────
SCRIPT = """
(function(){
  var deck = document.getElementById('deck');
  var slides = Array.prototype.slice.call(deck.querySelectorAll('.slide-wrap'));
  var nav = document.getElementById('nav');
  var counter = document.getElementById('counter');
  var current = 0;
  var labels = __LABELS__;

  slides.forEach(function(s, i){
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Ir para ' + (labels[i] || ('slide ' + (i+1))));
    b.addEventListener('click', function(){ go(i); });
    nav.appendChild(b);
  });
  var dots = Array.prototype.slice.call(nav.children);
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function setCurrent(i){
    if (i === current) return;
    current = i;
    dots.forEach(function(d, k){ d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    counter.textContent = pad(i + 1) + ' / ' + pad(slides.length);
  }
  function go(i){
    i = Math.max(0, Math.min(slides.length - 1, i));
    slides[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if (e.isIntersecting) setCurrent(slides.indexOf(e.target)); });
    }, { root: deck, threshold: 0.6 });
    slides.forEach(function(s){ io.observe(s); });
  }
  document.addEventListener('keydown', function(e){
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' '){
      e.preventDefault(); go(current + 1);
    } else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp'){
      e.preventDefault(); go(current - 1);
    } else if (k === 'Home'){ e.preventDefault(); go(0); }
    else if (k === 'End'){ e.preventDefault(); go(slides.length - 1); }
  });
  var btn = document.getElementById('btnPrint');
  if (btn) btn.addEventListener('click', function(){ window.print(); });
  dots[0].setAttribute('aria-current', 'true');
  counter.textContent = '01 / ' + pad(slides.length);
})();
"""


def pagina(titulo: str, corpo: str, rotulos: list[str], css: str,
           pdf_href: str | None, standalone: bool) -> str:
    """standalone=True gera documento completo (para servir e imprimir).
    standalone=False gera fragmento (para publicar como Artifact)."""
    baixar = (f'<a class="hud-dl" href="{pdf_href}" download>Baixar PDF</a>'
              if pdf_href else '<button type="button" id="btnPrint">Salvar PDF</button>')

    miolo = f'''<title>{esc(titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&family=JetBrains+Mono:wght@300;400;500&display=swap">
<style>
{css}
.hud-dl{{
  font-family:var(--font-body); font-size:11px; font-weight:500;
  letter-spacing:.1em; text-transform:uppercase; text-decoration:none;
  background:var(--cream); color:var(--olive-600);
  border:1px solid var(--sand-200); border-radius:2px;
  padding:5px 11px; transition:background .18s ease, color .18s ease;
}}
.hud-dl:hover{{ background:var(--olive-600); color:var(--cream); border-color:var(--olive-600); }}
.hud-dl:focus-visible{{ outline:2px solid var(--olive-600); outline-offset:2px; }}
</style>

<div class="deck" id="deck">{corpo}
</div>

<nav class="nav" id="nav" aria-label="Navegar pelos slides"></nav>

<div class="hud">
  <span id="counter">01 / {len(rotulos):02d}</span>
  <span class="sep"></span>
  <span><kbd>&larr;</kbd> <kbd>&rarr;</kbd> navegar</span>
  <span class="sep"></span>
  {baixar}
</div>

<script>{SCRIPT.replace("__LABELS__", json.dumps(rotulos, ensure_ascii=False))}</script>'''

    if not standalone:
        return miolo
    return ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            '<meta name="robots" content="noindex, nofollow">\n'
            '<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}</style>\n'
            + miolo + '\n</head>\n<body>\n</body>\n</html>')


def escrever(caminho: str, texto: str) -> None:
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(texto)
    print(f"  {os.path.relpath(caminho, ROOT):52} {os.path.getsize(caminho)/1024:8.0f} KB")


TS_HEADER = '''/**
 * Portfólio de vendas — índice das apresentações.
 *
 * ARQUIVO GERADO. Não edite à mão: saída de `scripts/portfolio/build.py`,
 * que também produz os HTMLs e PDFs em `public/portfolio/`.
 * Para mudar preços ou incluir um imóvel, edite o script e rode:
 *     python3 scripts/portfolio/build.py --pdf
 */

const BUCKET =
  "%s";

export type PortfolioDeck = {
  slug: string;
  nome: string;
  condominio: string;
  area: string;
  suites: number;
  hospedes: number;
  preco: number;
  /** Mesma foto de capa usada no deck do imóvel. */
  capa: string;
  alt: string;
};

export const PORTFOLIO_GERAL = {
  slug: "portfolio-milagres",
  titulo: "Seis imóveis na Rota Ecológica",
  resumo:
    "%d slides: a região, o portfólio completo com a composição do VGV e uma ficha por imóvel.",
};

export const PORTFOLIO_DECKS: PortfolioDeck[] = [
'''

TS_FOOTER = '''];

export function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
'''


def gerar_indice_ts(caminho: str) -> None:
    """Emite src/lib/portfolio.ts — o índice que a página do dashboard lê."""
    linhas = [TS_HEADER % (BUCKET, len(IMOVEIS) + 4)]
    for im in IMOVEIS:
        pid = MANIFESTO[im["slug"]]["property_id"]
        nome_arq = arquivo_de(im["slug"], im["hero"])
        alt = " ".join(im["alt"].split())
        linhas.append(
            "  {\n"
            f'    slug: "{im["slug"]}",\n'
            f'    nome: "{im["nome"]}",\n'
            f'    condominio: "{im["cond"]}",\n'
            f'    area: "{im["area"]}",\n'
            f'    suites: {im["suites"]},\n'
            f'    hospedes: {im["hospedes"]},\n'
            f'    preco: {im["preco"]},\n'
            f'    capa: `${{BUCKET}}/{pid}/{nome_arq}`,\n'
            f'    alt: "{alt}",\n'
            "  },\n"
        )
    linhas.append(TS_FOOTER)
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, "w", encoding="utf-8") as f:
        f.write("".join(linhas))
    print(f"  {os.path.relpath(caminho, ROOT):52} {os.path.getsize(caminho)/1024:8.0f} KB")


def gerar_pdf(html_path: str, pdf_path: str) -> None:
    if not os.path.exists(CHROME):
        print(f"  ! Chrome não encontrado em {CHROME} — PDF pulado", file=sys.stderr)
        return
    os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
    if os.path.exists(pdf_path):
        os.remove(pdf_path)

    # O Chrome grava o PDF e às vezes não encerra sozinho. Em vez de esperar
    # o processo sair, esperamos o arquivo aparecer e parar de crescer —
    # aí encerramos nós mesmos.
    with tempfile.TemporaryDirectory() as perfil:
        proc = subprocess.Popen([
            CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
            f"--user-data-dir={perfil}", "--no-pdf-header-footer",
            "--virtual-time-budget=15000",
            f"--print-to-pdf={pdf_path}", f"file://{html_path}",
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            anterior, estavel = -1, 0
            for _ in range(LIMITE_ESPERA_PDF * 2):          # passos de 0,5 s
                if proc.poll() is not None:
                    break
                atual = os.path.getsize(pdf_path) if os.path.exists(pdf_path) else -1
                estavel = estavel + 1 if atual == anterior >= 0 else 0
                if estavel >= 4:                            # 2 s sem crescer
                    break
                anterior = atual
                time.sleep(0.5)
        finally:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    proc.kill()

    if not os.path.exists(pdf_path) or os.path.getsize(pdf_path) < 1024:
        print(f"  ! falhou: {os.path.basename(pdf_path)}", file=sys.stderr)
        return
    with open(pdf_path, "rb") as f:
        if f.read(5) != b"%PDF-":
            print(f"  ! saída inválida: {os.path.basename(pdf_path)}", file=sys.stderr)
            return
    print(f"  {os.path.relpath(pdf_path, ROOT):52} {os.path.getsize(pdf_path)/1024:8.0f} KB")


# ───────────────────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mode", choices=["web", "inline"], default="web")
    ap.add_argument("--out", default=OUT_DEFAULT)
    ap.add_argument("--pdf", action="store_true", help="gera também os PDFs")
    ap.add_argument("--fragment", action="store_true",
                    help="emite fragmento sem <html>/<head> (para Artifact)")
    args = ap.parse_args()

    with open(CSS_PATH, encoding="utf-8") as f:
        css = f.read()

    fotos = Fotos(args.mode)
    standalone = not args.fragment
    os.makedirs(args.out, exist_ok=True)

    print(f"Gerando ({args.mode}) em {os.path.relpath(args.out, ROOT)}/")

    corpo, rotulos = deck_geral(fotos)
    escrever(os.path.join(args.out, "portfolio-milagres.html"),
             pagina("Portfólio Milagres Hospedagens", corpo, rotulos, css,
                    "pdf/portfolio-milagres.pdf" if standalone else None, standalone))

    for im in IMOVEIS:
        corpo, rotulos = deck_unidade(im, fotos)
        escrever(os.path.join(args.out, f"{im['slug']}.html"),
                 pagina(f"{im['nome']} — Milagres Hospedagens", corpo, rotulos, css,
                        f"pdf/{im['slug']}.pdf" if standalone else None, standalone))

    if args.out == OUT_DEFAULT and args.mode == "web":
        gerar_indice_ts(os.path.join(ROOT, "src", "lib", "portfolio.ts"))

    if args.pdf:
        print("\nPDFs (a partir de uma build inline, para ficarem autocontidos):")
        with tempfile.TemporaryDirectory() as tmp:
            inline = Fotos("inline")
            corpo, rotulos = deck_geral(inline)
            p = os.path.join(tmp, "portfolio-milagres.html")
            escrever(p, pagina("Portfólio Milagres Hospedagens", corpo, rotulos, css, None, True))
            gerar_pdf(p, os.path.join(args.out, "pdf", "portfolio-milagres.pdf"))
            for im in IMOVEIS:
                corpo, rotulos = deck_unidade(im, inline)
                p = os.path.join(tmp, f"{im['slug']}.html")
                escrever(p, pagina(im["nome"], corpo, rotulos, css, None, True))
                gerar_pdf(p, os.path.join(args.out, "pdf", f"{im['slug']}.pdf"))


if __name__ == "__main__":
    main()
