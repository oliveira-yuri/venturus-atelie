# Ateliê Afro Cultural — guia do projeto

Site para o **Ateliê Afro Cultural**, ONG de arte, cultura e memória afro-brasileira na Casa Verde,
zona norte de São Paulo. Fatec Innovation Challenge.

**Fonte de verdade do escopo:** `PLANO-PROJETO-ATELIE-AFRO-CULTURAL.md`
**Decisões de implementação:** `docs/superpowers/specs/2026-08-24-atelie-afro-cultural-design.md`
**Migração para Next.js (decidida em 28/08/2026):** `docs/superpowers/specs/2026-08-28-migracao-nextjs-design.md`
— o portão go/no-go foi vencido (**GO**); `main` continua sendo o que está no ar até esta branch
ser publicada de verdade na Netlify
**Conteúdo real da ONG:** `docs/conteudo-real.md` — nunca inventar texto; se falta, perguntar

---

## Manter este arquivo atualizado

**Ao terminar, acrescentar ou modificar qualquer funcionalidade, atualize a tabela de status abaixo
no mesmo commit.** Um mapa desatualizado é pior que nenhum: leva a refazer o que já existe e a
prometer o que não existe.

Marque com o que foi *verificado*, não com o que se pretende: `pronto` só depois de rodar e ver
funcionando.

---

## Comandos

```bash
npm test                        # suíte completa, modo offline (460 testes)
npm run test:supabase           # a mesma suíte, contra o banco real (461)
npm run test:supabase-degradado # prova que falha de consulta não derruba a página
npm run verificar-deploy        # guardião: barra deploy inseguro
npm run rls                     # políticas de segurança contra Postgres real
npm run seed                    # regenera supabase/seed.sql dos JSON de dados-iniciais/
./ferramentas/gerar-sql-completo.sh  # junta migrations + seed num arquivo
npx next dev                    # servir o site
npx @axe-core/cli http://localhost:3000/ --browser firefox   # acessibilidade
```

O modo offline é o padrão **de propósito**: ele roda sem rede, sem `.env.local`, e é
determinístico. O `test:supabase` é o que exercita a camada de dados de verdade — sem
ele, o site pode servir o JSON versionado com o Supabase configurado e ninguém saber.

Os 460 são 448 passando, 3 pulados com motivo declarado e 9 `test.todo` — os do painel
(RF33), que descrevem requisitos válidos cuja forma de verificar só existe no Bloco B. Dois
dos pulados nasceram na revisão final do Bloco A: `ROTAS_PENDENTES` está vazia desde a A6, e
os testes que iteravam sobre ela passavam sem verificar nada — pular com motivo escrito é a
contagem honesta.

`test:supabase-degradado` roda dois arquivos, não um: `origem-dos-dados` (a fonte dupla cai
para o JSON e diz que caiu) e `degradacao` (as três rotas sem JSON irmão respondem 200 com
o layout inteiro em vez de 500). Para exercitar o caminho de EXCEÇÃO (rede/DNS, não `{error}`):
`COM_SUPABASE=chave-errada SUPABASE_URL=https://host-que-nao-existe.invalid node ferramentas/rodar-testes.mjs testes/degradacao.test.mjs`.

## Regras invioláveis

Cada uma vem do escopo e violá-la invalida a entrega — com a exceção anotada na 7.

1. **Não é ONG assistencialista.** É arte, cultura e identidade do povo negro. Nada de estética de
   pena, linguagem de caridade ou contador de "vidas salvas". Há teste que recusa isso.
2. **Nunca inventar conteúdo.** Sem lorem ipsum, sem evento ou depoimento fictício. Faltou texto
   real, pergunta. Campos sem dado ficam `null` e a página omite a seção.
3. **A paleta é da ONG**, com significado declarado por eles: amarelo `#E0A400`, azul `#7FA9CE`,
   marrom `#8A6A4A`. Não alterar.
4. **Mobile-first no painel.** A ONG não possui computador — toda operação acontece no celular
   pessoal da equipe, muitas vezes de pé, no meio de um evento.
5. **RLS antes de tudo.** Toda tabela nasce com política na mesma migration. O aceite da seção 12
   é bloqueante: sem autenticar, as tabelas com dado pessoal voltam vazias.
