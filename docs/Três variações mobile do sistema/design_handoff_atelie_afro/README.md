# Handoff: Design System "Ateliê Afro" + Página inicial (mobile)

## Overview
Sistema visual e de componentes para o site/sistema web do **Ateliê Afro Cultural**, focado em uso mobile
(320–430 px de largura), derivado da variação **1a** aprovada. O pacote traz (a) os tokens e componentes
para adaptar um projeto **já existente** ao novo design, (b) a **página inicial completa** especificada e
implementada em HTML/CSS de referência, para ser recriada literalmente no ambiente do projeto, e
(c) a **camada desktop/tablet** (mesmo HTML, só a grade muda).

## About the Design Files
Os arquivos deste pacote são **referências de design feitas em HTML/CSS** — protótipos que mostram a
aparência e o comportamento pretendidos, não código de produção para colar. A tarefa é **recriar estes
designs no ambiente já existente do projeto** (Blade/Twig/React/Vue/etc.), usando seus padrões e
bibliotecas. As exceções, que podem ser adotadas praticamente como estão:
- `tokens.css` — pode ser copiado para o projeto como fonte única de cor/tipo/espaço/elevação;
- `components.css` — pode ser copiado e depois renomeado/mapeado para a convenção de classes do projeto.

## Fidelity
**High-fidelity (hifi).** Cores, tipografia, espaçamentos, sombras e estados são finais. Recriar
pixel-a-pixel usando os tokens. Onde há imagem, há um **placeholder** marcado (`.af-ph`) — trocar por
`<img>` real mantendo o mesmo `aspect-ratio`.

## Como adaptar um projeto existente (ordem recomendada)
1. **Fonte**: importar **Bitter** (300/400/500/600/700 + itálico 400). É a única família do sistema —
   display e texto. Fallback: `Georgia, "Times New Roman", serif`.
2. **Tokens**: copiar `tokens.css` e importá-lo antes de qualquer CSS do projeto.
3. **Reset mínimo**: `box-sizing:border-box`, `body{margin:0}`, `-webkit-text-size-adjust:100%`,
   cores de `a` / `a:hover` (`--af-blue-deep` / `#1E4E6E`).
4. **Substituição de cores legadas**: mapear as cores antigas para os tokens (tabela abaixo) — não
   introduzir cor nova; se faltar um tom, derivá-lo do ocre/marrom existente.
5. **Componentes**: implementar na ordem `af-btn` → `af-card` → `af-tile` → `af-header` →
   `af-drawer` → `af-a11y` → `af-media` → `af-footer`. Cada um está em `components.css` com o nome
   final da classe.
6. **Página inicial**: recriar a partir de `index.html` (estrutura, ordem das seções e cópia exata).
7. **Checklist de QA** no fim deste documento.

### Mapa de cor (legado → novo)
| Papel | Token | Hex |
|---|---|---|
| Fundo de marca / cabeçalho | `--af-ochre` | #D69A10 |
| Tinta principal, bordas, fundos escuros | `--af-brown` | #2B2019 |
| Superfície escura elevada | `--af-brown-800` | #3A2C21 |
| Texto secundário sobre creme | `--af-brown-400` | #6E5B45 |
| Fundo da página | `--af-cream` | #F9F4EA |
| Fundo de card | `--af-card` | #FFFDF7 |
| Texto secundário sobre marrom | `--af-cream-dim` | #D8CBB8 |
| Acento / faixa listrada | `--af-blue` | #6FA6C8 |
| Links | `--af-blue-deep` | #2F6D96 |
| Ocre sobre creme (texto) | `--af-ochre-deep` | #9A6A12 |

> Contraste: **nunca** usar `--af-ochre` como texto sobre creme (usar `--af-ochre-deep`), nem
> `--af-brown-400` sobre marrom. Texto sobre ocre é sempre `--af-brown`.

## Design Tokens
Ver `tokens.css` (comentado). Resumo:
- **Tipografia**: Bitter. H1 `clamp(22px,7.2vw,28px)/1.15` peso 700; H2 19px/700; H3 16px/700;
  corpo 14.5px/1.6 (400); corpo pequeno 13px/1.5; caption 12.5px/1.45; overline 10.5px/600,
  `letter-spacing:.12em`, caixa alta.
