-- =====================================================================
-- 002 — Conteudo publico
--
-- Leitura publica, escrita so da equipe. O padrao de politica se repete
-- porque cada tabela precisa da sua: nao existe heranca de politica.
-- =====================================================================

-- ---------------------------------------------------------------------
-- atividades (RF03) — espelha site/assets/dados-iniciais/atividades.json
-- ---------------------------------------------------------------------
create table public.atividades (
  id            text primary key,
  titulo        text not null,
  resumo        text,
  descricao     text,
  genero        text,
  duracao       text,
  elenco        text,
  classificacao text,
  local         text,
  rider         text,
  publicado     boolean not null default true,
  criado_em     timestamptz not null default now()
);

alter table public.atividades enable row level security;

create policy "atividades: leitura publica do que esta publicado"
  on public.atividades for select
  using (publicado or public.eh_equipe());

create policy "atividades: equipe gerencia"
  on public.atividades for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- publicacoes (RF04) — noticias, campanhas e resultados
-- ---------------------------------------------------------------------
create table public.publicacoes (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  resumo       text,
  corpo        text not null,
  imagem_caminho text,
  imagem_alt   text,
  publicado    boolean not null default false,
  publicado_em timestamptz,
  criado_em    timestamptz not null default now(),
  -- RNF02: imagem sem texto alternativo nao entra no ar.
  constraint alt_obrigatorio_com_imagem
    check (imagem_caminho is null or (imagem_alt is not null and length(trim(imagem_alt)) > 0))
);

create index publicacoes_publicado_em_idx on public.publicacoes (publicado_em desc);

alter table public.publicacoes enable row level security;

create policy "publicacoes: leitura publica do que esta publicado"
  on public.publicacoes for select
  using (publicado or public.eh_equipe());

create policy "publicacoes: equipe gerencia"
  on public.publicacoes for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- midia (RF05) — fotos e videos por album
-- ---------------------------------------------------------------------
create table public.midia (
  id             uuid primary key default gen_random_uuid(),
  album          text not null,
  tipo           text not null check (tipo in ('imagem', 'video')),
  caminho        text not null,
  alt            text not null,
  legenda        text,
  evento_id      uuid,
  publicacao_id  uuid references public.publicacoes(id) on delete set null,
  -- RN07: publicar imagem de participante exige autorizacao registrada.
  autorizacao_registrada boolean not null default false,
  publicado      boolean not null default false,
  criado_em      timestamptz not null default now(),
  constraint alt_nao_vazio check (length(trim(alt)) > 0)
);

create index midia_album_idx on public.midia (album);

alter table public.midia enable row level security;

create policy "midia: leitura publica do que esta publicado e autorizado"
  on public.midia for select
  using ((publicado and autorizacao_registrada) or public.eh_equipe());

create policy "midia: equipe gerencia"
  on public.midia for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- clipping (RF39) — espelha site/assets/dados-iniciais/clipping.json
-- ---------------------------------------------------------------------
create table public.clipping (
  id        text primary key,
  tipo      text not null check (tipo in ('midia', 'instituicao', 'programacao')),
  titulo    text not null,
  detalhe   text,
  ano       integer,
  publicado boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table public.clipping enable row level security;

create policy "clipping: leitura publica do que esta publicado"
  on public.clipping for select
  using (publicado or public.eh_equipe());

create policy "clipping: equipe gerencia"
  on public.clipping for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- acervo (RF35-RF37) — busca em portugues, sem servico externo
-- ---------------------------------------------------------------------
create table public.acervo (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descricao       text,
  tema            text,
  faixa_etaria    text,
  arquivo_caminho text not null,
  tamanho_bytes   bigint,
  downloads       integer not null default 0,
  publicado       boolean not null default false,
  criado_em       timestamptz not null default now(),
  busca tsvector generated always as (
    to_tsvector('portuguese',
      coalesce(titulo, '') || ' ' || coalesce(descricao, '') || ' ' || coalesce(tema, ''))
  ) stored
);

create index acervo_busca_idx on public.acervo using gin (busca);
create index acervo_tema_idx on public.acervo (tema);

alter table public.acervo enable row level security;

create policy "acervo: leitura publica do que esta publicado"
  on public.acervo for select
  using (publicado or public.eh_equipe());

create policy "acervo: equipe gerencia"
  on public.acervo for all
  using (public.eh_equipe()) with check (public.eh_equipe());
