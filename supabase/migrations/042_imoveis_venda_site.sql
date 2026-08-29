-- 042 — Site público de vendas: colunas e conteúdo
--
-- APLICADA em 29/08/2026 (via conector Supabase).
--
-- A tabela imoveis_milagres já alimentava a Sarah (tool consultar_imoveis).
-- Aqui ela passa a alimentar também:
--   • o site público /venda e /venda/[slug]
--   • a edição em Vendas › Imóveis à venda no PMS
--
-- As fotos são URLs do bucket público property-images — as mesmas do anúncio
-- no Airbnb. `fotos` guarda a seleção e a ORDEM escolhidas pelo time;
-- `foto_capa` é a que abre a página.
--
-- Só adiciona colunas e preenche conteúdo: nada existente é alterado.
-- A parte de RLS ficou na 043, que ainda NÃO foi aplicada.

ALTER TABLE public.imoveis_milagres
  ADD COLUMN IF NOT EXISTS slug        TEXT,
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS descricao   TEXT,
  ADD COLUMN IF NOT EXISTS beneficios  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fotos       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS foto_capa   TEXT,
  ADD COLUMN IF NOT EXISTS tag         TEXT,
  ADD COLUMN IF NOT EXISTS publicado   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ordem       INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.imoveis_milagres.slug      IS 'URL pública: /venda/<slug>';
COMMENT ON COLUMN public.imoveis_milagres.fotos     IS 'URLs do bucket property-images, na ordem exibida na galeria';
COMMENT ON COLUMN public.imoveis_milagres.foto_capa IS 'Foto de abertura; deve estar em fotos';
COMMENT ON COLUMN public.imoveis_milagres.publicado IS 'false = invisível no site público';
COMMENT ON COLUMN public.imoveis_milagres.ordem     IS 'Ordem no índice /venda (crescente)';