6. **`eh_equipe` nunca vem do cadastro.** Só é concedido pelo painel do Supabase. Já houve uma
   escalada de privilégio real aqui, corrigida com trigger.
7. **Sem bundler extra e sem biblioteca de UI.** *Superada em parte* pela decisão do grupo de
   28/08/2026: o projeto passou a ser Next.js 16 + TypeScript. O que sobrevive da regra, e continua
   valendo: nada de bundler além do que o Next já traz, nada de framework de CSS, nada de
   biblioteca de componentes. Rever esta regra é decisão do grupo, não de quem implementa.
8. **Acessibilidade é requisito**, não preferência: a ONG pediu "áudio, textos grandes, contraste".
   Nunca trocar acessibilidade por estética — em particular, não usar `vw` em texto, que ignora o
   controle A+.
9. **Nenhuma foto no ar sem autorização de uso de imagem registrada** (RN07). O público inclui
   crianças a partir de 10 anos.
10. **Verificar olhando.** Bateria de testes não substitui abrir a página. Dois defeitos visíveis
    passaram por 216 testes verdes.

## Arquitetura em uma tela

- **Next.js 16, App Router, tudo renderizado no servidor.** Cada rota é um `app/<rota>/page.tsx`;
  cabeçalho e rodapé vivem em `app/layout.tsx` (`componentes/Cabecalho.tsx`, `Rodape.tsx`).
- **Navegação sem JavaScript** chega pronta no HTML que o servidor entrega — não depende mais de
  `<noscript>`, e `testes/sem-javascript.test.mjs` mede isso rota a rota.
- **Escrita fica em `acoes/`, leitura em `servidor/dados/`.** Server Action é endpoint HTTP
  público (spec §4.5): qualquer pessoa chama com qualquer corpo, sem passar pelo formulário.
  Por isso toda validação de envio roda lá dentro, e o FormData é lido campo a campo por nome
  (`compartilhado/validacao.ts`) — nunca espalhado num objeto, que é como `eh_equipe` voltaria
  a entrar pela porta da frente.
- **Quem está autenticado se pergunta ao Supabase, não ao cookie.** `servidor/sessao.ts`
  (`usuarioAtual()`) usa `getUser()`, que verifica o token no servidor de autenticação;
  `getSession()` devolveria o que estiver escrito no cookie, que é dado do navegador. Página e
  Server Action usam a MESMA função — se divergissem, a diferença entre as duas seria o buraco.
- **Link de e-mail entra por `/auth/confirm` (Route Handler), nunca por uma página.** É
  `verifyOtp()` que grava o cookie de sessão, e escrever cookie durante a renderização de um
  Server Component é impossível (ver o `catch` do `setAll` em `servidor/supabase.ts`). O `type`
  da URL passa por lista fechada em `compartilhado/links-de-email.ts` — é entrada de usuário.
- **Camada de dados isolada e só do servidor:** páginas falam com `servidor/dados/*.ts`, nunca com
  `supabase-js` direto, e todo módulo de `servidor/` começa com `import 'server-only'`.
- **Fonte dupla:** `servidor/dados/conteudo.ts` lê o JSON versionado de `dados-iniciais/` quando não
  há Supabase e a tabela quando há.
- **Uma política de erro só, em `servidor/dados/degradacao.ts`:** nenhum módulo de dados lança
  para cima. Banco fora do ar degrada — `conteudo.ts` para o JSON versionado (que tem o mesmo
  conteúdo real e carimba a procedência), `eventos`/`acervo`/`voluntariado` para lista vazia,
  onde o estado vazio já é texto escrito. Sempre com aviso `[dados]` no log, porque a tela
  não distingue "não há registro" de "não deu para perguntar". `app/error.tsx` e
  `app/not-found.tsx` são a rede para o que escapar — mas **só o `not-found.tsx` traz o
  layout no HTML servido**. O `error.tsx` é boundary do React, que não roda na renderização
  do servidor: MEDIDO, um erro que escape entrega **500 com o `<body>` vazio** (só
  `<div hidden>` e scripts), e o layout — cabeçalho, rodapé, `<main id="conteudo">`, link de
  pular, A+/contraste, VLibras — só aparece **depois de hidratar**. Sem JavaScript, tela
  branca. Ver o bloco MEDIDO no topo de `app/error.tsx`.
