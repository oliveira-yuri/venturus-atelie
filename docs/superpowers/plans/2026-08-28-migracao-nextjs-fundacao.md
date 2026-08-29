# Migração para Next.js — Fase 1: Fundação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** levar o site do Ateliê Afro Cultural de estático puro para Next.js + TypeScript até a camada de dados no servidor, passando pelo portão go/no-go de acessibilidade.

**Arquitetura:** Next 16 App Router, Server Components por padrão e apenas 4 componentes de cliente. Toda consulta ao Supabase acontece no servidor com a sessão da pessoa, e os módulos de dados carregam `import 'server-only'` para que qualquer uso pelo cliente vire erro de build. CSP com nonce no middleware.

**Stack:** Next 16.3.3, React 19.2.8, TypeScript, `@supabase/ssr` 0.12.5, `supabase-js` 2.112.4, `@netlify/plugin-nextjs` 5.15.13, Node 24.15, `node --test` + selenium-webdriver (Firefox headless).

**Spec:** `docs/superpowers/specs/2026-08-28-migracao-nextjs-design.md`

## Restrições globais

Copiadas da spec. Valem para toda tarefa.

- **Paleta da ONG, inalterável:** amarelo `#E0A400`, azul `#7FA9CE`, marrom `#8A6A4A`
- **Nada de `vw` em texto** — ignora o controle A+, que é requisito da ONG
- **`hyphens: manual` pareado com `overflow-wrap: break-word`** — já está em `base.css:26-27`, preservar
- **Nunca inventar conteúdo.** Sem lorem ipsum. Campo sem dado real fica `null` e a seção some
- **Não é ONG assistencialista** — há teste que recusa linguagem de caridade
- **Sem `supabase-admin.ts`** e sem variável de ambiente com chave secreta em lugar nenhum
- **Nenhuma variável com prefixo `NEXT_PUBLIC_`**
- **Todo módulo em `servidor/dados/` começa com `import 'server-only'`**
- **Comentários e nomes em português**, seguindo o código existente
- **Trabalhar na branch `migracao-nextjs`.** `main` permanece com o site atual, publicável, até o portão da Tarefa 8 passar

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `app/layout.tsx` | `<html>` com `suppressHydrationWarning`, CSS, fontes, script anti-piscada, cabeçalho e rodapé |
| `app/page.tsx` | Home (portada na fase 2) |
| `middleware.ts` | Gera nonce, monta CSP, protege `/admin` (guarda na fase 2) |
| `componentes/Cabecalho.tsx` | Servidor: marca, link Entrar, menu |
| `componentes/MenuMovel.tsx` | Cliente: estado aberto/fechado, Esc, ajuste ao tamanho |
| `componentes/Acessibilidade.tsx` | Cliente: 4 botões, hidratação neutra |
| `componentes/Rodape.tsx` | Servidor: os 5 contatos do RF06 e o endereço |
| `componentes/VLibras.tsx` | Cliente: injeta o plugin com nonce e aplica a correção de acessibilidade |
| `componentes/FocoNaNavegacao.tsx` | Cliente: move foco e anuncia rota nova |
| `compartilhado/preferencias.ts` | Puro, sem DOM. Roda nos dois lados |
| `servidor/supabase.ts` | Cliente com sessão da pessoa, lida de cookie |
| `servidor/dados/*.ts` | Os 7 módulos, com `server-only` |
| `estilos/*.css` | As 1.066 linhas atuais, com 6 seletores ajustados |
| `ferramentas/rodar-testes.mjs` | Constrói uma vez, sobe um servidor, roda `node --test` contra ele |

---

## Tarefa 1: Esqueleto, TypeScript e deploy vazio

Prova o pipeline da Netlify antes de existir qualquer coisa a perder. Resolve a armadilha de dependências da spec §7.2.

**Arquivos:**
- Criar: `package.json` (modificar), `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `ferramentas/rodar-testes.mjs`
- Modificar: `netlify.toml`

**Interfaces:**
- Produz: `ferramentas/rodar-testes.mjs`, que exporta a URL do servidor pela variável `URL_BASE` para todos os testes de navegador das tarefas seguintes.

- [ ] **Passo 1: Criar a branch**

```bash
git checkout -b migracao-nextjs
```

- [ ] **Passo 2: Instalar as dependências, com a decisão da §7.2 aplicada**

`typescript` e `@types/*` vão para `dependencies`, não `devDependencies` — o `next build` precisa deles na Netlify, e manter `NPM_FLAGS="--omit=dev"` é o que impede o `embedded-postgres` de baixar binários do Postgres e derrubar o build, como já aconteceu uma vez.

```bash
npm install next@16.3.3 react@19.2.8 react-dom@19.2.8 \
  @supabase/supabase-js@2.112.4 @supabase/ssr@0.12.5 server-only@0.0.1 \
  typescript @types/node @types/react @types/react-dom
```

- [ ] **Passo 3: Conferir que as dev-only continuam dev-only**

```bash
node -e "const p=require('./package.json'); console.log('dev:', Object.keys(p.devDependencies||{}))"
```

Esperado: `selenium-webdriver` e `embedded-postgres`, e mais nada.

- [ ] **Passo 4: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "site", "testes"]
}
```

`"exclude"` lista `site` e `testes` de propósito: o site antigo continua no repositório até o portão passar, e os testes rodam em `node --test`, não pelo compilador.

- [ ] **Passo 5: `next.config.ts` mínimo**

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Os redirecionamentos das 15 URLs antigas entram na fase 2, quando as
  // páginas existirem. Redirecionar para rota inexistente é 404 com passo extra.
  reactStrictMode: true
};

export default config;
```

- [ ] **Passo 6: `app/layout.tsx` e `app/page.tsx` mínimos**

```tsx
// app/layout.tsx
export const metadata = {
  title: 'Ateliê Afro Cultural',
  description: 'Espaço educativo de criação, reflexão e valorização da cultura e memória afro brasileira, na Casa Verde, zona norte de São Paulo.'
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/page.tsx
export default function Home() {
  return <h1>Ateliê Afro Cultural</h1>;
}
```

O `suppressHydrationWarning` entra já: a Tarefa 3 acrescenta o script que altera atributos do `<html>`, e sem ele o React acusa divergência. Vale um nível só — o `<html>` e seus atributos — que é exatamente o escopo necessário.

- [ ] **Passo 7: `netlify.toml`**

```toml
[build]
  command = "next build"
  publish = ".next"

[build.environment]
  # Mantido: e o que impede o embedded-postgres (devDependency) de baixar os
  # binarios do PostgreSQL e derrubar o build, como ja aconteceu. Por isso
  # typescript e @types/* estao em dependencies — ver spec §7.2.
  NPM_FLAGS = "--omit=dev"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[[headers]]
  for = "/fontes/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

Os cabeçalhos de segurança saem daqui: a partir da Tarefa 6 quem os aplica é o `middleware.ts`, porque o CSP precisa de nonce por requisição e arquivo estático não gera nonce.

- [ ] **Passo 8: `ferramentas/rodar-testes.mjs`**

`node --test` roda cada arquivo em processo separado; subir o Next cinco vezes é lento demais. Constrói uma vez, sobe um servidor, roda tudo contra ele.

```js
/**
 * Constroi o site uma vez, sobe um servidor e roda a suite inteira contra ele.
 *
 * Os testes de navegador leem a URL de URL_BASE. Sem esta orquestracao, cada
 * arquivo de teste subiria o proprio Next — cinco builds por rodada.
 */
