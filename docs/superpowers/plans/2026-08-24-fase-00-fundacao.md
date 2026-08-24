# Fase 00 — Fundação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o esqueleto do site do Ateliê Afro Cultural com sistema visual, cabeçalho, rodapé e controles de acessibilidade funcionando em todas as páginas, sem depender de banco de dados.

**Architecture:** Site multi-página estático. Cada página é um `.html` real; a estrutura compartilhada é composta em tempo de execução por custom elements sem Shadow DOM, carregados como módulos ES. A lógica que merece teste é extraída para módulos puros em `site/assets/js/util/`, testados com o runner nativo do Node — os custom elements ficam como casca fina sobre eles.

**Tech Stack:** HTML, CSS e JavaScript sem framework nem bundler. Módulos ES nativos. `node --test` (Node 24, zero dependências). Ghostscript e LibreOffice para o acervo. Supabase entra na Fase 02.

**Spec:** `docs/superpowers/specs/2026-08-24-atelie-afro-cultural-design.md`

## Global Constraints

- **Sem framework de build.** Sem React, sem Vue, sem bundler, sem transpilação. Módulos ES nativos.
- **Português em todo identificador**: tabelas, colunas, funções JS, classes CSS e nomes de arquivo (kebab-case, sem acento).
- **Custom elements sem Shadow DOM**, prefixo `aac-`. Shadow DOM quebraria os controles globais de fonte e contraste.
- **Paleta fixa** (seção 3.4 do escopo, definida pela ONG — não alterar):
  `--amarelo: #E0A400` · `--azul: #7FA9CE` · `--azul-texto: #2E5C8A` · `--marrom: #8A6A4A` · `--tinta: #241C12` · `--fundo: #FAF6EE`
- **Slogan literal, nunca reescrito:** "Espaço educativo de criação, reflexão e valorização da cultura e memória afro brasileira"
- **Nomes próprios:** Wil Oliveira · Nathália (Nathy) Monteiro. Normalizar "Will Oliveira", "Nathi Nunes".
- **Nunca texto de preenchimento.** Sem lorem ipsum, sem evento ou depoimento inventado. Faltou conteúdo real, pergunta.
- **Tom:** acolhedor, humanizado, simples e sincero — inclusive em mensagem de erro e rótulo de botão.
- **Não é ONG assistencialista.** Nada de estética de pena, linguagem de caridade ou contador de vidas salvas.
- **Toda imagem tem `alt`.** Sem exceção.
- **Só `site/` é publicado.** `material-origem/` e `acervo-web/` ficam fora do versionamento.
- Rodar os testes com `node --test` (Node 24 descobre `testes/*.test.mjs` sozinho; passar `testes/` como argumento faz o Node tratar o diretório como arquivo de entrada e falhar).

---

## Estrutura de arquivos desta fase

| Arquivo | Responsabilidade |
|---|---|
| `site/index.html` | Página inicial — nesta fase, casca com conteúdo institucional real |
| `site/assets/css/tokens.css` | Paleta, escalas tipográficas, espaçamento, e a variante de alto contraste |
| `site/assets/css/base.css` | Reset, tipografia, foco visível, skip link, layout de página |
| `site/assets/css/componentes.css` | Estilo dos custom elements |
| `site/assets/js/util/preferencias.js` | Lógica pura de escala de fonte e contraste — o miolo testável |
| `site/assets/js/preferencias-inicial.js` | Script clássico e síncrono que aplica a preferência antes da primeira pintura |
| `site/assets/js/util/erros.js` | Tradução de falha técnica em mensagem acolhedora |
| `site/assets/js/util/estados-lista.js` | Os três estados obrigatórios de toda lista |
| `site/assets/js/componentes/aac-acessibilidade.js` | Botões A- / A / A+ e alto contraste |
| `site/assets/js/componentes/aac-header.js` | Logo, menu, e o componente de acessibilidade |
| `site/assets/js/componentes/aac-rodape.js` | Cinco contatos do RF06, VLibras e o `noscript` |
| `site/config.js` | URL do Supabase e anon key — vazios nesta fase |
| `testes/preferencias.test.mjs` | Testes da lógica de acessibilidade |
| `testes/erros.test.mjs` | Testes das mensagens de erro |
| `netlify.toml` | Publicação de `site/` |

---

### Task 1: Sistema visual e página inicial

**Files:**
- Create: `site/assets/css/tokens.css`
- Create: `site/assets/css/base.css`
- Create: `site/index.html`
- Create: `netlify.toml`

**Interfaces:**
- Consumes: nada (primeira tarefa)
- Produces: as custom properties `--escala-fonte`, `--fundo`, `--tinta`, `--amarelo`, `--azul`, `--azul-texto`, `--marrom`, e o atributo `data-contraste="alto"` no elemento `<html>`. Tudo o mais nesta fase depende delas.

- [ ] **Step 1: Criar `site/assets/css/tokens.css`**

O ponto crítico é `html { font-size: var(--escala-fonte, 100%) }` combinado com todo o resto em `rem`: é isso que faz um único valor controlar o tamanho do site inteiro.

```css
:root {
  /* Paleta declarada pela ONG (seção 3.4 do escopo). Não alterar. */
  --amarelo: #E0A400;      /* luz, sabedoria, criatividade, ancestralidade */
  --azul: #7FA9CE;         /* céu, esperança, serenidade, conhecimento */
  --azul-texto: #2E5C8A;   /* variante do azul com contraste para texto */
  --marrom: #8A6A4A;       /* terra, mãe África, raízes, memória */
  --tinta: #241C12;        /* texto */
  --fundo: #FAF6EE;        /* fundo claro levemente quente */

  --superficie: #FFFFFF;
  --borda: #E3D9C6;
  --tinta-suave: #5A4A38;
  --foco: #2E5C8A;

  /* Escala tipográfica, toda em rem para responder a --escala-fonte */
  --texto-pequeno: 0.875rem;
  --texto-base: 1rem;
  --texto-medio: 1.125rem;
  --texto-grande: 1.5rem;
  --texto-titulo: 2rem;
  --texto-destaque: 2.75rem;

  --espaco-1: 0.25rem;
  --espaco-2: 0.5rem;
  --espaco-3: 1rem;
  --espaco-4: 1.5rem;
  --espaco-5: 2.5rem;
  --espaco-6: 4rem;

  --raio: 0.5rem;
  --largura-conteudo: 68rem;
  --alvo-toque: 2.75rem;   /* 44px — mínimo para uso com o polegar */
}

/* O controle A- / A / A+ altera apenas esta linha. */
html {
  font-size: var(--escala-fonte, 100%);
}

/* Alto contraste: os mesmos tokens, redefinidos. Nenhum componente sabe que isso existe. */
html[data-contraste="alto"] {
  --fundo: #FFFFFF;
  --superficie: #FFFFFF;
  --tinta: #000000;
  --tinta-suave: #000000;
  --borda: #000000;
  --azul-texto: #00327A;
  --marrom: #4A3520;
  --amarelo: #8A6500;
  --foco: #000000;
}
```

