-- =============================================================================
-- Sistema de Cadastro Digital Setorial
-- Igreja Evangélica Assembleia de Deus – Ministério do Belém – Setor 46
--
-- Schema inicial: tabelas, funções, gatilhos, RLS e Storage.
-- Execute este arquivo uma única vez no SQL Editor do Supabase
-- (ou via `supabase db push`). Ele é idempotente sempre que possível.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------------------------------
-- Administradores
-- Não existe cadastro público de administradores: um usuário do Supabase Auth
-- só tem acesso ao painel quando existe uma linha ativa nesta tabela, criada
-- exclusivamente pela função public.promover_admin() executada no SQL Editor.
-- -----------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  nome       text not null check (char_length(nome) between 2 and 120),
  -- 'admin'      : acesso total (inclui excluir cadastros, configurações e auditoria)
  -- 'secretaria' : consulta, edita e aprova cadastros; não exclui
  papel      text not null default 'admin' check (papel in ('admin', 'secretaria')),
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = auth.uid() and a.ativo
  );
$$;

create or replace function public.is_admin_total()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = auth.uid() and a.ativo and a.papel = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- Congregações
-- -----------------------------------------------------------------------------
create table if not exists public.congregacoes (
  id         bigint generated always as identity primary key,
  nome       text not null check (char_length(nome) between 2 and 120),
  endereco   text check (char_length(endereco) <= 200),
  cidade     text check (char_length(cidade) <= 80),
  dirigente  text check (char_length(dirigente) <= 120),
  ativa      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists congregacoes_nome_unico
  on public.congregacoes (lower(nome));

-- -----------------------------------------------------------------------------
-- Configurações (linha única)
-- -----------------------------------------------------------------------------
create table if not exists public.configuracoes (
  id                        smallint primary key default 1 check (id = 1),
  formulario_aberto         boolean not null default true,
  url_publica               text check (url_publica is null or url_publica ~ '^https?://'),
  endereco_sede             text check (char_length(endereco_sede) <= 200),
  pastor_setorial           text check (char_length(pastor_setorial) <= 120),
  encarregado_lgpd_nome     text check (char_length(encarregado_lgpd_nome) <= 120),
  encarregado_lgpd_contato  text check (char_length(encarregado_lgpd_contato) <= 200),
  updated_at                timestamptz not null default now()
);

insert into public.configuracoes (id, endereco_sede, pastor_setorial)
values (1, 'Rua Independência, 179 - Centro - Embu-Guaçu - SP', 'Pr. Luiz Amaral')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Cadastros (fichas)
-- -----------------------------------------------------------------------------
create sequence if not exists public.cadastros_protocolo_seq;

create table if not exists public.cadastros (
  id                        uuid primary key default gen_random_uuid(),
  protocolo                 text not null unique default (
                              'S46-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-' ||
                              lpad(nextval('public.cadastros_protocolo_seq')::text, 6, '0')
                            ),
  status                    text not null default 'PENDENTE' check (status in ('PENDENTE', 'APROVADO')),
  congregacao_id            bigint not null references public.congregacoes (id) on delete restrict,

  nome                      text not null check (char_length(nome) between 3 and 150),
  nome_busca                text,
  conjuge_nome              text check (char_length(conjuge_nome) <= 150),
  data_casamento            date,
  pai_nome                  text check (char_length(pai_nome) <= 150),
  mae_nome                  text check (char_length(mae_nome) <= 150),
  data_nascimento           date not null,
  conjuge_data_nascimento   date,
  estado_civil              text not null check (estado_civil in
                              ('SOLTEIRO', 'CASADO', 'UNIAO_ESTAVEL', 'DIVORCIADO', 'SEPARADO', 'VIUVO')),
  origem_religiosa          text check (origem_religiosa in
                              ('CATOLICISMO', 'LAR_EVANGELICO', 'ESPIRITISMO', 'OUTROS_CREDOS')),
  origem_outros             text check (char_length(origem_outros) <= 80),

  naturalidade_cidade       text check (char_length(naturalidade_cidade) <= 80),
  naturalidade_uf           text check (naturalidade_uf ~ '^[A-Z]{2}$'),
  naturalidade_pais         text check (char_length(naturalidade_pais) <= 60),

  rg                        text check (char_length(rg) <= 20),
  rg_emissor                text check (char_length(rg_emissor) <= 20),
  rg_data_emissao           date,
  cpf                       text not null check (cpf ~ '^[0-9]{11}$'),
  escolaridade              text check (escolaridade in
                              ('NAO_ALFABETIZADO', 'FUNDAMENTAL_INCOMPLETO', 'FUNDAMENTAL_COMPLETO',
                               'MEDIO_INCOMPLETO', 'MEDIO_COMPLETO', 'SUPERIOR_INCOMPLETO',
                               'SUPERIOR_COMPLETO', 'POS_GRADUACAO', 'MESTRADO', 'DOUTORADO')),
  profissao                 text check (char_length(profissao) <= 80),

  endereco                  text not null check (char_length(endereco) between 3 and 150),
  numero                    text not null check (char_length(numero) between 1 and 10),
  complemento               text check (char_length(complemento) <= 60),
  bairro                    text not null check (char_length(bairro) between 2 and 80),
  cidade                    text not null check (char_length(cidade) between 2 and 80),
  estado                    text not null check (estado ~ '^[A-Z]{2}$'),
  cep                       text not null check (cep ~ '^[0-9]{8}$'),
  telefone                  text check (telefone ~ '^[0-9]{10,11}$'),
  celular                   text not null check (celular ~ '^[0-9]{10,11}$'),
  email                     text check (char_length(email) <= 150 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  data_batismo              date,
  igreja_batismo            text check (char_length(igreja_batismo) <= 150),
  igreja_batismo_cidade     text check (char_length(igreja_batismo_cidade) <= 80),
  igreja_batismo_uf         text check (igreja_batismo_uf ~ '^[A-Z]{2}$'),
  admissao_forma            text check (admissao_forma in ('BATISMO', 'CARTA', 'ACLAMACAO')),
  admissao_data             date,
  cargo                     text not null default 'MEMBRO' check (cargo in
                              ('MEMBRO', 'DIACONO', 'EVANGELISTA', 'COOPERADOR', 'PRESBITERO', 'PASTOR')),
  obreiro_local             text check (char_length(obreiro_local) <= 150),
  obreiro_data              date,
  cargos                    text check (char_length(cargos) <= 300),
  observacoes               text check (char_length(observacoes) <= 1000),

  foto_path                 text,

  consentimento_lgpd        boolean not null check (consentimento_lgpd),
  consentimento_em          timestamptz not null default now(),
  consentimento_versao      text not null,
  consentimento_responsavel boolean not null default false,

  aprovado_em               timestamptz,
  aprovado_por              uuid references auth.users (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users (id) on delete set null,

  constraint cadastros_foto_path_ok check (foto_path is null or foto_path = 'cadastros/' || id::text || '.jpg')
);

create index if not exists cadastros_status_idx       on public.cadastros (status);
create index if not exists cadastros_congregacao_idx  on public.cadastros (congregacao_id);
create index if not exists cadastros_created_idx      on public.cadastros (created_at desc);
create index if not exists cadastros_cpf_idx          on public.cadastros (cpf);
create index if not exists cadastros_cargo_idx        on public.cadastros (cargo);

-- -----------------------------------------------------------------------------
-- Auditoria (somente leitura para administradores; escrita só por funções)
-- Não grava valores de dados pessoais: apenas ação, autor, protocolo e nomes
-- dos campos alterados.
-- -----------------------------------------------------------------------------
create table if not exists public.auditoria (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  ator_id     uuid,
  ator_email  text,
  acao        text not null,
  entidade    text not null,
  entidade_id text,
  detalhes    jsonb not null default '{}'::jsonb
);
create index if not exists auditoria_created_idx on public.auditoria (created_at desc);

create or replace function public._registrar_auditoria(p_acao text, p_entidade text, p_entidade_id text, p_detalhes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if auth.uid() is not null then
    select a.email into v_email from public.admins a where a.user_id = auth.uid();
  end if;
  insert into public.auditoria (ator_id, ator_email, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), v_email, p_acao, p_entidade, p_entidade_id, coalesce(p_detalhes, '{}'::jsonb));
end;
$$;

-- -----------------------------------------------------------------------------
-- Controle de envio (anti-spam). Guarda apenas hash do IP por 24 horas.
-- -----------------------------------------------------------------------------
create table if not exists public.envios_controle (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists envios_controle_idx on public.envios_controle (ip_hash, created_at);

-- =============================================================================
-- Gatilhos
-- =============================================================================

-- Normaliza campos e protege colunas imutáveis
create or replace function public.cadastros_antes_gravar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.nome_busca := lower(extensions.unaccent(new.nome));

  if tg_op = 'INSERT' then
    new.status := 'PENDENTE';           -- todo novo cadastro começa pendente
    new.aprovado_em := null;
    new.aprovado_por := null;
    new.consentimento_em := now();
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE: campos que não podem ser alterados
  new.id                   := old.id;
  new.protocolo            := old.protocolo;
  new.created_at           := old.created_at;
  new.consentimento_lgpd   := old.consentimento_lgpd;
  new.consentimento_em     := old.consentimento_em;
  new.consentimento_versao := old.consentimento_versao;
  new.consentimento_responsavel := old.consentimento_responsavel;
  new.updated_at           := now();
  new.updated_by           := auth.uid();

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

drop trigger if exists cadastros_antes_gravar on public.cadastros;
create trigger cadastros_antes_gravar
  before insert or update on public.cadastros
  for each row execute function public.cadastros_antes_gravar();

-- Auditoria automática de inclusão e alteração
create or replace function public.cadastros_auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campos text[];
begin
  if tg_op = 'INSERT' then
    perform public._registrar_auditoria('cadastro_recebido', 'cadastro', new.id::text,
      jsonb_build_object('protocolo', new.protocolo));
    return new;
  end if;

  select coalesce(array_agg(n.key order by n.key), '{}')
    into v_campos
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
   where n.value is distinct from o.value
     and n.key not in ('updated_at', 'updated_by', 'nome_busca', 'aprovado_em', 'aprovado_por');

  if new.status is distinct from old.status then
    perform public._registrar_auditoria(
      case when new.status = 'APROVADO' then 'cadastro_aprovado' else 'cadastro_marcado_pendente' end,
      'cadastro', new.id::text, jsonb_build_object('protocolo', new.protocolo));
    v_campos := array_remove(v_campos, 'status');
  end if;

  if array_length(v_campos, 1) > 0 then
    perform public._registrar_auditoria('cadastro_editado', 'cadastro', new.id::text,
      jsonb_build_object('protocolo', new.protocolo, 'campos', to_jsonb(v_campos)));
  end if;
  return new;
end;
$$;

drop trigger if exists cadastros_auditar on public.cadastros;
create trigger cadastros_auditar
  after insert or update on public.cadastros
  for each row execute function public.cadastros_auditar();

create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists congregacoes_updated_at on public.congregacoes;
create trigger congregacoes_updated_at
  before update on public.congregacoes
  for each row execute function public.tocar_updated_at();

drop trigger if exists configuracoes_updated_at on public.configuracoes;
create trigger configuracoes_updated_at
  before update on public.configuracoes
  for each row execute function public.tocar_updated_at();

-- =============================================================================
-- Funções (RPC)
-- =============================================================================

-- Exclusão definitiva de um cadastro (somente administrador com papel 'admin').
-- A fotografia deve ser removida do Storage pelo painel ANTES desta chamada
-- (a política de Storage também exige papel 'admin').
-- Registra a operação guardando apenas o protocolo — nenhum dado pessoal.
create or replace function public.admin_excluir_cadastro(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_protocolo text;
  v_foto text;
begin
  if not public.is_admin_total() then
    raise exception 'Permissão negada: apenas administradores podem excluir cadastros.'
      using errcode = '42501';
  end if;

  delete from public.cadastros c
   where c.id = p_id
  returning c.protocolo, c.foto_path into v_protocolo, v_foto;

  if v_protocolo is null then
    raise exception 'Cadastro não encontrado.' using errcode = 'P0002';
  end if;

  perform public._registrar_auditoria('cadastro_excluido', 'cadastro', p_id::text,
    jsonb_build_object('protocolo', v_protocolo, 'foto_removida', v_foto is not null));

  return jsonb_build_object('protocolo', v_protocolo, 'foto_path', v_foto);
end;
$$;

-- Registro de ações do painel que não alteram dados (exportação, impressão).
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
  if p_acao not in ('exportacao_csv', 'exportacao_excel', 'impressao_ficha', 'login', 'logout') then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;
  if pg_column_size(p_detalhes) > 2000 then
    raise exception 'Detalhes muito grandes.' using errcode = '22023';
  end if;
  perform public._registrar_auditoria(p_acao, 'painel', p_entidade_id, p_detalhes);
end;
$$;

-- Indicadores do dashboard
create or replace function public.dashboard_resumo()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v jsonb;
  v_inicio_mes timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  if not public.is_admin() then
    raise exception 'Permissão negada.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total',      count(*),
    'pendentes',  count(*) filter (where status = 'PENDENTE'),
    'aprovados',  count(*) filter (where status = 'APROVADO'),
    'mes_atual',  count(*) filter (where created_at >= v_inicio_mes)
  ) into v
  from public.cadastros;

  v := v || jsonb_build_object('por_congregacao', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id, 'nome', g.nome, 'ativa', g.ativa,
             'total', g.total, 'pendentes', g.pendentes, 'aprovados', g.aprovados)
           order by g.total desc, g.nome)
      from (
        select k.id, k.nome, k.ativa,
               count(c.id) as total,
               count(c.id) filter (where c.status = 'PENDENTE') as pendentes,
               count(c.id) filter (where c.status = 'APROVADO') as aprovados
          from public.congregacoes k
          left join public.cadastros c on c.congregacao_id = k.id
         group by k.id, k.nome, k.ativa
      ) g
  ), '[]'::jsonb));

  return v;