import { spawn, spawnSync } from 'node:child_process';

const porta = 3123;

console.log('Construindo...');
if (spawnSync('npx', ['next', 'build'], { stdio: 'inherit' }).status !== 0) {
  process.exit(1);
}

console.log(`Subindo em :${porta}...`);
const servidor = spawn('npx', ['next', 'start', '--port', String(porta)], {
  stdio: ['ignore', 'pipe', 'inherit']
});

const pronto = new Promise((resolve, reject) => {
  const limite = setTimeout(() => reject(new Error('servidor nao subiu em 60s')), 60_000);
  servidor.stdout.on('data', (bloco) => {
    if (String(bloco).includes('Ready')) { clearTimeout(limite); resolve(); }
  });
});

try {
  await pronto;
  const testes = spawnSync('node', ['--test'], {
    stdio: 'inherit',
    env: { ...process.env, URL_BASE: `http://localhost:${porta}` }
  });
  process.exitCode = testes.status ?? 1;
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  servidor.kill();
}
```

- [ ] **Passo 9: Apontar o `npm test` para ele**

Em `package.json`, `"test": "node ferramentas/rodar-testes.mjs"`.

- [ ] **Passo 10: Verificar o build local**

```bash
npx next build
```

Esperado: build conclui sem erro de tipo.

- [ ] **Passo 11: Commit e deploy em branch deploy**

```bash
git add -A && git commit -m "Esqueleto Next 16 com TypeScript e orquestracao de testes"
git push -u origin migracao-nextjs
```

Na Netlify, configurar **branch deploy** para `migracao-nextjs`. **Não** alterar as configurações do site de produção: se a produção for reapontada agora, "voltar para `main`" deixa de ser rollback só de git.

- [ ] **Passo 12: Confirmar que o deploy da branch subiu**

Abrir a URL da pré-visualização e ver o `<h1>`. Se falhar por dependência, a §7.2 tem a segunda saída: abandonar `--omit=dev` e conter o `embedded-postgres` por `optionalDependencies`.

---

## Tarefa 2: CSS, fontes e os 6 seletores por nome de tag

**Arquivos:**
- Criar: `estilos/fontes.css`, `estilos/tokens.css`, `estilos/base.css`, `estilos/componentes.css`, `estilos/admin.css`
- Criar: `public/fontes/` (copiado de `site/assets/fontes/`)
- Modificar: `app/layout.tsx`

**Interfaces:**
- Produz: os tokens `--escala-fonte` e o seletor `[data-contraste="alto"]` no `html`, consumidos pelas Tarefas 3 e 4.

- [ ] **Passo 1: Copiar CSS e fontes**

```bash
mkdir -p estilos public/fontes
cp site/assets/css/*.css estilos/
cp -r site/assets/fontes/* public/fontes/
```

- [ ] **Passo 2: Corrigir os caminhos das fontes**

Em `estilos/fontes.css`, os `url()` apontam para o caminho antigo. Trocar para `/fontes/...`.

```bash
grep -n "url(" estilos/fontes.css
```

- [ ] **Passo 3: Localizar os 6 seletores por nome de tag**

```bash
grep -n "aac-card-atividade\|aac-form-campo\|aac-nav-admin" estilos/*.css
```

Esperado: 2 em `componentes.css` (`aac-card-atividade`), 3 em `componentes.css` (`aac-form-campo`), 1 em `admin.css` (`aac-nav-admin`). Total 6.

- [ ] **Passo 4: Trocar cada um por classe**

Os componentes React renderizam `<article class="...">`, não `<aac-card-atividade>`. Trocar `aac-card-atividade` por `.card-atividade`, `aac-form-campo` por `.form-campo`, `aac-nav-admin` por `.nav-admin`. Anotar os nomes: as Tarefas 5, 9 e a fase 2 precisam aplicá-los.

- [ ] **Passo 5: Confirmar que não sobrou nenhum**

```bash
grep -c "aac-" estilos/*.css
```

Esperado: `0` em todos.

- [ ] **Passo 6: Importar no layout**

```tsx
import '@/estilos/fontes.css';
import '@/estilos/tokens.css';
import '@/estilos/base.css';
import '@/estilos/componentes.css';
```

A ordem importa: `tokens` define as variáveis que `base` e `componentes` consomem.

- [ ] **Passo 7: Verificar olhando**

```bash
npx next dev
```

Abrir `http://localhost:3000` e confirmar que a fonte é a do projeto (Fraunces no título) e não a do sistema. A regra 10 do CLAUDE.md existe porque dois defeitos visíveis passaram por 216 testes verdes.

- [ ] **Passo 8: Commit**

```bash
git add -A && git commit -m "CSS e fontes no Next, com os 6 seletores de tag convertidos em classe"
```

---

## Tarefa 3: Preferências e o script anti-piscada

**Arquivos:**
- Criar: `compartilhado/preferencias.ts`
- Modificar: `app/layout.tsx`, `testes/preferencias.test.mjs`

**Interfaces:**
- Produz: `ESCALAS`, `PADRAO`, `CHAVE_ARMAZENAMENTO`, `proximaEscala(atual, direcao)`, `lerPreferencias(armazenamento)`, `gravarPreferencias(armazenamento, preferencias)`. A Tarefa 4 consome todas.
- Tipo: `type Preferencias = { escala: number; contraste: 'normal' | 'alto' }`

- [ ] **Passo 1: Portar `util/preferencias.js` para TypeScript**

Módulo puro, sem DOM. A conversão é acrescentar tipos; nenhuma lógica muda.

```ts
// compartilhado/preferencias.ts
/**
 * Preferencias de acessibilidade: tamanho de fonte e alto contraste.
 *
 * Modulo puro, sem DOM. Nenhuma funcao aqui lanca: preferencia e conforto, e
 * conforto que derruba a pagina deixa de ser conforto.
 */