- **Insert público sem `.select()`:** em `inscricoes` e `contatos` a leitura é negada; pedir a linha
  de volta faz a inserção *parecer* que falhou.
- **Design "Aplique":** um gesto só — deslocamento sólido que simula peça costurada. Nenhuma
  textura de fundo repetida. Fontes servidas localmente, sem Google Fonts.

---

## Status por módulo

Atualizado em 30/08/2026 (fim do Bloco A da fase 2, rodada de correção 1). O status descreve
**esta branch**, já sem o `site/` estático — e por isso foi conferido linha a linha contra o que
existe aqui, não contra o que existia na `main`.

**`pronto` = existe nesta branch e foi verificado rodando.** Tela que não envia nada não é
`pronto`. A camada de servidor da autenticação passou a existir em 30/08/2026 (Tarefa 1 do Bloco
B): `acoes/autenticacao.ts` tem `entrar`, `criarConta`, `solicitarRecuperacao` e `sair` como
Server Actions, e `compartilhado/validacao.ts` — que antes nenhum código de aplicação importava —
é o que elas usam para validar. A Tarefa 2 acrescentou `definirNovaSenha`, a rota
`/auth/confirm` (que troca o link do e-mail pela sessão) e a página `/nova-senha`, que é **o
primeiro formulário do site a chamar uma Server Action de verdade** — inclusive sem
JavaScript, medido. Os campos de `/entrar` e `/recuperar-acesso` continuam `disabled`; ligar
os dois é a Tarefa 3. O que ainda NÃO foi exercitado é o caminho do SUCESSO contra o Auth:
sem conta de teste e com o limite de envio de e-mail travando o cadastro, ninguém recebeu um
link de verdade. O que está provado contra o Supabase real (`npm run test:supabase`) é o
caminho da FALHA — token recusado vira `/nova-senha?erro=expirado` — e a recusa de
`definirNovaSenha` sem sessão.

### M1 — Site institucional

| Req | O quê | Status |
|---|---|---|
| RF01 | Página inicial | **pronto** |
| RF02 | Quem somos | **pronto** |
| RF03 | Projetos e atividades (11, do banco) | **pronto** — edição pela equipe falta |
| RF04 | Notícias e campanhas | página pronta, **sem CRUD e sem dados** |
| RF05 | Galeria | página pronta, **sem CRUD e sem dados** |
| RF06 | Contato institucional | **pronto** |
| RF07 | Formulário de contato | **falta** — depende da tela e do envio |
| RF38 | Para escolas | **pronto** |
| RF39 | Prova social (14 registros) | **pronto** |

### M2 — Contas e acesso

| Req | O quê | Status |
|---|---|---|
| RF08 | Cadastro de voluntário | tela pronta e **Server Action pronta** (`criarConta`); falta o formulário chamá-la — Tarefa 3 |
| RF09 | Cadastro de doador | idem RF08: é o mesmo formulário, com a caixa "Quero doar ou apoiar" virando `eh_doador` |
| RF10 | Autenticação, papéis acumuláveis | **parcial** — `entrar`/`sair`/`solicitarRecuperacao`/`definirNovaSenha` em `acoes/autenticacao.ts`; `/auth/confirm` (Tarefa 2) verifica o link do e-mail e grava a sessão; `/nova-senha` é a única tela que lê sessão (`servidor/sessao.ts`, com `getUser()`, nunca `getSession()`) e envia. Falta ligar os formulários de `/entrar` e `/recuperar-acesso` (Tarefa 3) |
| RF11 | Área do usuário | **falta** — Bloco B |
| RF12 | Confirmação de maioridade | caixa obrigatória na tela, regra (RN01) testada e **recusada no servidor** (`criarConta` não chama o `signUp` sem ela, e a caixa é lida pelo conteúdo, não pela presença do campo); falta o envio da tela — Tarefa 3 |
| RF33 | Painel administrativo | **falta** — Bloco B. A casca que existia no site antigo não foi portada; `/admin` dá 404 de propósito |
| RF34 | Perfis e permissões | **pronto no banco** — RLS, `eh_equipe()` e o trigger contra escalada, testados contra Postgres real (`npm run rls`). Nenhuma tela exercita isso ainda |