end;
$$;

-- Controle de taxa de envio (usado apenas pelo backend com a chave secreta)
create or replace function public.registrar_tentativa_envio(p_ip_hash text, p_max_ip int, p_max_global int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip int;
  v_global int;
begin
  delete from public.envios_controle where created_at < now() - interval '24 hours';

  select count(*) into v_ip from public.envios_controle
   where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
  select count(*) into v_global from public.envios_controle
   where created_at > now() - interval '24 hours';

  if v_ip >= p_max_ip or v_global >= p_max_global then
    return false;
  end if;

  insert into public.envios_controle (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

-- Criação segura de administrador: executar SOMENTE no SQL Editor do Supabase
-- depois de criar o usuário em Authentication > Users.
create or replace function public.promover_admin(p_email text, p_nome text, p_papel text default 'admin')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select u.id into v_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Usuário % não encontrado em Authentication > Users. Crie-o primeiro.', p_email;
  end if;
  insert into public.admins (user_id, email, nome, papel, ativo)
  values (v_id, lower(trim(p_email)), trim(p_nome), p_papel, true)
  on conflict (user_id) do update
    set nome = excluded.nome, papel = excluded.papel, ativo = true, email = excluded.email;
  insert into public.auditoria (ator_id, ator_email, acao, entidade, entidade_id, detalhes)
  values (null, 'sql-editor', 'admin_promovido', 'admin', v_id::text, jsonb_build_object('papel', p_papel));
  return 'Administrador ativo: ' || lower(trim(p_email)) || ' (' || p_papel || ')';
end;
$$;

create or replace function public.revogar_admin(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.admins set ativo = false where lower(email) = lower(trim(p_email)) returning user_id into v_id;
  if v_id is null then
    raise exception 'Administrador % não encontrado.', p_email;
  end if;
  insert into public.auditoria (ator_id, ator_email, acao, entidade, entidade_id, detalhes)
  values (null, 'sql-editor', 'admin_revogado', 'admin', v_id::text, '{}'::jsonb);
  return 'Acesso revogado: ' || lower(trim(p_email));
end;
$$;

-- =============================================================================
-- Permissões (GRANT/REVOKE)
-- =============================================================================
revoke all on table public.admins, public.congregacoes, public.configuracoes,
                    public.cadastros, public.auditoria, public.envios_controle
  from anon, authenticated;
revoke all on sequence public.cadastros_protocolo_seq from anon, authenticated;

grant select on public.admins to authenticated;
grant select, insert, update on public.congregacoes to authenticated;
grant select, update on public.configuracoes to authenticated;
grant select, update on public.cadastros to authenticated;
grant select on public.auditoria to authenticated;

-- Funções: ninguém executa por padrão
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin()                                 to authenticated;
grant execute on function public.is_admin_total()                           to authenticated;
grant execute on function public.admin_excluir_cadastro(uuid)               to authenticated;
grant execute on function public.admin_registrar_acao(text, text, jsonb)    to authenticated;
grant execute on function public.dashboard_resumo()                         to authenticated;
grant execute on function public.registrar_tentativa_envio(text, int, int)  to service_role;
-- promover_admin / revogar_admin: apenas o dono do banco (SQL Editor). Sem grant.

-- Evita que funções criadas no futuro fiquem executáveis por anon automaticamente
alter default privileges in schema public revoke execute on functions from public, anon;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.admins          enable row level security;
alter table public.congregacoes    enable row level security;
alter table public.configuracoes   enable row level security;
alter table public.cadastros       enable row level security;
alter table public.auditoria       enable row level security;
alter table public.envios_controle enable row level security;


-- admins: cada administrador ativo vê a lista; ninguém altera pelo painel
drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- congregações
drop policy if exists congregacoes_select on public.congregacoes;
create policy congregacoes_select on public.congregacoes
  for select to authenticated using (public.is_admin());
drop policy if exists congregacoes_insert on public.congregacoes;
create policy congregacoes_insert on public.congregacoes
  for insert to authenticated with check (public.is_admin());
drop policy if exists congregacoes_update on public.congregacoes;
create policy congregacoes_update on public.congregacoes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- configurações
drop policy if exists configuracoes_select on public.configuracoes;
create policy configuracoes_select on public.configuracoes
  for select to authenticated using (public.is_admin());
drop policy if exists configuracoes_update on public.configuracoes;
create policy configuracoes_update on public.configuracoes
  for update to authenticated using (public.is_admin_total()) with check (public.is_admin_total());

-- cadastros: sem INSERT público (o envio passa pelo backend validado);
-- sem DELETE direto (somente pela função admin_excluir_cadastro)
drop policy if exists cadastros_select on public.cadastros;
create policy cadastros_select on public.cadastros
  for select to authenticated using (public.is_admin());
drop policy if exists cadastros_update on public.cadastros;
create policy cadastros_update on public.cadastros
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- auditoria: leitura apenas para administrador total
drop policy if exists auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria
  for select to authenticated using (public.is_admin_total());

-- envios_controle: nenhuma política => inacessível a anon/authenticated

-- =============================================================================
-- Storage: bucket privado para fotos 3x4
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-cadastros', 'fotos-cadastros', false, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

drop policy if exists fotos_select_admin on storage.objects;
create policy fotos_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos-cadastros' and public.is_admin());

drop policy if exists fotos_insert_admin on storage.objects;
create policy fotos_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos-cadastros' and public.is_admin()
              and name ~ '^cadastros/[0-9a-f-]{36}\.jpg$');

drop policy if exists fotos_update_admin on storage.objects;
create policy fotos_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos-cadastros' and public.is_admin())
  with check (bucket_id = 'fotos-cadastros' and public.is_admin()
              and name ~ '^cadastros/[0-9a-f-]{36}\.jpg$');

drop policy if exists fotos_delete_admin on storage.objects;
create policy fotos_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos-cadastros' and public.is_admin_total());