- [ ] **Step 2: Criar `site/assets/css/base.css`**

```css
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--fundo);
  color: var(--tinta);
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  font-size: var(--texto-base);
  line-height: 1.6;
}

h1, h2, h3 { line-height: 1.25; margin: 0 0 var(--espaco-3); }
h1 { font-size: var(--texto-titulo); }
h2 { font-size: var(--texto-grande); }
p  { margin: 0 0 var(--espaco-3); max-width: 60ch; }

a { color: var(--azul-texto); }

img { max-width: 100%; height: auto; }

/* Foco sempre visível — RNF02. Nunca remover sem substituir. */
:focus-visible {
  outline: 3px solid var(--foco);
  outline-offset: 2px;
  border-radius: 2px;
}

.pular-para-conteudo {
  position: absolute;
  left: var(--espaco-3);
  top: -4rem;
  z-index: 100;
  padding: var(--espaco-2) var(--espaco-3);
  background: var(--superficie);
  color: var(--tinta);
  border: 2px solid var(--foco);
  border-radius: var(--raio);
  transition: top 0.15s;
}
.pular-para-conteudo:focus { top: var(--espaco-3); }

.conteudo {
  max-width: var(--largura-conteudo);
  margin: 0 auto;
  padding: var(--espaco-4) var(--espaco-3);
}

/* Visível só para leitor de tela. */
.apenas-leitor-de-tela {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```

- [ ] **Step 3: Criar `site/index.html`**

Conteúdo institucional real das seções 1 e 18 do escopo. Nenhum texto inventado.

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ateliê Afro Cultural</title>
  <meta name="description" content="Espaço educativo de criação, reflexão e valorização da cultura e memória afro brasileira.">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/base.css">
  <link rel="stylesheet" href="assets/css/componentes.css">
  <!-- Sincrono e antes do corpo: aplica a preferencia antes da primeira pintura. -->
  <script src="assets/js/preferencias-inicial.js"></script>
</head>
<body>
  <a class="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>

  <aac-header pagina-atual="inicio"></aac-header>

  <main id="conteudo" class="conteudo">
    <h1>Ateliê Afro Cultural</h1>
    <p class="slogan">Espaço educativo de criação, reflexão e valorização da cultura e memória afro brasileira.</p>

    <section aria-labelledby="titulo-setores">
      <h2 id="titulo-setores">Nossos três setores</h2>

      <article>
        <h3>Literário</h3>
        <p>Livros de temática negra, leituras, pesquisas, análises, contação de histórias, exercícios e técnicas de teatro.</p>
      </article>

      <article>
        <h3>Musical</h3>
        <p>Cantigas, instrumentos e corporeidade negra, movimentos de capoeira: jongo, maculelê, maracatu, forró, samba, rap, hip hop e funk.</p>
      </article>

      <article>
        <h3>Artístico criativo</h3>
        <p>Pintura em tela, materiais reciclados para figurinos e cenários, desenho, escultura e colagem.</p>
      </article>
    </section>
  </main>

  <aac-rodape></aac-rodape>

  <script type="module" src="assets/js/componentes/aac-header.js"></script>
  <script type="module" src="assets/js/componentes/aac-rodape.js"></script>
</body>
</html>
```

- [ ] **Step 4: Criar `netlify.toml`**

```toml
[build]
  publish = "site"
  command = ""

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    X-Frame-Options = "DENY"
```

- [ ] **Step 5: Verificar que a página abre**

Run: `python3 -m http.server 8080 --directory site`
Abrir `http://localhost:8080` — o conteúdo de `<main>` deve aparecer com a paleta aplicada. Cabeçalho e rodapé ainda não renderizam (os componentes vêm nas tarefas 3 e 4); isso é esperado.

- [ ] **Step 6: Commit**

```bash
git add site/assets/css site/index.html netlify.toml
git commit -m "Sistema visual e página inicial

Tokens da paleta declarada pela ONG, base tipográfica em rem para que
o controle de tamanho de fonte alcance o site inteiro, e variante de
alto contraste redefinindo os mesmos tokens."
```

---

### Task 2: Lógica de preferências de acessibilidade

O miolo testável dos controles A- / A / A+ e alto contraste. Módulo puro, sem DOM — é o que permite testar em Node sem navegador.

**Files:**
- Create: `site/assets/js/util/preferencias.js`
- Test: `testes/preferencias.test.mjs`

**Interfaces:**
- Consumes: as custom properties da Task 1
- Produces:
  - `ESCALAS: number[]` — os cinco degraus percentuais disponíveis
  - `PADRAO: {escala: number, contraste: 'normal'|'alto'}`
  - `proximaEscala(atual: number, direcao: -1|1): number` — degrau seguinte, limitado às pontas
  - `lerPreferencias(armazenamento: Storage): {escala, contraste}` — nunca lança; devolve `PADRAO` em qualquer falha
  - `gravarPreferencias(armazenamento: Storage, prefs): void` — nunca lança
  - `CHAVE_ARMAZENAMENTO: string`

- [ ] **Step 1: Escrever o teste que falha**

