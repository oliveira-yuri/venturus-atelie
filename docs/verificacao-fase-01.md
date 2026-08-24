# Verificação — Fase 01 (Site institucional)

Data: 24/08/2026
Comandos: `node --test` · `npx @axe-core/cli <url> --browser firefox`

| Verificação | Resultado |
|---|---|
| `node --test` — suíte completa | **92 testes, 92 passando** |
| — preferências de acessibilidade | 11 passando |
| — mensagens de erro | 7 passando |
| — navegador (Fase 00) | 11 passando |
| — integridade de `atividades.json` e `clipping.json` | 10 passando |
| — estrutura das páginas | 32 passando |
| — navegação sem JavaScript | 21 passando |
| Estrutura semântica nas 7 páginas | passou — título, meta description, um único h1, `main#conteudo`, skip link, `lang="pt-BR"` |
| Cabeçalho e rodapé montam nas 7 páginas | passou — menu, página atual marcada, cinco contatos, quatro controles |
| Alt em toda imagem, nas 7 páginas | passou |
| Sem rolagem horizontal em 375px, nas 7 páginas | passou |
| Navegação e contatos sem JavaScript, nas 7 páginas | passou — 11 destinos, telefone e e-mail |
| Ausência de linguagem assistencialista | passou |
| As 11 atividades aparecem em `projetos.html` | passou |
| Atividades sem sinopse não exibem bloco vazio | passou |
| Prova social carrega na home e em para-escolas | passou |
| **axe-core nas 7 páginas** | **0 violações em todas** |
| "Para escolas" alcançável da home em ≤ 2 cliques | passou — item de menu (1 clique) e botão "Ver como funciona" (1 clique) |

## Achados durante a execução

**Notícias e Galeria não existiam no menu.** As páginas foram criadas conforme RF04 e RF05, mas as
chaves não constavam da lista de itens do `aac-header` — nenhum item ficava marcado como página atual
e as duas páginas eram inalcançáveis pela navegação. O teste de estrutura pegou. Ambas entraram no
menu e na navegação sem JavaScript, que passou de 9 para 11 destinos.

**Colisão de landmarks.** As seções "Onde estamos" de `quem-somos.html` e `contato.html` colidiam com
a seção de mesmo nome no rodapé: três `region` com o mesmo nome acessível. A correção foi na raiz — o
`<footer>` já é um landmark `contentinfo`, então as `<section aria-labelledby>` dentro dele eram
regiões redundantes e viraram `<div>`. Isso resolve o problema para toda página futura, em vez de
renomear títulos caso a caso.

**Ordem de títulos quebrada em projetos.** Os cartões de atividade usavam `h3` logo depois do `h1` da
página, pulando um nível — o que desorienta quem navega por títulos no leitor de tela. Passaram a `h2`.

## Conteúdo publicado

- **11 atividades**, das quais 5 com sinopse completa extraída dos releases (Banzo, Catirina e Nego
  Dito, Cafú e o Café, Brincadeiras Encantadas na Mata, Projeto Brincantes) e 6 apenas com título e
  ficha técnica, porque a ONG não forneceu descrição. Nenhum texto foi inventado.
- **14 registros de clipping** — 3 de mídia, 9 de instituições, 2 de programações recorrentes.
- **Nenhuma fotografia.** Não há autorização de uso de imagem para nenhuma foto recebida (RN07,
  risco R10). As páginas estão desenhadas para receber imagens sem reestruturação.

## Pendências

| Pendência | Decisão | Bloqueia |
|---|---|---|
| **Projeto Supabase na nuvem, região São Paulo** | — | **Fase 02, em 28/08.** Sem Docker, não há alternativa local |
| Conta Netlify e conta Brevo | — | Deploy de 03/09 e e-mails da Fase 03 |
| Validação de `docs/conteudo-real.md` com a ONG | seção 18.2 | Publicação — sobretudo as citações e números lidos da matéria da Folha |
| Sinopse dos seis espetáculos sem descrição | — | Completude de `projetos.html` |
| "Nathi Nunes" e "Nathália (Nathy) Monteiro" são a mesma pessoa? | — | Ficha de Brincadeiras Encantadas na Mata |
| Autorizações de uso de imagem | RN07 / R10 | Qualquer foto no site |
| Logotipo em vetor | D9 | Marca no cabeçalho, hoje tipográfica |
| Sankofa como elemento da identidade visual? | — | Nada; enriqueceria a home |

## Requisitos da Fase 01

| Requisito | Situação |
|---|---|
| RF01 — Página inicial institucional | Entregue |
| RF02 — Quem somos | Entregue |
| RF03 — Projetos e atividades | Entregue; edição pela equipe chega na Fase 02 |
| RF04 — Notícias e campanhas | Página com estado vazio; liga à tabela `publicacoes` na Fase 02 |
| RF05 — Galeria | Página com estado vazio; liga à tabela `midia` na Fase 02 |
| RF06 — Contato institucional | Entregue — os cinco canais nomeados pela ONG |
| RF07 — Formulário de contato | Depende da tabela `contatos`; até lá a página oferece os canais diretos |
| RF38 — Para Escolas | Entregue |
| RF39 — Prova social | Entregue |