- **Espaço**: 4, 6, 8, 10, 12, 14, 16, 18, 20, 26 px. Margem lateral da página = **4%** da largura
  (fluida, mantém margem óptica de 320 a 430 px); padding interno de card = 5%.
- **Forma**: sem raio nos blocos (0); **3px** apenas em controles; 50% apenas em botão flutuante.
  Borda padrão `1.5px solid #2B2019`.
- **Elevação** (assinatura do sistema — sombra dura, sem blur):
  `4px 4px 0` (tile), `5px 5px 0` (card), `6px 6px 0` (card do herói), `5px 5px 0 #D69A10` (card escuro).
- **Faixa listrada** (divisor de seção): `repeating-linear-gradient(90deg,#2B2019 0 3px,#6FA6C8 3px 8px)`,
  altura 14px. Usar **duas vezes por página, no máximo**: antes do primeiro bloco de conteúdo e antes do rodapé.
- **Toque**: mínimo **44px**; CTA **50px**. Movimento: `.25s cubic-bezier(.4,0,.2,1)`;
  respeitar `prefers-reduced-motion`.

## Princípios do sistema (o que faz ele parecer "dele")
1. **Serifa única em tudo** — inclusive botões e rótulos. Nada de sans.
2. **Sombra dura deslocada** em vez de sombra difusa; sempre no eixo +x/+y, cor marrom (ou ocre em card escuro).
3. **Cor como categoria, não decoração** — a borda superior de 5px do tile identifica o caminho
   (ocre = conhecer, azul = participar, marrom = voluntariar, invertido = apoiar).
4. **Ocre é fundo, marrom é tinta.** Ocre nunca é texto sobre claro.
5. **Zero cantos arredondados** nos blocos; o sistema é de papel recortado.
6. **Acessibilidade visível**: controles A-/A/A+ e alto contraste fazem parte da interface, não de um menu escondido.

## Screens / Views

### Página inicial (`/`)
**Propósito**: apresentar o ateliê e direcionar para 4 caminhos (conhecer, participar, voluntariar, apoiar),
agenda e contato. **Layout**: coluna única, largura total, margem lateral 4%; ordem fixa das seções.

1. **Cabeçalho fixo** (`.af-header`, `position:sticky;top:0`, fundo ocre, borda inferior 1.5px)
   - Hambúrguer 46×46 (fundo marrom, 3 barras 20×2 creme, gap 4px, raio 3px), à esquerda.
   - Marca: "Ateliê Afro Cultural" 15px/700 marrom, uma linha com ellipsis; abaixo
     "Casa Verde · São Paulo" 10.5px/400 `#5C4423`.
   - Botão "Aa" 46×46 (creme, borda 1.5px) abre a barra de acessibilidade.
   - Botão "Entrar" altura 46, padding 0 12px, creme com borda, `white-space:nowrap`.
2. **Barra de acessibilidade** (`.af-a11y`, oculta por padrão, `position:sticky;top:68px`, fundo card)
   - Rótulo "Acessibilidade" (overline). Botões A- / A / A+ (44px alt., largura mín. 46) e
     "Alto contraste" (marrom, ocupa o resto da linha, mín. 130px). Quebra em duas linhas em 320px.
   - Escala de texto: 0.92 / 1 / 1.1 (persistir a escolha). Alto contraste:
     `filter:saturate(0) contrast(1.55)` no elemento raiz (persistir).
3. **Gaveta de navegação** (`.af-drawer`): scrim `rgba(43,32,25,.55)`; painel 82% da largura
   (máx. 300px), fundo marrom, borda direita 2px ocre. Itens 48px de altura, 15px/400 creme,
   divisor `rgba(249,244,234,.12)`; item atual em ocre com texto marrom e peso 600.
   Ordem: Início, Quem somos, Projetos, Agenda, Notícias, Galeria, Acervo, Para escolas,
   Voluntariado, Apoiar, Contato + botão "Doar agora" (ocre, borda creme, 48px).
   Fecha por scrim, botão ×, ou Esc. Foco preso no painel; `body` sem scroll enquanto aberta.
