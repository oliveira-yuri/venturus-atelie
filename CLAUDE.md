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
npm test                        # suíte completa, modo offline (509 testes)
npm run test:supabase           # a mesma suíte, contra o banco real (510)
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

Os 509 são 497 passando, 3 pulados com motivo declarado e 9 `test.todo` — os do painel
(RF33), que descrevem requisitos válidos cuja forma de verificar depende de uma sessão de
equipe, que ainda não existe (ver "O que trava hoje", itens 1 e 2). Os 19 que entraram em
31/08/2026 são da Tarefa P1 do painel: `testes/painel-guarda.test.mjs` (a guarda, a falha
fechada e o não-vazamento) e `testes/painel-inicio.test.mjs` (a home). Dois
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
- **A sessão se renova no `middleware.ts`, e só ali.** Server Component não pode escrever
  cookie (a resposta já começou quando ele roda — é o `catch` do `setAll` em
  `servidor/supabase.ts`), então sem o middleware o token de acesso vence e a pessoa é
  deslogada no meio do uso mesmo com refresh token válido. Duas travas, porque o middleware
  roda em TODAS as rotas e na Netlify é Edge Function: só monta o cliente do Supabase se a
  requisição trouxer cookie de sessão (`compartilhado/cookies-de-sessao.ts`), e a espera tem
  prazo total (`compartilhado/prazo.ts`) — não só timeout por tentativa. MEDIDO: sem o prazo
  total, com o Auth inalcançável, uma página levou **50,9 s** para responder, porque o
  `@supabase/auth-js` repete a renovação com espera exponencial por até 30 s e o abort de cada
  tentativa só faz a seguinte começar. Com prazo: 8 s.
- **O cabeçalho mostra quem entrou, e "Sair" é um `<form>` com Server Action.** Quem lê a
  sessão é `app/layout.tsx` (Server Component) e passa ao `Cabecalho` o MÍNIMO — um nome, nada
  de id, e-mail ou objeto de usuário, que iriam parar no HTML de toda página. Nada ali
  autoriza coisa alguma: o cabeçalho decide o que desenhar, a RLS decide o que pode.
- **Link de e-mail entra por `/auth/confirm` (Route Handler), nunca por uma página.** É
  `verifyOtp()` que grava o cookie de sessão, e escrever cookie durante a renderização de um
  Server Component é impossível (ver o `catch` do `setAll` em `servidor/supabase.ts`). O `type`
  da URL passa por lista fechada em `compartilhado/links-de-email.ts` — é entrada de usuário.
- **A guarda do painel fica na PÁGINA, não só no layout** (`app/admin/`, RF33).
  `servidor/permissao.ts` (`ehEquipe()`) consulta `perfis` no banco — nunca o metadata da
  conta, que a própria pessoa edita (regra 6) — e **falha FECHADA**: erro de consulta, prazo
  estourado, sem sessão, sem Supabase, tudo vira `notFound()`. É o CONTRÁRIO da política de
  degradação do resto do site, de propósito: conteúdo público degrada para continuar no ar;
  o painel não abre na dúvida (`compartilhado/permissao-de-equipe.ts` explica). MEDIDO: com
  a guarda só no layout, `/admin` respondia 404 **e** entregava a página inteira do painel
  no payload de hidratação — `notFound()` num layout não impede a página filha de renderizar
  e ser serializada. Um `export const metadata` com título vaza o título pelo mesmo caminho;
  por isso o metadata do painel é `generateMetadata` guardado.
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

Atualizado em 31/08/2026 (Tarefa P1 do painel; antes disso, fim do Bloco A da fase 2,
rodada de correção 1). O status descreve
**esta branch**, já sem o `site/` estático — e por isso foi conferido linha a linha contra o que
existe aqui, não contra o que existia na `main`.