### M3 — Eventos

| Req | O quê | Status |
|---|---|---|
| RF13 | Cadastro e edição de eventos | **falta** |
| RF14 | Agenda pública | página pronta, **sem dados** |
| RF15 | Inscrição sem conta | **falta** — tabela e política prontas |
| RF16 | Consulta de inscritos | **falta** |
| RF17 | Lista de presença pelo celular | **falta** |
| RF18 | E-mail de confirmação | **falta** — depende do Brevo |

### M4 — Doações · M5 — Voluntariado

| Req | O quê | Status |
|---|---|---|
| RF19–RF22 | Oferta, análise, registro, histórico | **falta** |
| RF23 | Meios de doação | **pronto** — chave Pix pendente (D7) |
| RF24 | Página de voluntariado (5 áreas, do banco) | **pronto** |
| RF25 | Candidatura | **falta** |
| RF26 | Gestão de voluntários | **falta** |

### M9 — Acervo · M6 — Comunicação · M7 — Relatórios

| Req | O quê | Status |
|---|---|---|
| RF35 | Catálogo com busca | página e busca por `?busca` prontas, **sem dados** |
| RF36 | Visualização e download | **falta** |
| RF37 | Publicação de material | **falta** |
| RF27 | Mural de avisos | **falta** |
| RF28 | Mensagem para grupo | **falta** |
| RF29 | Registro central de contatos | **falta** |
| RF30–RF32 | Indicadores, CSV, PDF | **falta** — os indicadores da home do painel existiam no site antigo e **não foram portados**; só na `main` |

### Infraestrutura

| Item | Status |
|---|---|
| Banco: 15 tabelas, todas com RLS | **pronto** |
| Aceite bloqueante da seção 12 | **passa** contra o banco real |
| Seed com conteúdo real | **pronto** — 11 atividades, 14 clipping, 5 áreas |
| Acervo tratado (233 MB → 27 MB) | **pronto** |
| Política de privacidade | **pronto** |
| Repositório no GitHub | **pronto** |
| Deploy Netlify | **nunca rodou** — config pronta e pinada (Node 24.15.0, plugin 5.15.13); falta publicar |
| Página de erro 500 (`app/error.tsx`) | **pronto** — com o layout inteiro, como o 404 |
| `/robots.txt` (`app/robots.ts`) | **pronto** — em modo prévia, ver "O que trava hoje" 0c |
| Edge Function de e-mail | **falta** |
| Manual da ONG (RNF07) | **falta** |

---

## Estado da migração para Next.js

**Decidida pelo grupo em 28/08/2026**, contra a recomendação técnica registrada na spec.
Spec: `docs/superpowers/specs/2026-08-28-migracao-nextjs-design.md`
Portão go/no-go: `docs/superpowers/plans/2026-08-28-resultado-do-portao.md` — **GO**

### Onde cada versão está publicada

| Endereço | Serve |
|---|---|
| `marvelous-squirrel-176b0d.netlify.app` | **produção** — branch `main`, o site estático antigo |
| `migracao-nextjs--marvelous-squirrel-176b0d.netlify.app` | **branch deploy** — a versão Next desta branch |

Configurado em *Project configuration → Build & deploy → Continuous Deployment →
Branches and deploy contexts*, com `main` como branch de produção e `migracao-nextjs`
em "Branch deploys". As variáveis `SUPABASE_URL` e `SUPABASE_CHAVE_PUBLICAVEL` estão no
painel da Netlify com escopo `All scopes` e `All deploy contexts` — **All scopes importa**:
com escopo só de build, o site sobe sem erro nenhum e serve o JSON versionado em vez do
banco. O carimbo `data-origem-clipping` no `<main>` de `/para-escolas` é como se verifica.

**Cuidado ao conferir**: o endereço sem o prefixo da branch é o site ANTIGO. Ele não tem
política de conteúdo nem redirects, e o catálogo dele carrega por JavaScript — parece
defeito da migração e não é.

**O Bloco A da fase 2 fechou em 30/08/2026.** As 14 páginas públicas do site antigo existem
como rota do Next, e a Tarefa A8 **apagou o diretório `site/` desta branch** — não há mais duas
versões para manter em paralelo aqui.