Create `testes/preferencias.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESCALAS, PADRAO, CHAVE_ARMAZENAMENTO,
  proximaEscala, lerPreferencias, gravarPreferencias
} from '../site/assets/js/util/preferencias.js';

/** Dublê de localStorage. Aceita falhar de propósito para testar o modo anônimo. */
function armazenamentoFalso({ conteudo = {}, quebrado = false } = {}) {
  return {
    getItem(chave) {
      if (quebrado) throw new Error('acesso negado');
      return chave in conteudo ? conteudo[chave] : null;
    },
    setItem(chave, valor) {
      if (quebrado) throw new Error('acesso negado');
      conteudo[chave] = String(valor);
    },
    conteudo
  };
}

test('proximaEscala avança um degrau', () => {
  assert.equal(proximaEscala(100, 1), ESCALAS[ESCALAS.indexOf(100) + 1]);
});

test('proximaEscala retrocede um degrau', () => {
  assert.equal(proximaEscala(100, -1), ESCALAS[ESCALAS.indexOf(100) - 1]);
});

test('proximaEscala para no maior degrau em vez de estourar', () => {
  const maior = ESCALAS[ESCALAS.length - 1];
  assert.equal(proximaEscala(maior, 1), maior);
});

test('proximaEscala para no menor degrau em vez de estourar', () => {
  assert.equal(proximaEscala(ESCALAS[0], -1), ESCALAS[0]);
});

test('proximaEscala volta ao padrão diante de valor desconhecido', () => {
  assert.equal(proximaEscala(999, 1), PADRAO.escala);
});

test('lerPreferencias devolve o padrão quando nada foi gravado', () => {
  assert.deepEqual(lerPreferencias(armazenamentoFalso()), PADRAO);
});

test('lerPreferencias recupera o que foi gravado', () => {
  const armazenamento = armazenamentoFalso();
  gravarPreferencias(armazenamento, { escala: 125, contraste: 'alto' });
  assert.deepEqual(lerPreferencias(armazenamento), { escala: 125, contraste: 'alto' });
});

test('lerPreferencias ignora conteúdo corrompido em vez de quebrar a página', () => {
  const armazenamento = armazenamentoFalso({
    conteudo: { [CHAVE_ARMAZENAMENTO]: 'isto não é json' }
  });
  assert.deepEqual(lerPreferencias(armazenamento), PADRAO);
});

test('lerPreferencias descarta escala fora da lista de degraus', () => {
  const armazenamento = armazenamentoFalso({
    conteudo: { [CHAVE_ARMAZENAMENTO]: JSON.stringify({ escala: 9999, contraste: 'normal' }) }
  });
  assert.equal(lerPreferencias(armazenamento).escala, PADRAO.escala);
});

test('lerPreferencias não lança quando o armazenamento é inacessível', () => {
  // Navegador em modo anônimo com cookies bloqueados lança ao tocar em localStorage.
  assert.deepEqual(lerPreferencias(armazenamentoFalso({ quebrado: true })), PADRAO);
});

test('gravarPreferencias não lança quando o armazenamento é inacessível', () => {
  assert.doesNotThrow(() =>
    gravarPreferencias(armazenamentoFalso({ quebrado: true }), PADRAO));
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test testes/preferencias.test.mjs`
Expected: FAIL — `Cannot find module .../util/preferencias.js`

- [ ] **Step 3: Escrever a implementação mínima**

Create `site/assets/js/util/preferencias.js`:

```js
/**
 * Preferências de acessibilidade: tamanho de fonte e alto contraste.
 * Módulo puro, sem DOM — quem aplica no documento é aac-acessibilidade.js.
 * Nenhuma função aqui lança: preferência é conforto, e conforto que
 * derruba a página deixa de ser conforto.
 */

export const CHAVE_ARMAZENAMENTO = 'aac-preferencias';

/** Cinco degraus, de 87,5% a 137,5%. */
export const ESCALAS = [87.5, 100, 112.5, 125, 137.5];

export const PADRAO = Object.freeze({ escala: 100, contraste: 'normal' });

export function proximaEscala(atual, direcao) {
  const posicao = ESCALAS.indexOf(atual);
  if (posicao === -1) return PADRAO.escala;
  const destino = posicao + direcao;
  if (destino < 0 || destino >= ESCALAS.length) return atual;
  return ESCALAS[destino];
}

export function lerPreferencias(armazenamento) {
  try {
    const bruto = armazenamento.getItem(CHAVE_ARMAZENAMENTO);
    if (!bruto) return { ...PADRAO };
    const guardado = JSON.parse(bruto);
    return {
      escala: ESCALAS.includes(guardado.escala) ? guardado.escala : PADRAO.escala,
      contraste: guardado.contraste === 'alto' ? 'alto' : PADRAO.contraste
    };
  } catch {
    return { ...PADRAO };
  }
}

export function gravarPreferencias(armazenamento, preferencias) {
  try {
    armazenamento.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(preferencias));
  } catch {
    // Modo anônimo com armazenamento bloqueado. A preferência vale só nesta página.
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test testes/preferencias.test.mjs`
Expected: PASS — 11 testes

- [ ] **Step 5: Commit**

```bash
git add site/assets/js/util/preferencias.js testes/preferencias.test.mjs
git commit -m "Lógica de preferências de acessibilidade

Módulo puro com os degraus de escala e a leitura tolerante do
armazenamento: modo anônimo e conteúdo corrompido caem no padrão em
vez de derrubar a página."
```

---

### Task 3: Aplicação antes da pintura e componente de acessibilidade

**Files:**
- Create: `site/assets/js/preferencias-inicial.js`
- Create: `site/assets/js/componentes/aac-acessibilidade.js`
- Create: `site/assets/css/componentes.css`

**Interfaces:**
- Consumes: `preferencias.js` da Task 2; os tokens da Task 1
- Produces: o elemento `<aac-acessibilidade>`, consumido por `aac-header` na Task 4

- [ ] **Step 1: Criar `site/assets/js/preferencias-inicial.js`**

Script clássico, **não módulo**: precisa executar de forma síncrona no `<head>`, antes da primeira pintura. Um módulo ES é adiado por padrão e a página piscaria no tamanho errado a cada navegação — o que num site multi-página acontece o tempo todo. Ele duplica de propósito a leitura mínima do armazenamento; é o preço de não bloquear a renderização com um `import`.