**`pronto` = existe nesta branch e foi verificado rodando.** Tela que não envia nada não é
`pronto`. A camada de servidor da autenticação passou a existir em 30/08/2026 (Tarefa 1 do Bloco
B): `acoes/autenticacao.ts` tem `entrar`, `criarConta`, `solicitarRecuperacao` e `sair` como
Server Actions, e `compartilhado/validacao.ts` — que antes nenhum código de aplicação importava —
é o que elas usam para validar. A Tarefa 2 acrescentou `definirNovaSenha`, a rota
`/auth/confirm` (que troca o link do e-mail pela sessão) e a página `/nova-senha`. **A Tarefa 3
ligou os formulários de `/entrar` (entrar e criar conta) e `/recuperar-acesso`**: não existe mais
campo `disabled` em tela nenhuma de conta, e os quatro formulários funcionam também **sem
JavaScript** — medido no Firefox com `javascript.enabled=false`, preenchendo e enviando
(`testes/formularios-conta.test.mjs`). O preço disso em `/entrar`: sem script os DOIS painéis
(entrar e criar conta) chegam abertos, um abaixo do outro, porque um painel `hidden` seria um
formulário que ninguém alcança — mesma decisão de `componentes/MenuMovel.tsx`. Com script,
as abas voltam a se comportar como abas assim que a página hidrata.

A Tarefa 4 acrescentou o que faltava para a sessão EXISTIR na tela: o cabeçalho de quem entrou
(nome + "Sair") e a renovação do token no `middleware.ts`. Como não há conta utilizável, o
cabeçalho autenticado é medido por uma porta de diagnóstico fechada por padrão —
`DIAGNOSTICO_CABECALHO_COM_SESSAO` (`app/layout.tsx`), que só muda o que o cabeçalho DESENHA e
não passa por `usuarioAtual()`, que continua sendo o único que autoriza.

O que ainda NÃO foi exercitado é o caminho do SUCESSO contra o Auth: sem conta de teste e com o
limite de envio de e-mail travando o cadastro, ninguém recebeu um link de verdade nem entrou —
e, por consequência, **ninguém viu o próprio nome no cabeçalho por ter entrado de verdade**.
O que está provado contra o Supabase real (`npm run test:supabase`) é o caminho da FALHA —
`/entrar` com credencial inexistente devolve "E-mail ou senha não conferem" vindo do Auth e
traduzido por `compartilhado/erros.ts`, e um token recusado vira `/nova-senha?erro=expirado`.

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
| RF08 | Cadastro de voluntário | **tela e envio prontos** (Tarefa 3: `componentes/AbasEntrar.tsx` chama `criarConta`). A conta é gravada, mas **ninguém entra antes de confirmar o e-mail**, e o envio nativo do Supabase tem cota baixíssima — ver "O que trava hoje", item 1. Falta a gestão pela equipe (RF26) |
| RF09 | Cadastro de doador | idem RF08: é o mesmo formulário, com a caixa "Quero doar ou apoiar" virando `eh_doador` |
| RF10 | Autenticação, papéis acumuláveis | **pronto até onde o e-mail deixa** — as quatro telas enviam (`/entrar`, criar conta, `/recuperar-acesso`, `/nova-senha`), com e sem JavaScript; `/auth/confirm` verifica o link e grava a sessão; `servidor/sessao.ts` lê a sessão com `getUser()`, nunca `getSession()`. Provado contra o Auth real só o caminho da recusa: **entrar de verdade ninguém conseguiu ainda**, porque não existe conta confirmada (item 1 e item 2 de "O que trava hoje"). A Tarefa 4 fechou a ponta que faltava: **o cabeçalho mostra o nome de quem entrou e um "Sair"** no lugar de "Entrar", e o "Sair" é um `<form>` com a Action `sair` — funciona sem JavaScript (medido pelo POST cru, 303 para `/`, e no Firefox com script desligado). O nome vem do metadata da conta, com o e-mail como reserva |
| RF11 | Área do usuário | **falta** — Bloco B |
| RF12 | Confirmação de maioridade | **pronto** — caixa obrigatória na tela, regra (RN01) recusada no servidor (`criarConta` não chama o `signUp` sem ela, e a caixa é lida pelo conteúdo, não pela presença do campo), e a recusa medida ponta a ponta, inclusive sem JavaScript |
| RF33 | Painel administrativo | **a fundação existe** (Tarefa P1, 31/08/2026): `/admin` é rota real, com guarda (`app/admin/layout.tsx` + `app/admin/page.tsx`), home "o que você quer fazer?" e `estilos/admin.css`. **Nenhum CRUD ainda** — publicações, galeria e atividades são P2/P3/P4. Quem não é equipe recebe **404**, medido; quem É equipe ninguém viu ainda, porque não há sessão utilizável |
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

