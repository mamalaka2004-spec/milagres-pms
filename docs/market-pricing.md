# Análise de Mercado & Tarifa Sugerida — Fornecedores e Estratégia

Objetivo: dar ao PMS uma visão de **tarifa sugerida / dinâmica** comparando os imóveis
da Milagres com o mercado (anúncios próximos, preços, ocupação, avaliações) em
Airbnb, Booking e Google.

Há três famílias de fornecedor, com modelos de cobrança e níveis de segurança bem
diferentes. Resumo abaixo e, no fim, a recomendação.

---

## Tabela comparativa

| Fornecedor | Tipo | Cobrança | Custo aprox. (2026) | Cobertura | O que entrega | Segurança / confiabilidade | Melhor para |
|---|---|---|---|---|---|---|---|
| **GeckoAPI** | Scraping gerenciado (BR) | **Créditos pré-pagos** — 1 crédito por execução (PLP ou PDP) | Baixo p/ volume pequeno; custo previsível por chamada | Airbnb BR confirmado (PLP+PDP); Booking/Google a confirmar | Lista de anúncios c/ **preço, disponibilidade, host, regras**; ou detalhe de 1 anúncio | Média-alta operacional: **eles** mantêm anti-bot/parse. É scraping (cinza em ToS), mas o risco técnico é deles. API BR, fácil | **Começar já** — fonte dos comparáveis |
| **Apify** | Scraping gerenciado (marketplace de "actors") | Assinatura + uso (compute/resultados) | ~US$ 39–49/mês base + uso; actors de Airbnb/Booking cobram por 1.000 resultados | Airbnb, Booking, Google Maps (actors prontos) | Igual ao Gecko, porém você escolhe/mantém o actor | Média: vendor mantém infra, mas você escolhe o actor; pode quebrar; ToS cinza | Booking/Google e volumes maiores |
| **AirDNA** | **Inteligência de mercado** (dados licenciados) | **Assinatura** (dashboard) + API enterprise | Dashboard ~US$ 20–100+/mês; **API enterprise** ~5.000+ chamadas/mês, preço sob consulta (caro) | Airbnb + Vrbo, 120k mercados | ADR, ocupação, RevPAR, **comparáveis (até 10)**, projeções, "Smart Rates" | **Alta**: dados agregados/licenciados, SLA, sem ToS cinza | Painel de mercado robusto, decisão de investimento |
| **PriceLabs** | **Precificação dinâmica** | **Assinatura por anúncio** | ~US$ 19,99/anúncio/mês (cai com volume) | Sincroniza Airbnb/Booking/Vrbo + 150 PMS | **Tarifa sugerida/dinâmica por noite** pronta (sazonalidade, demanda, ritmo) | **Alta**: produto consolidado, integrações oficiais, logs auditáveis | Preço dinâmico "pronto", sem construir modelo |
| Beyond / Wheelhouse | Precificação dinâmica | Assinatura por anúncio ou % | Similar a PriceLabs | Airbnb/Booking/Vrbo + PMS | Igual PriceLabs | Alta | Alternativas ao PriceLabs |
| Lighthouse (OTA Insight) | Rate shopping hoteleiro | Assinatura | Sob consulta (enterprise) | Booking/Google Hotels/OTAs | Tarifas de concorrentes (hotel) | Alta | Quando o foco for hotelaria/OTA |
| DIY (scraping próprio) | Você raspa | Infra própria | "Grátis" mas alto custo de manutenção | O que você construir | O que você construir | **Baixa**: quebra fácil, captcha, ToS, manutenção sua | Não recomendado |

> Valores são faixas de referência (jun/2026) para dimensionar — confirmar no plano de
> cada fornecedor antes de contratar.

---

## Como cada modelo funciona (e qual dá mais segurança)

**1. Scraping gerenciado por crédito/uso — GeckoAPI, Apify**
- Você manda uma URL/parâmetros, recebe os dados estruturados. O fornecedor cuida de
  proxy, anti-bot e parsing.
- **Segurança:** o risco técnico (bloqueio, mudança de layout) é do fornecedor, não seu.
  Continua sendo *scraping* → zona cinza de Termos de Uso do Airbnb/Booking. Para uso
  **interno** de inteligência de preço (não republicar dados), o risco prático é baixo,
  mas existe. Custo escala com o número de consultas.
- **Gecko vs Apify:** Gecko é BR, mais simples e com endpoints **prontos para Airbnb**
  (PLP de listagem + PDP de detalhe) e cobrança por crédito previsível. Apify é mais
  amplo (tem Booking e Google Maps) porém exige escolher/manter o actor certo.

**2. Inteligência de mercado licenciada — AirDNA**
- Não é scraping: eles **licenciam/agregam** os dados e expõem via dashboard/API.
- **Segurança:** a mais alta em termos legais e de estabilidade (SLA, contrato). Em
  compensação, a API séria é **enterprise** (volume mínimo, mais cara).

**3. Precificação dinâmica como serviço — PriceLabs / Beyond**
- Você não coleta nada: conecta seu PMS/canal e **recebe a tarifa sugerida** por noite,
  já calculada com o mercado.
- **Segurança:** alta (produto oficial, integrações homologadas). Cobra **por anúncio/mês**.
  É o caminho de menor esforço para "tarifa dinâmica de verdade".

### Qual dá mais segurança?
- **Segurança jurídica + estabilidade:** PriceLabs / AirDNA (dados oficiais/licenciados).
- **Segurança operacional com custo baixo e controle:** GeckoAPI (o fornecedor mantém o
  scraping; você paga por crédito; dados ficam no seu Supabase).
- **Menor segurança:** scraping próprio (DIY).

---

## Recomendação para a Milagres

Fase 1 (agora) — **GeckoAPI como fonte dos comparáveis.** É o melhor ponto de partida:
BR, barato por crédito, endpoints de Airbnb prontos, e os dados ficam no nosso banco
para montarmos a **tarifa sugerida** (mediana dos comparáveis ajustada por ocupação e
avaliações). Mantemos a fonte **abstraída** para plugar Apify (Booking/Google) depois.

Fase 2 (futuro) — avaliar **PriceLabs** para preço **dinâmico** automático por noite, e/ou
**AirDNA** se quisermos um painel de mercado mais profundo. Ver tabela acima para custo.

---

## GeckoAPI — como entra no módulo

- **PLP (Página de listagem):** dado um destino (lat/long ou endereço) + datas + nº de
  hóspedes, retorna **vários anúncios próximos com preço/disponibilidade** → é a base dos
  comparáveis. 1 crédito por página.
- **PDP (Página de detalhe):** dada a URL de um anúncio específico, retorna o detalhe
  completo (preço, disponibilidade, host, regras) → para acompanhar um concorrente
  conhecido ao longo do tempo. 1 crédito por execução.
- Os imóveis da Milagres já têm `latitude`, `longitude`, `bedrooms`, `max_guests` e
  `base_price_cents` — ou seja, dá para consultar por localização e comparar direto com o
  preço atual.

Endpoint: `POST https://api.geckoapi.com.br/v1/extract` com `Authorization: Bearer <token>`.
Guardar o token como env `GECKO_API_TOKEN` (server-side; nunca no client).