4. **Herói** (fundo ocre, padding 18px 4% 26px)
   - Placeholder de imagem 16:9 com `margin-bottom:-14px` e `z-index:1`.
   - Card creme sobreposto (`z-index:2`, sombra 6px): H1 "Arte, memória e **pertencimento** — feitos à
     mão, todo dia" (a palavra em `--af-ochre-deep`); parágrafo 14.5px/1.6; CTA primário marrom
     "Conhecer nossos projetos" e secundário outline "Ver a agenda", empilhados com gap 10px, 50px de altura.
5. **Faixa listrada** (14px).
6. **"Por onde começar"** — H2 + linha de apoio "Quatro caminhos para entrar no ateliê." +
   grade `repeat(auto-fit,minmax(140px,1fr))`, gap 12px: 4 tiles (01 Conhecer / 02 Participar /
   03 Ser voluntário / 04 Apoiar — o 4º invertido, fundo marrom e sombra ocre). Em 320px cai para 1 coluna.
7. **"O que fazemos"** — H2 + "Arraste para o lado." + carrossel `scroll-snap` com 3 cards
   (largura 70%, mín. 190px): Literário, Musical, Artístico criativo, cada um com placeholder 2:1.
   Abaixo, link "Ler nossa história completa →".
8. **Bloco escuro "Para escolas"** — card marrom com sombra ocre, H 18px creme, texto `--af-cream-dim`,
   CTA ocre "Ver como funciona".
9. **"Na mídia"** — lista de 3 itens com barra colorida de 6px à esquerda (ocre / azul / marrom),
   título 14.5px/700 e linha de apoio 13px.
10. **Faixa listrada** + **rodapé** marrom: "Fale com a gente" (telefone, WhatsApp, e-mail, Instagram,
    TikTok — cada link com 44px de altura), "Onde estamos" (endereço em 2 linhas),
    divisor e "Política de privacidade".

**Cópia exata**: usar os textos de `index.html` (já revisados).


## Desktop (>=1024 px)
Mesmo HTML, mesma ordem de seções, mesmos tokens — muda **só a grade**. Regras em `desktop.css`
(carregar depois de `components.css`); referência visual em `Home 1a Desktop.dc.html`.

**Breakpoints**
| Faixa | Comportamento |
|---|---|
| `<640px` | Mobile: coluna única, gaveta, carrossel com snap |
| `640–1023px` | Tablet: tiles 2×2, setores em 2 colunas, mídia em 2 cards, gaveta mantida |
| `>=1024px` | Desktop: grade completa, navegação horizontal, gaveta removida |
| `>=1240px` | Container travado em **1180px**, centralizado; calha de **32px** |

**Diferenças estruturais no desktop**
1. **Cabeçalho em duas faixas**: faixa ocre com marca (22px/700) + controles de acessibilidade sempre
   visíveis + "Entrar"; abaixo, faixa marrom `.af-navbar` com os 10 links horizontais (52px de altura,
   item atual em ocre) e "Apoiar" empurrado à direita em azul. O hambúrguer e a gaveta são
   `display:none` — a navegação inteira fica exposta.
2. **Herói em duas colunas** (`1.05fr / 1fr`): card creme à esquerda avançando **-48px** sobre a
   imagem vertical (4:5) à direita; sombra sobe para `8px 8px 0`; CTAs lado a lado.
3. **"Por onde começar"**: 4 colunas, gap 20px, borda superior 6px, título do tile 20px.
4. **"O que fazemos"**: o carrossel vira **grade de 3 colunas** (imagem 16:10 em cada card).
5. **"Para escolas"**: card marrom em 2 colunas — texto à esquerda, CTA de 56px à direita.
6. **"Na mídia"**: 3 cards com borda e sombra (deixa de ser lista).
7. **Rodapé**: 3 colunas — contato / endereço + redes / apoio com CTA "Doar agora".
8. **Escala tipográfica**: H1 46px, H2 30px, H3 22px, corpo 15px (17px no herói), faixa listrada 16px.

**Não muda**: sombra dura sem blur, ausência de raio, faixa listrada no máximo 2× por página,
alvo mínimo de 44px (inclusive no mouse), barra de acessibilidade visível, paleta e família tipográfica.

