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
