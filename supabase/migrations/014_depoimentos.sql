-- =====================================================================
-- 014 — Depoimentos com moderação
--
-- Quem participou (adulto, ou responsável por quem participou) conta como
-- foi; a equipe lê e APROVA; só o aprovado aparece no site.
--
-- ---------------------------------------------------------------------
-- O QUE ESTA TABELA GUARDA, E O QUE NÃO GUARDA
-- ---------------------------------------------------------------------
-- · NÃO guarda e-mail nem telefone: o depoimento é publicado com o nome que
--   a pessoa escolheu, e a ONG não precisa de contato para moderar (coleta
--   mínima, RNF09). O preço: a equipe não consegue perguntar nada a quem
--   escreveu — só aprovar ou recusar.
-- · NÃO aceita criança como autora. O formulário exige a declaração de
--   maioridade/responsabilidade e o banco a recusa sem ela (`check`).
--   Depoimento de quem tem menos de 18 anos é sempre escrito e assinado por
--   um responsável (RN02, regra 9).
-- · A autorização de publicar nome e texto é uma coluna própria
--   (`autoriza_publicacao`), recusada pelo banco quando falsa: quem não
--   autoriza não tem depoimento a moderar.
--
-- ---------------------------------------------------------------------
-- QUEM LÊ O QUÊ
-- ---------------------------------------------------------------------
-- · qualquer pessoa lê SÓ o aprovado (`situacao = 'aprovado'`);
-- · a equipe lê e muda tudo (`public.eh_equipe()`);
-- · qualquer pessoa ESCREVE, mas só uma linha `pendente`, sem data de
--   moderação, com as duas declarações marcadas. Sem `select`: a linha
--   pendente não volta para quem a enviou (mesmo desenho de `contatos`).
--
-- ---------------------------------------------------------------------
-- LIMITE DE ENVIO
-- ---------------------------------------------------------------------
-- Reusa `public.limitar_envios()` (005/007): 30 por hora por visitante e
-- teto de 300 no site. O visitante chega como hash por
-- `registrar_depoimento`, igual a `registrar_contato`.
-- =====================================================================

create table public.depoimentos (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null check (length(btrim(nome)) between 1 and 120),
  -- Texto livre e opcional ("oficina de percussão", "contação na escola").
  atividade           text check (atividade is null or length(atividade) <= 160),
  texto               text not null check (length(btrim(texto)) between 20 and 1500),
  declara_adulto      boolean not null,
  autoriza_publicacao boolean not null,
  situacao            text not null default 'pendente'
                      check (situacao in ('pendente', 'aprovado', 'recusado')),
  criado_em           timestamptz not null default now(),
  moderado_em         timestamptz,
  constraint depoimento_exige_adulto check (declara_adulto),
  constraint depoimento_exige_autorizacao check (autoriza_publicacao)
);

create index depoimentos_situacao_idx on public.depoimentos (situacao, criado_em desc);

alter table public.depoimentos enable row level security;

create policy "depoimentos: todos leem o aprovado"
  on public.depoimentos for select
  using (situacao = 'aprovado' or public.eh_equipe());

create policy "depoimentos: qualquer pessoa escreve, pendente"
  on public.depoimentos for insert
  with check (situacao = 'pendente' and moderado_em is null
              and declara_adulto and autoriza_publicacao);

create policy "depoimentos: equipe gerencia"
  on public.depoimentos for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- O GRANT decide antes da política (medido em `contatos`): `anon` lê e
-- escreve, mais nada. `authenticated` precisa de update para a moderação.
grant select, insert on public.depoimentos to anon;
grant select, insert, update, delete on public.depoimentos to authenticated;

create trigger limitar_depoimentos
  before insert on public.depoimentos
  for each row execute function public.limitar_envios();

create or replace function public.registrar_depoimento(
  p_visitante           text,
  p_nome                text,
  p_texto               text,
  p_declara_adulto      boolean,
  p_autoriza_publicacao boolean,
  p_atividade           text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_origem text;
begin
  v_origem := case
    when p_visitante ~ '^[0-9a-f]{64}$' then p_visitante
    else encode(sha256(convert_to('desconhecida', 'UTF8')), 'hex')
  end;

  perform set_config('app.origem_do_visitante', v_origem, true);

  insert into public.depoimentos
    (nome, atividade, texto, declara_adulto, autoriza_publicacao)
  values
    (btrim(p_nome),
     nullif(btrim(coalesce(p_atividade, '')), ''),
     btrim(p_texto),
     coalesce(p_declara_adulto, false),
     coalesce(p_autoriza_publicacao, false));
end;
$$;

revoke all on function public.registrar_depoimento(
  text, text, text, boolean, boolean, text) from public;

grant execute on function public.registrar_depoimento(
  text, text, text, boolean, boolean, text) to anon, authenticated;
