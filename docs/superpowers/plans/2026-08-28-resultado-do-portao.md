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

## Parte humana — pendente

Nenhum agente enxerga tela nem ouve leitor de tela. Estes itens não têm substituto automático:

| Item | Por que precisa de olhos |
|---|---|
| Abrir o VLibras e traduzir | 4 rodadas de correção e 3 medições convergiram para "funciona". Ninguém viu o avatar se mexer |
| A+ e o texto do menu | O menu usa `clamp()` com `vw`, herdado do site atual. `vw` ignora o controle de fonte; os limites são em `rem`, então deveria crescer com teto |
| Faixa âmbar perto de "Início" | Flagrada por screenshot, provada pré-existente. Ninguém sabe se é defeito ou artefato de captura headless |
| As três páginas no celular | Dois defeitos visuais deste projeto passaram por 216 testes verdes |
| Leitor de tela na navegação | Único jeito de validar o foco no `<h1>` e a região `aria-live` da Tarefa 7 |

## Riscos residuais que sobrevivem ao portão

1. **A suíte depende de 4 hosts de terceiros ao vivo.** Indisponibilidade do gov.br derruba os testes sem regressão nossa. Se acontecer perto da entrega, o sintoma parece defeito e não é.
2. **O `sleep(7000)` antes do duplo clique é heurística por faixa medida**, não limite provado. Se uma versão futura do widget atrasar a saudação, o teste volta a ser placebo em silêncio.
3. **Nenhuma diretiva da política é dedutível** — todas vieram de medição. Uma atualização do widget pode mudar hosts sem aviso.
4. **`'unsafe-inline'` em `style-src`** é a diretiva mais frouxa, imposta pelo `<style>` que o widget escreve por `innerHTML`.
5. **9 rotas do menu dão 404** nesta fase. Coberto por `links-menu.test.mjs`, que separa `ROTAS_PRONTAS` de `ROTAS_PENDENTES` e falha nos dois sentidos.
6. **Telemetria PostHog referenciada no bundle do VLibras** — não disparada nas medições e hoje bloqueada pela política. Merece decisão de privacidade: o público da ONG começa aos 10 anos.
7. **A convenção `middleware` está depreciada** no Next 16.3.3 em favor de `proxy`.

## Decisão

Pendente da parte humana.
