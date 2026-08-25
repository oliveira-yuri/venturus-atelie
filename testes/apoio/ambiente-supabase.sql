-- =====================================================================
-- Ambiente mínimo que imita o Supabase, para testar a RLS localmente.
--
-- NÃO faz parte do sistema: existe só para que testes/rls.test.mjs possa
-- rodar as migrations reais num Postgres de verdade antes de o projeto
-- Supabase existir.
--
-- Reproduz o que o Supabase provê por padrão:
--   - schema auth com auth.users e auth.uid()
--   - papéis anon e authenticated
--   - as concessões amplas do PostgREST, que deixam a RLS fazer a filtragem
--   - schema storage com buckets e objects
-- =====================================================================

create schema if not exists auth;
create schema if not exists storage;

-- Papéis que o PostgREST assume conforme o token da requisição.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb default '{}'::jsonb,
  criado_em           timestamptz not null default now()
);

-- auth.uid() lê o "sub" das claims da requisição, como no Supabase.
--
-- Devolve null quando não há sessão, em vez de estourar. O Supabase se
-- comporta assim, e a diferença importa: políticas do tipo
-- `using (publicado or eh_equipe())` avaliam eh_equipe() para linhas não
-- publicadas mesmo em requisição anônima, e um erro ali derrubaria a
-- consulta em vez de simplesmente não devolver a linha.
create or replace function auth.uid()
returns uuid
language plpgsql
stable
as $$
declare
  v_claims text;
begin
  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is null or v_claims = '' then
    return null;
  end if;
  return nullif(v_claims::json ->> 'sub', '')::uuid;
exception when others then
  return null;
end;
$$;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text not null,
  owner     uuid
);

alter table storage.objects enable row level security;

-- Concessões amplas, como o Supabase faz. É de propósito: o que protege os
-- dados é a RLS, não a ausência de GRANT. Um teste com GRANT restrito daria
-- falso verde — passaria por falta de permissão, não por política correta.
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