- `ROTAS_PENDENTES` (em `testes/apoio/rotas-migracao.mjs`) está **vazia**. Toda página real de
  `app/` é reconciliada contra as listas por `testes/links.test.mjs` e `links-menu.test.mjs`.
- As URLs antigas com `.html` **redirecionam 301** (`compartilhado/redirects-antigos.ts` +
  `middleware.ts`), com `Cache-Control` limitado. Exceção deliberada: `/admin/index.html`, que
  não redireciona — o painel nunca existiu no ar (ver `testes/redirects.test.mjs`).
- Os 15 HTML originais viraram **cópia congelada** em `testes/apoio/html-original/` (byte a byte,
  conferida com `cmp` antes da exclusão). Dois testes dependem deles e continuam vivos por causa
  disso: `paridade-texto.test.mjs` (texto do `<main>` de cada rota igual ao do original — foi ele
  que pegou `e-mailatelieafro@gmail.com`) e `redirects.test.mjs` (reconciliação das URLs antigas).
  Ver `testes/apoio/html-original/LEIA-ME.txt`. **Não editar aquelas cópias.**
- **`main` continua sendo o que está no ar** e ainda tem o `site/` estático. Comentário deste
  repositório que cite um caminho `site/...` está falando do site antigo, que vive no histórico:
  `git show main:site/index.html`.

**O que ainda não existe no Next:** o painel administrativo (RF33) e a área do usuário (RF11) —
Bloco B. `/admin` dá 404 de propósito, e há teste que falha no dia em que deixar de dar, para
obrigar a revisitar a decisão do redirect.

### O que a fase 1 entregou além das páginas

- **O navegador não fala com o Supabase**, garantido em três camadas: `import 'server-only'`
  (erro de build, provado), variáveis sem `NEXT_PUBLIC_` não embutidas, e o `connect-src`
  da CSP sem o Supabase
- **Política de conteúdo com nonce**, medida caminho a caminho contra o VLibras — cinco
  hosts, todos com uso demonstrado. Nenhuma diretiva ali é dedutível: veio de medição
- **VLibras traduzindo sob a política**, incluindo o Dicionário. Duas vezes ele passou por
  toda a suíte carregando o ícone sem traduzir
- **Foco e anúncio na navegação do roteador** — o que o carregamento de página inteira dava
  de graça e o roteador não dá

---

## O que trava hoje

**Da migração (branch `migracao-nextjs`):**

0. **A branch nunca foi publicada.** O `netlify.toml` foi reescrito por inteiro — o build
   passa a existir, `publish` muda de `site` para `.next`, entra o plugin do Next — **sem
   uma única execução real na Netlify**. Continua sendo o maior risco de cronograma, e só
   o usuário fecha: publicar. Duas das três incógnitas foram fechadas na revisão final do
   Bloco A e **não** precisam ser refeitas: Node fixado em 24.15.0 (`.nvmrc`, `engines` no
   `package.json` e `NODE_VERSION` no `netlify.toml` — os três dizem a mesma versão, mudou
   uma mudar as três) e `@netlify/plugin-nextjs` pinado em 5.15.13 em `dependencies` (não
   em `devDependencies`: `NPM_FLAGS="--omit=dev"` não a instalaria).
   **A terceira fica aberta de propósito:** `middleware.ts` está deprecado no Next 16 (o
   caminho novo é `proxy.ts`) e na Netlify roda como Edge Function, que **nunca foi
   exercitada** — a suíte inteira mede `next start` local. Migrar a cinco dias da entrega
   é risco maior que o benefício; a decisão é reavaliar depois do primeiro deploy real, com
   o `X-Robots-Tag`, a CSP com nonce e os 14 redirects verificados no ar. O TypeScript
   7.0.2 também nunca foi exercitado fora da máquina de desenvolvimento.
0b. **A chave do Supabase não saiu do repositório.** A que está em `.env.local` é byte a
   byte a mesma que ficou versionada em `site/config.js` — arquivo que a Tarefa A8 apagou
   desta branch, mas que continua no histórico do git e na branch `main`. Apagar não
   rotaciona: enquanto a chave não for trocada no Supabase, o ganho declarado na spec §4.3
   é nominal.
