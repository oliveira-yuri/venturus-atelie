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
