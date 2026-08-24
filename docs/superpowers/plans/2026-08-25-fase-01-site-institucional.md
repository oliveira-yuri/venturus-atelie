# Fase 01 — Site institucional — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar todo o conteúdo público do Ateliê Afro Cultural — home, quem somos, projetos, notícias, galeria, contato, "Para Escolas" e prova social — com o conteúdo real da organização. Se o projeto parasse aqui, a ONG já teria um site funcionando.

**Architecture:** Continua o multi-página estático da Fase 00. As páginas de conteúdo institucional estável são HTML direto. O que o escopo exige que seja editável pela equipe (catálogo de atividades, clipping) passa por módulos de dados com **fonte dupla**: enquanto não há Supabase, leem JSON versionado; quando o banco existir, o mesmo módulo passa a consultá-lo e nenhuma página muda. O JSON também é a origem do `seed.sql` da Fase 02.

**Tech Stack:** HTML, CSS e JavaScript sem framework nem bundler. Módulos ES nativos. `node --test` com Firefox headless via selenium-webdriver. `npx @axe-core/cli` para auditoria.

**Spec:** `docs/superpowers/specs/2026-08-24-atelie-afro-cultural-design.md`
**Conteúdo:** `docs/conteudo-real.md` — **toda** cópia de texto institucional sai de lá. Nada é inventado.

## Global Constraints

- **Sem framework de build.** Módulos ES nativos, sem transpilação.
- **Português em todo identificador**: classes CSS, funções, nomes de arquivo (kebab-case, sem acento).
- **Custom elements sem Shadow DOM**, prefixo `aac-`.
- **Paleta fixa** (não alterar): `--amarelo: #E0A400` · `--azul: #7FA9CE` · `--azul-texto: #2E5C8A` · `--marrom: #8A6A4A` · `--tinta: #241C12` · `--fundo: #FAF6EE`
- **Slogan literal:** "Espaço educativo de criação, reflexão e valorização da cultura e memória afro brasileira"
- **Nomes próprios:** Wil Oliveira · Nathália (Nathy) Monteiro.
- **Nunca texto de preenchimento.** Se `docs/conteudo-real.md` não tem o texto, a página não inventa: mostra só o que existe.
- **Não é ONG assistencialista** (seção 3.1 do escopo). A home abre com arte, cultura e identidade — nunca com apelo de caridade, foto de sofrimento ou contador de vidas salvas.
- **Nenhuma foto de pessoa vai ao ar nesta fase.** Nenhuma autorização de uso de imagem foi entregue (RN07, risco R10). As páginas são construídas com espaço reservado para imagem e texto alternativo obrigatório; as fotos entram quando as autorizações chegarem.
- **Toda imagem tem `alt`.**
- **Toda página leva o bloco `<noscript>` de navegação**, copiado de `site/index.html`, imediatamente
  antes de `<aac-rodape>`. Ele não pode viver dentro de um componente: cabeçalho e rodapé só existem
  se o JavaScript rodar. `testes/sem-javascript.test.mjs` verifica isso — acrescente cada página nova
  ao array `PAGINAS` dele.
- Rodar os testes com `node --test`.

---

## Estrutura de arquivos desta fase

| Arquivo | Responsabilidade |
|---|---|
| `site/index.html` | Home (RF01) — reescrita completa |
| `site/quem-somos.html` | História, idealizadores, três setores (RF02) |
| `site/projetos.html` | Catálogo de atividades (RF03) |
| `site/noticias.html` | Listagem de publicações (RF04) — casca com estado vazio |
| `site/galeria.html` | Álbuns (RF05) — casca com estado vazio |
| `site/para-escolas.html` | Área do público escolar (RF38) |
| `site/contato.html` | Cinco contatos e formulário (RF06, RF07) |
| `site/assets/dados-iniciais/atividades.json` | Catálogo real, origem do seed |
| `site/assets/dados-iniciais/clipping.json` | "Na mídia" e "Onde já estivemos", origem do seed |
| `site/assets/js/dados/conteudo.js` | Fonte dupla: JSON hoje, Supabase depois |
| `site/assets/js/componentes/aac-card-atividade.js` | Cartão de atividade |
| `site/assets/js/paginas/projetos.js` | Monta a página de projetos |
| `site/assets/js/paginas/prova-social.js` | Monta "Na mídia" e "Onde já estivemos" |
| `testes/conteudo.test.mjs` | Integridade dos JSON de conteúdo |
| `testes/paginas.test.mjs` | Verificação de navegador em todas as páginas |

---

### Task 1: Fonte dupla de conteúdo e catálogo de atividades

Cria a camada que permite as páginas funcionarem hoje sem banco e continuarem iguais depois dele.

**Files:**
- Create: `site/assets/dados-iniciais/atividades.json`
- Create: `site/assets/js/dados/conteudo.js`
- Test: `testes/conteudo.test.mjs`

**Interfaces:**
- Consumes: `supabaseConfigurado()` e `obterCliente()` de `dados/supabase.js` (Fase 00)
- Produces:
  - `listarAtividades(): Promise<Atividade[]>` — `Atividade` é `{id, titulo, resumo, descricao, genero, duracao, elenco, classificacao, local, rider, publicado}`; `descricao` e os campos de ficha podem ser `null` quando a ONG ainda não forneceu
  - `listarClipping(): Promise<Registro[]>` — usada na Task 5

- [ ] **Step 1: Criar `site/assets/dados-iniciais/atividades.json`**

Conteúdo integral de `docs/conteudo-real.md`, seção 4. Os seis últimos têm `descricao: null` de propósito — a ONG não forneceu sinopse e o projeto não inventa texto.

