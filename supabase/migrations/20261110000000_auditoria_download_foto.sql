-- Registra na auditoria o download da foto 3x4 pelo painel.
-- Efeito: apenas acrescenta 'download_foto' à lista de ações aceitas pela
-- função admin_registrar_acao. Não altera tabelas nem dados.
create or replace function public.admin_registrar_acao(p_acao text, p_entidade_id text default null, p_detalhes jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Permissão negada.' using errcode = '42501';
  end if;
  if p_acao not in ('exportacao_csv', 'exportacao_excel', 'impressao_ficha', 'download_foto', 'login', 'logout') then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;
  if pg_column_size(p_detalhes) > 2000 then
    raise exception 'Detalhes muito grandes.' using errcode = '22023';
  end if;
  perform public._registrar_auditoria(p_acao, 'painel', p_entidade_id, p_detalhes);
end;
$$;

revoke execute on function public.admin_registrar_acao(text, text, jsonb) from public, anon;
grant execute on function public.admin_registrar_acao(text, text, jsonb) to authenticated;