```js
/* Aplica a preferência de acessibilidade antes da primeira pintura.
   Script classico e sincrono de proposito — ver comentario no plano. */
(function () {
  try {
    var guardado = window.localStorage.getItem('aac-preferencias');
    if (!guardado) return;
    var preferencias = JSON.parse(guardado);
    var escalas = [87.5, 100, 112.5, 125, 137.5];
    if (escalas.indexOf(preferencias.escala) !== -1) {
      document.documentElement.style.setProperty('--escala-fonte', preferencias.escala + '%');
    }
    if (preferencias.contraste === 'alto') {
      document.documentElement.setAttribute('data-contraste', 'alto');
    }
  } catch (erro) {
    /* Armazenamento indisponivel: segue no padrao. */
  }
})();
```

- [ ] **Step 2: Criar `site/assets/js/componentes/aac-acessibilidade.js`**

```js
import {
  ESCALAS, PADRAO, proximaEscala, lerPreferencias, gravarPreferencias
} from '../util/preferencias.js';

/**
 * Controles de tamanho de fonte e alto contraste.
 * Sem Shadow DOM: os tokens precisam alcançar a página inteira.
 */
class AacAcessibilidade extends HTMLElement {
  connectedCallback() {
    this.preferencias = lerPreferencias(window.localStorage);
    this.render();
    this.aplicar();
  }

  render() {
    this.innerHTML = `
      <div class="acessibilidade" role="group" aria-label="Acessibilidade">
        <button type="button" data-acao="diminuir" aria-label="Diminuir tamanho do texto">A-</button>
        <button type="button" data-acao="padrao"   aria-label="Tamanho normal do texto">A</button>
        <button type="button" data-acao="aumentar" aria-label="Aumentar tamanho do texto">A+</button>
        <button type="button" data-acao="contraste" aria-pressed="false">Alto contraste</button>
        <p class="apenas-leitor-de-tela" role="status" data-papel="anuncio"></p>
      </div>`;

    this.anuncio = this.querySelector('[data-papel="anuncio"]');
    this.addEventListener('click', (evento) => {
      const botao = evento.target.closest('button[data-acao]');
      if (botao) this.executar(botao.dataset.acao);
    });
  }

  executar(acao) {
    if (acao === 'aumentar')  this.preferencias.escala = proximaEscala(this.preferencias.escala, 1);
    if (acao === 'diminuir')  this.preferencias.escala = proximaEscala(this.preferencias.escala, -1);
    if (acao === 'padrao')    this.preferencias.escala = PADRAO.escala;
    if (acao === 'contraste') {
      this.preferencias.contraste = this.preferencias.contraste === 'alto' ? 'normal' : 'alto';
    }
    gravarPreferencias(window.localStorage, this.preferencias);
    this.aplicar();
    this.anunciar(acao);
  }

  aplicar() {
    const raiz = document.documentElement;
    raiz.style.setProperty('--escala-fonte', `${this.preferencias.escala}%`);
    if (this.preferencias.contraste === 'alto') {
      raiz.setAttribute('data-contraste', 'alto');
    } else {
      raiz.removeAttribute('data-contraste');
    }
    const alto = this.preferencias.contraste === 'alto';
    this.querySelector('[data-acao="contraste"]').setAttribute('aria-pressed', String(alto));

    // Nas pontas o botão fica inerte, e isso precisa ser perceptível sem ver a tela.
    this.querySelector('[data-acao="aumentar"]').disabled =
      this.preferencias.escala === ESCALAS[ESCALAS.length - 1];
    this.querySelector('[data-acao="diminuir"]').disabled =
      this.preferencias.escala === ESCALAS[0];
  }

  /** Quem usa leitor de tela não vê o texto crescer: precisa ser dito. */
  anunciar(acao) {
    this.anuncio.textContent = acao === 'contraste'
      ? (this.preferencias.contraste === 'alto' ? 'Alto contraste ativado' : 'Alto contraste desativado')
      : `Texto em ${this.preferencias.escala}%`;
  }
}

customElements.define('aac-acessibilidade', AacAcessibilidade);
```

- [ ] **Step 3: Criar `site/assets/css/componentes.css`**

```css
.acessibilidade {
  display: flex;
  gap: var(--espaco-2);
  align-items: center;
  flex-wrap: wrap;
}

.acessibilidade button {
  min-height: var(--alvo-toque);
  min-width: var(--alvo-toque);
  padding: 0 var(--espaco-2);
  background: var(--superficie);
  color: var(--tinta);
  border: 2px solid var(--borda);
  border-radius: var(--raio);
  font-size: var(--texto-base);
  font-family: inherit;
  cursor: pointer;
}

.acessibilidade button:hover:not(:disabled) { border-color: var(--azul-texto); }
.acessibilidade button:disabled { opacity: 0.45; cursor: default; }
.acessibilidade button[aria-pressed="true"] {
  background: var(--tinta);
  color: var(--fundo);
  border-color: var(--tinta);
}
```

- [ ] **Step 4: Verificar no navegador**

Run: `python3 -m http.server 8080 --directory site`

Confirmar, com `<aac-acessibilidade></aac-acessibilidade>` inserido temporariamente em `index.html`:
1. A+ aumenta o texto de toda a página, não só do cabeçalho
2. A+ no último degrau desabilita o botão
3. Alto contraste troca fundo e texto
4. **Recarregar a página mantém a escolha e não pisca no tamanho errado** — é o que a Step 1 existe para garantir
5. Tab alcança os quatro botões, com contorno de foco visível
6. Espaço e Enter acionam

- [ ] **Step 5: Commit**

```bash
git add site/assets/js/preferencias-inicial.js site/assets/js/componentes/aac-acessibilidade.js site/assets/css/componentes.css
git commit -m "Controles de tamanho de fonte e alto contraste

Aplicação síncrona no head evita o piscar entre páginas. Os botões
anunciam a mudança por região live, porque quem usa leitor de tela
não vê o texto crescer."
```

---

### Task 4: Cabeçalho e rodapé

**Files:**
- Create: `site/assets/js/componentes/aac-header.js`
- Create: `site/assets/js/componentes/aac-rodape.js`
- Modify: `site/assets/css/componentes.css`
- Modify: `site/index.html` (remover o `<aac-acessibilidade>` temporário inserido na Task 3, Step 4)