export const CHAVE_ARMAZENAMENTO = 'aac-preferencias';

/** Cinco degraus, de 87,5% a 137,5%. */
export const ESCALAS = [87.5, 100, 112.5, 125, 137.5] as const;

export type Preferencias = { escala: number; contraste: 'normal' | 'alto' };

export const PADRAO: Readonly<Preferencias> = Object.freeze({ escala: 100, contraste: 'normal' });

export function proximaEscala(atual: number, direcao: number): number {
  const posicao = (ESCALAS as readonly number[]).indexOf(atual);
  if (posicao === -1) return PADRAO.escala;
  const destino = posicao + direcao;
  if (destino < 0 || destino >= ESCALAS.length) return atual;
  return ESCALAS[destino];
}

export function lerPreferencias(armazenamento: Storage): Preferencias {
  try {
    const bruto = armazenamento.getItem(CHAVE_ARMAZENAMENTO);
    if (!bruto) return { ...PADRAO };
    const guardado = JSON.parse(bruto);
    return {
      escala: (ESCALAS as readonly number[]).includes(guardado.escala) ? guardado.escala : PADRAO.escala,
      contraste: guardado.contraste === 'alto' ? 'alto' : PADRAO.contraste
    };
  } catch {
    return { ...PADRAO };
  }
}

export function gravarPreferencias(armazenamento: Storage, preferencias: Preferencias): void {
  try {
    armazenamento.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(preferencias));
  } catch {
    // Modo anonimo com armazenamento bloqueado. A preferencia vale so nesta pagina.
  }
}
```

- [ ] **Passo 2: Apontar o teste existente para o caminho novo**

Em `testes/preferencias.test.mjs`, trocar o import de `../site/assets/js/util/preferencias.js` para `../compartilhado/preferencias.ts`. O Node 24 lê `.ts` direto por remoção de tipos — por isso o `tsconfig` não usa `enum` nem `namespace`.

- [ ] **Passo 3: Rodar o teste e ver passar**

```bash
node --test testes/preferencias.test.mjs
```

Esperado: 76 linhas de teste, todas passando. Se falhar por sintaxe, é tipo que o Node não consegue remover — simplificar até ser removível.

- [ ] **Passo 4: Escrever o teste de hidratação, e vê-lo falhar**

Este teste não existe hoje. Ele guarda o item 5 do portão da Tarefa 8.

```js
// testes/hidratacao.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const BASE = process.env.URL_BASE || 'http://localhost:3123';
let navegador;

before(async () => {
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless')).build();
});
after(async () => { await navegador?.quit(); });

test('nenhum aviso de divergencia de hidratacao', async () => {
  for (const rota of ['/', '/quem-somos', '/privacidade']) {
    await navegador.get(`${BASE}${rota}`);
    await navegador.sleep(600);

    const avisos = await navegador.manage().logs().get('browser')
      .then((entradas) => entradas
        .map((e) => e.message)
        .filter((m) => /hydrat|did not match|server rendered/i.test(m)))
      .catch(() => []);

    assert.deepEqual(avisos, [], `divergencia de hidratacao em ${rota}`);
  }
});
```

As rotas `/quem-somos` e `/privacidade` só existem na Tarefa 9 — até lá o teste roda contra 404, que não gera aviso de hidratação. É intencional: o arquivo nasce agora porque a Tarefa 4 precisa dele para provar a hidratação neutra.

- [ ] **Passo 5: Acrescentar o script anti-piscada ao layout**

Script clássico e síncrono de propósito: um módulo seria adiado e a página piscaria no tamanho errado a cada navegação. Duplica a leitura mínima do armazenamento pelo mesmo motivo — não pode usar import.

```tsx
// dentro de app/layout.tsx, antes de </head> — ou como primeiro filho de <body>
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{
      var g=localStorage.getItem('aac-preferencias'); if(!g)return;
      var p=JSON.parse(g), e=[87.5,100,112.5,125,137.5];
      if(e.indexOf(p.escala)!==-1)document.documentElement.style.setProperty('--escala-fonte',p.escala+'%');
      if(p.contraste==='alto')document.documentElement.setAttribute('data-contraste','alto');
    }catch(x){}})();`
  }}
/>
```

Este é o **único** script inline nosso. A Tarefa 6 dá nonce a ele.

- [ ] **Passo 6: Rodar e ver passar**

```bash
npm test
```

Esperado: `preferencias` e `hidratacao` passam.

- [ ] **Passo 7: Commit**

```bash
git add -A && git commit -m "Preferencias em TypeScript e script anti-piscada com teste de hidratacao"
```

---

## Tarefa 4: Componente de acessibilidade com hidratação neutra

O ponto onde a hidratação morde. Os 4 botões têm estado vindo do `localStorage`, que o servidor não conhece.

**Arquivos:**
- Criar: `componentes/Acessibilidade.tsx`
- Modificar: `app/layout.tsx`

**Interfaces:**
- Consome: `compartilhado/preferencias.ts` (Tarefa 3)
- Produz: elemento `.acessibilidade` com exatamente 4 `<button>`, consumido pelo teste de `paginas` na Tarefa 9

- [ ] **Passo 1: Escrever o teste, e vê-lo falhar**

