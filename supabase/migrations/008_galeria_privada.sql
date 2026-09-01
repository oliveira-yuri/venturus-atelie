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
