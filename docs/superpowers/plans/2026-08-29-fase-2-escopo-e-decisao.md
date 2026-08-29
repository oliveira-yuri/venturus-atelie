# Fase 2 — escopo, estimativas e a decisão que cabe ao grupo

Data: 29/08/2026 · faltam **6 dias** para 04/09
Fase 1 encerrada: `docs/superpowers/plans/2026-08-28-resultado-do-portao.md` (GO)

Este documento não é um plano de tarefas. É o material para o grupo decidir **o que
entra até 04/09**, porque o que falta não cabe. Depois da decisão, escrevo o plano
tarefa a tarefa só do que for escolhido.

## A distinção que muda tudo

O que falta se divide em duas coisas de naturezas diferentes, e misturá-las é o que
faz o prazo parecer possível:

**Bloco A — terminar a migração.** Levar para o Next as 12 páginas que já existem e
funcionam em `main`. É trabalho conhecido: as 3 primeiras já foram feitas, o padrão
está estabelecido, e há teste de paridade de texto que compara cada página com o
original. **Risco baixo, escopo medido.**

**Bloco B — construir o que nunca existiu.** Painel administrativo, autenticação
funcionando, doações, candidatura de voluntário, relatórios. Isto **não é migração**:
são os requisitos que já estavam como "falta" no `CLAUDE.md` antes de qualquer decisão
sobre Next.js. **Risco alto, escopo grande, e nada disso existe em `main` para servir
de referência.**

## Bloco A — terminar a migração

| # | O quê | Estimativa | Depende de |
|---|---|---|---|
| A1 | `app/not-found.tsx` já existe; reapontar `links.test.mjs` e `sem-javascript.test.mjs` para o app novo (prometido na spec §6.2, não feito na fase 1) | 2 h | — |
| A2 | Home (RF01) — é hoje uma casca de um `<h1>`; precisa dos cartões, dos setores, da prova social | 3 h | — |
| A3 | `contato` (RF06) e `entrar` — páginas com formulário, sem envio ainda | 3 h | — |
| A4 | `projetos` (RF03) — 11 atividades do banco, com a ficha técnica | 3 h | camada de dados ✅ |
| A5 | `agenda`, `noticias`, `galeria`, `acervo` (RF14, RF04, RF05, RF35) — páginas prontas, sem dados | 4 h | — |
| A6 | `voluntariado` (RF24) e `doar` (RF23) | 3 h | — |
| A7 | `recuperar-acesso` + os 15 redirects de `.html` para rota limpa | 2 h | — |
| A8 | Aposentar `site/`, resolver as duas pastas `dados-iniciais/`, reativar os 3 `test.todo` | 3 h | A1–A7 |
| | **Total do bloco A** | **~23 h** | |

Ao fim do bloco A, a versão Next **iguala** o site que está no ar, com três garantias
a mais: o navegador não fala com o banco, há política de conteúdo medida, e o VLibras
traduz sob ela.

## Bloco B — o que nunca existiu

| # | O quê | Estimativa | Depende de |
|---|---|---|---|
| B1 | Auth com PKCE: `app/auth/confirm/route.ts`, sessão por cookie, guarda no middleware | 6 h | **dashboard do Supabase** ⚠ |
| B2 | Painel administrativo (RF33): 7 telas que **não existem em lugar nenhum** | 16 h | B1 |
| B3 | Eventos (RF13, RF15–RF18): cadastro, inscrição sem conta, presença, e-mail | 14 h | B1, Brevo ⚠ |
| B4 | Doações e voluntariado (RF19–RF22, RF25, RF26) | 12 h | B1 |
| B5 | Comunicação e relatórios (RF27–RF32) | 10 h | B1 |
| B6 | Migration 007 — rate limit por visitante (hoje vira balde global no desenho novo) | 3 h | — |
| B7 | Guardião de deploy: os itens levantados na revisão final | 2 h | — |
| | **Total do bloco B** | **~63 h** | |

## A conta

**23 h + 63 h = 86 h em 6 dias.** Isso é ~14 h por dia, todos os dias, sem erro e sem
revisão — e a fase 1 mostrou que a revisão é o que impediu três defeitos críticos de
chegar a produção.

**O bloco A cabe.** O bloco B não cabia antes da migração e não cabe agora; a decisão
de migrar não criou esse problema, apenas não o resolveu.

## Dependências que não são de código

Estas **bloqueiam** e não dependem de quem programa:

1. **Dashboard do Supabase** — confirmar fluxo PKCE e trocar o template de e-mail para
   `token_hash`. **Sem isso o bloco B1 não anda, e sem B1 nada de B2 a B5 anda.**
   Pedido feito em 28/08, sem resposta.
2. **SMTP do Brevo** — o limite de e-mail nativo do Supabase bloqueia todo cadastro.
   Trava anterior à migração, ainda de pé.
3. **Conta de administrador** — criar pelo painel e promover com
   `update public.perfis set eh_equipe = true where email = '...'`.
4. **Publicar a branch** — o pipeline da Netlify nunca rodou com a configuração nova.
5. **Decidir sobre o VLibras no painel** — a CSP usa `strict-dynamic`; quando o painel
   existir, o widget roda com confiança total na tela que mostra dados de crianças.

## Recomendação

**Fazer o bloco A inteiro e parar.** Entregar em 04/09 uma versão Next completa,
equivalente ao site atual, com as garantias novas — e manter `main` publicável até o
último minuto como rede.

Do bloco B, só o **B6** (rate limit) e o **B7** (guardião) cabem, e os dois são baratos
e independentes de dashboard. Os dois consertam defeitos que existem hoje.

A alternativa — começar o bloco B e não terminar — entrega um painel pela metade e 12
páginas não migradas, que é pior que qualquer um dos dois inteiros.

**Isso é recomendação, não decisão.** O grupo pode preferir mostrar um painel
incompleto a mostrar um site completo; é um julgamento sobre o que a banca valoriza, e
esse julgamento é de vocês.