```js
// testes/acessibilidade-componente.test.mjs
test('servidor entrega os 4 botoes em estado neutro', async () => {
  const html = await fetch(`${BASE}/`).then((r) => r.text());
  const botoes = html.match(/<button[^>]*data-acao=/g) || [];
  assert.equal(botoes.length, 4, 'o servidor precisa entregar os 4 botoes');
  assert.ok(!html.includes('data-contraste="alto"'),
    'o servidor nao pode adivinhar a preferencia: HTML tem que sair neutro');
});

test('apos hidratar, o botao reflete a preferencia guardada', async () => {
  await navegador.get(`${BASE}/`);
  await navegador.executeScript(
    `localStorage.setItem('aac-preferencias', JSON.stringify({escala:125,contraste:'alto'}))`);
  await navegador.navigate().refresh();
  await navegador.sleep(600);

  const estado = await navegador.executeScript(`return {
    pressionado: document.querySelector('[data-acao="contraste"]').getAttribute('aria-pressed'),
    contraste: document.documentElement.getAttribute('data-contraste'),
    escala: document.documentElement.style.getPropertyValue('--escala-fonte')
  }`);

  assert.equal(estado.pressionado, 'true');
  assert.equal(estado.contraste, 'alto');
  assert.equal(estado.escala, '125%');
});
```

```bash
npm test
```
Esperado: FALHA — o componente não existe.

- [ ] **Passo 2: Escrever o componente**

```tsx
'use client';
import { useEffect, useState } from 'react';
import {
  ESCALAS, PADRAO, proximaEscala, lerPreferencias, gravarPreferencias,
  type Preferencias
} from '@/compartilhado/preferencias';

/**
 * Controles de tamanho de fonte e alto contraste.
 *
 * O servidor nao conhece o localStorage, entao renderiza SEMPRE no estado
 * neutro e o useEffect sincroniza depois. A aparencia correta ja foi aplicada
 * pelo script anti-piscada no <html>, entao ninguem ve o tamanho errado — so
 * o botao leva um instante para se marcar como ativo.
 */
export default function Acessibilidade() {
  const [preferencias, setPreferencias] = useState<Preferencias>({ ...PADRAO });
  const [hidratado, setHidratado] = useState(false);
  const [anuncio, setAnuncio] = useState('');

  useEffect(() => {
    setPreferencias(lerPreferencias(window.localStorage));
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    const raiz = document.documentElement;
    raiz.style.setProperty('--escala-fonte', `${preferencias.escala}%`);
    if (preferencias.contraste === 'alto') raiz.setAttribute('data-contraste', 'alto');
    else raiz.removeAttribute('data-contraste');
    gravarPreferencias(window.localStorage, preferencias);
  }, [preferencias, hidratado]);

  function executar(acao: string) {
    setPreferencias((atual) => {
      const novo = { ...atual };
      if (acao === 'aumentar') novo.escala = proximaEscala(atual.escala, 1);
      if (acao === 'diminuir') novo.escala = proximaEscala(atual.escala, -1);
      if (acao === 'padrao') novo.escala = PADRAO.escala;
      if (acao === 'contraste') novo.contraste = atual.contraste === 'alto' ? 'normal' : 'alto';

      // Quem usa leitor de tela nao ve o texto crescer: precisa ser dito.
      setAnuncio(acao === 'contraste'
        ? (novo.contraste === 'alto' ? 'Alto contraste ativado' : 'Alto contraste desativado')
        : `Texto em ${novo.escala}%`);
      return novo;
    });
  }

  const alto = hidratado && preferencias.contraste === 'alto';

  return (
    <div className="acessibilidade" role="group" aria-label="Acessibilidade">
      <button type="button" data-acao="diminuir" aria-label="Diminuir tamanho do texto"
        onClick={() => executar('diminuir')}
        disabled={hidratado && preferencias.escala === ESCALAS[0]}>A-</button>
      <button type="button" data-acao="padrao" aria-label="Tamanho normal do texto"
        onClick={() => executar('padrao')}>A</button>
      <button type="button" data-acao="aumentar" aria-label="Aumentar tamanho do texto"
        onClick={() => executar('aumentar')}
        disabled={hidratado && preferencias.escala === ESCALAS[ESCALAS.length - 1]}>A+</button>
      <button type="button" data-acao="contraste" aria-pressed={alto}
        onClick={() => executar('contraste')}>Alto contraste</button>
      <p className="apenas-leitor-de-tela" role="status">{anuncio}</p>
    </div>
  );
}
```

O `hidratado &&` nos `disabled` e no `aria-pressed` é o que garante saída neutra do servidor. Sem ele, o React renderiza um valor no servidor e outro no cliente, e isso é exatamente a divergência que o teste da Tarefa 3 caça.

- [ ] **Passo 3: Rodar e ver passar**

```bash
npm test
```

- [ ] **Passo 4: Commit**

```bash
git add -A && git commit -m "Componente de acessibilidade com hidratacao neutra"
```

---

## Tarefa 5: Cabeçalho e menu

**Arquivos:**
- Criar: `componentes/Cabecalho.tsx`, `componentes/MenuMovel.tsx`
- Modificar: `app/layout.tsx`

**Interfaces:**
- Consome: `componentes/Acessibilidade.tsx` (Tarefa 4)
- Produz: `<nav id="menu-principal">` com 11 itens e `aria-current="page"` na rota atual — consumido pelos testes de `paginas` e `links`

- [ ] **Passo 1: Escrever o teste, e vê-lo falhar**

```js
test('o cabecalho monta com os 11 itens e marca a pagina atual', async () => {
  await navegador.get(`${BASE}/quem-somos`);
  const montou = await navegador.executeScript(`return {
    menu: Boolean(document.querySelector('#menu-principal')),
    itens: document.querySelectorAll('#menu-principal a').length,
    atual: document.querySelector('[aria-current="page"]')?.textContent.trim() || null
  }`);
  assert.ok(montou.menu, 'o menu nao montou');
  assert.equal(montou.itens, 11);
  assert.equal(montou.atual, 'Quem somos');
});
```

