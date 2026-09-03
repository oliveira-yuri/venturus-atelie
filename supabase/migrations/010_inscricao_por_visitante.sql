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