CREATE UNIQUE INDEX IF NOT EXISTS imoveis_milagres_slug_key
  ON public.imoveis_milagres (slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS imoveis_milagres_publicado_idx
  ON public.imoveis_milagres (publicado, ordem) WHERE publicado;

-- ── Conteúdo atual dos imóveis ────────────────────────────────────────
UPDATE public.imoveis_milagres SET
  slug        = 'tamona-07',
  property_id = '3a4ef8d9-cff3-4601-92b3-a04d3300294d'::uuid,
  descricao   = 'Dois dormitórios em suíte, sala e cozinha integradas e piscina privativa, a cem metros da praia. O caminho mais curto para entrar na Rota Ecológica.',
  beneficios  = ARRAY['Piscina privativa em 57 m² bem resolvidos', 'Porteira fechada: móveis planejados, decoração e enxoval', 'Cozinha equipada, churrasqueira e internet de alta velocidade', 'Ticket de entrada — libera capital para um segundo imóvel']::text[],
  fotos       = ARRAY['https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/3a4ef8d9-cff3-4601-92b3-a04d3300294d/airbnb-00-1782183397126.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/3a4ef8d9-cff3-4601-92b3-a04d3300294d/airbnb-01-1782183400744.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/3a4ef8d9-cff3-4601-92b3-a04d3300294d/airbnb-02-1782183402548.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/3a4ef8d9-cff3-4601-92b3-a04d3300294d/airbnb-03-1782183404170.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/3a4ef8d9-cff3-4601-92b3-a04d3300294d/airbnb-04-1782183407227.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/3a4ef8d9-cff3-4601-92b3-a04d3300294d/airbnb-05-1782183409277.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/3a4ef8d9-cff3-4601-92b3-a04d3300294d/airbnb-06-1782183411536.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/3a4ef8d9-cff3-4601-92b3-a04d3300294d/airbnb-07-1782183414295.jpg']::text[],
  foto_capa   = 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/3a4ef8d9-cff3-4601-92b3-a04d3300294d/airbnb-00-1782183397126.jpg',
  tag         = 'Menor ticket do portfólio',
  ordem       = 0,
  publicado   = true
WHERE unit_code = 'tamona-07';

UPDATE public.imoveis_milagres SET
  slug        = 'villa-green',
  property_id = '0430151c-73b5-4a7b-860c-dfd56dde924f'::uuid,
  descricao   = 'O único beira-mar do portfólio, e também o único térreo: 70 m² com varanda gourmet, assinados por arquitetos de nome e entregues decorados.',
  beneficios  = ARRAY['Beira-mar em Tatuamunha, na Rota Ecológica', 'Térreo — acessibilidade total, sem escadas', 'Varanda gourmet integrada à sala e à cozinha', 'Projeto e decoração de arquitetos renomados']::text[],
  fotos       = ARRAY['https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/0430151c-73b5-4a7b-860c-dfd56dde924f/airbnb-02-1782183591729.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/0430151c-73b5-4a7b-860c-dfd56dde924f/airbnb-00-1782183589202.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/0430151c-73b5-4a7b-860c-dfd56dde924f/airbnb-03-1782183594082.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/0430151c-73b5-4a7b-860c-dfd56dde924f/airbnb-04-1782183595354.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/0430151c-73b5-4a7b-860c-dfd56dde924f/airbnb-05-1782183597005.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/0430151c-73b5-4a7b-860c-dfd56dde924f/airbnb-06-1782183598732.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/0430151c-73b5-4a7b-860c-dfd56dde924f/airbnb-07-1782183600742.jpg']::text[],
  foto_capa   = 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/0430151c-73b5-4a7b-860c-dfd56dde924f/airbnb-02-1782183591729.jpg',
  tag         = 'Único beira-mar',
  ordem       = 1,
  publicado   = true
WHERE unit_code = 'villa-green';

UPDATE public.imoveis_milagres SET
  slug        = 'tamona-18',
  property_id = '4de8b1ce-b543-41b8-a3ad-ba8bbf09ab2f'::uuid,
  descricao   = '83 m² com duas suítes e um rooftop exclusivo — piscina privativa, banheiro e vista aberta para os coqueirais. O andar de cima é só seu.',
  beneficios  = ARRAY['Rooftop exclusivo com piscina privativa e banheiro', 'Vista aberta para os coqueirais', 'Churrasqueira e área de convivência no terraço', 'Porteira fechada, pronto para morar ou locar']::text[],
  fotos       = ARRAY['https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/4de8b1ce-b543-41b8-a3ad-ba8bbf09ab2f/airbnb-00-1777425365936.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/4de8b1ce-b543-41b8-a3ad-ba8bbf09ab2f/airbnb-01-1777425370378.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/4de8b1ce-b543-41b8-a3ad-ba8bbf09ab2f/airbnb-02-1777425372638.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/4de8b1ce-b543-41b8-a3ad-ba8bbf09ab2f/airbnb-03-1777425376722.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/4de8b1ce-b543-41b8-a3ad-ba8bbf09ab2f/airbnb-04-1777425380471.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/4de8b1ce-b543-41b8-a3ad-ba8bbf09ab2f/airbnb-05-1777425384294.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/4de8b1ce-b543-41b8-a3ad-ba8bbf09ab2f/airbnb-06-1777425388769.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/4de8b1ce-b543-41b8-a3ad-ba8bbf09ab2f/airbnb-07-1777425392170.jpg']::text[],
  foto_capa   = 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/4de8b1ce-b543-41b8-a3ad-ba8bbf09ab2f/airbnb-00-1777425365936.jpg',
  tag         = 'Rooftop privativo',
  ordem       = 2,
  publicado   = true
WHERE unit_code = 'tamona-18';

UPDATE public.imoveis_milagres SET
  slug        = 'cotinguiba-08',
  property_id = '06a8bfdd-c58c-494e-b813-868d5b147e59'::uuid,
  descricao   = '103 m² pelo mesmo preço do Tamoná 18 — a maior área entre os imóveis de duas suítes, com hall, sala de TV, sala de jantar, lavabo e depósito.',
  beneficios  = ARRAY['Maior área entre os de 2 suítes: 103 m²', 'Ambientes separados — hall, sala de TV e sala de jantar', 'Piscina privativa, lavabo e depósito', '200 m da Praia de Tatuamunha']::text[],
  fotos       = ARRAY['https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/06a8bfdd-c58c-494e-b813-868d5b147e59/airbnb-00-1777495979629.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/06a8bfdd-c58c-494e-b813-868d5b147e59/airbnb-01-1777495981471.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/06a8bfdd-c58c-494e-b813-868d5b147e59/airbnb-02-1777495983256.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/06a8bfdd-c58c-494e-b813-868d5b147e59/airbnb-03-1777495985237.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/06a8bfdd-c58c-494e-b813-868d5b147e59/airbnb-04-1777495986962.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/06a8bfdd-c58c-494e-b813-868d5b147e59/airbnb-05-1777495990700.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/06a8bfdd-c58c-494e-b813-868d5b147e59/airbnb-06-1777495992057.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/06a8bfdd-c58c-494e-b813-868d5b147e59/airbnb-07-1777495993687.jpg']::text[],
  foto_capa   = 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/06a8bfdd-c58c-494e-b813-868d5b147e59/airbnb-00-1777495979629.jpg',
  tag         = 'Melhor m² por real',
  ordem       = 3,
  publicado   = true
WHERE unit_code = 'cotinguiba-08';

UPDATE public.imoveis_milagres SET
  slug        = 'duplex-kanui-116',
  property_id = 'ee88c020-9974-40de-8cab-e2aa833e1f56'::uuid,
  descricao   = '155 m² em dois pavimentos, três suítes e quatro banheiros. Acomoda dez hóspedes — a maior diária do portfólio, com área gourmet e piscina privativa.',
  beneficios  = ARRAY['Até 10 hóspedes — a melhor relação diária/receita', '155 m² em duplex, 3 suítes e 4 banheiros', 'Área gourmet com piscina privativa e churrasqueira', '200 m da Praia do Riacho']::text[],
  fotos       = ARRAY['https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/ee88c020-9974-40de-8cab-e2aa833e1f56/airbnb-00-1782183521993.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/ee88c020-9974-40de-8cab-e2aa833e1f56/airbnb-01-1782183524291.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/ee88c020-9974-40de-8cab-e2aa833e1f56/airbnb-03-1782183527558.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/ee88c020-9974-40de-8cab-e2aa833e1f56/airbnb-04-1782183529366.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/ee88c020-9974-40de-8cab-e2aa833e1f56/airbnb-05-1782183531917.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/ee88c020-9974-40de-8cab-e2aa833e1f56/airbnb-06-1782183533923.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/ee88c020-9974-40de-8cab-e2aa833e1f56/airbnb-07-1782183535590.jpg']::text[],
  foto_capa   = 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/ee88c020-9974-40de-8cab-e2aa833e1f56/airbnb-00-1782183521993.jpg',
  tag         = 'Maior capacidade',
  ordem       = 4,
  publicado   = true
WHERE unit_code = 'duplex-kanui-116';

UPDATE public.imoveis_milagres SET
  slug        = 'kanui-201',
  property_id = '833b16b6-3e3c-4f88-a80b-92a6c548ba0c'::uuid,
  descricao   = 'A cobertura do portfólio: três suítes, área gourmet com piscina de borda infinita e uma vista contínua sobre o coqueiral. Anunciada como “Cobertura Vista Coqueiros”.',
  beneficios  = ARRAY['Piscina privativa suspensa sobre o coqueiral', '3 suítes e área gourmet completa, até 10 hóspedes', 'Vista panorâmica ininterrupta — o diferencial que não se constrói', 'Produto de topo, para o comprador de maior ticket']::text[],
  fotos       = ARRAY['https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/833b16b6-3e3c-4f88-a80b-92a6c548ba0c/airbnb-05-1777496302920.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/833b16b6-3e3c-4f88-a80b-92a6c548ba0c/airbnb-00-1777496291820.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/833b16b6-3e3c-4f88-a80b-92a6c548ba0c/airbnb-01-1777496293908.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/833b16b6-3e3c-4f88-a80b-92a6c548ba0c/airbnb-02-1777496297815.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/833b16b6-3e3c-4f88-a80b-92a6c548ba0c/airbnb-03-1777496299786.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/833b16b6-3e3c-4f88-a80b-92a6c548ba0c/airbnb-06-1777496304732.jpg', 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/833b16b6-3e3c-4f88-a80b-92a6c548ba0c/airbnb-07-1777496307132.jpg']::text[],
  foto_capa   = 'https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties/833b16b6-3e3c-4f88-a80b-92a6c548ba0c/airbnb-05-1777496302920.jpg',
  tag         = 'Produto premium',
  ordem       = 5,
  publicado   = true
WHERE unit_code = 'kanui-201';