- [ ] **Passo 2: `MenuMovel.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const ITENS = [
  { texto: 'Início', href: '/' },
  { texto: 'Quem somos', href: '/quem-somos' },
  { texto: 'Projetos', href: '/projetos' },
  { texto: 'Agenda', href: '/agenda' },
  { texto: 'Notícias', href: '/noticias' },
  { texto: 'Galeria', href: '/galeria' },
  { texto: 'Acervo', href: '/acervo' },
  { texto: 'Para escolas', href: '/para-escolas' },
  { texto: 'Voluntariado', href: '/voluntariado' },
  { texto: 'Apoiar', href: '/doar' },
  { texto: 'Contato', href: '/contato' }
];

export default function MenuMovel() {
  const [aberto, setAberto] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const rota = usePathname();

  // No desktop o menu e sempre visivel e o botao nao faz sentido.
  useEffect(() => {
    const consulta = window.matchMedia('(min-width: 62rem)');
    const ajustar = () => setDesktop(consulta.matches);
    ajustar();
    consulta.addEventListener('change', ajustar);
    return () => consulta.removeEventListener('change', ajustar);
  }, []);

  const visivel = desktop || aberto;

  return (
    <>
      <button className="cabecalho__alternar" type="button" hidden={desktop}
        aria-expanded={aberto} aria-controls="menu-principal"
        onClick={() => setAberto((a) => !a)}>Menu</button>

      <nav id="menu-principal" className="cabecalho__menu" aria-label="Principal"
        hidden={!visivel}
        // Esc fecha e devolve o foco ao botao: sem isso o foco fica preso num
        // menu invisivel para quem navega por teclado.
        onKeyDown={(e) => {
          if (e.key === 'Escape' && aberto) {
            setAberto(false);
            document.querySelector<HTMLButtonElement>('.cabecalho__alternar')?.focus();
          }
        }}>
        <ul>
          {ITENS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current={rota === item.href ? 'page' : undefined}>
                {item.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
```

- [ ] **Passo 3: `Cabecalho.tsx`**

```tsx
import Link from 'next/link';
import MenuMovel from './MenuMovel';
import Acessibilidade from './Acessibilidade';

/**
 * A marca aparece como tipografia, nao como imagem: a ONG so possui o logotipo
 * bordado nas camisetas, e inventar um simbolo contraria a regra de conteudo.
 * Quando o vetor chegar (decisao D9), entra aqui.
 */
export default function Cabecalho() {
  return (
    <header className="cabecalho">
      <div className="cabecalho__topo">
        <Link className="cabecalho__marca" href="/">
          <span className="cabecalho__marca-nome">Ateliê Afro Cultural</span>
        </Link>
        <Link className="cabecalho__entrar" href="/entrar">Entrar</Link>
        <MenuMovel />
        <Acessibilidade />
      </div>
    </header>
  );
}
```

- [ ] **Passo 4: Colocar no layout, com o link de pular**

```tsx
<body>
  <a className="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>
  <Cabecalho />
  {children}
</body>
```

- [ ] **Passo 5: Rodar e ver passar**

```bash
npm test
```

- [ ] **Passo 6: Commit**

```bash
git add -A && git commit -m "Cabecalho e menu como componentes"
```

---

## Tarefa 6: Rodapé, VLibras e CSP com nonce

A tarefa de maior risco do plano. Duas coisas independentes que se encontram aqui.

**Arquivos:**
- Criar: `componentes/Rodape.tsx`, `componentes/VLibras.tsx`, `middleware.ts`
- Modificar: `app/layout.tsx`

**Interfaces:**
- Consome: nada de tarefas anteriores
- Produz: cabeçalho `x-nonce` na resposta, lido pelo layout e repassado ao `VLibras` e ao script anti-piscada

- [ ] **Passo 1: Escrever o teste, e vê-lo falhar**

```js
test('a resposta traz nonce e a politica cobre o VLibras', async () => {
  const resposta = await fetch(`${BASE}/`);
  const politica = resposta.headers.get('content-security-policy');
  assert.ok(politica, 'sem CSP');
  assert.match(politica, /script-src[^;]*'nonce-/, 'script-src sem nonce');
  assert.match(politica, /connect-src[^;]*vlibras\.gov\.br/, 'connect-src sem o VLibras');
  assert.match(politica, /img-src[^;]*vlibras\.gov\.br/, 'img-src sem o VLibras');
});

test('nenhum recurso e recusado pela politica', async () => {
  await navegador.get(`${BASE}/`);
  await navegador.sleep(3000); // o VLibras se monta num setTimeout
  const recusas = await navegador.manage().logs().get('browser')
    .then((es) => es.map((e) => e.message).filter((m) => /Refused to/i.test(m)))
    .catch(() => []);
  assert.deepEqual(recusas, [], 'a politica recusou algo');
});
```

- [ ] **Passo 2: `middleware.ts`**

`'strict-dynamic'` faz as fontes por host em `script-src` serem **ignoradas** — por isso o VLibras recebe o nonce na própria tag, e a confiança propaga para o que ele carregar. `connect-src` e `img-src` não sofrem com `strict-dynamic` e continuam precisando do host na lista.

```ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(requisicao: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const politica = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // unsafe-inline em style e pragmatico: o React injeta estilo inline e o
    // risco de style-src e ordens de magnitude menor que o de script-src.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https://vlibras.gov.br`,
    `connect-src 'self' https://vlibras.gov.br`,
    `font-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`
  ].join('; ');

  const cabecalhos = new Headers(requisicao.headers);
  cabecalhos.set('x-nonce', nonce);

  const resposta = NextResponse.next({ request: { headers: cabecalhos } });
  resposta.headers.set('Content-Security-Policy', politica);
  resposta.headers.set('X-Content-Type-Options', 'nosniff');
  resposta.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  resposta.headers.set('X-Frame-Options', 'DENY');
  // PREVIA: remover no lancamento, junto com o Disallow do robots.txt.
  resposta.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return resposta;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico|fontes).*)' }]
};
```

- [ ] **Passo 3: Ler o nonce no layout e repassar**

```tsx
import { headers } from 'next/headers';

export default async function LayoutRaiz({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  // ...
  <script nonce={nonce} dangerouslySetInnerHTML={{ __html: '...' }} />
  <VLibras nonce={nonce} />
}
```

`headers()` é assíncrono a partir do Next 15 — o `await` não é opcional.

- [ ] **Passo 4: `VLibras.tsx`, com a correção de acessibilidade portada literalmente**

Este é o código mais caro do projeto: ele existe porque o widget introduziu 3 violações de acessibilidade que levaram tempo para diagnosticar. Portar sem reescrever.

```tsx
'use client';
import { useEffect, useRef } from 'react';

declare global { interface Window { VLibras?: { Widget: new (url: string) => unknown } } }

/**
 * VLibras e widget gratuito do gov.br. Se nao carregar, o rodape segue inteiro.
 *
 * O container fica fora da arvore que o React reconcilia: o widget injeta DOM
 * por fora, e sem suppressHydrationWarning a reconciliacao arranca os nos dele
 * em alguma navegacao.
 */
export default function VLibras({ nonce }: { nonce?: string }) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (document.querySelector('script[data-vlibras]')) return;

    const script = document.createElement('script');
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.async = true;
    script.dataset.vlibras = 'true';
    if (nonce) script.nonce = nonce;
    script.onload = () => {
      try {
        new window.VLibras!.Widget('https://vlibras.gov.br/app');
        corrigirAcessibilidade();
      } catch {
        // Sem traducao para Libras nesta visita. O resto da pagina nao muda.
      }
    };
    document.body.appendChild(script);
  }, [nonce]);

  return <div ref={caixa} suppressHydrationWarning />;
}

