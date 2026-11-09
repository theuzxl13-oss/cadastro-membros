-- =============================================================================
-- PROPOSTA 001 — Registro do responsável legal (LGPD, art. 14)
-- SITUAÇÃO: NÃO APLICADA. Aguarda autorização da instituição.
--
-- O QUE FAZ
--   * Adiciona duas colunas OPCIONAIS à tabela cadastros:
--       responsavel_nome       — nome de quem consentiu pelo menor
--       responsavel_parentesco — vínculo (pai, mãe, tutor, guardião)
--   * Protege as duas colunas contra alteração pelo painel (como os demais
--     campos de consentimento), mantendo a prova do consentimento.
--
-- EFEITOS
--   * Não apaga nem altera nenhum cadastro existente (colunas novas ficam vazias).
--   * Operação rápida e reversível (ALTER TABLE ... DROP COLUMN).
--   * Depois de aplicada, o formulário passará a pedir esses dois campos
--     quando o titular tiver menos de 18 anos (alteração de código separada,
--     publicada somente após a aplicação deste SQL).
-- =============================================================================

alter table public.cadastros
  add column if not exists responsavel_nome text
    check (responsavel_nome is null or char_length(responsavel_nome) between 3 and 150),
  add column if not exists responsavel_parentesco text
    check (responsavel_parentesco is null or responsavel_parentesco in ('PAI', 'MAE', 'TUTOR', 'GUARDIAO', 'OUTRO'));

create or replace function public.cadastros_antes_gravar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.nome_busca := lower(extensions.unaccent(new.nome));

  if tg_op = 'INSERT' then
    new.status := 'PENDENTE';
    new.aprovado_em := null;
    new.aprovado_por := null;
    new.consentimento_em := now();
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  new.id                        := old.id;
  new.protocolo                 := old.protocolo;
  new.created_at                := old.created_at;
  new.consentimento_lgpd        := old.consentimento_lgpd;
  new.consentimento_em          := old.consentimento_em;
  new.consentimento_versao      := old.consentimento_versao;
  new.consentimento_responsavel := old.consentimento_responsavel;
  new.responsavel_nome          := old.responsavel_nome;        -- novo
  new.responsavel_parentesco    := old.responsavel_parentesco;  -- novo
  new.updated_at                := now();
  new.updated_by                := auth.uid();

  if new.status is distinct from old.status then
    if new.status = 'APROVADO' then
      new.aprovado_em  := now();
      new.aprovado_por := auth.uid();
    else
      new.aprovado_em  := null;
      new.aprovado_por := null;
    end if;
  else
    new.aprovado_em  := old.aprovado_em;
    new.aprovado_por := old.aprovado_por;
  end if;
  return new;
end;
$$;

-- REVERSÃO (se necessário):
-- alter table public.cadastros drop column if exists responsavel_nome, drop column if exists responsavel_parentesco;
