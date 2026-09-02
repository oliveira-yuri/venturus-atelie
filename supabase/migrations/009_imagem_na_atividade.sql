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