/**
 * O widget injeta duas imagens sem alt e monta seu conteudo fora de qualquer
 * landmark — violacoes que o axe acusa e que nao sao nossas.
 *
 * Ele tem valor real para pessoas surdas, entao corrigimos por fora em vez de
 * remove-lo. As imagens ficam dentro de um shadow root aberto, o que exige
 * atravessar `shadowRoot` — um querySelector comum nao as alcanca.
 *
 * O widget se monta sozinho num setTimeout, entao observamos ate ele existir.
 */
function corrigirAcessibilidade() {
  const ajustar = () => {
    const area = document.getElementById('vlibras-access-wrapper');
    if (!area) return false;
    if (!area.hasAttribute('role')) {
      area.setAttribute('role', 'complementary');
      area.setAttribute('aria-label', 'Tradução para Libras');
    }
    // As imagens sao decorativas: o botao ja carrega a descricao em aria-label.
    area.shadowRoot?.querySelectorAll('img:not([alt])').forEach((imagem) => {
      imagem.setAttribute('alt', '');
    });
    return true;
  };

  if (ajustar()) return;
  const observador = new MutationObserver(() => { if (ajustar()) observador.disconnect(); });
  observador.observe(document.body, { childList: true, subtree: true });
}
```

- [ ] **Passo 5: `Rodape.tsx`**

Os cinco contatos são o RF06 e o teste de `paginas` exige `>= 5`. Note que os blocos usam `<div>`, não `<section>`: `<section>` criava colisão de landmark, corrigida antes.

```tsx
import Link from 'next/link';

export default function Rodape() {
  return (
    <footer className="rodape">
      <div className="rodape__conteudo">
        <div className="rodape__bloco">
          <h2>Fale com a gente</h2>
          <ul className="rodape__lista">
            <li><a href="tel:+5511953968344">(11) 95396-8344</a></li>
            <li><a href="https://wa.me/5511953968344" rel="noopener">WhatsApp</a></li>
            <li><a href="mailto:atelieafro@gmail.com">atelieafro@gmail.com</a></li>
            <li><a href="https://instagram.com/atelie_afrocultural" rel="noopener">Instagram</a></li>
            <li><a href="https://tiktok.com/@ateli.afro.cultur" rel="noopener">TikTok</a></li>
          </ul>
        </div>
        <div className="rodape__bloco">
          <h2>Onde estamos</h2>
          <address className="rodape__endereco">
            Rua Dr. Paulo Gatti, 135 — Vila Romero<br />
            São Paulo/SP — CEP 02468-030
          </address>
        </div>
      </div>
      <p className="rodape__aviso">
        <Link href="/privacidade">Política de privacidade</Link>
      </p>
    </footer>
  );
}
```

- [ ] **Passo 6: Medir o que o VLibras realmente pede**

```bash
npx next dev
```

Abrir com o console aberto e ler **todo** `Refused to`. Se aparecer pedido de `wasm-unsafe-eval` ou de outro host, acrescentar à política — e anotar no commit. Sem essa medição a política fica curta e o widget falha **em silêncio**, que é a pior falha possível num requisito de acessibilidade.

- [ ] **Passo 7: Rodar e ver passar**

```bash
npm test
```

- [ ] **Passo 8: Commit**

```bash
git add -A && git commit -m "Rodape, VLibras com nonce e CSP no middleware"
```

---

## Tarefa 7: Foco na navegação do roteador

Hoje cada navegação é carregamento completo, o cenário ideal para leitor de tela: o foco volta ao topo e o título novo é anunciado. Com o roteador do App Router a navegação vira parcial, e isso passa a poder falhar em silêncio.

**Arquivos:**
- Criar: `componentes/FocoNaNavegacao.tsx`
- Modificar: `app/layout.tsx`

**Interfaces:**
- Consome: nada
- Produz: após navegação, `document.activeElement` é o `<h1>` da rota nova

- [ ] **Passo 1: Escrever o teste, e vê-lo falhar**

```js
test('apos navegar pelo cabecalho, o foco vai para o h1 da pagina nova', async () => {
  await navegador.get(`${BASE}/`);
  await navegador.sleep(500);
  const tituloAntes = await navegador.getTitle();

  await navegador.findElement(By.css('#menu-principal a[href="/quem-somos"]')).click();
  await navegador.sleep(800);

  const depois = await navegador.executeScript(`return {
    titulo: document.title,
    focoEh: document.activeElement.tagName,
    focoTexto: (document.activeElement.textContent || '').trim().slice(0, 40)
  }`);

  assert.notEqual(depois.titulo, tituloAntes, 'o titulo nao mudou');
  assert.equal(depois.focoEh, 'H1', `o foco ficou em ${depois.focoEh}, nao no h1`);
  assert.equal(depois.focoTexto, 'Quem somos');
});
```

- [ ] **Passo 2: Escrever o componente**

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Devolve ao leitor de tela o que a navegacao completa dava de graca.
 *
 * Com carregamento de pagina inteiro o foco voltava ao topo e o titulo novo era
 * anunciado. A navegacao parcial do roteador nao faz nem um nem outro, e a
 * falha e silenciosa: a pagina troca e quem nao ve a tela continua no contexto
 * antigo.
 */
export default function FocoNaNavegacao() {
  const rota = usePathname();
  const primeira = useRef(true);

  useEffect(() => {
    // Na primeira carga o navegador ja posiciona o foco corretamente.
    if (primeira.current) { primeira.current = false; return; }

    const titulo = document.querySelector<HTMLElement>('main h1');
    if (!titulo) return;
    titulo.setAttribute('tabindex', '-1');
    titulo.focus();
  }, [rota]);

  return null;
}
```

- [ ] **Passo 3: Colocar no layout, dentro do `<body>`**