**Interfaces:**
- Consumes: `<aac-acessibilidade>` da Task 3
- Produces: `<aac-header pagina-atual="...">` e `<aac-rodape>`, usados por toda página criada da Fase 01 em diante. O valor de `pagina-atual` é a chave do item de menu correspondente: `inicio`, `quem-somos`, `projetos`, `agenda`, `noticias`, `galeria`, `acervo`, `para-escolas`, `voluntariado`, `doar`, `contato`.

- [ ] **Step 1: Criar `site/assets/js/componentes/aac-header.js`**

```js
import './aac-acessibilidade.js';

const ITENS = [
  { chave: 'inicio',       texto: 'Início',        href: '/index.html' },
  { chave: 'quem-somos',   texto: 'Quem somos',    href: '/quem-somos.html' },
  { chave: 'projetos',     texto: 'Projetos',      href: '/projetos.html' },
  { chave: 'agenda',       texto: 'Agenda',        href: '/agenda.html' },
  { chave: 'acervo',       texto: 'Acervo',        href: '/acervo.html' },
  { chave: 'para-escolas', texto: 'Para escolas',  href: '/para-escolas.html' },
  { chave: 'voluntariado', texto: 'Voluntariado',  href: '/voluntariado.html' },
  { chave: 'doar',         texto: 'Apoiar',        href: '/doar.html' },
  { chave: 'contato',      texto: 'Contato',       href: '/contato.html' }
];

class AacHeader extends HTMLElement {
  connectedCallback() {
    const atual = this.getAttribute('pagina-atual') || '';

    this.innerHTML = `
      <header class="cabecalho">
        <div class="cabecalho__topo">
          <a class="cabecalho__marca" href="/index.html">
            <img src="/assets/img/logo-atelie-afro-cultural.png"
                 alt="Ateliê Afro Cultural" width="48" height="48">
            <span>Ateliê Afro Cultural</span>
          </a>

          <button class="cabecalho__alternar" type="button"
                  aria-expanded="false" aria-controls="menu-principal">
            Menu
          </button>

          <aac-acessibilidade></aac-acessibilidade>
        </div>

        <nav id="menu-principal" class="cabecalho__menu" aria-label="Principal" hidden>
          <ul>
            ${ITENS.map((item) => `
              <li>
                <a href="${item.href}"${item.chave === atual ? ' aria-current="page"' : ''}>
                  ${item.texto}
                </a>
              </li>`).join('')}
          </ul>
        </nav>
      </header>`;

    this.alternar = this.querySelector('.cabecalho__alternar');
    this.menu = this.querySelector('.cabecalho__menu');

    this.alternar.addEventListener('click', () => this.alternarMenu());
    // Esc fecha o menu — esperado por quem navega por teclado.
    this.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && this.aberto()) {
        this.alternarMenu();
        this.alternar.focus();
      }
    });

    this.ajustarAoTamanho();
    window.addEventListener('resize', () => this.ajustarAoTamanho());
  }

  aberto() { return this.alternar.getAttribute('aria-expanded') === 'true'; }

  alternarMenu() {
    const abrindo = !this.aberto();
    this.alternar.setAttribute('aria-expanded', String(abrindo));
    this.menu.hidden = !abrindo;
  }

  /** No desktop o menu é sempre visível e o botão não faz sentido. */
  ajustarAoTamanho() {
    const desktop = window.matchMedia('(min-width: 48rem)').matches;
    this.alternar.hidden = desktop;
    if (desktop) {
      this.menu.hidden = false;
      this.alternar.setAttribute('aria-expanded', 'false');
    } else if (this.alternar.getAttribute('aria-expanded') !== 'true') {
      this.menu.hidden = true;
    }
  }
}

customElements.define('aac-header', AacHeader);
```

- [ ] **Step 2: Criar `site/assets/js/componentes/aac-rodape.js`**

Os cinco contatos do RF06 são dados reais da seção 1 do escopo. O `<noscript>` existe porque o cabeçalho depende de JavaScript: sem ele, uma página com JS desativado não teria nenhuma navegação.

```js
class AacRodape extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="rodape">
        <div class="rodape__conteudo">
          <section aria-labelledby="rodape-contato">
            <h2 id="rodape-contato">Fale com a gente</h2>
            <ul class="rodape__lista">
              <li><a href="tel:+5511953968344">(11) 95396-8344</a></li>
              <li><a href="https://wa.me/5511953968344">WhatsApp</a></li>
              <li><a href="mailto:atelieafro@gmail.com">atelieafro@gmail.com</a></li>
              <li><a href="https://instagram.com/atelie_afrocultural" rel="noopener">Instagram</a></li>
              <li><a href="https://tiktok.com/@ateli.afro.cultur" rel="noopener">TikTok</a></li>
            </ul>
          </section>

          <section aria-labelledby="rodape-endereco">
            <h2 id="rodape-endereco">Onde estamos</h2>
            <address>
              Rua Dr. Paulo Gatti, 135 — Vila Romero<br>
              São Paulo/SP — CEP 02468-030
            </address>
          </section>
        </div>

        <p class="rodape__aviso">
          <a href="/privacidade.html">Política de privacidade</a>
        </p>

        <noscript>
          <nav aria-label="Navegação sem JavaScript">
            <ul class="rodape__lista">
              <li><a href="/index.html">Início</a></li>
              <li><a href="/quem-somos.html">Quem somos</a></li>
              <li><a href="/projetos.html">Projetos</a></li>
              <li><a href="/agenda.html">Agenda</a></li>
              <li><a href="/acervo.html">Acervo</a></li>
              <li><a href="/para-escolas.html">Para escolas</a></li>
              <li><a href="/voluntariado.html">Voluntariado</a></li>
              <li><a href="/doar.html">Apoiar</a></li>
              <li><a href="/contato.html">Contato</a></li>
            </ul>
          </nav>
        </noscript>
      </footer>

      <div vw class="enabled">
        <div vw-access-button class="active"></div>
        <div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>
      </div>`;

    this.carregarVLibras();
  }

  /** VLibras é widget gratuito do gov.br. Se não carregar, o rodapé segue inteiro. */
  carregarVLibras() {
    if (document.querySelector('script[data-vlibras]')) return;
    const script = document.createElement('script');
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.async = true;
    script.dataset.vlibras = 'true';
    script.onload = () => {
      try { new window.VLibras.Widget('https://vlibras.gov.br/app'); } catch { /* sem Libras */ }
    };
    document.body.appendChild(script);
  }
}

