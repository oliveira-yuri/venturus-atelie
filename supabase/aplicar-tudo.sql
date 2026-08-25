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

-- ############ seed.sql ############
-- =====================================================================
-- Seed — conteudo real do Ateliê Afro Cultural
--
-- GERADO por ferramentas/gerar-seed.mjs a partir de
-- site/assets/dados-iniciais/*.json. Nao editar a mao: edite o JSON e
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