**Hooks de classe que o desktop.css espera** (adicionar ao markup da home, sem efeito no mobile):
`.af-wrap` no container interno das seções, `.af-navbar` na faixa de navegação marrom,
`.af-hero` na seção do herói, `.af-footer__cols` no grid do rodapé.

## Interactions & Behavior
- **Gaveta**: abre/fecha em ≤250ms; `aria-expanded` no hambúrguer, `aria-current="page"` no item atual,
  foco vai para o painel ao abrir e volta ao hambúrguer ao fechar.
- **Barra de acessibilidade**: toggle por "Aa"; estado (escala + contraste) persistido em
  `localStorage` (`af-font`, `af-contrast`) e reaplicado no carregamento, sem flash.
- **Tiles**: hover/press deslocam -1px em x/y e aumentam a sombra para 5px (feedback tátil de papel).
- **Carrossel**: `scroll-snap-type:x mandatory`, scrollbar oculta, arraste por toque; sem setas em mobile.
- **Responsivo**: 320–430px sem media query — % + `clamp()` + `auto-fit`. Acima de 480px, limitar o
  conteúdo a `max-width:480px` centralizado (o sistema é mobile-first; desktop é fase 2).
- **Reduced motion**: desativar transições.

## State Management
| Estado | Tipo | Origem | Efeito |
|---|---|---|---|
| `drawerOpen` | boolean | clique no hambúrguer / scrim / Esc | mostra gaveta, trava scroll do body |
| `a11yOpen` | boolean | clique em "Aa" | mostra a barra de acessibilidade |
| `fontStep` | 0 \| 1 \| 2 | A- / A / A+ | zoom 0.92 / 1 / 1.1 (persistido) |
| `highContrast` | boolean | "Alto contraste" | `filter` no raiz (persistido) |

Sem dados remotos na home além do conteúdo editorial (setores, mídia, agenda) — se o projeto já tem CMS,
ligar cada bloco às coleções existentes; a estrutura de cada card é fixa.

## Assets
Nenhuma imagem real neste pacote. Todos os espaços de imagem usam `.af-ph` com rótulo
("Imagem · oficina", "Imagem"). Substituir por fotografias do ateliê mantendo os `aspect-ratio`
(16:9 no herói, 2:1 nos cards de setor). Não há ícones — o sistema é tipográfico por decisão de design.

## Files
| Arquivo | O que é |
|---|---|
| `tokens.css` | Tokens do design system (copiar para o projeto) |
| `components.css` | Componentes do sistema em CSS puro, sobre os tokens |
| `index.html` | **Página inicial completa** de referência (estrutura + cópia + comportamento) |
| `desktop.css` | Camada desktop/tablet (media queries) sobre os mesmos componentes |
| `Home 1a.dc.html` | Protótipo mobile interativo (fluido, 320–430px), verdade visual |
| `Home 1a Desktop.dc.html` | Protótipo desktop (1440×900), verdade visual da grade ≥1024px |
| `Ateliê Afro — Variações Mobile.dc.html` | Prancheta com as 3 variações e a versão fluida em 3 larguras |

## QA checklist
- [ ] Bitter carregada (400/600/700); nenhum texto em sans.
- [ ] Nenhum canto arredondado fora de controles (3px) e do FAB.
- [ ] Toda sombra é dura, deslocada, sem blur.
- [ ] Alvos de toque ≥44px (inclusive links do rodapé) e CTAs de 50px.
- [ ] 320px: grade em 1 coluna, nada com scroll horizontal na página, marca em uma linha.
- [ ] 430px: margens de 4% preservadas, nada esticado.
- [ ] A-/A/A+ e alto contraste funcionam e persistem após recarregar.
- [ ] Gaveta: Esc fecha, foco preso, `aria-expanded` correto, body sem scroll.
- [ ] Faixa listrada aparece no máximo 2× na página.
- [ ] Placeholders substituídos por imagens reais com o mesmo aspect-ratio.
- [ ] 1024/1280/1440px: container centralizado em 1180px, gaveta ausente, nav horizontal completa.
- [ ] Herói desktop: card sobrepondo a imagem em -48px, sem corte de texto.
- [ ] Carrossel de setores substituído por grade de 3 colunas no desktop.