customElements.define('aac-rodape', AacRodape);
```

- [ ] **Step 3: Acrescentar o estilo a `site/assets/css/componentes.css`**

```css
.cabecalho {
  background: var(--superficie);
  border-bottom: 3px solid var(--amarelo);
}

.cabecalho__topo {
  max-width: var(--largura-conteudo);
  margin: 0 auto;
  padding: var(--espaco-3);
  display: flex;
  align-items: center;
  gap: var(--espaco-3);
  flex-wrap: wrap;
}

.cabecalho__marca {
  display: flex;
  align-items: center;
  gap: var(--espaco-2);
  font-weight: 700;
  color: var(--tinta);
  text-decoration: none;
  margin-right: auto;
}

.cabecalho__alternar {
  min-height: var(--alvo-toque);
  padding: 0 var(--espaco-3);
  background: var(--amarelo);
  color: var(--tinta);
  border: 2px solid transparent;
  border-radius: var(--raio);
  font-size: var(--texto-base);
  font-family: inherit;
  cursor: pointer;
}

.cabecalho__menu ul {
  list-style: none;
  margin: 0;
  padding: 0 var(--espaco-3) var(--espaco-3);
  max-width: var(--largura-conteudo);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: var(--espaco-1);
}

.cabecalho__menu a {
  display: block;
  min-height: var(--alvo-toque);
  padding: var(--espaco-2) var(--espaco-2);
  color: var(--tinta);
  text-decoration: none;
  border-radius: var(--raio);
}

.cabecalho__menu a:hover { background: var(--fundo); }
.cabecalho__menu a[aria-current="page"] {
  font-weight: 700;
  box-shadow: inset 3px 0 0 var(--amarelo);
}

@media (min-width: 48rem) {
  .cabecalho__menu ul { flex-direction: row; flex-wrap: wrap; gap: var(--espaco-2); }
  .cabecalho__menu a[aria-current="page"] {
    box-shadow: inset 0 -3px 0 var(--amarelo);
  }
}

.rodape {
  margin-top: var(--espaco-6);
  padding: var(--espaco-5) var(--espaco-3);
  background: var(--marrom);
  color: #FFFFFF;
}

.rodape a { color: #FFFFFF; }

.rodape__conteudo {
  max-width: var(--largura-conteudo);
  margin: 0 auto;
  display: grid;
  gap: var(--espaco-4);
}

@media (min-width: 48rem) {
  .rodape__conteudo { grid-template-columns: 1fr 1fr; }
}

.rodape__lista { list-style: none; margin: 0; padding: 0; }
.rodape__lista li { margin-bottom: var(--espaco-2); }
.rodape__lista a { display: inline-block; min-height: var(--alvo-toque); line-height: var(--alvo-toque); }

.rodape__aviso {
  max-width: var(--largura-conteudo);
  margin: var(--espaco-4) auto 0;
}

html[data-contraste="alto"] .rodape {
  background: #000000;
  border-top: 3px solid #FFFFFF;
}
```

- [ ] **Step 4: Colocar um logotipo provisório**

Enquanto a equipe não entrega o vetor (decisão D9), extrair um logotipo utilizável do material recebido:

```bash
mkdir -p site/assets/img
cp "material-origem/( Ateliê Afro Cultural ).jpg.jpeg" site/assets/img/logo-atelie-afro-cultural.png
```

Se a imagem não servir como marca, deixar `site/assets/img/logo-atelie-afro-cultural.png` como um quadrado sólido em `--amarelo` e **registrar a pendência** — nunca inventar um logotipo.

- [ ] **Step 5: Verificar no navegador**

Run: `python3 -m http.server 8080 --directory site`

1. Em janela estreita (375px): o botão Menu aparece, abre e fecha, e Esc fecha devolvendo o foco ao botão
2. Em janela larga (1200px): o menu aparece sempre e o botão some
3. O item "Início" tem `aria-current="page"` na home
4. Os cinco contatos do RF06 estão no rodapé e os links funcionam
5. Com JavaScript desativado no navegador: o `<main>` continua legível e o `<noscript>` do rodapé oferece navegação

- [ ] **Step 6: Commit**

```bash
git add site/assets/js/componentes site/assets/css/componentes.css site/assets/img site/index.html
git commit -m "Cabeçalho e rodapé compartilhados

Menu sanduíche no celular com Esc e foco devolvido, cinco contatos do
RF06 no rodapé e navegação em noscript, já que o cabeçalho depende de
JavaScript."
```

---

### Task 5: Mensagens de erro e estados de lista

Os dois utilitários que impedem 15 telas de inventarem 15 comportamentos diferentes quando a rede cai.

**Files:**
- Create: `site/assets/js/util/erros.js`
- Create: `site/assets/js/util/estados-lista.js`
- Test: `testes/erros.test.mjs`

**Interfaces:**
- Consumes: nada
- Produces:
  - `mensagemDeErro(erro: unknown, contexto?: string): {titulo: string, acao: string|null}`
  - `renderizarEstado(elemento: HTMLElement, estado, desenhar: (itens) => string): void`
    onde `estado` é `{situacao: 'carregando'|'pronto'|'vazio'|'erro', itens?: unknown[], erro?: unknown, contexto?: string, mensagemVazio?: string, aoTentarDeNovo?: () => void}`

- [ ] **Step 1: Escrever o teste que falha**

Create `testes/erros.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensagemDeErro } from '../site/assets/js/util/erros.js';

test('falha de rede diz o que fazer', () => {
  const resultado = mensagemDeErro(new TypeError('Failed to fetch'), 'a agenda');
  assert.match(resultado.titulo, /conex/i);
  assert.equal(resultado.acao, 'Tentar de novo');
});

test('o contexto entra na mensagem', () => {
  const resultado = mensagemDeErro(new TypeError('Failed to fetch'), 'a agenda');
  assert.match(resultado.titulo, /agenda/);
});