0c. **O `noindex` sai em TRÊS lugares, e fazer só um não produz erro visível.** Para o
   lançamento é preciso remover, no mesmo commit:
   1. `X-Robots-Tag` em **`middleware.ts`** (procure por `PREVIA`) — vale para as páginas
      renderizadas;
   2. `X-Robots-Tag` em **`netlify.toml`** — vale para o que a CDN serve direto, inclusive
      os caminhos que o `matcher` do middleware exclui;
   3. **`app/robots.ts`** — trocar o `disallow: '/'` por `allow: '/'`.

   Esquecer qualquer um deles **não quebra nada que se veja**: o site sobe, as pessoas
   navegam, a suíte fica verde, e só o buscador some. Um `X-Robots-Tag: noindex` que
   sobreviva vence o `robots.ts` (robots.txt controla o rastreio; o cabeçalho controla a
   indexação). Os três arquivos carregam a mesma advertência, cada um citando os outros
   dois — foi a correção do BLOQUEADOR 2 da revisão final, depois que a instrução original,
   que vivia em `site/robots.txt`, morreu junto com o diretório na Tarefa A8 e sobrou uma
   marca só, em `middleware.ts`. **E não depende mais de alguém ler os comentários:**
   `testes/noindex.test.mjs` mede os três (cabeçalho na resposta, `/robots.txt`, e o
   `netlify.toml` lido como texto, já que ele só tem efeito num deploy real) e falha se um
   sair sozinho — provado removendo cada um dos três, um de cada vez. Quando os três saírem
   juntos, apagar este item **e** o segundo teste daquele arquivo, que existe para quebrar
   uma vez só, no lançamento.
0d. **A suíte fica vermelha sem `.env.local`** — o teste de vazamento falha de propósito:
   um teste que não sabe o que procurar não prova nada. Quem clonar o repositório precisa
   do arquivo, ou usar só o que não depende dele.
0e. **Publicar sem as variáveis do Supabase não dá erro nenhum.** Sem `SUPABASE_URL`/
   `SUPABASE_CHAVE_PUBLICAVEL` no painel da Netlify, `temSupabase()`
   (`servidor/dados/degradacao.ts`) devolve false, nenhuma consulta sai, e as **cinco áreas
   reais de `/voluntariado`** — que só existem no seed do Postgres, sem JSON irmão — viram o
   estado vazio. O site sobe bonito e incompleto. Desde a revisão final isso pelo menos
   **aparece no log** do servidor: `[dados] "areas_voluntariado": ... não estão no ambiente`,
   uma linha por tabela por processo. Sai também em `npm test` (medido: 7 linhas por rodada,
   que tem dois processos, `next build` e `next start`) —
   é ruído aceito de propósito, porque não há filtro por ambiente que funcione aqui: o
   servidor de um build do Next lê `NODE_ENV=production` mesmo quando a suíte pede `test`.
   Conferir as duas variáveis no painel da Netlify antes de anunciar o endereço.
0e2. **Falta cadastrar `URL_DO_SITE` na Netlify, e a falta também não dá erro.** Nasceu com
   a Tarefa 1 do Bloco B (`acoes/autenticacao.ts`): é dela que sai o endereço que vai DENTRO
   do e-mail de confirmação de conta e de recuperação de senha (`redirectTo`/
   `emailRedirectTo`, apontando para `/auth/confirm`). Sem prefixo `NEXT_PUBLIC_`, de
   propósito — é lida só no servidor. Sem ela, o código cai em `DEPLOY_PRIME_URL` e `URL`,
   que a própria Netlify injeta, e só depois no cabeçalho `Host` da requisição; ou seja, o
   site não quebra, e é justamente por isso que a falta passa despercebida. **Cadastrar com
   o endereço público, sem barra no fim.** E há uma segunda ponta, esta no painel do
   Supabase: *Authentication → URL Configuration → Redirect URLs* precisa listar
   `<endereço>/auth/confirm` dos três ambientes (local, branch deploy, produção) — o Supabase
   IGNORA em silêncio qualquer `redirectTo` fora dessa lista e manda a pessoa para o Site
   URL, o que faz o link do e-mail parecer defeito do código quando é configuração.

