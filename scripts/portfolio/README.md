# Portfólio de vendas — gerador das apresentações

Gera as apresentações usadas pelo time comercial: um deck geral com os seis
imóveis à venda e um deck por imóvel, cada um em HTML navegável e em PDF.

Os arquivos ficam em `public/portfolio/` e aparecem na aba **Vendas › Portfólio**
(`/vendas/portfolio`), que exige login como qualquer rota do dashboard.

## Rodar

```bash
python3 scripts/portfolio/build.py          # só os HTMLs (rápido)
python3 scripts/portfolio/build.py --pdf    # HTMLs + os 7 PDFs (~2 min)
```

O comando também reescreve `src/lib/portfolio.ts`, o índice que a página lê.
Não edite esse arquivo à mão.

## O que sai

| Arquivo | Conteúdo |
|---|---|
| `public/portfolio/portfolio-milagres.html` | Deck geral, 10 slides |
| `public/portfolio/<slug>.html` | Deck do imóvel, 5 slides |
| `public/portfolio/pdf/*.pdf` | O mesmo conteúdo, um slide por página |
| `src/lib/portfolio.ts` | Índice para a página do dashboard |

Cada deck individual tem: capa, ficha com benefícios e valor, galeria,
a região e o fechamento com os links do vídeo e do anúncio.

## Onde mexer

- **Preço, texto, benefícios, foto de capa** → `IMOVEIS`, no topo do `build.py`.
  É a fonte da verdade dos decks; o `.md` da base de conhecimento é a fonte
  para a Sarah e para o time.
- **Visual** (cores, tipografia, layout dos slides) → `deck.css`. Os tokens
  saem do `tailwind.config.ts` (paleta `brand` + `cream`, Cormorant Garamond /
  DM Sans / JetBrains Mono), então o material acompanha a identidade do produto.
- **Quais fotos entram** → `fotos.json`. Peças de marketing (QR code, card de
  Instagram) foram retiradas de propósito: a galeria mostra só o imóvel.

## Fotos

Vêm do bucket público `property-images` — as mesmas do anúncio no Airbnb,
já organizadas por imóvel. Dois modos:

- `--mode web` (padrão): o HTML aponta para o bucket. Arquivo de ~35 KB.
- `--mode inline`: embute tudo em base64. É o que alimenta a geração de PDF
  e a publicação como Artifact.

O cache local em `scripts/portfolio/fotos/` é gitignorado e recomprimido
(1200 px, qualidade 58) para os PDFs não ficarem pesados. Se estiver faltando,
o script rebaixa do bucket sozinho.

## Detalhe da geração de PDF

O Chrome grava o PDF mas nem sempre encerra o processo. Por isso o script
espera o arquivo aparecer e parar de crescer, encerra o Chrome e só então
valida a assinatura `%PDF-`. Se você mexer nisso e os PDFs começarem a sair
vazios, é aqui que olhar.