```json
[
  {
    "id": "banzo",
    "titulo": "Banzo",
    "resumo": "Contação de história performática sobre o banzo — a saudade da pátria e da liberdade sentida pelos africanos escravizados.",
    "descricao": "Contação de história performática que, através da legitimação, valorização e conscientização da história dos negros no Brasil, propõe diálogos e interações com o público, buscando difundir uma arte negra contemporânea, com raízes e práticas afetivas e ancestrais através de fragmentos de imaginários negros, tendo como ponto de partida o BANZO — nome dado ao sentimento de nostalgia, tristeza e saudade de sua pátria, costumes familiares e principalmente de sua liberdade, que os negros africanos escravizados sentiam ao serem tirados de seu país de origem.\n\nA presença performática do artista negro Wil Oliveira em cena, com suas marcas, elementos e experiências diaspóricas, onde suas histórias e corpo são discursos e memórias de extrema potência, tanto estética quanto social.",
    "genero": "Contação de história performática",
    "duracao": "50 minutos",
    "elenco": "Wil Oliveira",
    "classificacao": "Livre",
    "local": "Adaptável a qualquer espaço",
    "rider": "1 caixa de som · 1 microfone com ou sem fio",
    "publicado": true
  },
  {
    "id": "catirina-e-nego-dito",
    "titulo": "Catirina e Nego Dito",
    "resumo": "Contação performática com fantoches e música ao vivo, a partir da história do auto do boi.",
    "descricao": "Apresentação artística com fantoches e música ao vivo, que conta a lendária história de dois personagens da cultura popular brasileira, Catirina e Francisco, figuras presentes nas manifestações artísticas conhecidas como auto do boi. A história ganha vida e é conduzida através de cantigas dos \"boiadeiros\", seres e divindades de luz pertencentes às religiões de matrizes africanas.\n\nCatirina e Nego Dito são um casal de escravizados que vivem em uma fazenda no sertão. Grávida, Catirina sente o desejo de comer a língua do boi mais bonito do dono da fazenda. Para satisfazer o desejo de sua mulher, Nego Dito rouba o boi preferido, mata o animal e retira a língua para que sua esposa possa comê-la. O coronel fica sabendo do roubo e parte em busca do casal, jurando vingança. No fim, os personagens conseguem ressuscitar o boi e, como agradecimento, o dono da fazenda promove uma festa.\n\nA apresentação retrata diferentes visões sobre o boi e ressalta sua importância: para os escravizados e trabalhadores rurais, companheiro de trabalho e sinônimo de força; para os proprietários de fazendas, investimento e fonte de renda; nas religiões de matrizes africanas, divindade de luz que representa esperança, proteção, justiça e prosperidade; e na cultura popular brasileira, símbolo de resistência.\n\nConta com fantoches de personagens negros, tecidos de chita, tambores, cantigas, figurinos e cenário, de modo a contribuir para a valorização e expansão da cultura e ancestralidade negra.",
    "genero": "Contação performática de histórias (fantoches)",
    "duracao": "50 minutos",
    "elenco": "Wil Oliveira (narrador, cantor e músico) · Davi Santos (bonequeiro)",
    "classificacao": "Livre",
    "local": "Adaptável a qualquer espaço",
    "rider": null,
    "publicado": true
  },
  {
    "id": "cafu-e-o-cafe",
    "titulo": "Cafú e o Café",
    "resumo": "Contação de história que leva o público às fazendas de café do Vale do Paraíba do século XIX.",
    "descricao": "Ao entrar em contato com a contação de histórias \"Cafú e o Café\", o público encontrará, através de uma linguagem acessível e simples, algumas memórias da cultura afro-brasileira, em especial a contribuição que a cultura africana forneceu ao Brasil.\n\nA história convida a uma viagem ao tempo, de maneira descontraída e dinâmica. As narrativas conduzem até as fazendas de café do Vale do Paraíba do século XIX. A história central gira em torno de situações de preconceito racial, através de bullying no ambiente escolar.\n\n\"Cafú e o Café\" foi escrita e ilustrada pelo artista, ator, arte-educador e escritor Wil Oliveira.",
    "genero": "Contação de história",
    "duracao": "50 minutos",
    "elenco": "Wil Oliveira",
    "classificacao": "Livre",
    "local": "Adaptável a qualquer espaço",
    "rider": "1 caixa de som · 1 microfone headset",
    "publicado": true
  },
  {
    "id": "brincadeiras-encantadas-na-mata",
    "titulo": "Brincadeiras Encantadas na Mata",
    "resumo": "História-brincante em que crianças e adultos entram numa aventura de faz de conta pela mata.",
    "descricao": "Você já brincou na mata? Já desvendou os segredos e encantamentos que vivem sob as copas e galhos, atravessando rios e trilhas?\n\nNesta história-brincante, crianças e pessoas adultas são convidadas a uma aventura de faz de conta, interagindo com os elementos dispersos no espaço e despertando a imaginação. O Ateliê Afro Cultural conduz o percurso por meio de uma história com ações para as crianças seguirem, mesclando comandos, música, sons da mata e natureza, elementos sensoriais e brincadeiras.\n\nUma vivência destinada a (re)descobrir os brincares coletivos de imaginação ligados à natureza e aos quintais, explorando as sensações e o ambiente ao redor.\n\nA ambientação e o cenário são construídos com chitas e elementos naturais como cabaças, palha sisal, pinhos, troncos de árvores e outros materiais, gerando uma ambientação colorida, lúdica, acolhedora e ancestral.",
    "genero": "História-brincante interativa",
    "duracao": "A combinar",
    "elenco": "Wil Oliveira · Nathália (Nathy) Monteiro",
    "classificacao": "Livre",
    "local": "Adaptável a qualquer espaço",
    "rider": null,
    "publicado": true
  },
  {
    "id": "projeto-brincantes",
    "titulo": "Projeto Brincantes",
    "resumo": "Vivência de resgate das brincadeiras da cultura popular afro-brasileira.",
    "descricao": "Pensando sobre a importância de resgatar brincadeiras populares, o \"Projeto Brincantes\" surge com o intuito de aproximar e espalhar arte e cultura afro-brasileira através de brincadeiras da nossa cultura popular. O projeto promove as atividades já enraizadas e as leva para outros espaços e lugares, com o objetivo de transformar relações e ambientes e, principalmente, propagar a cultura afro-brasileira através da arte brincante.\n\nNathy Monteiro e Wil Oliveira são um casal de artistas que juntos idealizaram o Projeto Brincantes. Somam habilidades artísticas como pesquisa acerca da cultura afro-brasileira, contação de histórias, brincantes de cultura popular, dança, música, atuação e escrita, sempre envolvendo a temática afro brasileira e a cultura popular.",
    "genero": "Vivência de brincadeiras populares",
    "duracao": null,
    "elenco": "Wil Oliveira · Nathália (Nathy) Monteiro",
    "classificacao": "Livre",
    "local": "Adaptável a qualquer espaço",
    "rider": null,
    "publicado": true
  },
  {
    "id": "brasil-negreiro",
    "titulo": "Brasil Negreiro: Imaginário em Liberdade",
    "resumo": null,
    "descricao": null,
    "genero": "Peça / contação",
    "duracao": null,
    "elenco": "Wil Oliveira",
    "classificacao": "Livre",
    "local": "Adaptável a qualquer espaço",
    "rider": null,
    "publicado": true
  },
  {
    "id": "a-cabaca-e-o-canto-ancestral",
    "titulo": "A Cabaça e o Canto Ancestral",
    "resumo": null,
    "descricao": null,
    "genero": "Contação de história",
    "duracao": null,
    "elenco": "Wil Oliveira",
    "classificacao": "Livre",
    "local": "Adaptável a qualquer espaço",
    "rider": null,
    "publicado": true
  },
  {
    "id": "eu-griot",
    "titulo": "Eu Griot",
    "resumo": null,
    "descricao": null,
    "genero": "Contação de história",
    "duracao": null,
    "elenco": "Wil Oliveira",
    "classificacao": "Livre",
    "local": "Adaptável a qualquer espaço",
    "rider": null,
    "publicado": true
  },
  {
    "id": "memoria-negra",
    "titulo": "Memória Negra",
    "resumo": null,
    "descricao": null,
    "genero": "Contação de história",
    "duracao": null,
    "elenco": "Wil Oliveira",
    "classificacao": "Livre",
    "local": "Adaptável a qualquer espaço",
    "rider": null,
    "publicado": true
  },
  {
    "id": "batuque-na-cozinha",
    "titulo": "Batuque na Cozinha",
    "resumo": null,
    "descricao": null,
    "genero": "Contação / vivência",
    "duracao": null,
    "elenco": "Wil Oliveira",
    "classificacao": "Livre",
    "local": "Adaptável a qualquer espaço",
    "rider": null,
    "publicado": true
  },
  {
    "id": "atelie-itinerante",
    "titulo": "Ateliê Afro Cultural Itinerante",
    "resumo": "Projeto de circulação que leva parte do acervo e do conhecimento produzido a outros espaços.",
    "descricao": null,
    "genero": "Projeto de circulação",
    "duracao": null,
    "elenco": null,
    "classificacao": "Livre",
    "local": "Adaptável a qualquer espaço",
    "rider": null,
    "publicado": true
  }
]
```

- [ ] **Step 2: Escrever o teste que falha**

Create `testes/conteudo.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const RAIZ = new URL('../site/assets/dados-iniciais/', import.meta.url);

async function carregar(arquivo) {
  return JSON.parse(await readFile(new URL(arquivo, RAIZ), 'utf8'));
}

test('atividades.json é uma lista não vazia', async () => {
  const atividades = await carregar('atividades.json');
  assert.ok(Array.isArray(atividades));
  assert.ok(atividades.length >= 11, 'o escopo lista 11 atividades');
});

test('toda atividade tem id e título', async () => {
  for (const atividade of await carregar('atividades.json')) {
    assert.ok(atividade.id, 'atividade sem id');
    assert.ok(atividade.titulo, `atividade ${atividade.id} sem título`);
  }
});

test('os ids são únicos', async () => {
  const ids = (await carregar('atividades.json')).map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'há id repetido');
});

test('os ids são kebab-case sem acento', async () => {
  for (const { id } of await carregar('atividades.json')) {
    assert.match(id, /^[a-z0-9-]+$/, `id fora do padrão: ${id}`);
  }
});

test('descrição ausente é null, nunca texto de preenchimento', async () => {
  // O escopo proíbe inventar conteúdo. Quando a ONG não forneceu sinopse,
  // o campo precisa ser null para a página saber que deve omitir a seção.
  const suspeitos = /lorem|ipsum|em breve|placeholder|TODO|descrição aqui/i;
  for (const atividade of await carregar('atividades.json')) {
    if (atividade.descricao !== null) {
      assert.ok(atividade.descricao.length > 40, `descrição curta demais em ${atividade.id}`);
      assert.doesNotMatch(atividade.descricao, suspeitos, `texto de preenchimento em ${atividade.id}`);
    }
    if (atividade.resumo !== null) {
      assert.doesNotMatch(atividade.resumo, suspeitos, `texto de preenchimento em ${atividade.id}`);
    }
  }
});

test('as cinco atividades com release têm descrição', async () => {
  const comRelease = [
    'banzo', 'catirina-e-nego-dito', 'cafu-e-o-cafe',
    'brincadeiras-encantadas-na-mata', 'projeto-brincantes'
  ];
  const atividades = await carregar('atividades.json');
  for (const id of comRelease) {
    const atividade = atividades.find((a) => a.id === id);
    assert.ok(atividade, `atividade ausente: ${id}`);
    assert.ok(atividade.descricao, `${id} deveria ter descrição extraída do release`);
  }
});

test('nenhuma grafia proibida de nome próprio', async () => {
  // O escopo manda normalizar "Will Oliveira" e "Nathi Nunes".
  const bruto = JSON.stringify(await carregar('atividades.json'));
  assert.doesNotMatch(bruto, /Will Oliveira/, 'usar "Wil Oliveira"');
  assert.doesNotMatch(bruto, /Nathi Nunes/, 'usar "Nathália (Nathy) Monteiro"');
});
```