**O que ainda não existe no Next:** a área do usuário (RF11) e o CRUD do painel (P2/P3/P4).
O painel em si passou a existir em 31/08/2026 (Tarefa P1): `/admin` é rota real e responde
**404 para quem não é equipe** — o que continua sendo o comportamento certo, e o que
`testes/redirects.test.mjs` agora vigia (a trava mudou de "`/admin` não existe" para
"`/admin` recusa quem não é equipe"). `/admin/index.html` segue sem redirect, decisão
revisitada e mantida naquela tarefa.

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
   3. **`app/robots.ts`** — trocar o `disallow: '/'` por `allow: '/'`. **Atenção:** desde a
      Tarefa 4 aquele arquivo lista também `/auth/confirm` e `/nova-senha` em
      `FORA_DO_BUSCADOR`, e desde a Tarefa P1 do painel, `/admin` — essas TRÊS NÃO saem no
      lançamento, viram o `disallow` ao lado do `allow`. Rastreador que abre um link de
      confirmação gasta o token, que é de uso único; e o painel não é conteúdo público
      (`Disallow: /admin` cobre por prefixo as telas de P2/P3/P4). Há teste só para elas em
      `testes/noindex.test.mjs`, e ele TAMBÉM não sai.

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
   **(c) O MESMO VALE PARA O `notFound()` EM TEMPO DE EXECUÇÃO**, medido em 31/08/2026 na
   Tarefa P1, em três formas (chamado do layout, da página, e com um `not-found.tsx` local
   dentro de `app/admin/`): as três respondem **404 com o `<body>` vazio**, com o conteúdo
   do 404 só no payload de hidratação — sem JavaScript, tela branca. NÃO é o mesmo caminho
   de um endereço inexistente (`/rota-que-nao-existe`), que continua vindo com a página
   inteira no HTML, porque ali o Next renderiza a rota `/_not-found` em vez de tratar uma
   exceção no meio da renderização. Consequência prática hoje: quem cai na recusa do painel
   sem script vê branco. Não foi "consertado" com um teste que exija tela branca — está
   escrito aqui e em `testes/painel-guarda.test.mjs`, que mede o que é verdade (404, o 404
   do projeto, e a tela inteira para quem tem script).
0g. **Herdada, não corrigida: `vw` em texto no menu.** `estilos/componentes.css:93`,
   `.cabecalho__menu a { font-size: clamp(0.84rem, 1.15vw, 0.95rem) }` (e o `padding` da
   linha 87). Contra a regra 8 e contra o aviso escrito em `estilos/tokens.css:43` — dentro
   de `clamp()` o `vw` fica preso entre dois `rem`, então o dano é menor que um `vw` solto,
   mas o item do menu ainda deixa de responder ao A+ na faixa do meio. Veio do site
   estático, não da migração. **Não foi mexida na revisão final do Bloco A**: trocar por
   `rem` muda a largura do menu em telas grandes, e isso é decisão de desenho, não de
   unidade — precisa de olho humano na tela, não de um commit.