0f. **`app/error.tsx` não protege quem está sem JavaScript, e não tem teste.** Duas coisas
   separadas, as duas medidas em 30/08/2026 com um `throw` proposital num Server Component:
   (a) o boundary de erro do React não roda na renderização do servidor, então um erro que
   escape da degradação entrega **500 com o `<body>` vazio** — só `<div hidden>` e scripts;
   o layout só aparece depois de hidratar, e sem script a pessoa vê tela branca. A correção
   de verdade é não chegar lá, e é a que existe (`servidor/dados/degradacao.ts`); cobrir
   também quem está sem script exige desenho novo — página de erro renderizada no servidor,
   ou tratar o erro dentro da própria página em vez de deixá-lo subir. (b) **Nenhum teste
   exercita essa tela** — a única menção em `testes/` é um comentário. Exercitá-la pede uma
   rota de defeito proposital fechada por variável de ambiente, no espírito de
   `/diagnostico/origem-dos-dados`. Enquanto não houver, toda afirmação sobre ela vale só até
   alguém medir de novo.
0g. **Herdada, não corrigida: `vw` em texto no menu.** `estilos/componentes.css:93`,
   `.cabecalho__menu a { font-size: clamp(0.84rem, 1.15vw, 0.95rem) }` (e o `padding` da
   linha 87). Contra a regra 8 e contra o aviso escrito em `estilos/tokens.css:43` — dentro
   de `clamp()` o `vw` fica preso entre dois `rem`, então o dano é menor que um `vw` solto,
   mas o item do menu ainda deixa de responder ao A+ na faixa do meio. Veio do site
   estático, não da migração. **Não foi mexida na revisão final do Bloco A**: trocar por
   `rem` muda a largura do menu em telas grandes, e isso é decisão de desenho, não de
   unidade — precisa de olho humano na tela, não de um commit.
0h. **Decisão pendente: o VLibras roda no layout raiz**, e a CSP usa `strict-dynamic`, que
   dá confiança em cadeia a tudo que ele carregar. Quando o painel existir (RF33), isso
   significa código de terceiro com confiança total na tela que mostra nome, telefone e
   responsável de crianças. O caminho barato é não montar o VLibras em `/admin`.

**Do projeto, válidos para as duas branches:**

1. **Limite de e-mail do Supabase bloqueia todo cadastro.** `over_email_send_rate_limit` — o envio
   nativo tem cota baixíssima. Enquanto não for resolvido, ninguém cria conta. Saída definitiva:
   apontar o Auth para o SMTP do Brevo.
2. **Não existe conta de administrador.** Criar pelo painel do Supabase com *Auto Confirm User* e
   promover com `update public.perfis set eh_equipe = true where email = '...'`.
3. **O painel inteiro é dívida do Bloco B.** No site antigo existia só a home do painel, e ela
   prometia seis telas que nunca existiram (`eventos`, `presenca`, `contatos`, `mais`, `doacoes`,
   `publicacoes`). Nada disso foi portado: nesta branch `/admin` dá 404, vigiado por
   `testes/redirects.test.mjs`. Os 12 `test.todo` de `testes/painel.test.mjs` guardam os
   requisitos (RF33/RNF08/RN01/RN05) até haver tela para medir — 9 continuam `todo`, 3 já foram
   reativados contra `/entrar` pela Tarefa A6.
4. **Conteúdo por validar com a ONG:** citações e números lidos da matéria da Folha, sinopse de 6
   espetáculos, se "Nathi Nunes" é a mesma pessoa que Nathália Monteiro.
5. **Nenhuma autorização de uso de imagem** — por isso não há uma única foto no site.
6. **Logotipo só existe em baixa qualidade**, bordado nas camisetas. A marca está tipográfica.

## Pedidos do grupo ainda não implementados

De `docs/Correções Web Ateliê.txt`:

- Conta de administrador que adiciona, remove e atualiza projetos, agenda, notícias e galeria —
  já é RF33 e está no plano
- Botão flutuante de WhatsApp no canto inferior direito — **novo, fora do escopo original**.
  Atenção: o VLibras já ocupa esse canto; empilhar ou trocar de lado, nunca remover o VLibras