- [ ] **Step 3: Rodar o teste e confirmar que passa nos JSON já criados**

Run: `node --test testes/conteudo.test.mjs`
Expected: PASS — 7 testes. Se algum falhar, o defeito está no JSON da Step 1: corrigir o dado, nunca o teste.

- [ ] **Step 4: Criar `site/assets/js/dados/conteudo.js`**

```js
import { supabaseConfigurado, obterCliente } from './supabase.js';

/**
 * Conteúdo institucional com fonte dupla.
 *
 * Enquanto o projeto Supabase não existe, lê o JSON versionado em
 * dados-iniciais/. Quando existir, passa a consultar a tabela — e nenhuma
 * página precisa mudar, porque todas falam só com estas funções.
 *
 * O mesmo JSON é a origem do seed.sql da Fase 02, então as duas fontes
 * nascem com o mesmo conteúdo.
 */
async function buscar(tabela, arquivoLocal, ordenarPor) {
  if (!supabaseConfigurado()) {
    const resposta = await fetch(arquivoLocal);
    if (!resposta.ok) {
      throw new Error(`nao foi possivel ler ${arquivoLocal}`);
    }
    return resposta.json();
  }

  const { data, error } = await obterCliente()
    .from(tabela)
    .select('*')
    .eq('publicado', true)
    .order(ordenarPor);

  if (error) throw error;
  return data;
}

export function listarAtividades() {
  return buscar('atividades', '/assets/dados-iniciais/atividades.json', 'titulo');
}

export function listarClipping() {
  return buscar('clipping', '/assets/dados-iniciais/clipping.json', 'titulo');
}
```

- [ ] **Step 5: Commit**

```bash
git add site/assets/dados-iniciais/atividades.json site/assets/js/dados/conteudo.js testes/conteudo.test.mjs
git commit -m "Catálogo de atividades e fonte dupla de conteúdo

Onze atividades com o texto real dos releases. As seis sem sinopse ficam
com descricao null: o projeto não inventa texto, e a página omite a seção.

Os módulos de dados leem JSON enquanto não há Supabase e passam a consultar
a tabela depois, sem que nenhuma página mude."
```

---

### Task 2: Página "Quem somos" (RF02)

**Files:**
- Create: `site/quem-somos.html`
- Modify: `site/assets/css/base.css` (classes de conteúdo editorial)

**Interfaces:**
- Consumes: `<aac-header pagina-atual="quem-somos">` e `<aac-rodape>` da Fase 00
- Produces: nada consumido por outras tarefas

- [ ] **Step 1: Criar `site/quem-somos.html`**

Texto integral de `docs/conteudo-real.md`, seções 1, 2 e 3. O bloco do Sankofa abre a página porque é a
ideia que origina o Ateliê — e porque abre com cultura e identidade, não com carência (seção 3.1 do escopo).

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quem somos — Ateliê Afro Cultural</title>
  <meta name="description" content="A história do Ateliê Afro Cultural, seus idealizadores e os três setores de atuação: literário, musical e artístico criativo.">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/base.css">
  <link rel="stylesheet" href="assets/css/componentes.css">
  <script src="assets/js/preferencias-inicial.js"></script>
</head>
<body>
  <a class="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>

  <aac-header pagina-atual="quem-somos"></aac-header>

  <main id="conteudo" class="conteudo">
    <h1>Quem somos</h1>

    <p class="destaque">
      O Ateliê Afro Cultural é um espaço educativo de reflexão, criação e valorização da cultura
      e memória afro brasileira.
    </p>

    <section aria-labelledby="titulo-sankofa">
      <h2 id="titulo-sankofa">Sankofa</h2>
      <p>
        Sankofa é um símbolo africano representado por um pássaro que volta a cabeça à sua cauda,
        da filosofia do povo Akan, de Gana. Ele mostra que nunca é tarde para voltar e apanhar
        aquilo que ficou para trás. É essa ideia que dá origem ao Ateliê Afro Cultural.
      </p>
    </section>

    <section aria-labelledby="titulo-onde">
      <h2 id="titulo-onde">Onde estamos</h2>
      <p>
        Ficamos no bairro da Casa Verde, zona norte de São Paulo, um lugar de grande e
        importantíssima historicidade e presença negra. O ateliê propõe atividades que
        possibilitam aproximar as crianças da riqueza cultural afro-brasileira, aprofundando o
        estudo das raízes culturais africanas, visando elevar o respeito e a autoestima da
        criança, na sua percepção e atuação sobre si mesma e seu lugar no mundo.
      </p>
      <p>
        Sabemos que há necessidade de trabalhar e conscientizar o público infantil acerca das
        práticas e representações que configuram o racismo.
      </p>
    </section>

    <section aria-labelledby="titulo-idealizadores">
      <h2 id="titulo-idealizadores">Quem idealizou</h2>
      <p>
        <strong>Wil Oliveira</strong> e <strong>Nathália (Nathy) Monteiro</strong> são um casal de
        artistas e os idealizadores da instituição. Juntos somam habilidades artísticas como
        pesquisa acerca da cultura afro-brasileira, contação de histórias, brincantes de cultura
        popular, dança, música, atuação e escrita, sempre envolvendo a temática afro brasileira e
        a cultura popular.
      </p>
      <p>
        O ateliê ganhou sede na Casa Verde em janeiro de 2020. O casal ficou conhecido em rede
        nacional ao participar do programa Caldeirão do Huck, na Rede Globo, na véspera do Dia
        Internacional Contra a Discriminação Racial.
      </p>
    </section>

    <section aria-labelledby="titulo-setores">
      <h2 id="titulo-setores">Nossos três setores</h2>

      <article class="setor">
        <h3>Literário</h3>
        <p>
          Com livros da temática negra, abrange leituras, pesquisas, análises, reflexões e
          dinâmicas como contação de histórias, exercícios e técnicas de teatro. Todo o conteúdo
          é centralizado na temática negra.
        </p>
      </article>

      <article class="setor">
        <h3>Musical</h3>
        <p>
          Onde as crianças têm contato direto com a musicalidade afro brasileira, através de
          cantigas, instrumentos e corporeidade negra, como por exemplo os movimentos da capoeira.
          A musicalidade de raiz africana forneceu os mais belos elementos da cultura de
          resistência brasileira, desde o jongo, maculelê, maracatu, forró, samba, rap, hip hop,
          funk e tantos outros estilos musicais marcados pela presença de elementos milenares de
          identidade afro.
        </p>
      </article>

      <article class="setor">
        <h3>Artístico criativo</h3>
        <p>
          Onde as crianças exploram sua imaginação através de pinturas em tela, trabalhos com
          materiais reciclados para criar figurinos e cenários, desenhos, esculturas, colagem e
          tantas outras técnicas, para que desenvolvam habilidades artísticas criativas.
        </p>
      </article>
    </section>

    <section aria-labelledby="titulo-publico">
      <h2 id="titulo-publico">Para quem</h2>
      <p>
        Crianças, jovens e adultos, de todas as etnias, descendências e faixas etárias.
      </p>
    </section>

    <p class="chamada-final">
      <a class="botao" href="/projetos.html">Conhecer nossos projetos</a>
    </p>
  </main>

  <aac-rodape></aac-rodape>

  <script type="module" src="assets/js/componentes/aac-header.js"></script>
  <script type="module" src="assets/js/componentes/aac-rodape.js"></script>
</body>
</html>
```

- [ ] **Step 2: Acrescentar as classes editoriais a `site/assets/css/base.css`**

```css
.destaque {
  font-size: var(--texto-medio);
  color: var(--tinta);
  border-left: 4px solid var(--amarelo);
  padding-left: var(--espaco-3);
  max-width: 52ch;
}

main section { margin-bottom: var(--espaco-5); }

.setor {
  background: var(--superficie);
  border: 1px solid var(--borda);
  border-left: 4px solid var(--amarelo);
  border-radius: var(--raio);
  padding: var(--espaco-3);
  margin-bottom: var(--espaco-3);
}

.setor h3 { margin-bottom: var(--espaco-2); }
.setor p  { margin-bottom: 0; }

.botao {
  display: inline-block;
  min-height: var(--alvo-toque);
  line-height: var(--alvo-toque);
  padding: 0 var(--espaco-4);
  background: var(--amarelo);
  color: var(--tinta);
  font-weight: 600;
  text-decoration: none;
  border: 2px solid transparent;
  border-radius: var(--raio);
}

