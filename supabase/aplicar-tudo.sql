-- =====================================================================
-- Ateliê Afro Cultural — aplicação completa do banco
--
-- GERADO por ferramentas/gerar-sql-completo.sh. Não editar à mão.
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- É seguro rodar uma vez; rodar duas vezes acusa objeto já existente.
-- =====================================================================

-- ############ 001_base.sql ############
-- =====================================================================
-- 001 — Base: extensoes, perfis e a funcao de permissao
--
-- Toda migration deste projeto cria a tabela E suas politicas no mesmo
-- arquivo. Nunca existe tabela sem politica, nem por uma hora.
-- =====================================================================

-- Nenhuma extensao e necessaria: gen_random_uuid() e sha256() sao nativos do
-- Postgres. Depender de pgcrypto obrigaria a qualificar o schema "extensions"
-- em toda chamada, porque e la que o Supabase instala as extensoes.

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

-- ############ 002_conteudo.sql ############
-- =====================================================================
-- 002 — Conteudo publico
--
-- Leitura publica, escrita so da equipe. O padrao de politica se repete
-- porque cada tabela precisa da sua: nao existe heranca de politica.
-- =====================================================================

-- ---------------------------------------------------------------------
-- atividades (RF03) — espelha dados-iniciais/atividades.json
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
-- clipping (RF39) — espelha dados-iniciais/clipping.json
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

-- ---------------------------------------------------------------------
-- Permissoes do conteudo publico
--
-- Leitura para todos; escrita apenas para quem esta autenticado, e a RLS
-- restringe essa escrita a equipe.
-- ---------------------------------------------------------------------
grant select on public.atividades, public.publicacoes, public.midia,
                public.clipping, public.acervo to anon, authenticated;

grant insert, update, delete on public.atividades, public.publicacoes,
                                 public.midia, public.clipping, public.acervo
  to authenticated;

-- ############ 003_eventos.sql ############
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

-- ############ 004_pessoas.sql ############
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

-- ---------------------------------------------------------------------
-- Permissoes de voluntariado, doacoes e contatos
--
-- anon so recebe insert em contatos — o formulario publico do RF07. Nas
-- demais nao recebe nada: sao dados pessoais.
-- ---------------------------------------------------------------------
grant select on public.areas_voluntariado to anon, authenticated;
grant insert, update, delete on public.areas_voluntariado to authenticated;

grant select, insert, update, delete on public.voluntarios,
                                        public.voluntario_areas,
                                        public.doacoes to authenticated;

grant insert on public.contatos to anon;
grant select, insert, update, delete on public.contatos to authenticated;

-- ############ 005_contencao.sql ############
-- =====================================================================
-- 005 — Contencao de envio automatizado
--
-- Efeito colateral de permitir insercao sem conta em inscricoes e contatos
-- (secao 12 do escopo): abre porta para envio em massa.
--
-- Contencao suficiente pedida pelo escopo: limite por origem e revisao
-- humana. Sem captcha — custo zero e nenhum atrito para quem se inscreve.
--
-- O que NAO pode acontecer, e nao acontece aqui: afrouxar a leitura junto
-- com a escrita.
-- =====================================================================

create table public.envios_recentes (
  id        bigserial primary key,
  origem    text not null,
  tabela    text not null,
  criado_em timestamptz not null default now()
);

create index envios_recentes_busca_idx
  on public.envios_recentes (origem, tabela, criado_em desc);

comment on column public.envios_recentes.origem is
  'Hash SHA-256 do IP. O endereco em si nunca e gravado: coleta minima (RNF09).';

alter table public.envios_recentes enable row level security;

-- Ninguem le nem escreve direto: so o trigger, que roda como definer.
create policy "envios_recentes: so a equipe consulta"
  on public.envios_recentes for select
  using (public.eh_equipe());

-- ---------------------------------------------------------------------
-- limitar_envios()
--
-- O Postgres enxerga os cabecalhos da requisicao via request.headers,
-- populado pelo PostgREST. Fora de uma requisicao HTTP a configuracao nao
-- existe — por isso o coalesce.
-- ---------------------------------------------------------------------
create or replace function public.limitar_envios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cabecalhos json;
  v_ip         text;
  v_origem     text;
  v_recentes   integer;
  v_limite     constant integer := 10;
  v_janela     constant interval := interval '1 hour';
begin
  begin
    v_cabecalhos := current_setting('request.headers', true)::json;
  exception when others then
    v_cabecalhos := null;
  end;

  v_ip := coalesce(
    split_part(v_cabecalhos ->> 'x-forwarded-for', ',', 1),
    v_cabecalhos ->> 'x-real-ip',
    'desconhecida'
  );

  -- Guardamos o hash, nunca o IP: coleta minima (RNF09).
  --
  -- sha256() e nativo do Postgres desde a versao 11. Usar digest() do
  -- pgcrypto exigiria qualificar o schema: no Supabase as extensoes ficam em
  -- "extensions", e esta funcao roda com search_path = public, entao digest()
  -- simplesmente nao existiria aqui.
  v_origem := encode(sha256(convert_to(v_ip, 'UTF8')), 'hex');

  select count(*) into v_recentes
  from public.envios_recentes e
  where e.origem = v_origem
    and e.tabela = tg_table_name
    and e.criado_em > now() - v_janela;

  if v_recentes >= v_limite then
    raise exception 'muitos envios em pouco tempo, tente novamente mais tarde'
      using errcode = 'P0001';
  end if;

  insert into public.envios_recentes (origem, tabela)
  values (v_origem, tg_table_name);

  return new;
end;
$$;

create trigger limitar_inscricoes
  before insert on public.inscricoes
  for each row execute function public.limitar_envios();

create trigger limitar_contatos
  before insert on public.contatos
  for each row execute function public.limitar_envios();

-- ---------------------------------------------------------------------
-- Limpeza: registros de contencao nao precisam durar mais que a janela.
-- ---------------------------------------------------------------------
create or replace function public.limpar_envios_antigos()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.envios_recentes where criado_em < now() - interval '1 day';
$$;

-- ---------------------------------------------------------------------
-- Permissoes da contencao
--
-- Ninguem escreve aqui pela API: quem insere e o trigger, que roda como
-- definer. A equipe pode consultar para investigar um pico de envios.
-- ---------------------------------------------------------------------
grant select on public.envios_recentes to authenticated;

-- ############ 006_storage.sql ############
-- =====================================================================
-- 006 — Buckets de arquivos
--
-- Politicas de Storage tambem sao RLS: valem as mesmas regras.
-- =====================================================================

insert into storage.buckets (id, name, public)
values
  ('galeria',   'galeria',   true),
  ('acervo',    'acervo',    true),
  ('identidade','identidade', true)
on conflict (id) do nothing;

-- Leitura publica nos tres: sao arquivos destinados ao publico.
create policy "arquivos publicos: leitura"
  on storage.objects for select
  using (bucket_id in ('galeria', 'acervo', 'identidade'));

-- Escrita apenas da equipe, nos tres.
create policy "arquivos publicos: equipe envia"
  on storage.objects for insert
  with check (bucket_id in ('galeria', 'acervo', 'identidade') and public.eh_equipe());

create policy "arquivos publicos: equipe atualiza"
  on storage.objects for update
  using (bucket_id in ('galeria', 'acervo', 'identidade') and public.eh_equipe());

create policy "arquivos publicos: equipe remove"
  on storage.objects for delete
  using (bucket_id in ('galeria', 'acervo', 'identidade') and public.eh_equipe());

