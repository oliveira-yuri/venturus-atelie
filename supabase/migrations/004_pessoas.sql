-- =====================================================================
-- 004 — Voluntariado, doacoes e contatos
--
-- Todas com dados pessoais: leitura publica negada em todas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- areas_voluntariado (RF24) — as cinco areas nomeadas pela ONG
-- ---------------------------------------------------------------------
create table public.areas_voluntariado (
  id        text primary key,
  nome      text not null,
  descricao text not null,
  ordem     integer not null
);

alter table public.areas_voluntariado enable row level security;

create policy "areas: leitura publica"
  on public.areas_voluntariado for select using (true);

create policy "areas: equipe gerencia"
  on public.areas_voluntariado for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- voluntarios (RF25, RF26)
-- ---------------------------------------------------------------------
create table public.voluntarios (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references public.perfis(id) on delete cascade,
  mensagem   text,
  situacao   text not null default 'novo'
             check (situacao in ('novo', 'em_contato', 'ativo', 'inativo')),
  criado_em  timestamptz not null default now()
);

create table public.voluntario_areas (
  voluntario_id uuid not null references public.voluntarios(id) on delete cascade,
  area_id       text not null references public.areas_voluntariado(id) on delete cascade,
  primary key (voluntario_id, area_id)
);

alter table public.voluntarios enable row level security;
alter table public.voluntario_areas enable row level security;

create policy "voluntarios: a pessoa le a propria candidatura"
  on public.voluntarios for select
  using (perfil_id = auth.uid() or public.eh_equipe());

create policy "voluntarios: a pessoa se candidata"
  on public.voluntarios for insert
  with check (perfil_id = auth.uid());

create policy "voluntarios: equipe gerencia"
  on public.voluntarios for all
  using (public.eh_equipe()) with check (public.eh_equipe());

create policy "voluntario_areas: a pessoa le as proprias"
  on public.voluntario_areas for select
  using (
    exists (select 1 from public.voluntarios v
            where v.id = voluntario_id and v.perfil_id = auth.uid())
    or public.eh_equipe()
  );

create policy "voluntario_areas: a pessoa escolhe as proprias"
  on public.voluntario_areas for insert
  with check (
    exists (select 1 from public.voluntarios v
            where v.id = voluntario_id and v.perfil_id = auth.uid())
  );

create policy "voluntario_areas: equipe gerencia"
  on public.voluntario_areas for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- doacoes (RF19-RF22)
--
-- RN03: o que a organizacao recebe. Descricao em texto livre de proposito
-- (RF19): filtrar depois custa menos que perder oferta por lista fechada.
-- RN08: o sistema registra doacao, nunca processa pagamento.
-- ---------------------------------------------------------------------
create table public.doacoes (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid references public.perfis(id) on delete set null,
  -- Doacao registrada pela equipe pode nao ter perfil: veio de fora do site.
  doador_nome   text,
  doador_email  text,
  tipo          text not null check (tipo in ('item', 'recurso_financeiro')),
  descricao     text not null,
  valor         numeric(12, 2) check (valor is null or valor >= 0),
  situacao      text not null default 'ofertada'
                check (situacao in ('ofertada', 'aceita', 'recusada', 'recebida')),
  resposta      text,
  respondida_em timestamptz,
  recebida_em   timestamptz,
  criado_em     timestamptz not null default now(),
  constraint identificacao_obrigatoria
    check (perfil_id is not null or (doador_nome is not null and length(trim(doador_nome)) > 0))
);

create index doacoes_situacao_idx on public.doacoes (situacao);
create index doacoes_perfil_idx on public.doacoes (perfil_id);

alter table public.doacoes enable row level security;

create policy "doacoes: o doador le as proprias"
  on public.doacoes for select
  using (perfil_id = auth.uid() or public.eh_equipe());

create policy "doacoes: o doador oferta"
  on public.doacoes for insert
  with check (perfil_id = auth.uid());

create policy "doacoes: equipe gerencia"
  on public.doacoes for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- contatos (RF07, RF29, RF38)
--
-- O registro central que responde a perda de oportunidades de 2021.
-- Insercao sem conta; leitura so da equipe.
--
-- Mesma armadilha de inscricoes: use .insert() sem .select().
-- ---------------------------------------------------------------------
create table public.contatos (
  id        uuid primary key default gen_random_uuid(),
  origem    text not null default 'contato'
            check (origem in ('contato', 'escola', 'doacao', 'voluntariado')),
  nome      text not null,
  email     text not null,
  telefone  text,
  instituicao text,
  mensagem  text not null,
  situacao  text not null default 'novo'
            check (situacao in ('novo', 'em_contato', 'concluido')),
  consentimento_dados boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint consentimento_obrigatorio check (consentimento_dados)
);

create index contatos_situacao_idx on public.contatos (situacao);
create index contatos_criado_em_idx on public.contatos (criado_em desc);

alter table public.contatos enable row level security;

create policy "contatos: qualquer pessoa escreve"
  on public.contatos for insert
  with check (true);

create policy "contatos: equipe gerencia"
  on public.contatos for all
  using (public.eh_equipe()) with check (public.eh_equipe());