0h. **Decisão tomada, risco aceito: o VLibras continua no painel.** Ele é montado no
   layout raiz, que envolve também `/admin`, e a CSP usa `strict-dynamic` — confiança em
   cadeia para tudo que ele carregar, numa tela que vai mostrar nome, telefone e
   responsável de crianças a partir de 10 anos. Até 31/08/2026 isto era uma *pendência*
   aqui, com "não montar o VLibras em `/admin`" como caminho barato. **O dono do projeto
   decidiu o contrário, em 31/08/2026, com o risco à vista** (registrado também no plano
   do bloco, `docs/superpowers/plans/2026-08-31-painel-administrativo.md`): tirar a
   tradução justo da tela de trabalho da equipe excluiria quem usa Libras, e
   acessibilidade é requisito da ONG (regra 8), não enfeite.
   O que muda de status: isto **não é mais uma decisão a tomar**, é um risco em aberto e
   conhecido. O que o reduziria sem tirar a tradução — e continua valendo como próximo
   passo, se alguém quiser gastar nisso: apertar a CSP para o painel (sem
   `strict-dynamic`, com os hosts do VLibras listados um a um), o que exige medir
   caminho a caminho como a fase 1 fez. A Tarefa P1 não mexeu nisso.

**Do projeto, válidos para as duas branches:**

1. **O e-mail do Supabase é o que separa "conta criada" de "consegue entrar".** Duas coisas, e a
   segunda foi medida de novo em 30/08/2026 (Tarefa 3): o projeto está com
   `mailer_autoconfirm: false`, ou seja, **todo cadastro exige abrir um link enviado por e-mail
   antes de a pessoa conseguir entrar**; e o envio nativo tem cota baixíssima
   (`over_email_send_rate_limit`). Desde a Tarefa 3 o formulário grava a conta de verdade — o
   que não se pode prometer é que o link chegue. Por isso a mensagem de sucesso do cadastro diz
   que falta confirmar, não promete prazo e termina no WhatsApp e no e-mail da ONG. Saída
   definitiva: apontar o Auth para o SMTP do Brevo. Enquanto isso não acontece, **o site inteiro
   de contas está de pé e ninguém consegue entrar** — a única forma de haver uma conta usável é
   criá-la pelo painel do Supabase com *Auto Confirm User* (item 2).
2. **Não existe conta de administrador.** Criar pelo painel do Supabase com *Auto Confirm User* e
   promover com `update public.perfis set eh_equipe = true where email = '...'`.
3. **O painel existe, e ninguém o viu pelo caminho normal.** A Tarefa P1 (31/08/2026)
   construiu a fundação: guarda, home e estilo. O que trava é o mesmo do item 1 — sem sessão
   de equipe, **o caminho autenticado nunca foi percorrido**: a home do painel foi conferida
   com o navegador só depois de um remendo local temporário no `ehEquipe()`, que não foi
   commitado, e por teste de unidade do componente (`testes/painel-inicio.test.mjs`). Não
   existe porta de diagnóstico para o painel, de propósito — uma variável que abra o painel
   é uma variável que abre o painel, e as telas de P2/P3/P4 penduram dado pessoal ali.
   Os 12 `test.todo` de `testes/painel.test.mjs` guardam os requisitos
   (RF33/RNF08/RN01/RN05) — 9 continuam `todo` porque medem a tela renderizada (alvo de
   44px, sem rolagem horizontal, navegação na zona do polegar) e ela exige a sessão; 3 foram
   reativados contra `/entrar` pela Tarefa A6.
   **O que a P1 deixou provado, e vale para P2/P3/P4:** a guarda precisa estar na PÁGINA, não
   só no layout. MEDIDO — com a guarda só em `app/admin/layout.tsx`, `/admin` respondia 404
   **e** mandava a página inteira do painel no payload de hidratação; e um `export const
   metadata` com título vaza o título do mesmo jeito. Toda página sob `app/admin/` chama
   `ehEquipe()` no corpo E no `generateMetadata`; `testes/painel-guarda.test.mjs` varre
   `app/admin/**` e falha se alguma esquecer.
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