-- ############ 007_limite_por_visitante.sql ############
-- =====================================================================
-- 007 — O limite de envio passa a ser por VISITANTE, e nao por servidor
--
-- POR QUE ESTA MIGRATION EXISTE, e por que ela nao podia vir depois do
-- formulario de contato (RF07):
--
-- 005_contencao.sql identifica quem enviou pelo `x-forwarded-for` que o
-- PostgREST expoe em `request.headers`. Isso funcionava quando o site era
-- estatico e o NAVEGADOR de cada pessoa falava direto com o Supabase: o
-- cabecalho carregava o IP dela.
--
-- No desenho novo (Next.js, spec 4.1) quem fala com o Supabase e SEMPRE o
-- servidor. O cabecalho passa a ser o mesmo para todo mundo, e o limite de
-- 10/hora vira um BALDE GLOBAL de 10 envios por hora para o site inteiro.
-- Nao fica fraco: fica uma negacao de servico contra quem usa. Um spammer
-- esgota a cota de todos, e depois de 10 mensagens legitimas ninguem mais
-- consegue escrever para a ONG. Ver spec 4.6.
--
-- O CONSERTO, exatamente como a spec desenhou: o SERVIDOR le o IP real do
-- visitante (`x-nf-client-connection-ip` na Netlify,
-- `x-forwarded-for` no `next dev` local), calcula o hash SHA-256 e passa a
-- origem como PARAMETRO EXPLICITO — nao mais como cabecalho a ser
-- adivinhado. Quem faz isso do lado do site e
-- compartilhado/origem-do-visitante.ts, chamado por acoes/contato.ts.
--
-- DESCARTADO PELA SPEC, e nao reaberto aqui: injetar um cabecalho proprio
-- no cliente do Supabase e torcer para o gateway nao reescrever. Depende de
-- infraestrutura de terceiro e exigiria medicao que ninguem tem como fazer.
--
-- =====================================================================
-- COMO A ORIGEM CHEGA ATE O TRIGGER (a parte nao obvia)
-- =====================================================================
--
-- Um trigger `before insert` nao recebe parametro de quem chamou. E o
-- PostgREST nao deixa o cliente definir configuracao de sessao arbitraria —
-- de proposito. Entao a origem chega por uma FUNCAO que faz as duas coisas
-- na MESMA transacao:
--
--   1. `public.registrar_contato(...)` grava `app.origem_do_visitante` com
--      `set_config(..., is_local => true)` — transacao-local, ou seja,
--      morre junto com a requisicao e nunca vaza para a proxima requisicao
--      que reaproveitar a mesma conexao do pool;
--   2. faz o INSERT, que dispara `public.limitar_envios()`, que le aquela
--      configuracao.
--
-- Duas chamadas separadas (uma para "definir a origem", outra para
-- inserir) NAO funcionariam: o PostgREST abre uma transacao por
-- requisicao, e a configuracao local da primeira ja teria morrido quando a
-- segunda chegasse. E uma configuracao NAO-local resolveria isso do pior
-- jeito possivel: ficaria grudada na conexao do pool e a proxima pessoa
-- herdaria o balde da anterior.
--
-- =====================================================================
-- O QUE ESTA MIGRATION NAO CONSEGUE FAZER, dito em voz alta
-- =====================================================================
--
-- O hash chega como PARAMETRO, ou seja, quem chama escolhe o valor. Quem
-- tiver a chave publicavel do projeto pode chamar `registrar_contato` com
-- um hash diferente a cada envio e furar o balde por visitante.
--
-- Isso NAO e uma regressao, e e por isso que o teto do site (abaixo)
-- existe: sem ele, trocar o balde global por baldes por visitante deixaria
-- quem tem a chave com insercao ILIMITADA — pior que hoje. Com ele, o pior
-- caso volta a ser um balde global, so que num numero que pessoa nenhuma
-- alcanca por uso normal.
--
-- Fechar isso de verdade exigiria um segredo que o cliente nao tem (o que
-- este projeto nao tem: nao existe service_role no repositorio, spec 4.1) e
-- rotacionar a chave que vazou no historico do git (CLAUDE.md, item 0b).
--
-- =====================================================================
-- COMPATIBILIDADE COM QUEM JA USA `limitar_envios()`
-- =====================================================================
--
-- Dois triggers chamam esta funcao: `limitar_inscricoes` (em
-- public.inscricoes) e `limitar_contatos` (em public.contatos), os dois de
-- 005_contencao.sql. Nenhum dos dois e recriado aqui — um
-- `create or replace function` mantem os triggers apontando para a funcao
-- nova, com o mesmo nome e a mesma assinatura.
--
-- O caminho antigo continua inteiro: sem a configuracao de sessao (INSERT
-- direto na tabela, sem passar pela funcao), a funcao volta a ler o
-- cabecalho, exatamente como em 005. Ou seja, RF15 (inscricao sem conta),
-- que ainda nao foi escrito, nao quebra — ele so nao ganha o balde por
-- visitante ate ter a funcao irma dele (ver o fim deste arquivo).
-- =====================================================================

-- ---------------------------------------------------------------------
-- O comentario da coluna muda: `origem` deixa de ser SEMPRE um hash.
-- ---------------------------------------------------------------------
comment on column public.envios_recentes.origem is
  'Hash SHA-256 do IP do visitante, ou o literal ''teto-do-site'' na linha '
  'que conta o teto global. O endereco em si nunca e gravado: coleta minima (RNF09).';

-- ---------------------------------------------------------------------
-- limitar_envios() — agora com DOIS baldes
--
-- OS NUMEROS, e de onde eles vem (a spec pede que sejam revistos aqui):
--
-- 30 POR HORA POR ORIGEM (era 10). O 10 vinha de um mundo em que cada
-- navegador falava por si. Ele quebra em dois casos reais e conhecidos
-- desta ONG:
--
--   · CGNAT de operadora movel — dezenas de celulares saem pelo MESMO
--     endereco. No Brasil isso e a regra, nao a excecao, e a ONG opera no
--     celular (regra 4 do CLAUDE.md);
--   · o laboratorio da escola — o site tem /para-escolas, e o caminho
--     natural dali e uma turma inteira se inscrevendo de uma vez, de um
--     endereco so. Turma de escola publica em Sao Paulo tem ~30 alunos.
--
-- 30 cobre a turma e cobre o CGNAT com folga, e continua sendo um numero
-- que nenhum envio automatizado considera util: quem quer inundar um
-- formulario quer milhares, nao 30. O balde e POR TABELA
-- (`origem, tabela`, como em 005), entao a turma que se inscreve nao gasta
-- nada do balde de mensagens de contato.
--
-- 300 POR HORA NO SITE INTEIRO (teto novo). E um fusivel, nao um limite de
-- uso: a ONG recebeu 14 mencoes na imprensa em toda a sua historia
-- (dados-iniciais/clipping.json) e nunca teve volume que chegue perto
-- disso numa hora. Ele existe por dois motivos concretos:
--
--   · o paragrafo "o que esta migration nao consegue fazer", acima — sem
--     teto, quem tem a chave insere sem limite nenhum;
--   · `envios_recentes` cresce com os envios e so e limpa por
--     `limpar_envios_antigos()`. Um teto e o que impede a tabela de virar
--     o problema.
--
-- 300 = 10x o balde por origem: sobra para dez turmas de escola na mesma
-- hora, que e mais do que a ONG ja fez em um dia.
--
-- A JANELA CONTINUA DE 1 HORA. Mudar os dois numeros ao mesmo tempo
-- tornaria impossivel saber qual deles causou o proximo problema.
-- ---------------------------------------------------------------------
create or replace function public.limitar_envios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cabecalhos json;
  v_ip         text;
  v_do_site    text;
  v_origem     text;
  v_recentes   integer;
  v_no_site    integer;
  v_limite     constant integer := 30;
  v_teto       constant integer := 300;
  v_janela     constant interval := interval '1 hour';
  -- Nao e um hash: e um literal, para a equipe conseguir achar estas linhas
  -- no painel do Supabase quando quiser entender um pico.
  v_teto_chave constant text := 'teto-do-site';
