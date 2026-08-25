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
