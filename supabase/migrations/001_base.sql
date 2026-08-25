-- =====================================================================
-- 001 — Base: extensoes, perfis e a funcao de permissao
--
-- Toda migration deste projeto cria a tabela E suas politicas no mesmo
-- arquivo. Nunca existe tabela sem politica, nem por uma hora.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- perfis
--
-- Tres booleanos em vez de uma coluna unica de papel porque o RF10 permite
-- acumular voluntario e doador na mesma pessoa.
-- ---------------------------------------------------------------------
create table public.perfis (
  id                    uuid primary key references auth.users(id) on delete cascade,
  nome                  text not null,
  email                 text not null,
  telefone              text,
  tipo_pessoa           text check (tipo_pessoa in ('fisica', 'juridica')),
  eh_voluntario         boolean not null default false,
  eh_doador             boolean not null default false,
  eh_equipe             boolean not null default false,
  maioridade_confirmada boolean not null default false,
  criado_em             timestamptz not null default now()
);

comment on column public.perfis.eh_equipe is
  'Concedido apenas manualmente no painel do Supabase. Nunca vem do cadastro.';

-- ---------------------------------------------------------------------
-- eh_equipe() — usada por TODAS as politicas
--
-- SECURITY DEFINER e obrigatorio aqui. Sem ele, uma politica em perfis que
-- consulta perfis dispara recursao infinita e o Postgres aborta a consulta.
-- Esse erro e a causa classica de alguem desativar a RLS para "destravar".
-- ---------------------------------------------------------------------
create or replace function public.eh_equipe()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.eh_equipe from public.perfis p where p.id = auth.uid()), false);
$$;

revoke all on function public.eh_equipe() from public;
grant execute on function public.eh_equipe() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Criacao automatica do perfil ao criar a conta
--
-- eh_equipe NAO e lido do metadata: se fosse, qualquer pessoa poderia se
-- declarar equipe no cadastro e ler os dados de todos os inscritos.
-- ---------------------------------------------------------------------
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (
    id, nome, email, telefone, tipo_pessoa,
    eh_voluntario, eh_doador, maioridade_confirmada
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.email,
    new.raw_user_meta_data ->> 'telefone',
    new.raw_user_meta_data ->> 'tipo_pessoa',
    coalesce((new.raw_user_meta_data ->> 'eh_voluntario')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'eh_doador')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'maioridade_confirmada')::boolean, false)
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------------------------------------------------------------------
-- Politicas de perfis
-- ---------------------------------------------------------------------
alter table public.perfis enable row level security;

create policy "perfis: cada pessoa le o proprio registro"
  on public.perfis for select
  using (id = auth.uid() or public.eh_equipe());

create policy "perfis: cada pessoa edita o proprio registro"
  on public.perfis for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "perfis: equipe gerencia"
  on public.perfis for all
  using (public.eh_equipe())
  with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- Protecao contra escalada de privilegio
--
-- A politica acima deixa cada pessoa editar o proprio registro, e o
-- with check so garante que o id continue sendo o dela — nao impede que
-- ela mude eh_equipe. Sem este trigger, qualquer pessoa com conta de
-- voluntario ou doador executa
--
--   update perfis set eh_equipe = true where id = auth.uid()
--
-- e passa a ler inscritos, doadores e contatos. Numa organizacao que
-- atende criancas a partir de 10 anos, isso e incidente de dados pessoais.
--
-- Confirmado em teste antes de existir projeto Supabase: ver
-- testes/rls.test.mjs, "pessoa autenticada nao consegue se tornar equipe".
-- ---------------------------------------------------------------------
-- SECURITY INVOKER de proposito (o padrao). Com SECURITY DEFINER, o
-- current_user dentro da funcao passa a ser o dono dela, e a checagem de
-- papel abaixo nunca enxergaria 'authenticated' — a protecao seria inerte.
-- Quem precisa ser DEFINER e eh_equipe(), para nao recursionar.
create or replace function public.proteger_papel_equipe()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- A restricao vale para quem chega pela API publica (anon e authenticated).
  -- O painel do Supabase e as Edge Functions operam como postgres ou
  -- service_role, e precisam conseguir promover alguem: e assim que a
  -- PRIMEIRA pessoa da equipe ganha acesso, e assim que a ONG adiciona uma
  -- nova. Sem esta distincao o sistema fica sem administrador nenhum.
  if new.eh_equipe is distinct from old.eh_equipe
     and current_user in ('anon', 'authenticated')
     and not public.eh_equipe() then
    raise exception 'somente a equipe altera o papel de equipe'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proteger_papel_equipe
  before update on public.perfis
  for each row execute function public.proteger_papel_equipe();

-- ---------------------------------------------------------------------
-- Permissoes de perfis
--
-- O projeto foi criado com "Automatically expose new tables" DESLIGADO, entao
-- nenhuma tabela chega a API sem uma concessao explicita como estas. E defesa
-- em profundidade: se uma politica tiver erro, o papel ainda assim nao tem o
-- privilegio. A RLS filtra o que passa; o grant decide o que sequer e tentado.
--
-- anon nao recebe nada aqui: perfil so existe para quem esta autenticado.
-- A insercao acontece pelo trigger ao_criar_usuario, que roda como definer.
-- ---------------------------------------------------------------------
grant select, update on public.perfis to authenticated;
