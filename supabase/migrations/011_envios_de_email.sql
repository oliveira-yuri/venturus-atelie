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