.botao:hover { filter: brightness(0.95); }

.botao--secundario {
  background: transparent;
  border-color: var(--marrom);
  color: var(--tinta);
}

.chamada-final { margin-top: var(--espaco-5); }
```

- [ ] **Step 3: Verificar no navegador**

Run: `python3 -m http.server 8080 --directory site`
Abrir `http://localhost:8080/quem-somos.html`. Confirmar: o item "Quem somos" do menu tem destaque de
página atual, os três setores aparecem, e nenhum texto está cortado em 375px.

- [ ] **Step 4: Rodar a auditoria**

```bash
npx --yes @axe-core/cli http://localhost:8080/quem-somos.html --browser firefox
```
Expected: 0 violações.

- [ ] **Step 5: Commit**

```bash
git add site/quem-somos.html site/assets/css/base.css
git commit -m "Página Quem somos

História, idealizadores e os três setores, com o texto real do portfólio
da ONG. Abre pelo Sankofa, que é a ideia que origina o ateliê."
```

---

### Task 3: Página de projetos (RF03)

**Files:**
- Create: `site/projetos.html`
- Create: `site/assets/js/componentes/aac-card-atividade.js`
- Create: `site/assets/js/paginas/projetos.js`
- Modify: `site/assets/css/componentes.css`

**Interfaces:**
- Consumes: `listarAtividades()` da Task 1; `renderizarEstado()` e `mensagemDeErro()` da Fase 00
- Produces: `<aac-card-atividade>` — recebe os dados pelo atributo `dados` como JSON, seguindo a regra de que componente não busca dado

- [ ] **Step 1: Criar `site/assets/js/componentes/aac-card-atividade.js`**

```js
/**
 * Cartão de uma atividade do catálogo.
 *
 * Recebe o dado pronto — não busca nada. É o que permite o mesmo cartão
 * servir a página pública e, na Fase 02, o painel da equipe.
 *
 * Campos ausentes são omitidos em vez de exibidos vazios: várias atividades
 * ainda não têm sinopse fornecida pela ONG.
 */
class AacCardAtividade extends HTMLElement {
  connectedCallback() {
    const dados = JSON.parse(this.getAttribute('dados'));
    const ficha = [
      ['Gênero', dados.genero],
      ['Duração', dados.duracao],
      ['Elenco', dados.elenco],
      ['Classificação', dados.classificacao],
      ['Local', dados.local],
      ['Precisa de', dados.rider]
    ].filter(([, valor]) => valor);

    this.innerHTML = `
      <article class="atividade" id="${dados.id}">
        <h3 class="atividade__titulo">${dados.titulo}</h3>
        ${dados.resumo ? `<p class="atividade__resumo">${dados.resumo}</p>` : ''}
        ${dados.descricao ? dados.descricao.split('\n\n')
            .map((paragrafo) => `<p>${paragrafo}</p>`).join('') : ''}
        ${ficha.length ? `
          <dl class="atividade__ficha">
            ${ficha.map(([rotulo, valor]) => `
              <div><dt>${rotulo}</dt><dd>${valor}</dd></div>`).join('')}
          </dl>` : ''}
      </article>`;
  }
}

customElements.define('aac-card-atividade', AacCardAtividade);
```

- [ ] **Step 2: Criar `site/assets/js/paginas/projetos.js`**

```js
import '../componentes/aac-card-atividade.js';
import { listarAtividades } from '../dados/conteudo.js';
import { renderizarEstado } from '../util/estados-lista.js';

const lista = document.getElementById('lista-atividades');

async function carregar() {
  renderizarEstado(lista, { situacao: 'carregando' });

  try {
    const atividades = await listarAtividades();
    renderizarEstado(
      lista,
      { situacao: 'pronto', itens: atividades, mensagemVazio: 'Nenhuma atividade publicada ainda.' },
      (itens) => itens.map((atividade) =>
        `<aac-card-atividade dados='${JSON.stringify(atividade).replace(/'/g, '&#39;')}'></aac-card-atividade>`
      ).join('')
    );
  } catch (erro) {
    renderizarEstado(lista, {
      situacao: 'erro',
      erro,
      contexto: 'os projetos',
      aoTentarDeNovo: carregar
    });
  }
}

carregar();
```

- [ ] **Step 3: Criar `site/projetos.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Projetos e atividades — Ateliê Afro Cultural</title>
  <meta name="description" content="Contações de história, espetáculos e vivências brincantes do Ateliê Afro Cultural, com ficha técnica de cada atividade.">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/base.css">
  <link rel="stylesheet" href="assets/css/componentes.css">
  <script src="assets/js/preferencias-inicial.js"></script>
</head>
<body>
  <a class="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>

  <aac-header pagina-atual="projetos"></aac-header>

  <main id="conteudo" class="conteudo">
    <h1>Projetos e atividades</h1>
    <p class="destaque">
      Contações de história performáticas e vivências brincantes. Todas se adaptam a qualquer
      espaço e têm classificação livre.
    </p>

    <p>
      Quer levar uma destas atividades para a sua escola ou instituição?
      <a href="/para-escolas.html">Veja como funciona</a> ou
      <a href="/contato.html">fale com a gente</a>.
    </p>

    <div id="lista-atividades" class="lista-atividades"></div>
  </main>

  <aac-rodape></aac-rodape>

  <script type="module" src="assets/js/componentes/aac-header.js"></script>
  <script type="module" src="assets/js/componentes/aac-rodape.js"></script>
  <script type="module" src="assets/js/paginas/projetos.js"></script>
</body>
</html>
```

- [ ] **Step 4: Acrescentar o estilo a `site/assets/css/componentes.css`**

```css
/* ---------- Atividades ---------- */

.lista-atividades { display: grid; gap: var(--espaco-4); }

.atividade {
  background: var(--superficie);
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  padding: var(--espaco-4);
}

.atividade__titulo {
  font-size: var(--texto-grande);
  color: var(--tinta);
  margin-bottom: var(--espaco-2);
}

.atividade__resumo {
  font-size: var(--texto-medio);
  color: var(--tinta-suave);
}

.atividade__ficha {
  margin: var(--espaco-4) 0 0;
  padding-top: var(--espaco-3);
  border-top: 1px solid var(--borda);
  display: grid;
  gap: var(--espaco-2);
}

.atividade__ficha > div { display: flex; gap: var(--espaco-2); flex-wrap: wrap; }
.atividade__ficha dt { font-weight: 700; min-width: 8rem; }
.atividade__ficha dd { margin: 0; color: var(--tinta-suave); }
```

- [ ] **Step 5: Verificar no navegador**

Abrir `http://localhost:8080/projetos.html`. Confirmar:
1. As 11 atividades aparecem
2. Banzo, Catirina, Cafú, Brincadeiras e Brincantes mostram descrição completa
3. As seis sem sinopse mostram título e ficha, **sem nenhum bloco vazio ou "em breve"**
4. Desligar a rede no DevTools e recarregar: aparece a mensagem de erro com botão "Tentar de novo", e o botão funciona quando a rede volta

- [ ] **Step 6: Commit**

```bash
git add site/projetos.html site/assets/js/componentes/aac-card-atividade.js site/assets/js/paginas/projetos.js site/assets/css/componentes.css
git commit -m "Página de projetos com o catálogo real

Onze atividades vindas do módulo de dados. Campos que a ONG ainda não
forneceu são omitidos em vez de exibidos vazios."
```

---

### Task 4: Home (RF01)

**Files:**
- Modify: `site/index.html` (reescrita completa)
- Modify: `site/assets/css/componentes.css`

**Interfaces:**
- Consumes: componentes da Fase 00
- Produces: nada

- [ ] **Step 1: Reescrever `site/index.html`**

A home abre com arte, cultura e identidade — nunca com apelo de caridade (seção 3.1). Os quatro
caminhos do RF01 aparecem logo abaixo: conhecer, participar, ser voluntário, apoiar.

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ateliê Afro Cultural</title>
  <meta name="description" content="Espaço educativo de criação, reflexão e valorização da cultura e memória afro brasileira, na Casa Verde, zona norte de São Paulo.">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/base.css">
  <link rel="stylesheet" href="assets/css/componentes.css">
  <script src="assets/js/preferencias-inicial.js"></script>
