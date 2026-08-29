-- 043 — RLS de imoveis_milagres (site público de vendas)
--
-- ⚠️  NÃO APLICADA AINDA. Depende de conferir os consumidores da tabela.
--
-- Hoje imoveis_milagres está sem RLS. Como o site público passou a existir,
-- convém restringir o que a chave `anon` enxerga: só imóveis publicados e
-- disponíveis. A leitura autenticada continua ampla (o editor do PMS precisa
-- ver rascunhos) e a escrita segue exclusiva do backend com service role.
--
-- ANTES DE APLICAR, confira:
--   • A Sarah usa createAdminClient (service role) e NÃO é afetada — ok.
--   • O n8n: se algum fluxo ler esta tabela com a chave anon, passará a ver
--     só os publicados. Se ele usa service role, também não é afetado.
--
-- Enquanto não for aplicada, o site funciona normalmente: as páginas leem
-- via service role.

ALTER TABLE public.imoveis_milagres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imoveis_venda_public_read" ON public.imoveis_milagres;
CREATE POLICY "imoveis_venda_public_read"
  ON public.imoveis_milagres
  FOR SELECT
  TO anon
  USING (publicado = true AND disponivel = true);

DROP POLICY IF EXISTS "imoveis_venda_auth_read" ON public.imoveis_milagres;
CREATE POLICY "imoveis_venda_auth_read"
  ON public.imoveis_milagres
  FOR SELECT
  TO authenticated
  USING (true);
