# Painel administrativo (RF33) — plano de implementação

> **Para quem executa:** use `superpowers:subagent-driven-development`. Uma tarefa por
> subagente, revisão entre elas.

**Objetivo:** dar à equipe da ONG uma área onde ela publica notícias, sobe fotos na
galeria e edita as atividades — sem passar por quem desenvolve.

**Spec:** `docs/superpowers/specs/2026-08-28-migracao-nextjs-design.md`
**Escopo do bloco:** `docs/superpowers/plans/2026-08-29-fase-2-escopo-e-decisao.md` (item B2)
**Requisito:** RF33 no `PLANO-PROJETO-ATELIE-AFRO-CULTURAL.md` §7

---

## Por que estas quatro telas, e não as sete do site antigo

A home do painel na `main` prometia seis telas que **nunca existiram**
(`eventos`, `presenca`, `contatos`, `mais`, `doacoes`, `publicacoes`). Este plano
constrói o mínimo que muda alguma coisa hoje:

| Rota | O quê | Destrava |
|---|---|---|
| `/admin` | "O que você quer fazer?" — só os caminhos | — |
| `/admin/publicacoes` | criar, editar, publicar/despublicar notícias | `/noticias`, hoje vazia |
| `/admin/galeria` | idem para mídia, com upload e autorização de imagem | `/galeria`, hoje vazia |
| `/admin/atividades` | editar as 11 atividades reais | RF03 ("edição pela equipe falta") |

Indicadores (RF30–RF32) ficam de fora: são outro requisito e o próprio escopo os
chama de "primeiro candidato a corte".

## Decisões tomadas antes de escrever isto

1. **VLibras CONTINUA em `/admin`** — decisão do dono do projeto, 31/08/2026, contra
   a recomendação registrada no item 0h do `CLAUDE.md`. O risco permanece e está
   à vista: a CSP usa `strict-dynamic`, que dá confiança em cadeia a tudo que o
   VLibras carregar, numa tela que mostra dado pessoal. Motivo de manter: tirar a
   tradução justo da tela de trabalho da equipe exclui quem usa Libras, e
   acessibilidade é requisito da ONG (regra 8). **Reescrever o item 0h** para
   registrar que virou decisão, não pendência.
2. **Upload de verdade na galeria**, via Supabase Storage — decisão do dono do
   projeto. O bucket `galeria` **já existe** (`006_storage.sql`), com leitura
   pública e escrita só para `eh_equipe()`. Nenhuma migration nova.
3. **A guarda fica no layout, não no middleware.** `middleware.ts` já é o maior
   risco de deploy (Edge Function na Netlify, nunca exercitada) e acabou de ganhar
   uma chamada de rede na Tarefa 4 da autenticação. Não empilhar mais nada lá.
4. **Quem não é equipe recebe 404, não "acesso negado".** Negar com explicação
   conta que o painel existe.

## Restrições globais

Valem para **todas** as tarefas. Cada uma vem de uma regra do `CLAUDE.md` ou de um
defeito real já ocorrido neste projeto.

- **Mobile-first não é preferência (regra 4).** A ONG não possui computador. Toda
  operação acontece no celular pessoal da equipe, muitas vezes de pé, no meio de um
  evento. Qualquer tela que só funcione bem em 1280px está errada.
- **Quem autoriza é a RLS, não a tela (regras 5 e 6).** O painel decide o que
  *desenhar*; o banco decide o que *pode*. `eh_equipe` nunca vem do cliente. Já
  houve escalada de privilégio real neste projeto, corrigida com trigger.
- **Server Action é endpoint HTTP público** (spec §4.5). Toda Action do painel
  revalida entrada **e** permissão, mesmo que a tela já tenha checado. Ler o
  `FormData` campo a campo por nome — nunca espalhar num objeto.
- **Nenhuma foto no ar sem autorização registrada (regra 9, RN07).** A política de
  `midia` é `(publicado and autorizacao_registrada) or eh_equipe()`. O formulário
  honra isso; não contorna.
- **Nunca inventar conteúdo (regra 2).** Sem lorem ipsum, sem notícia de exemplo.
  Texto funcional de formulário é permitido; conteúdo institucional, não.
- **Sem biblioteca nova (regra 7).** Nada de editor de texto rico, nada de
  componente de upload pronto, nada de framework de CSS.
- **Acessibilidade é requisito (regra 8).** Rótulo em todo campo, erro vinculado ao
  campo, resultado anunciado, foco levado ao erro. Nada de `vw` em texto.
- **Verificar olhando (regra 10).** Bateria verde não substitui abrir a página.
- **Degradação:** a política única de erro é `servidor/dados/degradacao.ts`. Nenhum
  módulo de dados lança para cima.
- Sem `NEXT_PUBLIC_`. O navegador nunca fala com o Supabase.

## O que não dá para provar hoje, e por quê

Não existe sessão utilizável: a conta `atelieafrocultural@admin.com` foi criada em
31/08/2026 mas ninguém entrou ainda, e o `eh_equipe` não foi concedido. **Todo o
painel fica atrás dessa sessão.** Cada tarefa mede o que dá sem ela — o caminho da
recusa, o HTML servido, a forma das Actions — e declara no relatório o que ficou
sem medir. Nenhuma tarefa afirma "funciona" sobre um caminho que não percorreu.

---

## Tarefa P1 — Fundação: guarda, home e estilo

**Arquivos:** criar `app/admin/layout.tsx`, `app/admin/page.tsx`, `estilos/admin.css`;
modificar `testes/redirects.test.mjs` (o teste que exige 404 em `/admin`),
`testes/apoio/rotas-migracao.mjs`, `CLAUDE.md` (item 0h e a tabela de status).

A guarda lê a sessão com `usuarioAtual()` (`servidor/sessao.ts`) e consulta
`eh_equipe` **no banco** — nunca no metadata, que a própria pessoa edita. Sem
sessão ou sem equipe: `notFound()`.

`estilos/admin.css` é escrito do zero, mobile-first. O do site antigo
(`git show main:site/assets/css/admin.css`) serve de referência de intenção, não de
cópia — ele foi feito para telas que nunca existiram.

`/admin` deixa de dar 404, o que derruba o teste que existe justamente para quebrar
neste dia. Revisitar, não apagar: ele passa a exigir 404 para quem **não** é equipe.

## Tarefa P2 — Publicações (notícias)

**Arquivos:** `app/admin/publicacoes/`, `acoes/publicacoes.ts`,
`servidor/dados/publicacoes.ts`, testes.

Listar, criar, editar, publicar/despublicar (`publicacoes`). `publicado` começa
`false`: nada vai ao ar por acidente. Ao publicar, gravar `publicado_em`.

`/noticias` passa a ler dessa tabela e mostrar o que estiver publicado.

## Tarefa P3 — Galeria com upload

**Arquivos:** `app/admin/galeria/`, `acoes/galeria.ts`, `servidor/dados/galeria.ts`,
testes.

Upload para o bucket `galeria` via Server Action. Validar tipo e tamanho **no
servidor** — o `accept` do input é sugestão, não garantia.

`alt` é obrigatório (é `not null` no banco e é acessibilidade).
`autorizacao_registrada` é caixa obrigatória para publicar: sem ela a linha pode
existir, mas não vai ao ar. Isto é RN07 e a política do banco já recusa.

## Tarefa P4 — Atividades

**Arquivos:** `app/admin/atividades/`, `acoes/atividades.ts`, testes.

Editar as 11 atividades reais. Sem criar nem apagar por enquanto: o conteúdo veio da
ONG e apagar por engano no celular não tem desfazer.
