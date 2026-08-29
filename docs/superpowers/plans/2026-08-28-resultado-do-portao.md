# Portão go/no-go — resultado

Data: 29/08/2026
Fase 1 da migração para Next.js. Critérios definidos na spec §8.1.
Branch: `migracao-nextjs`, commit `9a6b389`. `main` intacta e publicável.

## Parte automática — 6 critérios

| # | Critério | Resultado | Medido por |
|---|---|---|---|
| 1 | Botão do VLibras aparece e o player abre ao clique | **passa** | `csp-vlibras.test.mjs` — clique real no shadow root, espera `#vlibras-app-root` com iframe |
| 2 | Zero recusa de recurso pela política, em todas as rotas | **passa** | `csp-vlibras.test.mjs` — captura por `onConsoleEntry` e `onJavascriptException` do BiDi |
| 3 | `axe-core` com 0 violações | **passa** | 4 rotas, 0 violações cada, com VLibras montado |
| 4 | Após clicar em "Quem somos": título muda e foco no `<h1>` | **passa** | `foco-navegacao.test.mjs` |
| 5 | Zero aviso de divergência de hidratação | **passa** | `hidratacao.test.mjs` — provado capaz de falhar |
| 6 | Escala de fonte persiste na navegação **do roteador** | **passa** | teste escrito ao montar o portão; a lacuna não existia antes |

Suíte completa: **212 testes, 209 passando, 0 falhas, 3 `todo` declarados.**

### Desvios do critério original, declarados

- O critério 5 nomeava `/`, `/entrar` e `/quem-somos`. `/entrar` não existe nesta fase; as rotas medidas foram `/`, `/quem-somos`, `/privacidade` e `/para-escolas` — as quatro que existem.
- O critério 3 pedia a home. Foram medidas as quatro rotas.

## Parte humana — feita em 29/08/2026 pelo usuário

Nenhum agente enxerga tela nem ouve leitor de tela. Estes itens não têm substituto automático:

| Item | Resultado |
|---|---|
| Abrir o VLibras e traduzir | **passa** |
| A+ e o texto do menu | **passa** |
| Faixa âmbar perto de "Início" | **passa** — era artefato de captura headless, não defeito |
| As três páginas no celular | **dois defeitos reportados**, corrigidos em `dfded22` |

### Os dois defeitos que só olhos humanos pegaram

1. **Espaços sumidos entre texto e link** (`/privacidade` e `/para-escolas`) — **regressão da migração**. Em HTML a quebra de linha entre texto e elemento vira um espaço; em JSX ela é removida. Resultado: "e-mailatelieafro@gmail.com", "com ninguémpara fins", "Falar pelo WhatsAppEnviar e-mail".

   Passou por 212 testes e pela verificação de fidelidade de conteúdo, que comparava **palavras** — e todas estavam presentes. O que sumia era o espaço entre elas.

   Corrigido, e coberto por `testes/paridade-texto.test.mjs`, que compara o texto renderizado do `<main>` de cada rota com o do HTML original, com espaços normalizados. Esse teste encontrou uma quinta ocorrência que o mapeamento manual não pegou (elemento adjacente a elemento, não texto adjacente a elemento). Protege as 12 páginas da fase 2.

2. **Ficha "Formato e duração" com alinhamento inconsistente no celular** — **não é regressão**: o CSS é idêntico ao do site atual. `.ficha > div` é flex com `flex-wrap` e `dt` com `min-width: 9rem`, então valor curto cabe ao lado e valor longo desce. Empilhado no celular; `.atividade__ficha` tinha o mesmo defeito e foi corrigida junto.

## Riscos residuais que sobrevivem ao portão

1. **A suíte depende de 4 hosts de terceiros ao vivo.** Indisponibilidade do gov.br derruba os testes sem regressão nossa. Se acontecer perto da entrega, o sintoma parece defeito e não é.
2. **O `sleep(7000)` antes do duplo clique é heurística por faixa medida**, não limite provado. Se uma versão futura do widget atrasar a saudação, o teste volta a ser placebo em silêncio.
3. **Nenhuma diretiva da política é dedutível** — todas vieram de medição. Uma atualização do widget pode mudar hosts sem aviso.
4. **`'unsafe-inline'` em `style-src`** é a diretiva mais frouxa, imposta pelo `<style>` que o widget escreve por `innerHTML`.
5. **9 rotas do menu dão 404** nesta fase. Coberto por `links-menu.test.mjs`, que separa `ROTAS_PRONTAS` de `ROTAS_PENDENTES` e falha nos dois sentidos.
6. **Telemetria PostHog referenciada no bundle do VLibras** — não disparada nas medições e hoje bloqueada pela política. Merece decisão de privacidade: o público da ONG começa aos 10 anos.
7. **A convenção `middleware` está depreciada** no Next 16.3.3 em favor de `proxy`.

## Decisão: **GO**

Seis critérios automáticos verdes, quatro julgamentos humanos aprovados, dois defeitos
encontrados e corrigidos. Suíte final: **215 testes, 212 passando, 0 falhas, 3 `todo`**.

A migração segue para a Tarefa 10 (camada de dados) e depois para o plano da fase 2.
`main` permanece intacta e publicável até a fase 2 terminar.