</head>
<body>
  <a class="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>

  <aac-header pagina-atual="inicio"></aac-header>

  <main id="conteudo">
    <section class="abertura">
      <div class="abertura__conteudo">
        <h1>Ateliê Afro Cultural</h1>
        <p class="abertura__slogan">
          Espaço educativo de criação, reflexão e valorização da cultura e memória
          afro brasileira.
        </p>
        <p class="abertura__acoes">
          <a class="botao" href="/projetos.html">Conhecer nossos projetos</a>
          <a class="botao botao--secundario" href="/agenda.html">Ver a agenda</a>
        </p>
      </div>
    </section>

    <div class="conteudo">
      <section aria-labelledby="titulo-caminhos">
        <h2 id="titulo-caminhos">Por onde começar</h2>
        <ul class="caminhos">
          <li class="caminho">
            <h3><a href="/quem-somos.html">Conhecer</a></h3>
            <p>Nossa história, quem idealizou o ateliê e os três setores de atuação.</p>
          </li>
          <li class="caminho">
            <h3><a href="/agenda.html">Participar</a></h3>
            <p>Oficinas, apresentações e vivências abertas ao público. A inscrição não exige cadastro.</p>
          </li>
          <li class="caminho">
            <h3><a href="/voluntariado.html">Ser voluntário</a></h3>
            <p>Cinco áreas de atuação, do apoio pedagógico à organização do acervo.</p>
          </li>
          <li class="caminho">
            <h3><a href="/doar.html">Apoiar</a></h3>
            <p>Recebemos livros, instrumentos musicais, materiais de arte, itens de acervo e recursos financeiros.</p>
          </li>
        </ul>
      </section>

      <section aria-labelledby="titulo-setores-home">
        <h2 id="titulo-setores-home">O que fazemos</h2>

        <article class="setor">
          <h3>Literário</h3>
          <p>Livros de temática negra, leituras, pesquisas, contação de histórias e técnicas de teatro.</p>
        </article>

        <article class="setor">
          <h3>Musical</h3>
          <p>Cantigas, instrumentos e corporeidade negra: jongo, maculelê, maracatu, forró, samba, rap, hip hop e funk.</p>
        </article>

        <article class="setor">
          <h3>Artístico criativo</h3>
          <p>Pintura em tela, materiais reciclados para figurinos e cenários, desenho, escultura e colagem.</p>
        </article>

        <p><a href="/quem-somos.html">Ler nossa história completa</a></p>
      </section>

      <section aria-labelledby="titulo-escolas-home">
        <h2 id="titulo-escolas-home">É de uma escola ou instituição?</h2>
        <p>
          Levamos contações de história e vivências brincantes até o seu espaço. Todas as
          atividades se adaptam a qualquer local e têm classificação livre.
        </p>
        <p><a class="botao" href="/para-escolas.html">Ver como funciona</a></p>
      </section>

      <section id="na-midia" aria-labelledby="titulo-midia-home">
        <h2 id="titulo-midia-home">Na mídia</h2>
        <div id="lista-midia"></div>
      </section>
    </div>
  </main>

  <aac-rodape></aac-rodape>

  <script type="module" src="assets/js/componentes/aac-header.js"></script>
  <script type="module" src="assets/js/componentes/aac-rodape.js"></script>
  <script type="module" src="assets/js/paginas/prova-social.js"></script>
</body>
</html>
```

- [ ] **Step 2: Acrescentar o estilo a `site/assets/css/componentes.css`**

```css
/* ---------- Abertura da home ---------- */

.abertura {
  background: var(--amarelo);
  border-bottom: 3px solid var(--tinta);
}

.abertura__conteudo {
  max-width: var(--largura-conteudo);
  margin: 0 auto;
  padding: var(--espaco-6) var(--espaco-3);
}

.abertura h1 {
  font-size: var(--texto-destaque);
  color: var(--tinta);
  margin-bottom: var(--espaco-3);
}

.abertura__slogan {
  font-size: var(--texto-medio);
  color: var(--tinta);
  max-width: 46ch;
}

.abertura__acoes {
  display: flex;
  gap: var(--espaco-3);
  flex-wrap: wrap;
  margin-top: var(--espaco-4);
}

.abertura .botao {
  background: var(--tinta);
  color: var(--fundo);
}

.abertura .botao--secundario {
  background: transparent;
  border-color: var(--tinta);
  color: var(--tinta);
}

/* ---------- Caminhos ---------- */

.caminhos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--espaco-3);
}

@media (min-width: 48rem) {
  .caminhos { grid-template-columns: repeat(2, 1fr); }
}

.caminho {
  background: var(--superficie);
  border: 1px solid var(--borda);
  border-top: 4px solid var(--azul);
  border-radius: var(--raio);
  padding: var(--espaco-3);
}

.caminho h3 { margin-bottom: var(--espaco-2); }
.caminho p  { margin-bottom: 0; color: var(--tinta-suave); }