test('nenhuma mensagem pede desculpas', () => {
  // Regra da seção 11 do escopo: dizer o que houve e o que fazer, sem se desculpar.
  const casos = [
    new TypeError('Failed to fetch'),
    { code: 'PGRST301' },
    { code: '23505' },
    new Error('qualquer outra coisa'),
    null
  ];
  for (const caso of casos) {
    const { titulo } = mensagemDeErro(caso, 'a agenda');
    assert.doesNotMatch(titulo, /desculp|ops|oops|infelizmente/i);
  }
});

test('nenhuma mensagem vaza jargão técnico', () => {
  const { titulo } = mensagemDeErro(new TypeError('Failed to fetch'), 'a agenda');
  assert.doesNotMatch(titulo, /fetch|null|undefined|error|http|500/i);
});

test('sessão expirada orienta a entrar de novo', () => {
  const resultado = mensagemDeErro({ code: 'PGRST301' }, 'o painel');
  assert.match(resultado.titulo, /entrar de novo/i);
});

test('registro duplicado é explicado, não codificado', () => {
  const resultado = mensagemDeErro({ code: '23505' }, 'a inscrição');
  assert.match(resultado.titulo, /já/i);
  assert.equal(resultado.acao, null);
});

test('erro desconhecido ainda produz mensagem útil', () => {
  const resultado = mensagemDeErro(null, 'a agenda');
  assert.ok(resultado.titulo.length > 0);
  assert.equal(resultado.acao, 'Tentar de novo');
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test testes/erros.test.mjs`
Expected: FAIL — `Cannot find module .../util/erros.js`

- [ ] **Step 3: Escrever a implementação**

Create `site/assets/js/util/erros.js`:

```js
/**
 * Tradução de falha técnica em mensagem para pessoas.
 * Regra da seção 11 do escopo: dizer o que houve e como resolver,
 * sem pedir desculpas e sem vaguidão.
 */

export function mensagemDeErro(erro, contexto = 'esta página') {
  const codigo = erro && typeof erro === 'object' ? erro.code : undefined;

  if (codigo === 'PGRST301' || codigo === '401') {
    return { titulo: 'Sua sessão terminou. É preciso entrar de novo para continuar.', acao: 'Entrar' };
  }

  if (codigo === '23505') {
    return { titulo: 'Este cadastro já existe.', acao: null };
  }

  if (codigo === '42501' || codigo === 'PGRST116') {
    return { titulo: 'Esta parte do sistema é da equipe do Ateliê.', acao: null };
  }

  if (erro instanceof TypeError || codigo === 'ECONNREFUSED') {
    return {
      titulo: `Não foi possível carregar ${contexto}. Verifique sua conexão.`,
      acao: 'Tentar de novo'
    };
  }

  return {
    titulo: `Não foi possível carregar ${contexto} agora.`,
    acao: 'Tentar de novo'
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test testes/erros.test.mjs`
Expected: PASS — 7 testes

- [ ] **Step 5: Criar `site/assets/js/util/estados-lista.js`**

```js
import { mensagemDeErro } from './erros.js';

/**
 * Os três estados obrigatórios de toda lista: carregando, vazio e erro.
 * Sem isto, cada tela inventa o seu — e a página fica em branco quando
 * o sinal cai no meio de um evento.
 */
export function renderizarEstado(elemento, estado, desenhar) {
  const { situacao, itens = [], erro, contexto = 'esta lista',
          mensagemVazio = 'Nada por aqui ainda.', aoTentarDeNovo } = estado;

  if (situacao === 'carregando') {
    elemento.setAttribute('aria-busy', 'true');
    elemento.innerHTML = `<p class="estado estado--carregando" role="status">Carregando…</p>`;
    return;
  }

  elemento.setAttribute('aria-busy', 'false');

  if (situacao === 'erro') {
    const { titulo, acao } = mensagemDeErro(erro, contexto);
    elemento.innerHTML = `
      <div class="estado estado--erro" role="alert">
        <p>${titulo}</p>
        ${acao && aoTentarDeNovo ? `<button type="button" data-acao="repetir">${acao}</button>` : ''}
      </div>`;
    const botao = elemento.querySelector('[data-acao="repetir"]');
    if (botao) botao.addEventListener('click', aoTentarDeNovo);
    return;
  }

  if (situacao === 'vazio' || itens.length === 0) {
    elemento.innerHTML = `<p class="estado estado--vazio">${mensagemVazio}</p>`;
    return;
  }

  elemento.innerHTML = desenhar(itens);
}
```

- [ ] **Step 6: Acrescentar o estilo dos estados a `site/assets/css/componentes.css`**

```css
.estado {
  padding: var(--espaco-4);
  border: 2px dashed var(--borda);
  border-radius: var(--raio);
  color: var(--tinta-suave);
}

.estado--erro {
  border-style: solid;
  border-color: var(--marrom);
  color: var(--tinta);
}

.estado--erro button {
  min-height: var(--alvo-toque);
  padding: 0 var(--espaco-3);
  background: var(--amarelo);
  color: var(--tinta);
  border: 2px solid transparent;
  border-radius: var(--raio);
  font-size: var(--texto-base);
  font-family: inherit;
  cursor: pointer;
}
```

- [ ] **Step 7: Commit**

```bash
git add site/assets/js/util/erros.js site/assets/js/util/estados-lista.js site/assets/css/componentes.css testes/erros.test.mjs
git commit -m "Mensagens de erro e estados de lista

Tradução de falha técnica em mensagem que diz o que fazer, com teste
garantindo que nenhuma variante pede desculpas nem vaza jargão."
```

---

### Task 6: Configuração do Supabase e cliente

Prepara o contrato de acesso ao banco sem que o banco precise existir. As chaves entram quando a equipe criar o projeto.

**Files:**
- Create: `site/config.js`
- Create: `site/assets/js/dados/supabase.js`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nada
- Produces:
  - `CONFIG: {supabaseUrl: string, supabaseAnonKey: string}` (de `config.js`)
  - `obterCliente(): SupabaseClient` — cliente único, criado sob demanda
  - `supabaseConfigurado(): boolean` — permite às páginas da Fase 01 funcionarem antes de o banco existir

- [ ] **Step 1: Criar `site/config.js`**

A anon key é pública por construção — o site é estático e ela aparece no código-fonte de qualquer forma. Quem protege os dados é a RLS, não o sigilo desta chave. Ver seção 12 do escopo.

```js
/**
 * Configuracao publica do front.
 *
 * A anon key e publica por construcao: o site e estatico e ela aparece
 * no codigo-fonte. O que protege os dados e a Row Level Security no
 * Postgres, nunca o sigilo desta chave.
 *
 * A service role key NUNCA entra neste arquivo nem em qualquer outro do
 * repositorio. Ela existe apenas como secret da Edge Function.
 */
export const CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
```

- [ ] **Step 2: Criar `site/assets/js/dados/supabase.js`**

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from '../../../config.js';

let cliente = null;

export function supabaseConfigurado() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

/**
 * Cliente único do Supabase.
 *
 * Regra do projeto: nenhuma página chama este cliente diretamente.
 * As páginas usam os módulos de dados (eventos.js, doacoes.js, …), que
 * são os únicos consumidores daqui. Isso mantém a mudança de schema
 * restrita a um arquivo em vez de espalhada por quinze páginas.
 */
export function obterCliente() {
  if (!supabaseConfigurado()) {
    throw new Error('Supabase ainda não configurado em site/config.js');
  }
  if (!cliente) {
    cliente = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  }
  return cliente;
}
```

- [ ] **Step 3: Acrescentar a nota de segurança ao `.gitignore`**

```
material-origem/
acervo-web/
*.zip
node_modules/
.env
.env.*
supabase/.temp/

# A service role key nunca entra no repositorio: ela vive como secret
# da Edge Function. Se algum arquivo com ela aparecer aqui, e engano.
**/service-role*
```

- [ ] **Step 4: Verificar que o módulo carrega sem chaves**

Run: `node --input-type=module -e "import('./site/assets/js/dados/supabase.js').then(m => console.log('configurado:', m.supabaseConfigurado()))"`

Expected: pode falhar ao resolver o import remoto do esm.sh em Node — isso é esperado e não é problema, porque o módulo só roda no navegador. A verificação que vale é no navegador: abrir `index.html` e confirmar que **nenhum erro de console aparece**, já que nenhuma página desta fase importa este módulo ainda.

- [ ] **Step 5: Commit**

```bash
git add site/config.js site/assets/js/dados/supabase.js .gitignore
git commit -m "Cliente Supabase e configuração pública

Chaves vazias até a equipe criar o projeto. A anon key é pública por
construção; a service role fica fora do repositório."
```

---

### Task 7: Verificação da fundação

Fecha a fase provando que o que foi construído atende os critérios que a Fase 01 vai assumir como dados.

**Files:**
- Create: `docs/verificacao-fase-00.md`

**Interfaces:**
- Consumes: tudo das tarefas 1 a 6
- Produces: registro de verificação, referenciado pelo aceite da seção 14 do escopo

- [ ] **Step 1: Rodar toda a suíte de testes**

Run: `node --test`
Expected: PASS — 18 testes (11 de preferências, 7 de erros)

- [ ] **Step 2: Rodar a auditoria automatizada de acessibilidade**

```bash
python3 -m http.server 8080 --directory site &
npx --yes @axe-core/cli http://localhost:8080/index.html
```

Expected: zero violações. Se aparecer alguma, corrigir antes de seguir — não registrar como pendência.

- [ ] **Step 3: Executar a verificação manual de teclado**

Com o servidor no ar, sem tocar no mouse:

1. Tab a partir do topo alcança primeiro "Pular para o conteúdo"
2. Acionar esse link move o foco para `<main>`
3. Tab alcança os quatro botões de acessibilidade, o botão Menu e todos os links
4. Todo elemento focado tem contorno visível
5. Esc fecha o menu no celular e devolve o foco ao botão Menu
6. A+ cinco vezes: o texto cresce e nenhum conteúdo fica cortado ou sobreposto
7. Alto contraste: todo texto permanece legível, inclusive no rodapé

- [ ] **Step 4: Verificar em largura de celular**

Com o DevTools em 375px de largura: nenhuma barra de rolagem horizontal, todo alvo de toque com pelo menos 44px, e o menu abrindo e fechando.

- [ ] **Step 5: Registrar o resultado em `docs/verificacao-fase-00.md`**

Escrever o que **de fato** foi observado, com a data. Item que não passou fica registrado como não passou — a fase 01 precisa saber sobre o que está construindo.

```markdown
# Verificação — Fase 00 (Fundação)

Data: <preencher com a data da execução>

| Verificação | Resultado |
|---|---|
| `node --test` | <preencher> |
| axe-core em index.html | <preencher> |
| Navegação completa por teclado | <preencher> |
| Foco visível em todos os elementos | <preencher> |
| Escala de fonte de 87,5% a 137,5% sem quebra de layout | <preencher> |
| Alto contraste legível em todas as áreas | <preencher> |
| Preferência preservada ao recarregar, sem piscar | <preencher> |
| Sem rolagem horizontal em 375px | <preencher> |
| Alvos de toque ≥ 44px | <preencher> |
| Conteúdo legível com JavaScript desativado | <preencher> |

## Pendências levantadas

- Logotipo em vetor (decisão D9) — <preencher situação>
- Validação da paleta com a ONG (seção 3.4) — <preencher situação>
- Projeto Supabase na nuvem — bloqueia a Fase 02
```

- [ ] **Step 6: Commit**

```bash
git add docs/verificacao-fase-00.md
git commit -m "Verificação da Fase 00

Testes, auditoria de acessibilidade e checagem manual de teclado,
contraste e escala de fonte registrados."
```

---

## Ao terminar esta fase

A Fase 01 (site institucional, dias 26–27/08) assume como pronto:

- `<aac-header pagina-atual="...">` e `<aac-rodape>` funcionando em qualquer página
- Tokens, `base.css` e `componentes.css` cobrindo tipografia, foco, alvos de toque e alto contraste
- `renderizarEstado()` e `mensagemDeErro()` disponíveis
- `obterCliente()` e `supabaseConfigurado()` com contrato definido, chaves ainda vazias

**Bloqueio conhecido:** não há Docker nesta máquina, então o Supabase local não roda. A Fase 02 exige
o projeto criado na nuvem, região São Paulo. Essa é a dependência mais urgente da equipe.
