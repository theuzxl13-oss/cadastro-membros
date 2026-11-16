-- Tipo de ficha (mesma ficha, finalidades diferentes): Cadastro, Batismo ou
-- Solicitação de Credencial. Permite ao painel separar as fichas por seção.
--
-- EFEITOS
--   * Acrescenta a coluna tipo_ficha com valor padrão 'CADASTRO'.
--   * Fichas já existentes passam a ser do tipo 'CADASTRO' (nada é apagado).
--   * Cria um índice para filtrar por tipo.
--   * Reversível: alter table public.cadastros drop column tipo_ficha;
alter table public.cadastros
  add column if not exists tipo_ficha text not null default 'CADASTRO'
    check (tipo_ficha in ('CADASTRO', 'BATISMO', 'CREDENCIAL'));

create index if not exists cadastros_tipo_ficha_idx on public.cadastros (tipo_ficha);