html[data-contraste="alto"] .abertura { background: #FFFFFF; }
html[data-contraste="alto"] .abertura .botao { background: #000000; color: #FFFFFF; }
```

- [ ] **Step 3: Verificar no navegador**

Abrir `http://localhost:8080/`. Confirmar:
1. A abertura fala de arte e cultura — **nenhuma linguagem de caridade ou pedido de pena**
2. Os quatro caminhos do RF01 estão presentes e levam às páginas certas
3. Em alto contraste, o texto sobre a faixa amarela continua legível
4. Em 375px, os botões da abertura não se sobrepõem

- [ ] **Step 4: Commit**

```bash
git add site/index.html site/assets/css/componentes.css
git commit -m "Home institucional

Abre com arte, cultura e identidade, como manda a seção 3.1 do escopo, e
apresenta os quatro caminhos do RF01: conhecer, participar, ser voluntário
e apoiar."
```

---

### Task 5: Prova social (RF39)

**Files:**
- Create: `site/assets/dados-iniciais/clipping.json`
- Create: `site/assets/js/paginas/prova-social.js`
- Modify: `testes/conteudo.test.mjs`
- Modify: `site/assets/css/componentes.css`

**Interfaces:**
- Consumes: `listarClipping()` da Task 1; `renderizarEstado()` da Fase 00
- Produces: preenche os elementos `#lista-midia` (home) e `#lista-instituicoes` (para-escolas, Task 6)

- [ ] **Step 1: Criar `site/assets/dados-iniciais/clipping.json`**

Somente o que a seção 18.2 do escopo lista como verificável. A regra é explícita: não acrescentar
nenhum outro registro sem confirmação.

```json
[
  { "id": "folha-materia", "tipo": "midia", "titulo": "Folha de S.Paulo", "detalhe": "Como o menino que era caixa de supermercado criou um ateliê para valorizar a cultura negra", "ano": null },
  { "id": "globo-caldeirao", "tipo": "midia", "titulo": "Rede Globo — Caldeirão do Huck", "detalhe": "Participação em rede nacional", "ano": 2021 },
  { "id": "globo-the-wall", "tipo": "midia", "titulo": "Rede Globo — The Wall", "detalhe": "Participação no programa", "ano": 2021 },

  { "id": "sesc-interlagos", "tipo": "instituicao", "titulo": "SESC Interlagos", "detalhe": null, "ano": null },
  { "id": "sesc-santo-amaro", "tipo": "instituicao", "titulo": "SESC Santo Amaro", "detalhe": null, "ano": null },
  { "id": "fabricas-de-cultura", "tipo": "instituicao", "titulo": "Fábricas de Cultura", "detalhe": "Jaçanã", "ano": null },
  { "id": "casas-de-cultura", "tipo": "instituicao", "titulo": "Casas de Cultura de São Paulo", "detalhe": "Inclui a Casa de Cultura São Rafael", "ano": null },
  { "id": "teatro-adelia-lorenzetti", "tipo": "instituicao", "titulo": "Teatro Municipal Adélia Lorenzetti", "detalhe": null, "ano": null },
  { "id": "pracas-da-cultura", "tipo": "instituicao", "titulo": "Praças da Cultura", "detalhe": "Subprefeitura Pirituba/Jaraguá", "ano": null },
  { "id": "espaco-malungo", "tipo": "instituicao", "titulo": "Espaço Malungo", "detalhe": null, "ano": null },
  { "id": "ambev-campinas", "tipo": "instituicao", "titulo": "Ambev", "detalhe": "Ação de Dia das Crianças, Campinas", "ano": 2021 },
  { "id": "igualdade-racial", "tipo": "instituicao", "titulo": "Subsecretaria de Igualdade Racial", "detalhe": "II Festa Preta, Parque Bosque Maia", "ano": null },

  { "id": "consciencia-negra", "tipo": "programacao", "titulo": "Mês da Consciência Negra", "detalhe": "Programação recorrente", "ano": null },
  { "id": "reexistencia", "tipo": "programacao", "titulo": "(Re)Existência do Povo Negro", "detalhe": "SESC", "ano": null }
]
```

- [ ] **Step 2: Acrescentar os testes a `testes/conteudo.test.mjs`**

```js
test('clipping.json só contém tipos previstos', async () => {
  const permitidos = new Set(['midia', 'instituicao', 'programacao']);
  for (const registro of await carregar('clipping.json')) {
    assert.ok(permitidos.has(registro.tipo), `tipo desconhecido: ${registro.tipo}`);
  }
});

test('todo registro de clipping tem id e título únicos', async () => {
  const registros = await carregar('clipping.json');
  const ids = registros.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'há id repetido');
  for (const registro of registros) {
    assert.ok(registro.titulo, `registro ${registro.id} sem título`);
  }
});

test('o clipping não inventa patrocinador nem parceiro', async () => {
  // A seção 9.2 do escopo recusa a seção "Nossos apoiadores": a ONG declarou
  // não possuir patrocinador nem parceiro institucional. O clipping registra
  // apenas onde já se apresentou e onde foi noticiada.
  const bruto = JSON.stringify(await carregar('clipping.json'));
  assert.doesNotMatch(bruto, /patrocinador|patrocínio|apoiador oficial|parceiro institucional/i);
});
```

- [ ] **Step 3: Rodar os testes**

Run: `node --test testes/conteudo.test.mjs`
Expected: PASS — 10 testes

- [ ] **Step 4: Criar `site/assets/js/paginas/prova-social.js`**

```js
import { listarClipping } from '../dados/conteudo.js';
import { renderizarEstado } from '../util/estados-lista.js';

/**
 * Preenche as seções de prova social onde elas existirem.
 *
 * A mesma fonte alimenta "Na mídia" na home e "Onde já estivemos" na página
 * para escolas — por isso o script é tolerante à ausência de cada elemento.
 */
const midia = document.getElementById('lista-midia');
const instituicoes = document.getElementById('lista-instituicoes');

function desenhar(registros) {
  return `<ul class="clipping">${registros.map((registro) => `
    <li class="clipping__item">
      <strong>${registro.titulo}</strong>
      ${registro.detalhe ? `<span class="clipping__detalhe">${registro.detalhe}</span>` : ''}
      ${registro.ano ? `<span class="clipping__ano">${registro.ano}</span>` : ''}
    </li>`).join('')}</ul>`;
}

async function carregar() {
  const alvos = [midia, instituicoes].filter(Boolean);
  if (alvos.length === 0) return;

  alvos.forEach((alvo) => renderizarEstado(alvo, { situacao: 'carregando' }));

  try {
    const registros = await listarClipping();

    if (midia) {
      renderizarEstado(
        midia,
        { situacao: 'pronto', itens: registros.filter((r) => r.tipo === 'midia') },
        desenhar
      );
    }

    if (instituicoes) {
      renderizarEstado(
        instituicoes,
        {
          situacao: 'pronto',
          itens: registros.filter((r) => r.tipo === 'instituicao' || r.tipo === 'programacao')
        },
        desenhar
      );
    }
  } catch (erro) {
    alvos.forEach((alvo) => renderizarEstado(alvo, {
      situacao: 'erro', erro, contexto: 'esta lista', aoTentarDeNovo: carregar
    }));
  }
}

carregar();
```

- [ ] **Step 5: Acrescentar o estilo a `site/assets/css/componentes.css`**

```css
/* ---------- Clipping ---------- */

.clipping { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--espaco-2); }

.clipping__item {
  padding: var(--espaco-3);
  background: var(--superficie);
  border: 1px solid var(--borda);
  border-left: 4px solid var(--marrom);
  border-radius: var(--raio);
  display: flex;
  gap: var(--espaco-2);
  flex-wrap: wrap;
  align-items: baseline;
}

.clipping__detalhe { color: var(--tinta-suave); }
.clipping__ano { margin-left: auto; color: var(--tinta-suave); }
```

- [ ] **Step 6: Commit**

```bash
git add site/assets/dados-iniciais/clipping.json site/assets/js/paginas/prova-social.js site/assets/css/componentes.css testes/conteudo.test.mjs
git commit -m "Prova social com o clipping verificável

Somente os registros que a seção 18.2 do escopo lista. Teste garante que
nenhum patrocinador ou parceiro apareça: a ONG declarou não possuir, e uma
lista inventada produziria o efeito social inverso."
```

---

### Task 6: Para Escolas (RF38)

**Files:**
- Create: `site/para-escolas.html`

**Interfaces:**
- Consumes: componentes da Fase 00; `prova-social.js` da Task 5 preenche `#lista-instituicoes`
- Produces: nada

- [ ] **Step 1: Criar `site/para-escolas.html`**

O critério de aceite do M1 exige que um professor chegue aqui a partir da home em no máximo dois
cliques — a Task 4 já cria dois caminhos diretos.

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Para escolas — Ateliê Afro Cultural</title>
  <meta name="description" content="Contações de história e vivências brincantes para escolas e instituições, com faixas etárias, duração e o que a escola precisa providenciar.">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/base.css">
  <link rel="stylesheet" href="assets/css/componentes.css">
  <script src="assets/js/preferencias-inicial.js"></script>
</head>
<body>
  <a class="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>

  <aac-header pagina-atual="para-escolas"></aac-header>

  <main id="conteudo" class="conteudo">
    <h1>Para escolas e instituições</h1>

    <p class="destaque">
      Levamos contações de história performáticas e vivências brincantes até o seu espaço,
      trabalhando cultura e memória afro-brasileira com as crianças.
    </p>

    <section aria-labelledby="titulo-atividades-escola">
      <h2 id="titulo-atividades-escola">Que atividades existem</h2>
      <p>
        Nosso catálogo reúne contações de história performáticas, apresentações com fantoches e
        música ao vivo, e vivências de brincadeiras da cultura popular.
      </p>
      <p><a class="botao" href="/projetos.html">Ver o catálogo completo</a></p>
    </section>

    <section aria-labelledby="titulo-formato">
      <h2 id="titulo-formato">Formato e duração</h2>
      <dl class="ficha">
        <div><dt>Público</dt><dd>Crianças, jovens e adultos, de todas as etnias e faixas etárias</dd></div>
        <div><dt>Classificação</dt><dd>Livre</dd></div>
        <div><dt>Duração</dt><dd>50 minutos na maioria das atividades; algumas a combinar</dd></div>
        <div><dt>Local</dt><dd>Adaptável a qualquer espaço</dd></div>
      </dl>
    </section>

    <section aria-labelledby="titulo-providenciar">
      <h2 id="titulo-providenciar">O que a escola precisa providenciar</h2>
      <ul class="lista-simples">
        <li>Um espaço para a apresentação — adaptamos ao que a escola tiver</li>
        <li>1 caixa de som</li>
        <li>1 microfone, com ou sem fio, conforme a atividade</li>
      </ul>
      <p>
        A ficha técnica de cada atividade traz o que ela pede em detalhe.
      </p>
    </section>

    <section aria-labelledby="titulo-onde-estivemos">
      <h2 id="titulo-onde-estivemos">Onde já estivemos</h2>
      <div id="lista-instituicoes"></div>
    </section>

    <section aria-labelledby="titulo-solicitar">
      <h2 id="titulo-solicitar">Solicitar uma atividade</h2>
      <p>
        Conte para a gente qual atividade interessou, quantas crianças participariam e qual
        período você tem em mente. Respondemos pelo mesmo canal que você escolher.
      </p>
      <p class="abertura__acoes">
        <a class="botao" href="https://wa.me/5511953968344" rel="noopener">Falar pelo WhatsApp</a>
        <a class="botao botao--secundario" href="mailto:atelieafro@gmail.com">Enviar e-mail</a>
      </p>
    </section>
  </main>

  <aac-rodape></aac-rodape>

  <script type="module" src="assets/js/componentes/aac-header.js"></script>
  <script type="module" src="assets/js/componentes/aac-rodape.js"></script>
  <script type="module" src="assets/js/paginas/prova-social.js"></script>
</body>
</html>
```

- [ ] **Step 2: Acrescentar o estilo a `site/assets/css/base.css`**

```css
.ficha { display: grid; gap: var(--espaco-2); margin: 0 0 var(--espaco-3); }
.ficha > div { display: flex; gap: var(--espaco-2); flex-wrap: wrap; }
.ficha dt { font-weight: 700; min-width: 9rem; }
.ficha dd { margin: 0; color: var(--tinta-suave); }

.lista-simples { padding-left: var(--espaco-4); max-width: 60ch; }
.lista-simples li { margin-bottom: var(--espaco-2); }
```

- [ ] **Step 3: Verificar o critério de aceite do M1**

Abrir a home e contar os cliques até "Para escolas":
1. Item "Para escolas" no menu — **um clique**
2. Botão "Ver como funciona" na seção "É de uma escola ou instituição?" — **um clique**

Ambos dentro do limite de dois cliques exigido pela seção 14 do escopo.

- [ ] **Step 4: Commit**

```bash
git add site/para-escolas.html site/assets/css/base.css
git commit -m "Página Para escolas

Atividades, faixas etárias, formato, o que a escola providencia e onde o
ateliê já se apresentou. Alcançável da home em um clique."
```

---

### Task 7: Contato, notícias e galeria (RF04, RF05, RF06, RF07)

Notícias e galeria dependem de tabelas que só existem na Fase 02. Ficam com a estrutura pronta e o
estado vazio funcionando, para ligarem sem reescrita.

**Files:**
- Create: `site/contato.html`
- Create: `site/noticias.html`
- Create: `site/galeria.html`

**Interfaces:**
- Consumes: componentes e utilitários da Fase 00
- Produces: nada. A Fase 02 preenche `#lista-noticias` e `#lista-albuns`

- [ ] **Step 1: Criar `site/contato.html`**

Os cinco contatos que o RF06 nomeia. O formulário do RF07 grava em `contatos`, tabela da Fase 02 —
até lá a página oferece os canais diretos, que já funcionam, em vez de um formulário que falharia.

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Contato — Ateliê Afro Cultural</title>
  <meta name="description" content="Telefone, WhatsApp, e-mail, redes sociais e endereço do Ateliê Afro Cultural, na Casa Verde, São Paulo.">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/base.css">
  <link rel="stylesheet" href="assets/css/componentes.css">
  <script src="assets/js/preferencias-inicial.js"></script>
</head>
<body>
  <a class="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>

  <aac-header pagina-atual="contato"></aac-header>

  <main id="conteudo" class="conteudo">
    <h1>Fale com a gente</h1>

    <p class="destaque">
      Escolas, instituições, empresas, imprensa ou qualquer pessoa que queira conhecer o
      ateliê: escreva pelo canal que preferir.
    </p>

    <section aria-labelledby="titulo-canais">
      <h2 id="titulo-canais">Canais diretos</h2>
      <dl class="ficha">
        <div><dt>Telefone</dt><dd><a href="tel:+5511953968344">(11) 95396-8344</a></dd></div>
        <div><dt>WhatsApp</dt><dd><a href="https://wa.me/5511953968344" rel="noopener">(11) 95396-8344</a></dd></div>
        <div><dt>E-mail</dt><dd><a href="mailto:atelieafro@gmail.com">atelieafro@gmail.com</a></dd></div>
        <div><dt>Instagram</dt><dd><a href="https://instagram.com/atelie_afrocultural" rel="noopener">@atelie_afrocultural</a></dd></div>
        <div><dt>TikTok</dt><dd><a href="https://tiktok.com/@ateli.afro.cultur" rel="noopener">@ateli.afro.cultur</a></dd></div>
        <div><dt>YouTube</dt><dd><a href="https://www.youtube.com/channel/UCWeZ-53etejdUzUi3eR81zg" rel="noopener">Nosso canal</a></dd></div>
      </dl>
    </section>

    <section aria-labelledby="titulo-endereco-contato">
      <h2 id="titulo-endereco-contato">Onde estamos</h2>
      <address class="rodape__endereco">
        Rua Dr. Paulo Gatti, 135 — Vila Romero<br>
        São Paulo/SP — CEP 02468-030
      </address>
      <p>Nossa sede fica no bairro da Casa Verde, zona norte de São Paulo.</p>
    </section>
  </main>

  <aac-rodape></aac-rodape>

  <script type="module" src="assets/js/componentes/aac-header.js"></script>
  <script type="module" src="assets/js/componentes/aac-rodape.js"></script>
</body>
</html>
```

- [ ] **Step 2: Criar `site/noticias.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Notícias — Ateliê Afro Cultural</title>
  <meta name="description" content="Notícias, campanhas e resultados do Ateliê Afro Cultural.">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/base.css">
  <link rel="stylesheet" href="assets/css/componentes.css">
  <script src="assets/js/preferencias-inicial.js"></script>
</head>
<body>
  <a class="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>

  <aac-header pagina-atual="noticias"></aac-header>

  <main id="conteudo" class="conteudo">
    <h1>Notícias</h1>
    <p class="destaque">O que anda acontecendo no ateliê.</p>
    <div id="lista-noticias">
      <p class="estado estado--vazio">Nenhuma notícia publicada ainda.</p>
    </div>
  </main>

  <aac-rodape></aac-rodape>

  <script type="module" src="assets/js/componentes/aac-header.js"></script>
  <script type="module" src="assets/js/componentes/aac-rodape.js"></script>
</body>
</html>
```

- [ ] **Step 3: Criar `site/galeria.html`**

Estrutura idêntica à de notícias, trocando título, descrição, `pagina-atual` e o identificador da
lista. Repetido por inteiro porque o executor pode ler as tarefas fora de ordem:

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Galeria — Ateliê Afro Cultural</title>
  <meta name="description" content="Fotos e vídeos das ações e eventos do Ateliê Afro Cultural.">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/base.css">
  <link rel="stylesheet" href="assets/css/componentes.css">
  <script src="assets/js/preferencias-inicial.js"></script>
</head>
<body>
  <a class="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>

  <aac-header pagina-atual="galeria"></aac-header>

  <main id="conteudo" class="conteudo">
    <h1>Galeria</h1>
    <p class="destaque">Registros das nossas ações, oficinas e apresentações.</p>
    <div id="lista-albuns">
      <p class="estado estado--vazio">Nenhum álbum publicado ainda.</p>
    </div>
  </main>

  <aac-rodape></aac-rodape>

  <script type="module" src="assets/js/componentes/aac-header.js"></script>
  <script type="module" src="assets/js/componentes/aac-rodape.js"></script>
</body>
</html>
```

- [ ] **Step 4: Registrar o que fica pendente**

Acrescentar ao final de `docs/conteudo-real.md`:

```markdown
## Pendente da Fase 02

- **RF07 — formulário de contato**: depende da tabela `contatos` e da sua política de RLS.
  Até lá, `contato.html` oferece os canais diretos, que já funcionam.
- **RF04 — notícias** e **RF05 — galeria**: as páginas existem com estado vazio; ligam às tabelas
  `publicacoes` e `midia` sem reescrita.
- **Galeria**: migrar os quatro álbuns do `meualbum.co` depende das fotos em alta e das
  autorizações de uso de imagem.
```

- [ ] **Step 5: Commit**

```bash
git add site/contato.html site/noticias.html site/galeria.html docs/conteudo-real.md
git commit -m "Contato, notícias e galeria

Os cinco contatos do RF06 com os canais que já funcionam. Notícias e galeria
ficam com estado vazio até as tabelas existirem na Fase 02."
```

---

### Task 8: Verificação da fase

Estende a verificação automatizada da Fase 00 para todas as páginas.

**Files:**
- Create: `testes/paginas.test.mjs`
- Create: `docs/verificacao-fase-01.md`

**Interfaces:**
- Consumes: todas as páginas das tarefas 2 a 7
- Produces: registro de verificação

- [ ] **Step 1: Criar `testes/paginas.test.mjs`**

```js
/**
 * Verificações estruturais em todas as páginas públicas.
 *
 * Roda em Firefox headless com servidor próprio, como testes/navegador.test.mjs.
 * Cada página nova entra na lista PAGINAS e ganha toda a bateria de graça.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const PAGINAS = [
  { arquivo: 'index.html',        chave: 'inicio' },
  { arquivo: 'quem-somos.html',   chave: 'quem-somos' },
  { arquivo: 'projetos.html',     chave: 'projetos' },
  { arquivo: 'noticias.html',     chave: 'noticias' },
  { arquivo: 'galeria.html',      chave: 'galeria' },
  { arquivo: 'para-escolas.html', chave: 'para-escolas' },
  { arquivo: 'contato.html',      chave: 'contato' }
];

const RAIZ = new URL('../site/', import.meta.url).pathname;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

let servidor;
let navegador;
let endereco;

before(async () => {
  servidor = createServer(async (requisicao, resposta) => {
    const caminho = requisicao.url === '/' ? '/index.html' : requisicao.url.split('?')[0];
    try {
      const arquivo = join(RAIZ, normalize(caminho));
      const conteudo = await readFile(arquivo);
      resposta.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
      resposta.end(conteudo);
    } catch {
      resposta.writeHead(404).end('nao encontrado');
    }
  });

  await new Promise((pronto) => servidor.listen(0, pronto));
  endereco = `http://localhost:${servidor.address().port}`;

  navegador = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();
});