begin
  -- 1. A ORIGEM DITA PELO SERVIDOR, quando houver.
  --
  -- `current_setting(..., true)` devolve NULL em vez de levantar erro
  -- quando a configuracao nunca foi definida — que e o caso de todo INSERT
  -- que nao passou por `registrar_contato`.
  --
  -- O FORMATO E CONFERIDO AQUI TAMBEM, e nao so na funcao que grava: esta
  -- funcao e a que decide o balde, e uma configuracao com lixo dentro
  -- (string vazia, texto de 1 MB, um valor por envio) transformaria
  -- `envios_recentes` num deposito de entrada de usuario. O que nao for um
  -- SHA-256 em hexadecimal cai no caminho de baixo.
  v_do_site := current_setting('app.origem_do_visitante', true);

  if v_do_site is not null and v_do_site ~ '^[0-9a-f]{64}$' then
    v_origem := v_do_site;
  else
    -- 2. O CAMINHO DE 005, INTEIRO: sem origem dita pelo servidor, le o
    --    cabecalho. Serve a quem insere direto na tabela (RF15 ainda nao
    --    escrito) e serve como rede se `registrar_contato` for contornada.
    begin
      v_cabecalhos := current_setting('request.headers', true)::json;
    exception when others then
      v_cabecalhos := null;
    end;

    v_ip := coalesce(
      -- A Netlify poe o IP real do visitante aqui, e o cabecalho e dela,
      -- nao de quem faz a requisicao. Fora da Netlify ele simplesmente nao
      -- existe e o coalesce segue adiante.
      v_cabecalhos ->> 'x-nf-client-connection-ip',
      split_part(v_cabecalhos ->> 'x-forwarded-for', ',', 1),
      v_cabecalhos ->> 'x-real-ip',
      'desconhecida'
    );

    -- Guardamos o hash, nunca o IP: coleta minima (RNF09).
    --
    -- sha256() e nativo do Postgres desde a versao 11. Usar digest() do
    -- pgcrypto exigiria qualificar o schema: no Supabase as extensoes ficam
    -- em "extensions", e esta funcao roda com search_path = public, entao
    -- digest() simplesmente nao existiria aqui.
    v_origem := encode(sha256(convert_to(v_ip, 'UTF8')), 'hex');
  end if;

  -- 3. O BALDE DA ORIGEM.
  select count(*) into v_recentes
  from public.envios_recentes e
  where e.origem = v_origem
    and e.tabela = tg_table_name
    and e.criado_em > now() - v_janela;

  if v_recentes >= v_limite then
    raise exception 'muitos envios em pouco tempo, tente novamente mais tarde'
      using errcode = 'P0001';
  end if;

  -- 4. O TETO DO SITE. Verificado DEPOIS do balde da origem de proposito:
  --    quando os dois estourarem juntos, a mensagem que a pessoa recebe e
  --    a mesma, mas o caso comum (uma pessoa insistindo) nunca chega aqui.
  select count(*) into v_no_site
  from public.envios_recentes e
  where e.origem = v_teto_chave
    and e.tabela = tg_table_name
    and e.criado_em > now() - v_janela;

  if v_no_site >= v_teto then
    raise exception 'muitos envios em pouco tempo, tente novamente mais tarde'
      using errcode = 'P0001';
  end if;

  -- 5. Duas linhas por envio: a da origem e a do teto. O `limpar_envios_
  --    antigos()` de 005 apaga as duas do mesmo jeito (ele olha so a data).
  insert into public.envios_recentes (origem, tabela)
  values (v_origem, tg_table_name), (v_teto_chave, tg_table_name);

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- registrar_contato() — a porta do formulario publico (RF07)
--
-- SECURITY INVOKER, e isso e decisao: ela roda com os privilegios de quem
-- chamou (anon, na pratica), entao a RLS de `public.contatos` continua
-- valendo palavra por palavra. Um `security definer` aqui pularia a
-- politica — e ainda que a politica de insert seja `with check (true)`,
-- essa e a diferenca entre "o banco autoriza" e "a funcao autoriza", e a
-- primeira e a unica que continua verdadeira depois que alguem mexer na
-- politica. Quem precisa de definer e o trigger, que grava em
-- `envios_recentes`, e ele ja e (005_contencao.sql).
--
-- NAO DEVOLVE A LINHA (`returns void`), e isso tambem e decisao: `anon`
-- tem `grant insert` e NENHUM select em `public.contatos`. Uma funcao que
-- devolvesse a linha gravada seria uma porta lateral de leitura no meio de
-- uma tabela com nome, e-mail e telefone de quem escreve para a ONG. Do
-- lado do site, acoes/contato.ts nao precisa da linha para nada.
--
-- `origem` (a coluna) e escrita AQUI, com o literal 'contato', e nao vem do
-- parametro: quem manda o corpo da requisicao escolheria entre 'contato',
-- 'escola', 'doacao' e 'voluntariado' e sujaria o registro central (RF29)
-- de graca. Quando existir a tela de escolas, ela ganha a funcao dela.
--
-- Telefone e instituicao vazios viram NULL, nao string vazia: as colunas
-- aceitam nulo e a tela da equipe omite o que e nulo (regra 2 do CLAUDE.md
-- aplicada a campo).
--
-- O consentimento NAO e "corrigido" para true em lugar nenhum: se vier
-- falso, o `check (consentimento_dados)` da tabela recusa a linha, que e
-- LGPD imposta pelo esquema (004_pessoas.sql). A validacao do site recusa
-- antes; esta e a rede embaixo dela.
-- ---------------------------------------------------------------------
create or replace function public.registrar_contato(
  p_visitante     text,
  p_nome          text,
  p_email         text,
  p_mensagem      text,
  p_consentimento boolean,
  p_telefone      text default null,
  p_instituicao   text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_origem text;
begin
  -- O que nao for um SHA-256 em hexadecimal e tratado como "nao sei quem
  -- e": todos os envios sem origem identificavel compartilham um balde so,
  -- que e o comportamento seguro pedido pela spec (degrada para o limite
  -- global de hoje, em vez de desligar o limite).
  v_origem := case
    when p_visitante ~ '^[0-9a-f]{64}$' then p_visitante
    else encode(sha256(convert_to('desconhecida', 'UTF8')), 'hex')
  end;

  -- `is_local => true`: vale so ate o fim desta transacao. Ver o cabecalho.
  perform set_config('app.origem_do_visitante', v_origem, true);

  insert into public.contatos
    (origem, nome, email, telefone, instituicao, mensagem, consentimento_dados)
  values
    ('contato',
     p_nome,
     p_email,
     nullif(btrim(coalesce(p_telefone, '')), ''),
     nullif(btrim(coalesce(p_instituicao, '')), ''),
     p_mensagem,
     coalesce(p_consentimento, false));
end;
$$;

-- ---------------------------------------------------------------------
-- Permissoes
--
-- O formulario de contato e PUBLICO (RF07): quem escreve nao tem conta.
-- `anon` precisa executar a funcao, e ja tinha `grant insert` na tabela
-- (004_pessoas.sql) — nada de novo se abre aqui.
--
-- `revoke ... from public` primeiro porque funcao nasce executavel por
-- PUBLIC no Postgres: sem isto, "quem pode executar" ficaria implicito, e a
-- lista explicita abaixo nao seria a lista de verdade.
-- ---------------------------------------------------------------------
revoke all on function public.registrar_contato(
  text, text, text, text, boolean, text, text) from public;

grant execute on function public.registrar_contato(
  text, text, text, text, boolean, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- O QUE FICA PARA DEPOIS, escrito aqui para nao se perder:
--
-- RF15 (inscricao em evento sem conta) vai precisar da funcao irma —
-- `registrar_inscricao(p_visitante, ...)`, com o mesmo `set_config` na
-- mesma transacao. Enquanto ela nao existir, `public.inscricoes` continua
-- com o balde por CABECALHO, ou seja, com o balde global de hoje. Isso nao
-- e um problema em aberto: nao existe uma linha de codigo que insira em
-- `inscricoes` nesta branch.
-- ---------------------------------------------------------------------

-- ############ 008_galeria_privada.sql ############
-- =====================================================================
-- 008 — O bucket `galeria` deixa de ser publico
--
-- FECHA A BRECHA REGISTRADA NO ITEM 0j DO CLAUDE.md, e ela nao era
-- teorica. MEDIDO em 01/09/2026 contra o projeto de verdade, SEM MANDAR
-- CHAVE NENHUMA na requisicao:
--
--   GET https://<projeto>.supabase.co/storage/v1/object/public/galeria/nao-existe.jpg
--   -> HTTP 400 {"statusCode":"404","error":"not_found",
--                "message":"Object not found","code":"NoSuchKey"}
--
-- Leia o codigo: `NoSuchKey`, nao `NoSuchBucket`. O endereco ACEITOU o
-- bucket e so reclamou da chave — ou seja, qualquer pessoa com o caminho
-- de um arquivo de verdade baixa o arquivo, sem chave, sem sessao, sem
-- passar por politica nenhuma. Um bucket que nao existe responde diferente,
-- e a diferenca tambem foi medida:
--
--   GET .../object/public/nao-existe-bucket/x.jpg
--   -> HTTP 400 {"statusCode":"404","error":"Bucket not found",
--                "message":"Bucket not found","code":"NoSuchBucket"}
--
-- Isso colide com a RN07 (regra 9 do CLAUDE.md): nenhuma foto no ar sem
-- autorizacao de uso de imagem registrada, e o publico da ONG inclui
-- criancas a partir de 10 anos. A coluna `publicado` governa o que a
-- pagina DESENHA; ela nunca governou o ARQUIVO. "Tirar do ar" mexia so na
-- tabela: o arquivo continuava baixavel para sempre por quem tivesse a
-- URL. O que havia contra isso era o caminho `<album>/<uuid>.<ext>` nao
-- ser adivinhavel — obscuridade, nao permissao.
--
-- =====================================================================
-- O QUE ESTA MIGRATION FAZ, E O QUE ELA DE PROPOSITO NAO FAZ
-- =====================================================================
--
-- FAZ:
--   1. `galeria` vira privado. O endereco /object/public/galeria/... para
--      de servir arquivo — passa a responder NoSuchBucket. A unica forma
--      de baixar uma foto passa a ser uma URL ASSINADA, gerada pelo
--      servidor do site (servidor/dados/galeria.ts, `createSignedUrls`).
--   2. A leitura de `storage.objects` no bucket `galeria` passa a
--      depender da linha correspondente em `public.midia`: so tem
--      endereco assinado quem tem a linha `publicado` E
--      `autorizacao_registrada`. Ou seja, a RN07 passa a valer para o
--      ARQUIVO e nao so para a listagem.
--
-- NAO FAZ, e a instrucao da tarefa foi explicita: nao encosta em `acervo`
-- nem em `identidade`. Os dois continuam publicos e com leitura sem
-- condicao — sao material feito para ser baixado por qualquer pessoa
-- (RF35/RF36: "download livre, sem cadastro"). A unica coisa que muda
-- para eles e que a politica de leitura precisou ser RECRIADA sem citar
-- `galeria`, porque a original cobria os tres num `in (...)` so. O efeito
-- para `acervo` e `identidade` e identico, linha a linha.
--
-- NAO MEXE nas politicas de insert/update/delete de 006_storage.sql: elas
-- ja exigem `public.eh_equipe()` nos tres buckets, e isso continua certo.
--
-- =====================================================================
-- POR QUE A POLITICA OLHA `public.midia`, E POR QUE ISSO NAO E CIRCULAR
-- =====================================================================
--
-- Uma URL assinada so e emitida se quem pede tiver `select` no objeto
-- (o Storage checa RLS na hora de assinar). Se a politica de leitura
-- virasse "so equipe", a galeria PUBLICA morreria: quem visita o site e
-- `anon`, e e o servidor do site, com a sessao de quem visita, que pede a
-- assinatura. Entao a condicao precisa ser exatamente a mesma que ja
-- governa a listagem:
--
--   existe uma linha em public.midia com este caminho, publicada e
--   autorizada
--
-- `storage.objects.name` e o caminho DENTRO do bucket, que e o mesmo valor
-- gravado em `public.midia.caminho` (ver `caminhoNoBucket` em
-- compartilhado/validacao.ts). Sao o mesmo texto, sem prefixo de bucket.
--
-- A subconsulta roda com as politicas de `public.midia` tambem aplicadas —
-- e isso e uma segunda tranca de graca, nao um problema: a politica de
-- `midia` ja e `(publicado and autorizacao_registrada) or eh_equipe()`, ou
-- seja, `anon` so ENXERGA a linha se ela puder ser vista. Nao ha recursao:
-- nenhuma politica de `public.midia` olha para `storage.objects`.
--
-- `anon` e `authenticated` ja tem `grant select on public.midia`
-- (002_conteudo.sql, ultima linha).
--
-- =====================================================================
-- O QUE ESTA MIGRATION **NAO** RESOLVE — e precisa estar escrito
-- =====================================================================
--
-- Uma URL assinada e um PORTADOR: quem tiver o link entra, ate ele vencer,
-- independente de quem seja. O prazo escolhido esta em
-- compartilhado/galeria-privada.ts (uma hora) com a conta que o justifica.
-- Consequencia pratica, em uma frase: depois de "Tirar do ar" ainda existe
-- uma janela de ate uma hora em que uma URL ja emitida continua servindo o
-- arquivo. Para o caso urgente da RN07 — autorizacao retirada, foto de
-- crianca subida por engano — quem resolve NA HORA continua sendo
-- "Apagar", que remove o arquivo do bucket e mata toda URL assinada viva
-- no mesmo instante.
--
-- =====================================================================
-- ESTA MIGRATION AINDA NAO FOI RODADA EM LUGAR NENHUM
-- =====================================================================
--
-- Nao existe chave `service_role` neste repositorio (spec 4.1), e alterar
-- `storage.buckets` e criar politica em `storage.objects` exige ser dono
-- do schema. Entao ninguem consegue aplicar isto pelo codigo do site: e
-- preciso uma pessoa colar este arquivo no SQL Editor do painel do
-- Supabase.
--
-- Enquanto isso nao acontecer, o site NAO QUEBRA — URL assinada funciona
-- em bucket publico tambem — e por isso a falta passaria despercebida.
-- Contra isso existe uma sonda: `bucketAindaAberto()` em
-- servidor/dados/galeria.ts bate no endereco publico e, se ele ainda
-- responder `NoSuchKey`, desenha um aviso permanente no topo de
-- /admin/galeria e grita no log do servidor. Quando esta migration for
-- aplicada, o aviso some sozinho.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. O bucket deixa de servir arquivo pelo endereco publico
-- ---------------------------------------------------------------------
update storage.buckets set public = false where id = 'galeria';

-- ---------------------------------------------------------------------
-- 2. A leitura sem condicao sai de cena — mas so para `galeria`
-- ---------------------------------------------------------------------
-- 006_storage.sql criou UMA politica cobrindo os tres buckets. Politicas
-- do Postgres se somam com OU: enquanto esta existir, qualquer politica
-- nova mais restritiva para `galeria` seria inutil, porque a permissiva
-- continuaria valendo ao lado. Por isso ela e derrubada e recriada sem
-- `galeria` — `acervo` e `identidade` ficam exatamente como estavam.
drop policy if exists "arquivos publicos: leitura" on storage.objects;

create policy "arquivos publicos: leitura"
  on storage.objects for select
  using (bucket_id in ('acervo', 'identidade'));

-- ---------------------------------------------------------------------
-- 3. `galeria`: le quem a RN07 deixa ler
-- ---------------------------------------------------------------------
-- O publico so alcanca o arquivo de uma foto que esta publicada E
-- autorizada. Foto guardada, foto sem autorizacao e foto tirada do ar
-- deixam de ter endereco alcancavel.
create policy "galeria: leitura do que esta no ar"
  on storage.objects for select
  using (
    bucket_id = 'galeria'
    and exists (
      select 1
      from public.midia
      where public.midia.caminho = storage.objects.name
        and public.midia.publicado
        and public.midia.autorizacao_registrada
    )
  );

-- A equipe continua vendo tudo — e precisa: /admin/galeria mostra a
-- miniatura de cada foto, inclusive das que estao guardadas e das que nem
-- podem ir ao ar, porque e olhando a foto que a pessoa decide se apaga.
create policy "galeria: equipe le tudo"
  on storage.objects for select
  using (bucket_id = 'galeria' and public.eh_equipe());

-- ############ 009_imagem_na_atividade.sql ############
-- =====================================================================
-- 009 — Imagem na atividade (pedido V1, 02/09/2026)
--
-- "Colocar imagens dos projetos."
--
-- `public.publicacoes` ja tinha `imagem_caminho` e `imagem_alt` desde
-- 002_conteudo.sql; `public.atividades` nao. Esta migration acrescenta as
-- MESMAS duas colunas, com a MESMA constraint — para que as duas telas do
-- painel se comportem igual e ninguem precise lembrar de qual e' qual.
--
-- ---------------------------------------------------------------------
-- NENHUMA POLITICA DE STORAGE MUDA, E ISSO E' O PONTO
-- ---------------------------------------------------------------------
--
-- A primeira versao desta migration criava uma politica nova em
-- `storage.objects`, porque supunha que a capa iria para o bucket
-- `galeria`. Estava errada, e a premissa caiu ao ser verificada:
--
--   · `galeria` e' PRIVADO desde a 008. Num bucket privado o endereco
--     publico nao existe — nem com politica; so' URL assinada, que vence
--     em uma hora. Uma capa de projeto assinada obrigaria /projetos a
--     gastar uma requisicao de assinatura por carregamento;
--   · `identidade` ja e' PUBLICO (006_storage.sql), a 008 NAO o tocou
--     (ela isolou so' `galeria`), e ele foi criado exatamente para isto:
--     material institucional da ONG.
--
-- Entao a capa vai para `identidade`, e este arquivo so' acrescenta duas
-- colunas. Nenhuma politica nova, nenhum risco de afrouxar a RN07 por
-- efeito colateral.
--
-- ---------------------------------------------------------------------
-- E A RN07? NAO SE APLICA AQUI, E A DISTINCAO IMPORTA
-- ---------------------------------------------------------------------
--
-- A RN07 protege FOTO DE PESSOA — o acervo de oficina, com criancas a
-- partir de 10 anos. Esse acervo mora em `public.midia`, no bucket
-- `galeria`, sob a politica da 008, que exige linha publicada E
-- autorizada.
--
-- A capa de uma atividade e' outra coisa: e' material institucional sobre
-- a PROPRIA atividade — cartaz, ilustracao, foto de cena de espetaculo. Se
-- um dia alguem quiser pos uma foto de crianca como capa, a regra continua
-- valendo pelo caminho de sempre: quem sobe responde pela autorizacao, e a
-- tela do painel diz isso com todas as letras.
--
-- ---------------------------------------------------------------------
-- NADA AQUI QUEBRA O QUE JA' EXISTE
-- ---------------------------------------------------------------------
--
-- As duas colunas nascem NULAS e sem default. As onze atividades que a ONG
-- entregou pelo seed continuam validas, sem imagem, e /projetos desenha o
-- cartao sem foto exatamente como hoje.
--
-- Enquanto esta migration NAO for rodada, o site tambem nao quebra: a
-- leitura pede as colunas com `?? null` e o formulario do painel nao
-- mostra o campo. O aviso vive no log e no CLAUDE.md, como o da 007.
--
-- ---------------------------------------------------------------------
-- O ALT E' OBRIGATORIO QUANDO HA' IMAGEM, E ISSO E' REGRA, NAO GOSTO
-- ---------------------------------------------------------------------
--
-- Mesma constraint de `publicacoes`. Acessibilidade e' requisito neste
-- projeto (regra 8), e imagem sem alt e' imagem que nao existe para quem
-- usa leitor de tela. Deixar isso a cargo da tela nao basta: Server Action
-- e' endpoint HTTP publico (spec §4.5), e o banco e' a ultima linha.
-- =====================================================================

alter table public.atividades
  add column if not exists imagem_caminho text,
  add column if not exists imagem_alt     text;

alter table public.atividades
  drop constraint if exists atividade_alt_obrigatorio_com_imagem;

-- `not valid` + `validate` num passo separado: com onze linhas o custo e'
-- zero, mas o padrao fica certo para o dia em que a tabela for grande.
alter table public.atividades
  add constraint atividade_alt_obrigatorio_com_imagem
  check (imagem_caminho is null or (imagem_alt is not null and length(trim(imagem_alt)) > 0))
  not valid;

alter table public.atividades
  validate constraint atividade_alt_obrigatorio_com_imagem;

comment on column public.atividades.imagem_caminho is
  'Caminho da capa no bucket `identidade`, que e publico (006_storage.sql). '
  'NAO e uma linha de public.midia: e material institucional sobre a propria '
  'atividade, e nao o acervo de fotos de oficina — esse fica em `galeria`, '
  'privado desde a 008, sob a RN07.';

-- ############ 010_inscricao_por_visitante.sql ############
-- =====================================================================
-- 010 — Inscricao em evento sem conta (RF15)
--
-- A FUNCAO IRMA QUE A 007 DEIXOU ANOTADA. Palavra por palavra, o que
-- estava escrito no fim de 007_limite_por_visitante.sql:
--
--     RF15 (inscricao em evento sem conta) vai precisar da funcao irma —
--     `registrar_inscricao(p_visitante, ...)`, com o mesmo `set_config` na
--     mesma transacao. Enquanto ela nao existir, `public.inscricoes`
--     continua com o balde por CABECALHO, ou seja, com o balde global de
--     hoje. Isso nao e um problema em aberto: nao existe uma linha de
--     codigo que insira em `inscricoes` nesta branch.
--
-- Passou a existir. `acoes/inscricoes.ts` insere, e por isso esta migration
-- deixou de ser opcional: sem ela o limite de `public.inscricoes` volta a
-- ser o balde por cabecalho, que neste desenho e SEMPRE o servidor — 30
-- inscricoes por hora para o site inteiro. O caminho de /para-escolas e
-- justamente uma turma se inscrevendo de um endereco so, e a 11a pessoa
-- fecharia o formulario para todo mundo (spec §4.6).
--
-- ESTA MIGRATION NAO CRIA TABELA E NAO MEXE EM POLITICA. Ela acrescenta
-- duas funcoes e nada mais. `public.inscricoes`, a RLS dela e o trigger
-- `limitar_inscricoes` de 005 continuam exatamente como estao.
--
-- ---------------------------------------------------------------------
-- POR QUE NAO PRECISOU MEXER EM `limitar_envios()`
-- ---------------------------------------------------------------------
--
-- A funcao de 007 ja le `app.origem_do_visitante` e ja separa o balde por
-- `tg_table_name`. Ou seja, ela e generica desde que foi escrita: basta
-- que quem insere em `inscricoes` defina a mesma configuracao na mesma
-- transacao, que e o que `registrar_inscricao` faz abaixo. O balde de
-- inscricoes e SEPARADO do de contatos (`origem, tabela`), entao a turma
-- que se inscreve num evento nao gasta nada do balde de mensagens.
-- =====================================================================

-- ---------------------------------------------------------------------
-- vagas_restantes() — quantas sobram, ou NULL quando o evento nao limita
--
-- SECURITY DEFINER, e aqui isso e OBRIGATORIO, nao preferencia. `anon` tem
-- `grant insert` em public.inscricoes e NENHUM select (003_eventos.sql):
-- uma contagem feita com os privilegios de quem chamou devolveria ZERO
-- para todo mundo, e a verificacao de vagas passaria SEMPRE, em silencio.
-- Uma trava que nunca dispara e pior que trava nenhuma, porque ninguem vai
-- procurar por ela.
--
-- O QUE ELA DEIXA VER, dito em voz alta: um numero. Quantas vagas restam
-- num evento publicado — nao quem se inscreveu, nao quantas pessoas ha na
-- lista de um evento que nao esta publicado. E informacao que qualquer
-- pagina de evento do mundo mostra, e que a agenda publica passa a mostrar
-- ("restam N vagas"). Nenhum dado pessoal atravessa esta funcao.
--
-- EVENTO QUE NAO EXISTE, QUE NAO ESTA PUBLICADO OU QUE JA ACABOU devolve
-- 0 — ou seja, "nao da para se inscrever". Devolver NULL nesses casos
-- (que e o valor de "sem limite") abriria inscricao em rascunho.
-- ---------------------------------------------------------------------
create or replace function public.vagas_restantes(p_evento_id uuid)
returns integer
language plpgsql
security definer
-- SEM `stable`, e a omissao e' deliberada: uma funcao STABLE recebe o
-- snapshot do statement que a chamou. Dentro de `reservar_vaga()`, logo
-- depois de o `for update` liberar, isso significaria contar sem enxergar a
-- inscricao que a outra transacao acabou de confirmar — ou seja, a corrida
-- voltaria por dentro da trava que existe para fecha-la. VOLATILE (o padrao)
-- reavalia a cada chamada. O custo e' uma contagem por chamada, que e' o que
-- se quer aqui.
set search_path = public
as $$
declare
  v_vagas    integer;
  v_fim      timestamptz;
  v_ocupadas integer;
begin
  select e.vagas, coalesce(e.termina_em, e.comeca_em)
    into v_vagas, v_fim
  from public.eventos e
  where e.id = p_evento_id and e.publicado;

  -- `not found` cobre os tres casos de uma vez: id inexistente, evento em
  -- rascunho, e id nulo.
  if not found then
    return 0;
  end if;

  -- Evento que ja terminou nao recebe inscricao. O corte e pelo FIM, e nao
  -- pelo comeco, de proposito: quem chega atrasado a uma oficina de duas
  -- horas ainda participa, e uma inscricao recusada na porta seria uma
  -- pessoa mandada embora por causa do relogio.
  if v_fim < now() then
    return 0;
  end if;

  -- Sem limite declarado, sem limite. NULL e o valor de "ilimitado" em
  -- toda a cadeia — a coluna aceita nulo (`check (vagas is null or vagas >
  -- 0)`), esta funcao devolve nulo, e o site escreve "vagas abertas" em vez
  -- de um numero.
  if v_vagas is null then
    return null;
  end if;

  select count(*) into v_ocupadas
  from public.inscricoes i
  where i.evento_id = p_evento_id;

  -- `greatest(..., 0)`: se um dia houver mais inscritos que vagas (o
  -- caminho de degradacao descrito em acoes/inscricoes.ts grava sem
  -- conferir), a resposta certa e "nenhuma", nunca um numero negativo
  -- desenhado na tela.
  return greatest(v_vagas - v_ocupadas, 0);
end;
$$;

-- ---------------------------------------------------------------------
-- reservar_vaga() — a mesma pergunta, com a linha do evento TRAVADA
--
-- POR QUE DUAS FUNCOES PARA UMA CONTA SO. `vagas_restantes()` responde uma
-- pergunta de LEITURA, e e chamada ao desenhar a pagina; travar a linha do
-- evento a cada visita seria serializar toda a agenda publica por nada.
-- Esta aqui e chamada UMA vez, no instante de gravar, e existe por causa da
-- corrida:
--
--   duas pessoas enviam ao mesmo tempo o formulario do ultimo lugar;
--   as duas consultas contam N-1 ocupadas; as duas veem 1 vaga; as duas
--   gravam. O evento fica com uma pessoa a mais do que cabe na sala.
--
-- E a mesma corrida que CLAUDE.md descreve para a candidatura duplicada da
-- RF25 — e ali ela ficou EM ABERTO, porque fechar exigia migration. Esta E
-- a migration, entao aqui ela fecha: o `for update` na linha do evento faz
-- a segunda requisicao esperar a primeira terminar antes de contar.
--
-- O `for update` mora DENTRO de uma funcao `security definer` porque
-- travar linha exige privilegio que `anon` nao tem em `public.eventos`
-- (ele so tem `grant select`).
--
-- A TRAVA DURA ATE O FIM DA TRANSACAO, que e a chamada da funcao mais o
-- insert que vem logo depois — microssegundos. Ela serializa apenas as
-- inscricoes DO MESMO EVENTO; dois eventos diferentes nao se esperam.
-- ---------------------------------------------------------------------
create or replace function public.reservar_vaga(p_evento_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existe boolean;
begin
  -- Trava a linha do evento. Quem chegar depois espera aqui.
  select true into v_existe
  from public.eventos e
  where e.id = p_evento_id and e.publicado
  for update;

  -- TRES RESPOSTAS, E NAO DUAS, porque "este evento nao aceita inscricao" e
  -- "este evento lotou" mandam a pessoa fazer coisas diferentes: a primeira
  -- e' um endereco velho ou um evento que ja aconteceu, e a segunda e' um
  -- convite a olhar a agenda de novo mais tarde. Um booleano aqui obrigaria
  -- quem chama a adivinhar qual dos dois foi.
  if not found then
    return 'indisponivel';
  end if;

  -- Agora a contagem e confiavel: ninguem mais insere neste evento
  -- enquanto esta transacao nao terminar.
  if coalesce(public.vagas_restantes(p_evento_id), 1) > 0 then
    return 'ok';
  end if;

  -- `vagas_restantes` tambem devolve 0 para evento que ja terminou, e o
  -- desfecho e' o mesmo: nao da' para se inscrever. A tela publica nem
  -- oferece o formulario nesse caso (a agenda so lista o que ainda vem),
  -- entao quem chega aqui montou a requisicao a mao ou guardou a pagina
  -- aberta por dias.
  return 'lotado';
end;
$$;

-- ---------------------------------------------------------------------
-- registrar_inscricao() — a porta do formulario publico (RF15)
--
-- SECURITY INVOKER, pelo mesmo motivo escrito em `registrar_contato` (007):
-- ela roda com os privilegios de quem chamou, entao a RLS de
-- `public.inscricoes` continua valendo palavra por palavra. Quem precisa de
-- definer sao o trigger (que grava em `envios_recentes`) e as duas funcoes
-- de vaga acima (que CONTAM uma tabela cuja leitura e' negada) — e as tres
-- ja sao.
--
-- ---------------------------------------------------------------------
-- O QUE ELA NAO ACEITA DE FORA
-- ---------------------------------------------------------------------
--
-- Nao ha parametro para `id` nem para `criado_em`: os dois nascem de
-- `default` da coluna. E' a regra 6 do CLAUDE.md aplicada a esta tabela —
-- o insert e' escrito coluna por coluna, nunca a partir do corpo recebido.
--
-- `p_consentimento` NAO e' "corrigido" para true em lugar nenhum. Vindo
-- falso, o `check (consentimento_dados)` da tabela recusa a linha
-- (003_eventos.sql). A validacao do site recusa antes; esta e' a rede
-- embaixo dela, e ela precisa continuar sendo uma rede de verdade.
--
-- O MESMO VALE PARA `p_responsavel_*`: a constraint
-- `responsavel_obrigatorio_para_menor` (RN02) e' quem decide, e ela e' do
-- esquema. Se alguem montar um corpo com `eh_menor` verdadeiro e
-- responsavel vazio, quem recusa e' o Postgres.
--
-- ---------------------------------------------------------------------
-- POR QUE `returns text` E NAO `returns void`
-- ---------------------------------------------------------------------
--
-- `registrar_contato` devolve void porque o unico desfecho ruim dela e' uma
-- excecao. Aqui existe um desfecho que NAO e' erro e que a pessoa precisa
-- entender: o evento lotou. Levantar excecao para isso obrigaria a traduzir
-- um SQLSTATE inventado, e o P0001 ja esta ocupado pelo limite de envios —
-- a pessoa que tentou se inscrever num evento cheio leria "muitas mensagens
-- deste ponto de acesso", que nao tem nada a ver.
--
-- NADA DA LINHA GRAVADA VOLTA, e isso continua igual a 007: `anon` tem
-- `grant insert` e NENHUM select em `public.inscricoes` (003_eventos.sql).
-- O texto devolvido e' uma das tres palavras fechadas abaixo, nunca dado.
-- ---------------------------------------------------------------------
create or replace function public.registrar_inscricao(
  p_visitante            text,
  p_evento_id            uuid,
  p_nome                 text,
  p_email                text,
  p_consentimento        boolean,
  p_telefone             text default null,
  p_cpf                  text default null,
  p_eh_menor             boolean default false,
  p_responsavel_nome     text default null,
  p_responsavel_telefone text default null,
  p_autoriza_imagem      boolean default false
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_origem text;
  v_vaga   text;
begin
  -- O que nao for um SHA-256 em hexadecimal e' tratado como "nao sei quem
  -- e'": todos os envios sem origem identificavel compartilham um balde so.
  -- Identico a `registrar_contato`, e de proposito — duas regras de origem
  -- no mesmo banco divergiriam.
  v_origem := case
    when p_visitante ~ '^[0-9a-f]{64}$' then p_visitante
    else encode(sha256(convert_to('desconhecida', 'UTF8')), 'hex')
  end;

  -- `is_local => true`: vale so ate o fim desta transacao. E' o que
  -- `limitar_envios()` (007) le para saber de quem e' o balde. Sem esta
  -- linha, o trigger cai no caminho do cabecalho — que neste desenho e'
  -- sempre este servidor, ou seja, um balde global.
  perform set_config('app.origem_do_visitante', v_origem, true);

  -- A VAGA E' CONFERIDA ANTES DO INSERT, com a linha do evento travada.
  -- Ver `reservar_vaga` acima.
  v_vaga := public.reservar_vaga(p_evento_id);
  if v_vaga <> 'ok' then
    return v_vaga;
  end if;

  -- Coluna por coluna. Campos de texto vazios viram NULL e nao string
  -- vazia: as colunas aceitam nulo, e a tela da equipe omite o que e' nulo
  -- (regra 2 do CLAUDE.md aplicada a campo). Um telefone de responsavel
  -- gravado como '' passaria pela constraint de RN02 se ela olhasse so
  -- nulidade — ela olha `length(trim(...)) > 0` justamente por isso.
  insert into public.inscricoes
    (evento_id, nome, email, telefone, cpf, eh_menor,
     responsavel_nome, responsavel_telefone, autoriza_imagem, consentimento_dados)
  values
    (p_evento_id,
     p_nome,
     p_email,
     nullif(btrim(coalesce(p_telefone, '')), ''),
     nullif(btrim(coalesce(p_cpf, '')), ''),
     coalesce(p_eh_menor, false),
     nullif(btrim(coalesce(p_responsavel_nome, '')), ''),
     nullif(btrim(coalesce(p_responsavel_telefone, '')), ''),
     coalesce(p_autoriza_imagem, false),
     coalesce(p_consentimento, false));

  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------
-- Permissoes
--
-- A inscricao e' PUBLICA (RF15, decisao D4: reduzir atrito importa mais que
-- historico individual). `anon` precisa executar as tres funcoes, e ja
-- tinha `grant insert` na tabela (003_eventos.sql) — nada de novo se abre
-- aqui.
--
-- `revoke all ... from public` primeiro porque funcao nasce executavel por
-- PUBLIC no Postgres: sem isto, "quem pode executar" ficaria implicito, e a
-- lista explicita abaixo nao seria a lista de verdade. Isso pesa mais nas
-- duas `security definer`: elas CONTAM uma tabela cuja leitura e' negada.
-- ---------------------------------------------------------------------
revoke all on function public.vagas_restantes(uuid) from public;
revoke all on function public.reservar_vaga(uuid) from public;
revoke all on function public.registrar_inscricao(
  text, uuid, text, text, boolean, text, text, boolean, text, text, boolean) from public;

grant execute on function public.vagas_restantes(uuid) to anon, authenticated;
grant execute on function public.reservar_vaga(uuid) to anon, authenticated;
grant execute on function public.registrar_inscricao(
  text, uuid, text, text, boolean, text, text, boolean, text, text, boolean)
  to anon, authenticated;

-- ############ 011_envios_de_email.sql ############
-- =====================================================================
-- 011 — Registro de envios de e-mail (RF18, RF20, RF28)
--
-- A spec §9 desenhou a Edge Function `enviar-email` e disse o essencial:
--
--     Ela NAO CONFIA NO PAYLOAD: recebe apenas o identificador do
--     registro, busca os dados no banco e monta a mensagem. Sem isso, o
--     endereco da funcao seria um formulario aberto para enviar e-mail em
--     nome da ONG.
--
-- O que ela nao disse, e esta migration resolve: ONDE fica o registro do
-- que foi enviado. Sem tabela, tres coisas ficam impossiveis:
--
--   1. NAO REENVIAR. Uma confirmacao de inscricao mandada duas vezes faz a
--      pessoa achar que se inscreveu duas vezes — e ligar para a ONG para
--      desfazer uma das duas, que nao existe;
--   2. SABER QUE FALHOU. Envio de e-mail falha em silencio por natureza:
--      quem nao recebeu nao reclama, porque nao sabe que devia receber.
--      Sem registro, a ONG so descobriria numa oficina vazia;
--   3. PRESTAR CONTAS. RF28 manda mensagem para um GRUPO, e "para quem foi
--      isso?" e' pergunta de auditoria, nao de curiosidade.
--
-- ---------------------------------------------------------------------
-- O ENDERECO NAO E' GRAVADO — SO' O HASH
-- ---------------------------------------------------------------------
--
-- Mesma disciplina de `envios_recentes` (005/007), e pelo mesmo motivo:
-- o e-mail da pessoa ja' esta' na tabela de origem (`inscricoes`,
-- `doacoes`), ligado a ela pela chave estrangeira. Copia-lo para ca'
-- criaria um SEGUNDO lugar com dado pessoal, que a promessa de exclusao
-- de /privacidade teria de lembrar de limpar — e nao lembraria.
--
-- O hash serve para a unica pergunta que este registro precisa responder
-- sem abrir a outra tabela: "ja' mandei para esta pessoa?".
-- =====================================================================

create table public.envios (
  id             uuid primary key default gen_random_uuid(),

  -- O QUE FOI ENVIADO. Lista fechada, e ela e' a mesma do `case` da Edge
  -- Function — divergindo, um envio novo entraria com um tipo que nenhuma
  -- tela sabe ler.
  tipo           text not null check (tipo in ('inscricao', 'doacao', 'aviso')),

  -- QUAL REGISTRO. `uuid` sem foreign key DE PROPOSITO: as tres origens
  -- estao em tabelas diferentes (`inscricoes`, `doacoes`, e o RF28 nao tem
  -- tabela de origem nenhuma — o "grupo" e' uma consulta). Uma FK exigiria
  -- tres colunas, duas sempre nulas.
  --
  -- A CONSEQUENCIA, dita em voz alta: apagar uma inscricao NAO apaga o
  -- registro do envio. E' o certo — o e-mail foi mandado, e isso continua
  -- verdade depois. Para o RF28 esta coluna e' nula.
  referencia_id  uuid,

  -- PARA QUEM, sem guardar para quem. Ver o cabecalho.
  destinatario   text not null,

  -- COMO TERMINOU. 'enviado' e' o unico desfecho bom; os outros dois sao o
  -- que a ONG precisa VER.
  situacao       text not null default 'enviado'
                 check (situacao in ('enviado', 'falhou', 'recusado')),

  -- O que o provedor respondeu quando falhou. Texto livre, do Resend —
  -- NUNCA o corpo do e-mail, que carregaria o dado pessoal de volta.
  erro           text,

  criado_em      timestamptz not null default now()
);

-- A TRAVA CONTRA REENVIO, e ela e' um indice, nao codigo.
--
-- Codigo que consulta antes de gravar perde a corrida de duas chamadas
-- simultaneas — e' a mesma corrida que a candidatura duplicada da RF25
-- deixou em aberto, e que a 010 fechou com um `for update`. Aqui o jeito
-- barato e' um indice unico PARCIAL: so' vale para o que deu certo, entao
-- um envio que FALHOU pode ser tentado de novo.
--
-- `where referencia_id is not null` porque o RF28 (aviso para grupo) nao
-- tem referencia: mandar dois avisos diferentes para a mesma pessoa e' o
-- uso normal daquele requisito, nao um defeito.
create unique index envios_sem_repetir
  on public.envios (tipo, referencia_id, destinatario)
  where referencia_id is not null and situacao = 'enviado';

create index envios_criado_em_idx on public.envios (criado_em desc);

alter table public.envios enable row level security;

-- ---------------------------------------------------------------------
-- RLS: so' a equipe LE, e ninguem do site ESCREVE
--
-- Quem escreve aqui e' a Edge Function, com a service role — que ignora
-- RLS por construcao. Por isso NAO existe politica de insert: nao ha' um
-- unico caminho pelo qual `anon` ou `authenticated` gravem nesta tabela,
-- e e' assim que precisa continuar. Um insert aberto aqui deixaria
-- qualquer pessoa marcar um envio como feito, e a trava contra reenvio
-- viraria uma trava contra ENVIAR.
-- ---------------------------------------------------------------------
create policy "envios: so a equipe le"
  on public.envios for select
  using (public.eh_equipe());

-- `anon` nao recebe nada. `authenticated` recebe SELECT, e quem filtra e'
-- a politica acima — a mesma divisao de trabalho do resto do schema: o
-- grant decide se pode tentar, a politica decide o que volta.
grant select on public.envios to authenticated;

-- ############ 012_avisos.sql ############
-- =====================================================================
-- 012 — Mural de avisos (RF27) e mensagem para grupo (RF28)
--
-- ---------------------------------------------------------------------
-- POR QUE UMA TABELA NOVA, E NAO UMA COLUNA EM `publicacoes`
-- ---------------------------------------------------------------------
--
-- O caminho barato seria acrescentar `interno boolean` a `public.
-- publicacoes` e filtrar. Foi recusado, e o motivo esta MEDIDO: a politica
-- daquela tabela e' `using (publicado or public.eh_equipe())`, e um
-- anonimo com a chave publicavel LE tudo que tem `publicado = true`
-- (HTTP 200, conferido em 01/09/2026).
--
-- Ou seja: reaproveitar `publicacoes` faria a seguranca da comunicacao
-- INTERNA depender de um `and not interno` escrito certo em toda consulta
-- e em toda politica, para sempre. Um esquecimento publicaria na internet
-- aberta um aviso escrito para dentro da equipe — e ninguem veria, porque
-- nada quebra.
--
-- Tabela separada, politica separada: o pior caso de um erro aqui e' um
-- aviso que ninguem le, nao um aviso que todo mundo le.
--
-- ---------------------------------------------------------------------
-- UMA TABELA SERVE OS DOIS REQUISITOS, E ISSO E' DESENHO
-- ---------------------------------------------------------------------
--
-- RF27 quer um MURAL que voluntario le no site. RF28 quer MANDAR uma
-- mensagem para um grupo. E' o mesmo texto: a ONG escreve o aviso uma vez,
-- ele fica no mural, e um botao separado o manda por e-mail.
--
-- Isso tambem e' o que faz o RF28 caber na regra da Edge Function (spec
-- §9): ela nao aceita texto no payload, so' um identificador. Com o aviso
-- ja' gravado, o que viaja e' o `id` — e a funcao busca o corpo aqui.
-- =====================================================================

-- ---------------------------------------------------------------------
-- eh_voluntario_ativo() — quem enxerga o mural
--
-- ESPELHA `public.eh_equipe()` (001_base.sql) linha por linha: `stable`,
-- `security definer`, `search_path = public`. O definer e' o que evita a
-- recursao — sem ele, uma politica em `voluntarios` que consultasse
-- `voluntarios` estouraria com "stack depth limit exceeded", que e' o
-- defeito que `eh_equipe` ja' teve de resolver.
--
-- 'ativo' E NAO 'novo', E ESTA E' A DECISAO DESTA MIGRATION.
--
-- `public.voluntarios.situacao` tem quatro valores ('novo', 'em_contato',
-- 'ativo', 'inativo'). O escopo pede o mural "visivel para voluntarios
-- autenticados", e a leitura honesta disso e' quem JA' E' voluntario — nao
-- quem acabou de mandar o formulario.
--
-- A diferenca importa: `/voluntariado/candidatura` e' publica e qualquer
-- pessoa com conta se candidata. Se 'novo' contasse, bastaria preencher um
-- formulario para passar a ler a comunicacao interna da ONG.
--
-- O PRECO, dito em voz alta: um aviso novo NAO alcanca ninguem ate a
-- equipe promover alguem a 'ativo' em /admin/voluntarios — o que ja' e' um
-- toque naquela tela, e ja' e' o gesto que significa "esta pessoa entrou".
-- ---------------------------------------------------------------------
create or replace function public.eh_voluntario_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.voluntarios v
    where v.perfil_id = auth.uid() and v.situacao = 'ativo'
  );
$$;

revoke all on function public.eh_voluntario_ativo() from public;
-- `anon` NAO recebe: sem sessao, `auth.uid()` e' nulo e a resposta seria
-- sempre falsa — mas conceder execucao a quem nao tem conta convidaria a
-- usar esta funcao como se ela fosse publica em alguma politica futura.
grant execute on function public.eh_voluntario_ativo() to authenticated;

-- ---------------------------------------------------------------------
-- avisos (RF27, RF28)
-- ---------------------------------------------------------------------
create table public.avisos (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  corpo        text not null,

  -- COMO EM `publicacoes` E AO CONTRARIO DE `atividades`: nasce FALSE.
  -- Escrever nao e' publicar, e num mural interno o descuido poe algo na
  -- frente de gente que ainda nao devia ver.
  publicado    boolean not null default false,

  -- Carimbada ao publicar, e SO' se ainda for nula (corrigir e republicar
  -- nao e' republicar). Ao tirar do ar ela FICA — e' um fato, e apaga-la
  -- seria destruir informacao num gesto sem desfazer. Mesma regra de
  -- `publicacoes`.
  publicado_em timestamptz,

  criado_em    timestamptz not null default now()
);

create index avisos_publicado_em_idx on public.avisos (publicado_em desc nulls last);

alter table public.avisos enable row level security;

-- A POLITICA DE LEITURA, e ela e' a razao desta migration existir.
--
-- Repare no que NAO esta aqui: nenhuma forma de `publicado` sozinho. Um
-- aviso publicado continua invisivel para quem nao e' voluntario ativo nem
-- equipe. E' o oposto de `publicacoes`, onde `publicado` significa "o
-- mundo ve".
create policy "avisos: voluntario ativo e equipe leem"
  on public.avisos for select
  using ((publicado and public.eh_voluntario_ativo()) or public.eh_equipe());

create policy "avisos: equipe gerencia"
  on public.avisos for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- Permissoes
--
-- `anon` NAO RECEBE NADA, nem select. E' a primeira trava, antes da RLS:
-- mesmo que a politica acima fosse reescrita errada um dia, o papel
-- anonimo nao teria o privilegio de tentar. E' a mesma disciplina de
-- `inscricoes` (003) e `doacoes`.
-- ---------------------------------------------------------------------
grant select on public.avisos to authenticated;
grant insert, update, delete on public.avisos to authenticated;

-- ############ 013_service_role.sql ############
-- =====================================================================
-- 013 — Os privilegios que faltavam ao `service_role` (RF18, RF20, RF28)
--
-- MEDIDO em 03/09/2026, contra o projeto de producao, com a chave
-- `service_role` na mao: `select` em `inscricoes` responde
--
--     42501 permission denied for table inscricoes
--     hint: GRANT SELECT ON public.inscricoes TO service_role;
--
-- e a mesma coisa em `eventos`, `doacoes`, `perfis`, `avisos`,
-- `voluntarios` e `envios`. As SETE. Ou seja: o `service_role` deste
-- projeto nao enxergava uma linha de tabela nenhuma.
--
-- ---------------------------------------------------------------------
-- POR QUE ISSO PASSOU DESPERCEBIDO ATE' AGORA
-- ---------------------------------------------------------------------
--
-- Duas coisas se somaram, e nenhuma das duas da erro visivel:
--
--   1. TODA migration deste projeto concede privilegio NOMINALMENTE, a
--      `anon` e a `authenticated`, e nunca a `service_role` — porque
--      ate' a 011 nao existia uma linha de codigo que usasse a service
--      role (spec 4.1: "nao existe service_role neste repositorio"). A
--      Edge Function foi o primeiro uso, e ela nasceu depois das tabelas;
--
--   2. o `service_role` IGNORA a RLS, e e' facil ler isso como "ele passa
--      por cima de tudo". Nao passa: `grant` vem ANTES da politica, e e'
--      exatamente a trava que o resto do projeto usa de proposito (o
--      comentario de 003_eventos.sql diz isso sobre `anon`). A mesma
--      trava que protege a tabela de `anon` estava trancando a funcao.
--
-- O sintoma era um e-mail que nunca chegava, com a funcao respondendo
-- `registro_nao_encontrado` para um registro que EXISTE — e o Postgres
-- nao conta que a causa foi privilegio: ele responde `permission denied`,
-- que a funcao lia como "nao achei". Ver `papelDaChave()` em
-- `supabase/functions/enviar-email/index.ts`, que foi escrita para nunca
-- mais precisar medir isso por fora.
--
-- ---------------------------------------------------------------------
-- POR QUE NOMINAL, E NAO `grant all on all tables`
-- ---------------------------------------------------------------------
--
-- Um projeto Supabase de fabrica traz `alter default privileges ... grant
-- all on tables to anon, authenticated, service_role`. Este aqui nao tem
-- isso valendo, e o resultado — sem querer — foi melhor: o que a service
-- role alcanca e' o que esta escrito, e esta escrito aqui.
--
-- Entao a lista abaixo e' EXATAMENTE o que a Edge Function consulta, e
-- nada mais. As cinco de `.from(...)`:
--
--     inscricoes   doacoes   avisos   voluntarios   envios
--
-- mais as DUAS que so' aparecem como embed do PostgREST — e que exigem
-- privilegio do mesmo jeito, porque viram `join`:
--
--     eventos (dentro de inscricoes)   perfis (dentro de doacoes e de
--                                              voluntarios)
--
-- `testes/avisos.test.mjs` reconcilia as duas pontas: toda tabela que a
-- funcao consulta precisa aparecer aqui, e o teste fica vermelho no dia
-- em que alguem acrescentar um `.from(` sem o grant. E' a mesma disciplina
-- das tres palavras de `registrar_inscricao` (010).
--
-- ---------------------------------------------------------------------
-- O QUE ELA NAO PODE ESCREVER
-- ---------------------------------------------------------------------
--
-- So' `envios` recebe `insert` e `update`, porque so' ela e' escrita pela
-- funcao (a reserva antes do envio, e o `situacao = 'falhou'` depois).
-- Nas outras seis o privilegio e' de LEITURA, e isso importa: a funcao
-- monta mensagem a partir de registro, ela nao corrige registro. Um
-- `update` em `inscricoes` vindo dali seria a ONG alterando o que uma
-- pessoa preencheu, sem tela e sem rastro.
--
-- `delete` nao aparece em lugar nenhum, nem em `envios`: o registro de
-- envio e' o que impede o reenvio (o indice unico parcial de 011). Uma
-- funcao que pudesse apagar dali poderia mandar o mesmo e-mail de novo.
-- =====================================================================

-- Leitura: as sete tabelas que a Edge Function precisa enxergar.
grant select on public.inscricoes  to service_role;
grant select on public.eventos     to service_role;
grant select on public.doacoes     to service_role;
grant select on public.perfis      to service_role;
grant select on public.avisos      to service_role;
grant select on public.voluntarios to service_role;
grant select on public.envios      to service_role;

-- Escrita: so' o registro do proprio envio.
grant insert, update on public.envios to service_role;

-- A funcao `eh_voluntario_ativo()` (012) e' consultada pela POLITICA de
-- `avisos`, e nao por esta chave — o `service_role` ignora RLS, entao a
-- politica nem chega a ser avaliada. Fica anotado para quem vier
-- procurar: nao falta grant de funcao aqui.

-- ############ seed.sql ############
-- =====================================================================
-- Seed — conteudo real do Ateliê Afro Cultural
--
-- GERADO por ferramentas/gerar-seed.mjs a partir de
-- dados-iniciais/*.json. Nao editar a mao: edite o JSON e
-- rode o gerador de novo, para as duas fontes nao divergirem.
-- =====================================================================

insert into public.areas_voluntariado (id, nome, descricao, ordem) values
  ('apoio-pedagogico', 'Apoio pedagógico e oficinas', 'Reforço escolar, contação de histórias, oficinas de percussão, dança, turbantes e artes manuais.', 1),
  ('comunicacao', 'Comunicação e mídias', 'Fotos, vídeos, textos para redes sociais, divulgação de projetos e editais.', 2),
  ('producao-eventos', 'Produção de eventos', 'Montagem de exposições, recepção de público, feiras culturais, apresentações.', 3),
  ('acervo', 'Organização de acervo', 'Catalogação de livros, roupas, instrumentos musicais, fantasias e peças de memória ancestral.', 4),
  ('administrativo', 'Apoio administrativo', 'Captação de recursos, planejamento de projetos, atendimento à comunidade.', 5)
on conflict (id) do nothing;

insert into public.atividades (id, titulo, resumo, descricao, genero, duracao, elenco, classificacao, local, rider, publicado) values
  ('banzo', 'Banzo', 'Contação de história performática sobre o banzo — a saudade da pátria e da liberdade sentida pelos africanos escravizados.', 'Contação de história performática que, através da legitimação, valorização e conscientização da história dos negros no Brasil, propõe diálogos e interações com o público, buscando difundir uma arte negra contemporânea, com raízes e práticas afetivas e ancestrais através de fragmentos de imaginários negros, tendo como ponto de partida o BANZO — nome dado ao sentimento de nostalgia, tristeza e saudade de sua pátria, costumes familiares e principalmente de sua liberdade, que os negros africanos escravizados sentiam ao serem tirados de seu país de origem.

A presença performática do artista negro Wil Oliveira em cena, com suas marcas, elementos e experiências diaspóricas, onde suas histórias e corpo são discursos e memórias de extrema potência, tanto estética quanto social.', 'Contação de história performática', '50 minutos', 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', '1 caixa de som · 1 microfone com ou sem fio', true),
  ('catirina-e-nego-dito', 'Catirina e Nego Dito', 'Contação performática com fantoches e música ao vivo, a partir da história do auto do boi.', 'Apresentação artística com fantoches e música ao vivo, que conta a lendária história de dois personagens da cultura popular brasileira, Catirina e Francisco, figuras presentes nas manifestações artísticas conhecidas como auto do boi. A história ganha vida e é conduzida através de cantigas dos "boiadeiros", seres e divindades de luz pertencentes às religiões de matrizes africanas.

Catirina e Nego Dito são um casal de escravizados que vivem em uma fazenda no sertão. Grávida, Catirina sente o desejo de comer a língua do boi mais bonito do dono da fazenda. Para satisfazer o desejo de sua mulher, Nego Dito rouba o boi preferido, mata o animal e retira a língua para que sua esposa possa comê-la. O coronel fica sabendo do roubo e parte em busca do casal, jurando vingança. No fim, os personagens conseguem ressuscitar o boi e, como agradecimento, o dono da fazenda promove uma festa.

A apresentação retrata diferentes visões sobre o boi e ressalta sua importância: para os escravizados e trabalhadores rurais, companheiro de trabalho e sinônimo de força; para os proprietários de fazendas, investimento e fonte de renda; nas religiões de matrizes africanas, divindade de luz que representa esperança, proteção, justiça e prosperidade; e na cultura popular brasileira, símbolo de resistência.

Conta com fantoches de personagens negros, tecidos de chita, tambores, cantigas, figurinos e cenário, de modo a contribuir para a valorização e expansão da cultura e ancestralidade negra.', 'Contação performática de histórias (fantoches)', '50 minutos', 'Wil Oliveira (narrador, cantor e músico) · Davi Santos (bonequeiro)', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('cafu-e-o-cafe', 'Cafú e o Café', 'Contação de história que leva o público às fazendas de café do Vale do Paraíba do século XIX.', 'Ao entrar em contato com a contação de histórias "Cafú e o Café", o público encontrará, através de uma linguagem acessível e simples, algumas memórias da cultura afro-brasileira, em especial a contribuição que a cultura africana forneceu ao Brasil.

A história convida a uma viagem ao tempo, de maneira descontraída e dinâmica. As narrativas conduzem até as fazendas de café do Vale do Paraíba do século XIX. A história central gira em torno de situações de preconceito racial, através de bullying no ambiente escolar.

"Cafú e o Café" foi escrita e ilustrada pelo artista, ator, arte-educador e escritor Wil Oliveira.', 'Contação de história', '50 minutos', 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', '1 caixa de som · 1 microfone headset', true),
  ('brincadeiras-encantadas-na-mata', 'Brincadeiras Encantadas na Mata', 'História-brincante em que crianças e adultos entram numa aventura de faz de conta pela mata.', 'Você já brincou na mata? Já desvendou os segredos e encantamentos que vivem sob as copas e galhos, atravessando rios e trilhas?

Nesta história-brincante, crianças e pessoas adultas são convidadas a uma aventura de faz de conta, interagindo com os elementos dispersos no espaço e despertando a imaginação. O Ateliê Afro Cultural conduz o percurso por meio de uma história com ações para as crianças seguirem, mesclando comandos, música, sons da mata e natureza, elementos sensoriais e brincadeiras.

Uma vivência destinada a (re)descobrir os brincares coletivos de imaginação ligados à natureza e aos quintais, explorando as sensações e o ambiente ao redor.

A ambientação e o cenário são construídos com chitas e elementos naturais como cabaças, palha sisal, pinhos, troncos de árvores e outros materiais, gerando uma ambientação colorida, lúdica, acolhedora e ancestral.', 'História-brincante interativa', 'A combinar', 'Wil Oliveira · Nathália (Nathy) Monteiro', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('projeto-brincantes', 'Projeto Brincantes', 'Vivência de resgate das brincadeiras da cultura popular afro-brasileira.', 'Pensando sobre a importância de resgatar brincadeiras populares, o "Projeto Brincantes" surge com o intuito de aproximar e espalhar arte e cultura afro-brasileira através de brincadeiras da nossa cultura popular. O projeto promove as atividades já enraizadas e as leva para outros espaços e lugares, com o objetivo de transformar relações e ambientes e, principalmente, propagar a cultura afro-brasileira através da arte brincante.

Nathy Monteiro e Wil Oliveira são um casal de artistas que juntos idealizaram o Projeto Brincantes. Somam habilidades artísticas como pesquisa acerca da cultura afro-brasileira, contação de histórias, brincantes de cultura popular, dança, música, atuação e escrita, sempre envolvendo a temática afro brasileira e a cultura popular.', 'Vivência de brincadeiras populares', null, 'Wil Oliveira · Nathália (Nathy) Monteiro', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('brasil-negreiro', 'Brasil Negreiro: Imaginário em Liberdade', null, null, 'Peça / contação', null, 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('a-cabaca-e-o-canto-ancestral', 'A Cabaça e o Canto Ancestral', null, null, 'Contação de história', null, 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('eu-griot', 'Eu Griot', null, null, 'Contação de história', null, 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('memoria-negra', 'Memória Negra', null, null, 'Contação de história', null, 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('batuque-na-cozinha', 'Batuque na Cozinha', null, null, 'Contação / vivência', null, 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('atelie-itinerante', 'Ateliê Afro Cultural Itinerante', 'Projeto de circulação que leva parte do acervo e do conhecimento produzido a outros espaços.', null, 'Projeto de circulação', null, null, 'Livre', 'Adaptável a qualquer espaço', null, true)
on conflict (id) do nothing;

insert into public.clipping (id, tipo, titulo, detalhe, ano, publicado) values
  ('folha-materia', 'midia', 'Folha de S.Paulo', 'Como o menino que era caixa de supermercado criou um ateliê para valorizar a cultura negra', null, true),
  ('globo-caldeirao', 'midia', 'Rede Globo — Caldeirão do Huck', 'Participação em rede nacional', 2021, true),
  ('globo-the-wall', 'midia', 'Rede Globo — The Wall', 'Participação no programa', 2021, true),
  ('sesc-interlagos', 'instituicao', 'SESC Interlagos', null, null, true),
  ('sesc-santo-amaro', 'instituicao', 'SESC Santo Amaro', null, null, true),
  ('fabricas-de-cultura', 'instituicao', 'Fábricas de Cultura', 'Jaçanã', null, true),
  ('casas-de-cultura', 'instituicao', 'Casas de Cultura de São Paulo', 'Inclui a Casa de Cultura São Rafael', null, true),
  ('teatro-adelia-lorenzetti', 'instituicao', 'Teatro Municipal Adélia Lorenzetti', null, null, true),
  ('pracas-da-cultura', 'instituicao', 'Praças da Cultura', 'Subprefeitura Pirituba/Jaraguá', null, true),
  ('espaco-malungo', 'instituicao', 'Espaço Malungo', null, null, true),
  ('ambev-campinas', 'instituicao', 'Ambev', 'Ação de Dia das Crianças, Campinas', 2021, true),
  ('igualdade-racial', 'instituicao', 'Subsecretaria de Igualdade Racial', 'II Festa Preta, Parque Bosque Maia', null, true),
  ('consciencia-negra', 'programacao', 'Mês da Consciência Negra', 'Programação recorrente', null, true),
  ('reexistencia', 'programacao', '(Re)Existência do Povo Negro', 'SESC', null, true)
on conflict (id) do nothing;
