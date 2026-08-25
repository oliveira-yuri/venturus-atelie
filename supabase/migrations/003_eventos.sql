-- =====================================================================
-- 003 — Eventos, inscricoes e presencas
--
-- ATENCAO: inscricoes guarda dados pessoais de criancas a partir de 10
-- anos e de seus responsaveis. A leitura publica e negada. Nao existe
-- politica de SELECT para quem nao esta autenticado — e isso e proposital.
-- =====================================================================

-- ---------------------------------------------------------------------
-- eventos (RF13, RF14)
-- ---------------------------------------------------------------------
create table public.eventos (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  descricao      text,
  comeca_em      timestamptz not null,
  termina_em     timestamptz,
  local          text,
  faixa_etaria   text,
  vagas          integer check (vagas is null or vagas > 0),
  imagem_caminho text,
  imagem_alt     text,
  -- RN06: CPF so e pedido quando a instituicao parceira exigir.
  exige_cpf      boolean not null default false,
  publicado      boolean not null default false,
  criado_em      timestamptz not null default now(),
  constraint alt_obrigatorio_com_imagem
    check (imagem_caminho is null or (imagem_alt is not null and length(trim(imagem_alt)) > 0)),
  constraint termino_depois_do_inicio
    check (termina_em is null or termina_em > comeca_em)
);

create index eventos_comeca_em_idx on public.eventos (comeca_em);

alter table public.eventos enable row level security;

create policy "eventos: leitura publica do que esta publicado"
  on public.eventos for select
  using (publicado or public.eh_equipe());

create policy "eventos: equipe gerencia"
  on public.eventos for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- inscricoes (RF15)
--
-- Insercao sem conta, de proposito: reduzir atrito importa mais que
-- historico individual (decisao D4).
--
-- IMPORTANTE PARA QUEM FOR CONSUMIR: como nao ha politica de SELECT
-- publica, o supabase-js NAO pode devolver a linha inserida. Use
-- .insert(dados) sem .select(), ou a insercao parecera falhar mesmo
-- tendo gravado.
-- ---------------------------------------------------------------------
create table public.inscricoes (
  id                    uuid primary key default gen_random_uuid(),
  evento_id             uuid not null references public.eventos(id) on delete cascade,
  nome                  text not null,
  email                 text not null,
  telefone              text,
  cpf                   text,
  eh_menor              boolean not null default false,
  responsavel_nome      text,
  responsavel_telefone  text,
  -- RN07: autorizacao de uso de imagem registrada na inscricao.
  autoriza_imagem       boolean not null default false,
  consentimento_dados   boolean not null default false,
  criado_em             timestamptz not null default now(),
  -- RN02: menor participa por inscricao feita por responsavel identificado.
  constraint responsavel_obrigatorio_para_menor check (
    not eh_menor or (
      responsavel_nome is not null and length(trim(responsavel_nome)) > 0
      and responsavel_telefone is not null and length(trim(responsavel_telefone)) > 0
    )
  ),
  -- Coleta minima: sem consentimento nao ha inscricao.
  constraint consentimento_obrigatorio check (consentimento_dados)
);

create index inscricoes_evento_idx on public.inscricoes (evento_id);

alter table public.inscricoes enable row level security;

-- Escrita aberta, leitura fechada. A ausencia de policy de select para
-- anon e authenticated e o que protege os dados.
create policy "inscricoes: qualquer pessoa se inscreve"
  on public.inscricoes for insert
  with check (true);

create policy "inscricoes: equipe gerencia"
  on public.inscricoes for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- presencas (RF17) — nem leitura nem escrita publica
-- ---------------------------------------------------------------------
create table public.presencas (
  id           uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null unique references public.inscricoes(id) on delete cascade,
  presente     boolean not null default true,
  marcada_em   timestamptz not null default now(),
  marcada_por  uuid references public.perfis(id)
);

alter table public.presencas enable row level security;

create policy "presencas: so a equipe"
  on public.presencas for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- Permissoes de eventos, inscricoes e presencas
--
-- Repare no que anon recebe em inscricoes: APENAS insert. Sem select, sem
-- update, sem delete. Mesmo que a politica de leitura fosse escrita errada
-- um dia, o papel anonimo nao teria o privilegio de tentar.
--
-- presencas nao concede nada a anon: nem leitura nem escrita.
-- ---------------------------------------------------------------------
grant select on public.eventos to anon, authenticated;
grant insert, update, delete on public.eventos to authenticated;

grant insert on public.inscricoes to anon;
grant select, insert, update, delete on public.inscricoes to authenticated;

grant select, insert, update, delete on public.presencas to authenticated;