after(async () => {
  await navegador?.quit();
  servidor?.close();
});

for (const pagina of PAGINAS) {
  test(`${pagina.arquivo}: estrutura semântica completa`, async () => {
    await navegador.get(`${endereco}/${pagina.arquivo}`);

    const estrutura = await navegador.executeScript(`
      return {
        titulo: document.title,
        descricao: document.querySelector('meta[name="description"]')?.content || '',
        h1: document.querySelectorAll('h1').length,
        main: Boolean(document.querySelector('main#conteudo')),
        skip: Boolean(document.querySelector('.pular-para-conteudo')),
        idioma: document.documentElement.lang
      };
    `);

    assert.ok(estrutura.titulo.includes('Ateliê Afro Cultural'), 'título sem o nome da organização');
    assert.ok(estrutura.descricao.length > 30, 'meta description ausente ou curta');
    assert.equal(estrutura.h1, 1, 'a página precisa de exatamente um h1');
    assert.ok(estrutura.main, 'falta <main id="conteudo">');
    assert.ok(estrutura.skip, 'falta o link de pular para o conteúdo');
    assert.equal(estrutura.idioma, 'pt-BR');
  });

  test(`${pagina.arquivo}: cabeçalho e rodapé montam`, async () => {
    await navegador.get(`${endereco}/${pagina.arquivo}`);

    const montou = await navegador.executeScript(`
      return {
        menu: Boolean(document.querySelector('#menu-principal')),
        atual: document.querySelector('[aria-current="page"]')?.textContent.trim() || null,
        contatos: document.querySelectorAll('.rodape__lista a').length,
        acessibilidade: document.querySelectorAll('.acessibilidade button').length
      };
    `);

    assert.ok(montou.menu, 'o menu não montou');
    assert.ok(montou.atual, 'nenhum item marcado como página atual');
    assert.ok(montou.contatos >= 5, 'o rodapé precisa dos cinco contatos do RF06');
    assert.equal(montou.acessibilidade, 4, 'faltam controles de acessibilidade');
  });

  test(`${pagina.arquivo}: toda imagem tem alt`, async () => {
    await navegador.get(`${endereco}/${pagina.arquivo}`);
    const semAlt = await navegador.executeScript(`
      return [...document.querySelectorAll('img')]
        .filter((i) => !i.hasAttribute('alt'))
        .map((i) => i.src);
    `);
    assert.deepEqual(semAlt, [], 'imagens sem alt');
  });

  test(`${pagina.arquivo}: sem rolagem horizontal em 375px`, async () => {
    await navegador.manage().window().setRect({ width: 375, height: 720 });
    await navegador.get(`${endereco}/${pagina.arquivo}`);
    const excesso = await navegador.executeScript(
      'return document.documentElement.scrollWidth - document.documentElement.clientWidth'
    );
    assert.ok(excesso <= 0, `vaza ${excesso}px na horizontal`);
  });
}