- [ ] **Passo 4: Rodar e ver passar**

```bash
npm test
```

- [ ] **Passo 5: Commit**

```bash
git add -A && git commit -m "Foco e anuncio na navegacao do roteador"
```

---

## Tarefa 8: O PORTÃO — go/no-go

Não escreve código. Mede os seis critérios da spec §8.1 e registra o resultado. **Se qualquer um falhar, a recomendação é abortar** e voltar para `main`, que continua publicável.

**Arquivos:**
- Criar: `docs/superpowers/plans/2026-08-28-resultado-do-portao.md`

- [ ] **Passo 1: Subir e medir**

```bash
npm test && npx next build && npx next start --port 3123
```

- [ ] **Passo 2: Percorrer os seis critérios**

| # | Critério | Como medir |
|---|---|---|
| 1 | Botão do VLibras aparece e o player abre ao clique | Manual, no navegador |
| 2 | Zero `Refused to execute` / `Refused to connect` | Console, nas rotas existentes |
| 3 | axe-core em 0 violações na home | `npx @axe-core/cli http://localhost:3123/ --browser firefox` |
| 4 | Após clicar em "Quem somos": título mudou e foco no `<h1>` | Teste da Tarefa 7 |
| 5 | Zero aviso de hidratação em `/`, `/entrar`, `/quem-somos` | Teste da Tarefa 3 |
| 6 | Escala de fonte persiste em navegação **do roteador** | Manual: mudar A+, clicar num link do menu, conferir |

- [ ] **Passo 3: Verificação com leitor de tela real**

NVDA ou Orca. Navegar pelo menu e confirmar que a mudança de página é percebida. **O axe-core não cobre isso** — ele analisa página parada, e a falha desta tarefa só existe na transição.

- [ ] **Passo 4: Registrar o resultado**

Escrever o arquivo com os seis critérios, o resultado de cada um e a decisão. Se for abortar, registrar o porquê — é o documento que justifica a decisão para o grupo.

- [ ] **Passo 5: Commit**

```bash
git add -A && git commit -m "Resultado do portao go/no-go"
```

---

## Tarefa 9: As três páginas sem dados

Provam o layout sem depender da camada de servidor.

**Arquivos:**
- Criar: `app/quem-somos/page.tsx`, `app/privacidade/page.tsx`, `app/para-escolas/page.tsx`
- Modificar: `testes/paginas.test.mjs`

**Interfaces:**
- Consome: layout completo das Tarefas 2 a 7
- Produz: três rotas que o `paginas.test.mjs` percorre

- [ ] **Passo 1: Adaptar o arranjo do `paginas.test.mjs`**

Trocar o `createServer` que lê de `site/` por `const BASE = process.env.URL_BASE`. As asserções ficam. Trocar a lista `PAGINAS` pelas três rotas novas, sem `.html`.

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npm test
```
Esperado: FALHA — as rotas não existem.

- [ ] **Passo 3: Portar as três páginas**

Conteúdo copiado literalmente de `site/quem-somos.html`, `site/privacidade.html` e `site/para-escolas.html`. **Não reescrever texto:** é conteúdo real da ONG, e inventar contraria a regra 2 do CLAUDE.md.

Conversão mecânica: `class` vira `className`, `<br>` vira `<br />`, o `<main id="conteudo" class="conteudo">` fica, e o bloco `<noscript>` **sai** — a navegação agora existe no HTML entregue pelo servidor.

Cada página exporta `metadata`:

```tsx
export const metadata = {
  title: 'Quem somos — Ateliê Afro Cultural',
  description: 'A história do Ateliê Afro Cultural, seus idealizadores e os três setores de atuação: literário, musical e artístico criativo.'
};
```

O teste exige `title` contendo "Ateliê Afro Cultural" e `description` com mais de 30 caracteres.

- [ ] **Passo 4: Rodar e ver passar**

```bash
npm test
```

- [ ] **Passo 5: Verificar olhando, em 375px**

O teste cobre rolagem horizontal e texto saindo da caixa, mas dois defeitos visíveis já passaram por 216 testes verdes. Abrir as três páginas em 375 de largura e olhar.

- [ ] **Passo 6: Reapontar os outros testes que atravessam**

A spec §6.1 lista seis testes que sobrevivem. `preferencias` foi na Tarefa 3 e
`seguranca` vai na Tarefa 10. Os outros três mudam só o caminho do import:

```bash
# validacao: ../site/assets/js/util/validacao.js  ->  ../compartilhado/validacao.ts
# erros:     ../site/assets/js/util/erros.js      ->  ../compartilhado/erros.ts
# conteudo:  ../site/assets/dados-iniciais/       ->  ../dados-iniciais/
```

Copiar `site/assets/js/util/validacao.js` e `erros.js` para `compartilhado/`
convertendo para `.ts`, e `site/assets/dados-iniciais/` para `dados-iniciais/`.
São funções puras — a conversão é acrescentar tipos, nenhuma lógica muda.

- [ ] **Passo 7: Adaptar o `navegador.test.mjs`**

Ele verifica escala de fonte, contraste, persistência e foco visível num Firefox
real — tudo que as Tarefas 3, 4 e 7 construíram. Trocar o `createServer` que lê
de `site/` por `const BASE = process.env.URL_BASE`; as asserções ficam.

Onde ele visita `/index.html`, trocar por `/`; onde visita `/quem-somos.html`,
trocar por `/quem-somos`.

- [ ] **Passo 8: Rodar a suíte inteira e conferir a contagem**

```bash
npm test
```

Esperado: `validacao` (129 linhas), `erros` (52), `conteudo` (92),
`preferencias` (76) e `navegador` (233) passando. `rls` continua intacto —
ele nunca tocou no site.

- [ ] **Passo 9: Commit**

```bash
git add -A && git commit -m "Quem somos, privacidade e para escolas portadas"
```

---

## Tarefa 10: Camada de dados no servidor

**Arquivos:**
- Criar: `servidor/supabase.ts`, `servidor/dados/conteudo.ts`
- Criar: `testes/vazamento.test.mjs`
- Modificar: `testes/seguranca.test.mjs`
- Criar: `.env.local` (não versionado)

**Interfaces:**
- Produz: `obterCliente()` em `servidor/supabase.ts`, consumido por todo `servidor/dados/*`. Os 6 módulos restantes vêm na fase 2.

- [ ] **Passo 1: Variáveis de ambiente, sem `NEXT_PUBLIC_`**

```bash
cat > .env.local <<'EOF'
SUPABASE_URL=https://lubsufltidrbmganftux.supabase.co
SUPABASE_CHAVE_PUBLICAVEL=<a chave atual de site/config.js, ou a sb_publishable_ quando chegar>
EOF
echo ".env.local" >> .gitignore
```

- [ ] **Passo 2: Escrever o teste de vazamento, e vê-lo falhar**

Varre `.next/static` **e o HTML renderizado**. Só `.next/static` seria insuficiente: se um Server Component passar objeto do Supabase como prop para componente de cliente, o dado sai serializado dentro de `self.__next_f.push(...)` no HTML e não encosta em `.next/static`.

```js
// testes/vazamento.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.URL_BASE || 'http://localhost:3123';
const URL_SUPABASE = 'lubsufltidrbmganftux.supabase.co';

async function todosOsArquivos(raiz) {
  const achados = [];
  for (const entrada of await readdir(raiz, { withFileTypes: true })) {
    const caminho = join(raiz, entrada.name);
    if (entrada.isDirectory()) achados.push(...await todosOsArquivos(caminho));
    else achados.push(caminho);
  }
  return achados;
}

test('nenhum artefato de cliente contem a URL do Supabase', async () => {
  const arquivos = (await todosOsArquivos('.next/static')).filter((a) => a.endsWith('.js'));
  assert.ok(arquivos.length > 0, 'nada construido: rodar next build antes');

  const sujos = [];
  for (const arquivo of arquivos) {
    const conteudo = await readFile(arquivo, 'utf8');
    if (conteudo.includes(URL_SUPABASE)) sujos.push(arquivo);
  }
  assert.deepEqual(sujos, [], 'a URL do Supabase vazou para o bundle de cliente');
});

test('o HTML entregue nao carrega dado do Supabase no payload RSC', async () => {
  const sujas = [];
  for (const rota of ['/', '/quem-somos', '/privacidade', '/para-escolas']) {
    const html = await fetch(`${BASE}${rota}`).then((r) => r.text());
    if (html.includes(URL_SUPABASE)) sujas.push(rota);
  }
  assert.deepEqual(sujas, [], 'a URL do Supabase apareceu no HTML entregue');
});
```

- [ ] **Passo 3: `servidor/supabase.ts`**

```ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente do Supabase, sempre com a sessao da pessoa lida do cookie.
 *
 * Nao existe cliente com chave que ignora o RLS neste projeto: nenhum caso de
 * uso precisou furar as politicas. Enquanto for assim, o codigo da rota e a
 * politica do banco sao um E — a requisicao precisa sobreviver aos dois, e o
 * efetivo e o mais restritivo. Ver spec §4.2.
 */
