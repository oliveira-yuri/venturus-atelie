# Fase 2, Bloco A — terminar a migração

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`. Os passos usam caixas (`- [ ]`).

**Objetivo:** levar para o Next as 11 páginas que faltam, aposentar `site/`, e deixar a versão nova equivalente ao site que está no ar — com as garantias que a fase 1 acrescentou.

**Arquitetura:** inalterada da fase 1. Server Components por padrão; camada de dados em `servidor/` com `import 'server-only'`; CSP com nonce no middleware; conteúdo real da ONG copiado literalmente.

**Stack:** Next 16.3.3, React 19.2.8, TypeScript 7.0.2, `@supabase/ssr` 0.12.5, Node 24.15.

**Spec:** `docs/superpowers/specs/2026-08-28-migracao-nextjs-design.md`
**Decisão de escopo:** `docs/superpowers/plans/2026-08-29-fase-2-escopo-e-decisao.md` (o grupo escolheu o Bloco A em 29/08/2026)
**Fase 1:** `docs/superpowers/plans/2026-08-28-migracao-nextjs-fundacao.md` · portão: `2026-08-28-resultado-do-portao.md`

## Restrições globais

As da fase 1 continuam valendo. Estas nove vêm de defeitos que a fase 1 produziu — cada uma custou pelo menos uma rodada de correção.

1. **Nunca inventar nome de coluna.** Os módulos em `site/assets/js/dados/*.js` funcionam em produção e usam `select('*')`. **Porte a consulta como está**; não enumere colunas. Na fase 1 o brief inventou seis nomes que não existiam, e o `if (error) return JSON` teria mascarado isso para sempre.
2. **Conteúdo copiado literalmente.** Texto real da ONG. Não reescrever, não "melhorar", não resumir.
3. **A armadilha do JSX come espaços.** Em HTML, quebra de linha entre texto e elemento vira **um espaço**; em JSX é **removida**. Isso produziu "e-mailatelieafro@gmail.com" na fase 1 e passou por 212 testes. Use `{' '}` explícito. O `testes/paridade-texto.test.mjs` pega — rode-o.
4. **`next/link` para rota interna**, nunca `<a href>` cru: `<a>` faz recarga completa e passa ao largo do `FocoNaNavegacao`.
5. **Todo módulo em `servidor/` começa com `import 'server-only'`.** Há teste que falha se esquecer.
6. **Comentário afirma o que foi medido, não o que se supõe.** A fase 1 teve **cinco** comentários factualmente errados, cada um instruindo quem viesse depois a desfazer uma correção. Se não mediu, escreva que não mediu.
7. **Nunca subir servidor de longa duração, nunca usar execução em segundo plano.** Travou três tarefas na fase 1. `npm test` sobe e encerra sozinho.
8. **TDD com prova real:** ver o teste falhar **pelo motivo certo**. Falha por rota inexistente ou conexão recusada não conta.
9. **Cada página portada move sua rota** de `ROTAS_PENDENTES` para `ROTAS_PRONTAS` em `testes/links-menu.test.mjs`, no mesmo commit. O teste falha nos dois sentidos de propósito.

Mais as invioláveis do `CLAUDE.md`: paleta `#E0A400`/`#7FA9CE`/`#8A6A4A`; nada de `vw` em texto; não é ONG assistencialista; nenhuma `NEXT_PUBLIC_`; nenhuma chave secreta; comentários e nomes em português; mobile-first no painel.

**Branch:** `migracao-nextjs`. `main` permanece publicável até o Bloco A terminar.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `app/page.tsx` | Home — hoje é casca de um `<h1>`; ganha os quatro caminhos, os três setores, a chamada para escolas e a prova social |
| `app/projetos/page.tsx` | 11 atividades do banco, com ficha técnica |
| `app/agenda/page.tsx` · `app/noticias/page.tsx` · `app/galeria/page.tsx` · `app/acervo/page.tsx` | páginas prontas, hoje sem dado |
| `app/voluntariado/page.tsx` · `app/doar/page.tsx` | 5 áreas do banco; meios de doação |
| `app/contato/page.tsx` · `app/entrar/page.tsx` · `app/recuperar-acesso/page.tsx` | formulários **sem envio** — o envio é Bloco B |
| `servidor/dados/acervo.ts` · `eventos.ts` · `voluntariado.ts` | portados de `site/assets/js/dados/`, com `server-only` |
| `componentes/CardAtividade.tsx` · `CampoFormulario.tsx` | os dois custom elements que faltam |
| `next.config.ts` | os 15 redirects de `.html` para rota limpa |

---

## Tarefa A1: reapontar os testes legados e fechar a dívida da spec §6.2

A spec prometeu reapontar `links.test.mjs` e `sem-javascript.test.mjs`; a fase 1 não o fez. `painel.test.mjs` é um terceiro, descoberto na revisão final.

**Arquivos:** modificar `testes/links.test.mjs`, `testes/sem-javascript.test.mjs`, `testes/painel.test.mjs`

- [ ] **Passo 1:** `links.test.mjs` — trocar o servidor estático próprio por `process.env.URL_BASE`, e percorrer as rotas do app. Ele deve considerar as rotas ainda pendentes como esperadas, igual ao `links-menu.test.mjs` faz.
- [ ] **Passo 2:** `sem-javascript.test.mjs` — reapontar. Com JS desligado, os 11 links do menu precisam estar no HTML entregue. A fase 1 já provou isso por `fetch`; aqui é com `javascript.enabled=false` de verdade.
- [ ] **Passo 3:** `painel.test.mjs` — o painel é Bloco B e as telas serão reescritas. Marque os 12 casos como `test.todo` com o motivo, **não apague**: eles descrevem requisitos do RF33 que continuam valendo.
- [ ] **Passo 4:** `npm test`, ver passar. Commit.

---

## Tarefa A2: a home (RF01)

**Arquivos:** modificar `app/page.tsx`; criar `testes/pagina-home.test.mjs`

Fonte: `site/index.html`. Conteúdo copiado literalmente.

- [ ] **Passo 1:** escrever o teste antes — a home precisa ter os 4 caminhos ("Conhecer", "Participar", "Ser voluntário", "Apoiar"), os 3 setores, e a prova social com pelo menos 3 registros de mídia. Rodar, ver falhar por ausência (a home hoje é um `<h1>`).
- [ ] **Passo 2:** portar o conteúdo de `site/index.html`. O `<div id="lista-midia">` é alimentado pelo servidor, como `/para-escolas` já faz — use `listarClippingComOrigem()` e o filtro de tipo `midia`.
- [ ] **Passo 3:** acrescentar `/` ao `testes/paridade-texto.test.mjs` — a fase 1 deixou a home de fora, e nada compara o texto dela com o original.
- [ ] **Passo 4:** `npm test` e `npm run test:supabase`. Verificar a 375px. Commit.

---

## Tarefa A3: projetos (RF03)

**Arquivos:** criar `app/projetos/page.tsx`, `componentes/CardAtividade.tsx`; modificar `servidor/dados/conteudo.ts` se necessário

Fonte: `site/projetos.html` + `site/assets/js/paginas/projetos.js` + `site/assets/js/componentes/aac-card-atividade.js`.

**Atenção ao CSS:** `estilos/componentes.css` tem `.card-atividade:nth-child(3n+2)` e `(3n+3)` alternando a cor da costura entre amarelo, azul e marrom. **Isso só funciona se o componente puser a classe no elemento raiz, filho direto da lista.** Um `<div>` a mais quebra a contagem e a paleta sai fora de ordem.

- [ ] **Passo 1:** teste primeiro — 11 atividades renderizadas, e atividade sem sinopse não exibe parágrafo vazio (regra 2). Ver falhar.
- [ ] **Passo 2:** o componente e a página. `listarAtividadesComOrigem()` já existe.
- [ ] **Passo 3:** reativar o `test.todo` "projetos.html mostra as onze atividades" em `paginas.test.mjs`, apontado para a rota nova.
- [ ] **Passo 4:** verificar a alternância de cor a 1280px e a 375px. `npm test`, `npm run test:supabase`. Commit.

---

## Tarefa A4: agenda, notícias, galeria, acervo

**Arquivos:** criar `app/agenda/page.tsx`, `app/noticias/page.tsx`, `app/galeria/page.tsx`, `app/acervo/page.tsx`, `servidor/dados/eventos.ts`, `servidor/dados/acervo.ts`

As quatro estão sem dado hoje, e continuarão — as tabelas estão vazias. **A regra 2 manda omitir a seção sem dado**, então cada uma precisa de um estado vazio honesto, não de uma lista em branco.

- [ ] **Passo 1:** portar `eventos.ts` e `acervo.ts` de `site/assets/js/dados/`. **Copie as consultas como estão** — `select('*')`, sem enumerar colunas. Acrescente `import 'server-only'`.
- [ ] **Passo 2:** teste primeiro — cada página responde 200, tem `<main id="conteudo">` com um `<h1>`, e mostra um estado vazio com texto real quando não há registro. Ver falhar.
- [ ] **Passo 3:** as quatro páginas, conteúdo literal de `site/*.html`.
- [ ] **Passo 4:** o `enderecoDoArquivo` do acervo usa `storage.getPublicUrl` — confirme que funciona a partir do servidor e diga no relatório.
- [ ] **Passo 5:** `npm test`, `npm run test:supabase`. Commit.

---

## Tarefa A5: voluntariado (RF24) e doar (RF23)

**Arquivos:** criar `app/voluntariado/page.tsx`, `app/doar/page.tsx`, `servidor/dados/voluntariado.ts`

- [ ] **Passo 1:** portar `voluntariado.ts` — só o `listarAreas()`; o `candidatar()` é RF25, Bloco B. Deixe a função de fora e registre no relatório.
- [ ] **Passo 2:** teste primeiro — voluntariado mostra as 5 áreas do banco; doar mostra os meios de doação. Ver falhar.
- [ ] **Passo 3:** as duas páginas. **A chave Pix ainda não existe** (decisão D7 pendente) — o campo fica ausente e a página omite, nunca com texto de preenchimento.
- [ ] **Passo 4:** `npm test`, `npm run test:supabase`. Commit.

---

## Tarefa A6: contato, entrar, recuperar-acesso — as telas, sem o envio

**Arquivos:** criar `app/contato/page.tsx`, `app/entrar/page.tsx`, `app/recuperar-acesso/page.tsx`, `componentes/CampoFormulario.tsx`

**Estas três páginas ficam sem funcionar de propósito.** O envio depende de autenticação e de Server Actions, que são Bloco B e dependem do dashboard do Supabase. Portar a tela agora é o que permite ao grupo ver o site completo.

- [ ] **Passo 1:** teste primeiro — as três respondem 200, têm os campos do original, e **cada uma exibe um aviso visível** de que o envio ainda não está ativo. Ver falhar.
- [ ] **Passo 2:** portar `aac-form-campo.js` para `componentes/CampoFormulario.tsx`. O CSS espera a classe `.form-campo` no elemento raiz.
- [ ] **Passo 3:** as três páginas, conteúdo literal. O aviso de "envio ainda não ativo" é texto novo — **é a única exceção à regra de não inventar conteúdo nesta fase, e precisa ser aprovado**: escreva o texto no relatório e não invente mais nada.
- [ ] **Passo 4:** `npm test`. Commit.

---

## Tarefa A7: os 15 redirects e a rota de privacidade

**Arquivos:** modificar `next.config.ts`; criar `testes/redirects.test.mjs`

Links com `.html` já circularam. `/quem-somos.html` precisa levar a `/quem-somos`.

- [ ] **Passo 1:** teste primeiro — cada uma das 15 URLs antigas responde 301 ou 308 para a rota limpa correspondente. Ver falhar.
- [ ] **Passo 2:** os redirects no `next.config.ts`.
- [ ] **Passo 3:** confirmar que o guardião de deploy falha se sobrar `.html` em `public/` — o `next.config` não redireciona caminho que existe como arquivo, e um arquivo esquecido derruba o redirect em silêncio. Esse teste já existe; confirme que continua verde.
- [ ] **Passo 4:** `npm test`. Commit.

---

## Tarefa A8: aposentar `site/`

Só depois de A1–A7 passarem. **Esta tarefa apaga o site que está em produção na `main`** — mas só nesta branch, e `main` continua intacta.

**Arquivos:** remover `site/`; modificar `ferramentas/verificar-antes-do-deploy.mjs`, `ferramentas/gerar-seed.mjs`, `testes/paridade-texto.test.mjs`, `testes/conteudo.test.mjs`, `CLAUDE.md`

- [ ] **Passo 1:** conferir que as 15 rotas existem e passam, e que `links-menu.test.mjs` tem `ROTAS_PENDENTES` vazio.
- [ ] **Passo 2:** **antes de apagar**, o `paridade-texto.test.mjs` compara cada página com o HTML original em `site/`. Sem `site/` ele perde a referência. Decida e registre: congelar as referências num diretório próprio, ou aposentar o teste com o motivo escrito. **Aposentar sem substituto não é opção** — foi ele que pegou o defeito dos espaços.
- [ ] **Passo 3:** apagar `site/` e a pasta `dados-iniciais/` duplicada, deixando uma só.
- [ ] **Passo 4:** no `verificar-antes-do-deploy.mjs`, **remover a entrada de `site/`** — hoje ela é `obrigatorio: false` e passaria a imprimir "· site/ não existe" em toda execução, virando ruído permanente num script cuja premissa é que verificador que grita à toa é ignorado.
- [ ] **Passo 5:** `gerar-seed.mjs` já lê de `dados-iniciais/`; confirmar que `npm run seed` não muda o `supabase/seed.sql`.
- [ ] **Passo 6:** atualizar o `CLAUDE.md`: a tabela de duas versões some, os comandos de `main` somem, e a contagem de testes é a nova.
- [ ] **Passo 7:** `npm test`, `npm run test:supabase`, `npm run verificar-deploy`. Commit.

---

## Ao terminar

O Bloco A entrega a versão Next equivalente ao site atual. Fica pendente, e precisa ir para o `CLAUDE.md`:

- **Bloco B inteiro** — painel (RF33), autenticação funcionando, eventos (RF13–RF18), doações (RF19–RF22), candidatura (RF25–RF26), comunicação e relatórios (RF27–RF32)
- **As três telas de formulário não enviam** — contato, entrar, recuperar-acesso
- **Migration 007** — o rate limit vira balde global no desenho novo
- **Decisão do VLibras no painel** — a CSP dá confiança em cadeia, e o widget é montado no layout raiz
- **Rotação da chave** do Supabase, que segue sendo a mesma de `site/config.js`
- **Remover o `X-Robots-Tag: noindex` dos DOIS lugares** no lançamento
- Os quatro itens levantados na revisão final e deliberadamente não corrigidos: `data === []` ambíguo, `.cjs` fora da regex da trava, e os dois invólucros sem consumidor