test('projetos.html mostra as onze atividades', async () => {
  await navegador.manage().window().setRect({ width: 1280, height: 900 });
  await navegador.get(`${endereco}/projetos.html`);

  // O catálogo carrega por fetch: espera o primeiro cartão aparecer.
  await navegador.wait(async () =>
    (await navegador.findElements(By.css('aac-card-atividade'))).length > 0, 5000);

  const cartoes = await navegador.findElements(By.css('aac-card-atividade'));
  assert.equal(cartoes.length, 11, 'o escopo lista 11 atividades');
});

test('nenhuma página pública usa linguagem assistencialista', async () => {
  // Seção 3.1 do escopo: o Ateliê é organização de arte, cultura e identidade,
  // não de assistência social. Linguagem de caridade invalida a entrega.
  const proibidos = /crianças carentes|ajude uma criança|doe um sorriso|vidas salvas|apadrinhe|carência|coitad/i;

  for (const pagina of PAGINAS) {
    await navegador.get(`${endereco}/${pagina.arquivo}`);
    const texto = await navegador.executeScript('return document.body.innerText');
    assert.doesNotMatch(texto, proibidos, `linguagem assistencialista em ${pagina.arquivo}`);
  }
});
```

- [ ] **Step 2: Rodar a verificação de páginas**

Run: `node --test testes/paginas.test.mjs`
Expected: PASS — 30 testes (4 por página × 7 páginas, mais 2 gerais). Qualquer falha aponta a página e o
critério; corrigir a página, não o teste.

- [ ] **Step 3: Rodar a suíte completa**

Run: `node --test`
Expected: PASS — todos os testes da Fase 00 mais os desta fase.

- [ ] **Step 4: Rodar a auditoria de acessibilidade em todas as páginas**

```bash
python3 -m http.server 8080 --directory site &
for p in index quem-somos projetos noticias galeria para-escolas contato; do
  echo "== $p =="
  npx --yes @axe-core/cli "http://localhost:8080/$p.html" --browser firefox
done
```
Expected: 0 violações em todas. Corrigir antes de seguir.

- [ ] **Step 5: Acrescentar as sete páginas ao teste sem JavaScript**

Em `testes/sem-javascript.test.mjs`, trocar a lista por todas as páginas da fase:

```js
const PAGINAS = [
  'index.html', 'quem-somos.html', 'projetos.html', 'noticias.html',
  'galeria.html', 'para-escolas.html', 'contato.html'
];
```

Run: `node --test testes/sem-javascript.test.mjs`
Expected: PASS — 21 testes (3 por página). Se alguma falhar, falta o bloco `<noscript>` naquela página.

- [ ] **Step 6: Registrar o resultado em `docs/verificacao-fase-01.md`**

```markdown
# Verificação — Fase 01 (Site institucional)

Data: <preencher com a data da execução>
Comandos: `node --test` · `npx @axe-core/cli <url> --browser firefox`

| Verificação | Resultado |
|---|---|
| `node --test` — suíte completa | <preencher: total e passando> |
| Integridade de `atividades.json` e `clipping.json` | <preencher> |
| Estrutura semântica nas 7 páginas | <preencher> |
| Cabeçalho e rodapé montam nas 7 páginas | <preencher> |
| Alt em toda imagem, nas 7 páginas | <preencher> |
| Sem rolagem horizontal em 375px, nas 7 páginas | <preencher> |
| Navegação e contatos sem JavaScript, nas 7 páginas | <preencher> |
| Ausência de linguagem assistencialista | <preencher> |
| As 11 atividades aparecem em projetos.html | <preencher> |
| axe-core nas 7 páginas | <preencher: violações por página> |
| "Para escolas" alcançável da home em ≤ 2 cliques | <preencher> |

## Achados durante a execução

<preencher: o que apareceu de inesperado, como no registro da Fase 00>

## Pendências

| Pendência | Decisão | Bloqueia |
|---|---|---|
| Projeto Supabase na nuvem, região São Paulo | — | Fase 02, em 28/08 |
| Validação de `docs/conteudo-real.md` com a ONG | seção 18.2 | Publicação |
| Sinopse dos seis espetáculos sem descrição | — | Completude de projetos.html |
| "Nathi Nunes" e "Nathália (Nathy) Monteiro" são a mesma pessoa? | — | Ficha de Brincadeiras Encantadas |
| Autorizações de uso de imagem | RN07 / R10 | Qualquer foto no site |
| Sankofa como elemento da identidade visual? | — | Nada; enriqueceria a home |
```

Preencher com o que **de fato** foi observado. Item que não passou fica registrado como não passou.

- [ ] **Step 7: Commit**

```bash
git add testes/paginas.test.mjs testes/sem-javascript.test.mjs docs/verificacao-fase-01.md
git commit -m "Verificação da Fase 01

Bateria estrutural em todas as sete páginas públicas: semântica, cabeçalho
e rodapé, alt em imagens, ausência de rolagem horizontal e um teste que
recusa linguagem assistencialista, como manda a seção 3.1 do escopo."
```

---

## Ao terminar esta fase

A Fase 02 assume como pronto:

- Sete páginas públicas com conteúdo real, auditadas e sem violação de acessibilidade
- `listarAtividades()` e `listarClipping()` com fonte dupla — trocar para Supabase não altera página alguma
- `atividades.json` e `clipping.json` prontos para virar `seed.sql`
- `#lista-noticias` e `#lista-albuns` esperando as tabelas `publicacoes` e `midia`

**Bloqueio conhecido:** o projeto Supabase precisa existir antes de 28/08. Sem Docker nesta máquina,
não há alternativa local.

**Pendências de conteúdo que a equipe precisa destravar:**

1. Validar `docs/conteudo-real.md` com a ONG — sobretudo as citações e números lidos da matéria da Folha
2. Sinopse dos seis espetáculos sem descrição
3. Confirmar se "Nathi Nunes" e "Nathália (Nathy) Monteiro" são a mesma pessoa
4. Autorizações de uso de imagem — nenhuma foto foi publicada por falta delas
5. Confirmar se a ONG quer o Sankofa como elemento da identidade visual