export async function obterCliente() {
  const armazenamento = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_CHAVE_PUBLICAVEL!,
    {
      cookies: {
        getAll: () => armazenamento.getAll(),
        setAll: (lista) => {
          try {
            lista.forEach(({ name, value, options }) =>
              armazenamento.set(name, value, options));
          } catch {
            // Chamado de um Server Component, onde nao se escreve cookie.
            // O middleware renova a sessao; aqui pode ignorar.
          }
        }
      }
    }
  );
}
```

- [ ] **Passo 4: Portar `conteudo.ts` como primeiro módulo de dados**

Mantém a fonte dupla do projeto: JSON versionado quando não há Supabase
configurado, tabela quando há. É o que permite o site rodar antes de o banco
existir — e o que faz `conteudo.test.mjs` continuar valendo.

```ts
import 'server-only';
import { obterCliente } from '../supabase';
import atividadesLocais from '@/dados-iniciais/atividades.json';
import clippingLocal from '@/dados-iniciais/clipping.json';

export type Atividade = {
  id: string;
  titulo: string;
  sinopse: string | null;
  duracao_minutos: number | null;
  faixa_etaria: string | null;
};

function temSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_CHAVE_PUBLICAVEL);
}

export async function listarAtividades(): Promise<Atividade[]> {
  if (!temSupabase()) return atividadesLocais as Atividade[];

  const { data, error } = await (await obterCliente())
    .from('atividades')
    .select('id, titulo, sinopse, duracao_minutos, faixa_etaria')
    .order('titulo');

  // Banco fora do ar nao pode derrubar a pagina institucional: cai para o JSON
  // versionado, que e o mesmo conteudo real da ONG.
  if (error) return atividadesLocais as Atividade[];
  return data as Atividade[];
}

export async function listarClipping() {
  if (!temSupabase()) return clippingLocal;

  const { data, error } = await (await obterCliente())
    .from('clipping')
    .select('id, titulo, veiculo, url, data')
    .order('data', { ascending: false });

  if (error) return clippingLocal;
  return data;
}
```

Campo sem dado real fica `null` e a página omite a seção — regra 2 do
`CLAUDE.md`. Nunca preencher com texto inventado.

- [ ] **Passo 5: Corrigir `seguranca.test.mjs`**

Ele lê `site/config.js` com `readFileSync`, e esse arquivo deixa de existir. Passar a ler `process.env.SUPABASE_URL` e `process.env.SUPABASE_CHAVE_PUBLICAVEL`.

A leitura precisa continuar **síncrona e no topo do arquivo**: o `describe` avalia a condição de pular antes do `before()` rodar, e foi assim que este teste ficou silenciosamente pulado uma vez.

- [ ] **Passo 6: Rodar o aceite bloqueante contra o banco real**

```bash
node --test testes/seguranca.test.mjs
```

Esperado: 8 de 8. Este é o aceite da seção 12 do escopo. Se falhar, para tudo.

- [ ] **Passo 7: Rodar a suíte inteira**

```bash
npm test
```

- [ ] **Passo 8: Commit**

```bash
git add -A && git commit -m "Camada de dados no servidor com server-only e teste de vazamento"
```

---

## Ao terminar

Atualizar o `CLAUDE.md` no mesmo commit, conforme a regra do próprio arquivo: a tabela de status e a seção "O que trava hoje" precisam refletir que o site passou a ser Next.

A fase 2 — 12 páginas restantes, auth com PKCE, painel com guarda no middleware, migration 007 do rate limit, redirects e guardião de deploy — ganha plano próprio, escrito depois que o portão da Tarefa 8 passar.
