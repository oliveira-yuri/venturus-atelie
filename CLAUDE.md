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
npm test                        # suíte completa, modo offline (1148 testes)
npm run test:supabase           # a mesma suíte, contra o banco real (1078)
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

Os 1077 são 1064 passando, 4 pulados com motivo declarado e 9 `test.todo` (MEDIDO em
01/09/2026, depois de juntar as três frentes que rodaram em paralelo). Os 33 que entraram com a RF25 (candidatura ao voluntariado)
são 28 em `testes/voluntariado.test.mjs`, 2 novos em `testes/minha-conta.test.mjs` e 3 que
`testes/sem-javascript.test.mjs` gera sozinho por rota nova: a trava do corpo hostil
(`situacao=ativo`, `perfil_id` de outra pessoa) percorrendo `lerCandidatura` →
`colunasDaCandidatura`, que é literalmente o objeto do `.insert()`; a deduplicação das áreas,
sem a qual uma área repetida no corpo derrubaria o insert DEPOIS de a candidatura já estar
gravada; a reconciliação de `SITUACOES_EM_ANDAMENTO` com o `check` de `public.voluntarios`,
com `inativo` obrigatoriamente FORA (quem encerrou precisa poder voltar); as duas pontas do
prefixo `area:`, que são strings em arquivos diferentes e, quando divergem, devolvem o
formulário com as caixas desmarcadas sem erro nenhum; a varredura que exige `usuarioAtual()`
na Action **e que ela NÃO chame `ehEquipe()`**; e a ordem das duas gravações.

Os 13 que
entraram em 01/09/2026 com o bucket privado (item 0j) estão na seção 7 de
`testes/galeria.test.mjs`: a leitura da sonda que descobre se a migration 008 foi rodada
(com os DOIS corpos que o Storage devolve, copiados de uma medição real), o prazo da
assinatura **e a exigência de que seja a constante que a camada de dados passa**, a
varredura que impede `getPublicUrl` de voltar a `servidor/dados/galeria.ts` (e a que exige
que ele CONTINUE em `acervo.ts`), o texto da migration, o que o painel desenha quando a
assinatura não vem, e a reconciliação da URL assinada com o `img-src`. A metade do BANCO
está em `npm run rls` (63 → 69 testes), no bloco "RN07 no ARQUIVO": as políticas novas
contra um Postgres de verdade, inclusive a prova de que "Tirar do ar" passou a fechar o
ARQUIVO e não só a listagem. Os 35 que entraram
em 01/09/2026 com a RF11 (área do usuário) são `testes/minha-conta.test.mjs`: a trava da
regra 6 exercitada com um FormData HOSTIL (`eh_equipe=true`, `id` de outra pessoa, papéis
inventados) percorrendo `lerMeusDados` → `colunasDoPerfil`, que é literalmente o objeto que
vai ao `.update()`; a varredura que exige `usuarioAtual()` em toda Action de conta **e que
ela NÃO chame `ehEquipe()`** (o contrário da varredura do painel — a área do usuário é de
qualquer pessoa autenticada); a que exige que o `nome` seja gravado TAMBÉM no metadata da
conta, sem o que o cabeçalho mostraria o nome antigo para sempre; a que exige `.eq()` por
`perfilId` em toda consulta, sem o que quem é da equipe veria as doações de todo mundo na
própria área de conta; a reconciliação das palavras da tela com os `check` de
`001_base.sql` e `004_pessoas.sql`; e o redirect (não 404) para quem chega sem sessão.
**Duas fontes de
vermelho intermitente, nenhuma delas do projeto:** os três testes de
`testes/csp-vlibras.test.mjs` que dependem de o serviço do VLibras traduzir de verdade (em
01/09/2026 variaram entre rodadas — 3 vermelhos, depois 2, depois nenhum; com a árvore LIMPA
falham igual) e, na rodada do RF29, uma falha isolada de `testes/foco-navegacao.test.mjs`
que não repetiu na rodada seguinte. Se o VLibras voltar a passar sozinho, apague esta
observação. Os 42 que entraram em 01/09/2026 com o RF29 são `testes/contatos.test.mjs` (36),
o bloco RF29 de `testes/rls.test.mjs` (5) e um teste novo em
`testes/painel-inicio.test.mjs`: a lista fechada de situações reconciliada contra o `check`
do banco, a ordem da fila de atendimento, o que a lista da equipe desenha, a varredura que
exige `ehEquipe()` na Action **e que o `update` grave uma coluna só**, o 404 da rota nova, e
— o que faltava desde a Tarefa P1 — a reconciliação NO SENTIDO INVERSO: uma tela de primeiro
nível do painel que existe em `app/` e não aparece na home. MEDIDO: até o RF29, apagar a
entrada de uma tela de `TELAS_DO_PAINEL` deixava a suíte inteira VERDE. Os 44 que entraram em 01/09/2026 com o RF07 são
`testes/contato.test.mjs` (32) e o bloco novo de `testes/rls.test.mjs` (12): a validação do
formulário público, a origem do visitante e o hash conferido contra um Postgres de verdade,
a varredura que exige que `acoes/contato.ts` **NÃO** chame `ehEquipe()` (o contrário da do
painel — este formulário é público) e que não peça a linha de volta no insert, os dois
baldes da migration 007, e o envio sem JavaScript no Firefox. Os 630 anteriores eram 618
passando, 3 pulados com motivo declarado e 9 `test.todo` — os do painel
(RF33), que descrevem requisitos válidos cuja forma de verificar depende de uma sessão de
equipe, que ainda não existe (ver "O que trava hoje", itens 1 e 2). Os 19 que entraram em
31/08/2026 são da Tarefa P1 do painel: `testes/painel-guarda.test.mjs` (a guarda, a falha
fechada e o não-vazamento) e `testes/painel-inicio.test.mjs` (a home). Os 35 de 01/09/2026
são da Tarefa P2 (`testes/publicacoes.test.mjs`): a validação do formulário de notícia, o
que as duas telas desenham, a varredura que exige `ehEquipe()` em toda Server Action de
publicações — a de `painel-guarda` cobre `app/admin/**` e NÃO alcança Action — e o 404 das
rotas novas. Os de `testes/galeria.test.mjs` são da Tarefa P3, e os 34 de 01/09/2026, em
`testes/atividades.test.mjs`, são da Tarefa P4: o identificador de atividade (que é `text`,
não uuid), a validação do formulário de dez campos, o que a lista da equipe desenha, a
varredura que exige `ehEquipe()` em toda Action de atividades **e que não exista `insert`
nem `delete` ali**, e a que exige que a leitura do PAINEL não caia para o JSON versionado.
No modo `test:supabase` a contagem é 804, um a mais e dois pulados a mais (MEDIDO: 790 passando, 5 pulados, 9 todo). O pulado novo é
o do RF07 — "sem JavaScript: o envio válido atravessa a validação e chega ao corpo da
Action" (`testes/contato.test.mjs`), que só roda no modo offline: com credenciais ele
gravaria uma linha inventada em `public.contatos` do projeto de produção A CADA RODADA, e
`anon` não tem `delete` para desfazer (não existe service_role neste projeto, spec §4.1).
O outro é o teste do `img-src`
"sem Supabase" (`testes/galeria.test.mjs`) mede o servidor compartilhado da suíte e só vale
no modo offline — ficava vermelho com credenciais, e a Tarefa P4 o marcou com `skip` nesse
modo (o irmão "com Supabase" sobe servidor próprio e continua medindo). Dois
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
3. **A paleta é da ONG**, com significado declarado por eles: luz/sabedoria, céu/esperança,
   terra/raízes. **Os HEX mudaram em 01/09/2026**, ao adotar o design system "Ateliê Afro" v1
   (variação 1a, aprovada pelo grupo): ocre `#D69A10`, azul `#6FA6C8`, marrom `#2B2019`. Os
   antigos eram `#E0A400`, `#7FA9CE` e `#8A6A4A` — o que mais se mexeu foi o marrom, que
   deixou de ser cor de destaque e virou TINTA (o texto do site inteiro). Os significados são
   os mesmos; os tons foram afinados para contraste. **A regra continua valendo com os
   valores novos:** alterar é decisão do grupo, não de quem implementa. Fonte de verdade:
   `docs/Três variações mobile do sistema/`, executada em `estilos/tokens.css`.
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
  **Desde a RF11 o nome é um link para `/minha-conta`** — e é o ÚNICO caminho até a área do
  usuário, que não é (e não deve ser) item de menu: o menu é o mesmo para toda visita, e para
  a maioria anônima aquele item só redirecionaria.
- **O nome de quem entrou é gravado em DOIS lugares, e isso é decisão medida (RF11).** O
  cabeçalho lê o nome do metadata da conta, não de `perfis` — `servidor/sessao.ts` roda no
  layout raiz, ou seja, em toda página de quem está autenticado, e trocar essa leitura por uma
  consulta custaria uma ida ao Postgres por página para desenhar uma palavra. Então
  `acoes/conta.ts` grava nos dois: `public.perfis` primeiro (é o registro, é o que a RLS
  protege), o metadata depois. Se só a primeira der certo, a pessoa NÃO recebe "salvo" liso:
  recebe uma frase dizendo que os dados foram gravados e que só o nome do topo continua
  antigo. Há teste que falha se a segunda gravação sumir. **O que precisa continuar verdade:
  existe UM único escritor de `perfis.nome`.** No dia em que RF26 criar o segundo, a decisão
  precisa ser tomada de novo.
- **A área do usuário recusa com REDIRECT; o painel recusa com 404. Não é inconsistência.**
  `/admin` responde 404 porque a EXISTÊNCIA do painel é o que se recusa a contar.
  `/minha-conta` não é segredo de ninguém — que este site tem contas está escrito em /entrar
  e no cabeçalho de toda página; o que falta a quem chega sem sessão é sessão, e a resposta
  certa para isso é a tela de entrar. Um 404 ali esconderia de quem tem conta o caminho para a
  própria conta. O que as duas telas compartilham é a REGRA DA GUARDA: no corpo da página **e**
  no `generateMetadata`, pelo motivo medido na Tarefa P1.
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
- **Fonte dupla, e desde a Tarefa P4 ela pode DIVERGIR:** `servidor/dados/conteudo.ts` lê o
  JSON versionado de `dados-iniciais/` quando não há Supabase e a tabela quando há. Até P4 as
  duas diziam a mesma coisa; agora a equipe corrige o texto das atividades pelo painel, e a
  correção fica só no banco. Consequências no item 0k de "O que trava hoje". As DUAS leituras
  do painel (`listarAtividadesDoPainel`, `buscarAtividadeDoPainel`) NÃO caem para o JSON, de
  propósito — desenhar 11 atividades com "Editar" ao lado sabendo que aquele texto não é o do
  banco é oferecer um gesto que não pode dar certo. Há teste que falha se alguém unificar as
  duas leituras (`testes/atividades.test.mjs`).
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
- **O bucket da galeria é privado, e o endereço de cada foto é uma URL assinada de uma
  hora** (`supabase/migrations/008_galeria_privada.sql` + `servidor/dados/galeria.ts`). A
  política do Storage exige a linha de `public.midia` publicada E autorizada, ou seja, a
  RN07 passou a valer para o ARQUIVO e não só para a listagem. Três consequências que não
  são dedutíveis: assinar **custa uma requisição** (por isso a forma plural,
  `createSignedUrls`, uma para a lista inteira, e por isso as Actions usam
  `buscarLinhaDaMidia`, que não assina nada); o endereço **pode faltar**, e aí a galeria
  pública omite a foto enquanto o painel a mantém com o motivo escrito; e `acervo` continua
  com `getPublicUrl`, de propósito, porque download livre é requisito (RF36). **A migration
  ainda não foi aplicada** — ver item 0j.
- **Insert público sem `.select()`:** em `inscricoes` e `contatos` a leitura é negada; pedir a linha
  de volta faz a inserção *parecer* que falhou. Em `publicacoes` é o CONTRÁRIO, e é de propósito:
  a equipe lê tudo (`using (publicado or eh_equipe())`), então o `update` pede `.select('id')` —
  sem ele um update que não casa linha nenhuma é sucesso com zero linhas no PostgREST, e editar
  uma notícia apagada responderia "guardado" sem ter guardado nada.
- **A mesma tabela, duas Actions com políticas OPOSTAS, e os nomes quase iguais.**
  `acoes/contato.ts` (singular) é o formulário PÚBLICO que grava em `public.contatos`;
  `acoes/contatos.ts` (plural) é a triagem da equipe (RF29), que muda a coluna `situacao` e
  exige `ehEquipe()`. A leitura é só da equipe — MEDIDO contra o Supabase de PRODUÇÃO em
  01/09/2026: `select` anônimo em `contatos` responde `42501 permission denied`, antes mesmo
  da RLS, porque `anon` só tem `grant insert`. É por isso que o insert público não pede a
  linha de volta e o update da triagem pede: no mesmo lugar, a mesma escolha se inverte.
  **A tela de triagem lê e organiza; ela não apaga e não edita a mensagem** — o texto que a
  pessoa escreveu é registro, e `testes/contatos.test.mjs` falha se aparecer um `.insert(`,
  um `.delete(` ou um `update` que grave qualquer coisa além de `{ situacao }`.
- **`acoes/contato.ts` é a ÚNICA Action sem `ehEquipe()`, e a ausência é o desenho.** RF07:
  quem escreve para a ONG não tem conta, e a política do banco diz o mesmo (`contatos:
  qualquer pessoa escreve`, `for insert with check (true)`). A consequência é que a
  validação de `compartilhado/validacao.ts` é a única barreira antes de uma tabela com dado
  pessoal — por isso ela roda inteira no servidor e lê o FormData campo a campo, e por isso
  `origem` e `situacao` (colunas de trabalho da ONG) são escritas pelo servidor, nunca pelo
  formulário. `testes/contato.test.mjs` tem uma varredura que EXIGE a ausência de
  `ehEquipe()` ali: ela existe porque quem ler as quatro Actions do painel vai achar que
  aqui faltou a guarda.
- **O limite de envio é por VISITANTE, e isso custa duas metades que precisam viajar
  juntas.** `005_contencao.sql` identificava a origem pelo `x-forwarded-for` que o PostgREST
  expõe ao Postgres — o que funcionava quando o navegador de cada pessoa falava direto com o
  Supabase. Aqui quem fala é sempre o servidor, então aquele cabeçalho é o mesmo para todo
  mundo e o limite viraria um balde global de 10/hora para o site inteiro: negação de
  serviço contra quem usa (spec §4.6). O conserto é `compartilhado/origem-do-visitante.ts`
  (lê `x-nf-client-connection-ip`, depois `x-forwarded-for`, e calcula o SHA-256 — nessa
  ordem, porque o segundo pode ser forjado e o primeiro é escrito pela Netlify) mais
  `supabase/migrations/007_limite_por_visitante.sql`, que recebe o hash como parâmetro. São
  30 envios/hora por origem e por tabela (cabe uma turma de escola saindo por um IP só, que
  é o caminho de `/para-escolas`) com um teto de 300/hora no site inteiro — o teto existe
  porque o hash vem de quem chama: sem ele, quem tivesse a chave publicável inseriria sem
  limite nenhum, o que seria PIOR que hoje. **O IP nunca é gravado**, só o hash, e é o que a
  política de privacidade promete a quem lê.
- **Toda Server Action do painel chama `ehEquipe()` sozinha.** A varredura de
  `testes/painel-guarda.test.mjs` exige a guarda em toda página de `app/admin/**` e **não
  alcança Action** — Action é endpoint HTTP público (spec §4.5) e não passa por página nem por
  layout. `testes/publicacoes.test.mjs`, `testes/galeria.test.mjs` e
  `testes/atividades.test.mjs` têm a varredura irmã, uma para cada arquivo de Action. MEDIDO em
  01/09/2026, sem JavaScript, com as guardas das PÁGINAS desligadas de propósito: o envio chega
  à Action, a guarda dela recusa e o formulário volta preenchido.
  **`acoes/conta.ts` é a exceção que confirma a regra:** ela chama `usuarioAtual()` e NUNCA
  `ehEquipe()` — a área do usuário é de qualquer pessoa autenticada, e exigir equipe ali
  trancaria voluntárias e doadoras fora dos próprios dados. `testes/minha-conta.test.mjs` tem a
  varredura ao contrário, que falha se `ehEquipe()` aparecer naquele arquivo.
- **`eh_equipe` mora na MESMA LINHA que /minha-conta edita, e a defesa é tripla (RF11).**
  `lerMeusDados` conhece três nomes de campo; `colunasDoPerfil` monta o objeto do `update`
  com três chaves escritas à mão (função pura, testada com um FormData hostil); e o trigger
  `proteger_papel_equipe` levanta exceção no banco. MEDIDO em 01/09/2026 contra o Supabase de
  produção, com sessão de verdade, **pelos dois caminhos**: um `PATCH` direto no PostgREST com
  `{"eh_equipe":true}` respondeu `42501 somente a equipe altera o papel de equipe`; e o envio
  do formulário REAL de `/minha-conta` com `eh_equipe`, `eh_doador`, `id` de outra pessoa e
  `email` acrescentados como campos escondidos gravou o nome e **não mexeu em nada disso** —
  `eh_equipe` continuou `false`, o e-mail continuou o mesmo e a linha atualizada foi a da
  própria pessoa. O `id` da linha vem da sessão verificada, nunca do corpo.
- **Candidatar-se ao voluntariado EXIGE CONTA, e o formulário de contato não — a diferença
  é do esquema, não de gosto (RF25).** `public.voluntarios.perfil_id` é `not null
  references public.perfis(id)` e a política de insert é `with check (perfil_id =
  auth.uid())`: sem sessão não existe linha possível. MEDIDO contra o Supabase de produção,
  com sessão de verdade: um insert com `perfil_id` de outra pessoa responde `42501 new row
  violates row-level security policy`. A alternativa considerada — gravar em
  `public.contatos` com `origem = 'voluntariado'` para quem não tem conta — foi recusada
  porque perderia as ÁREAS (não há para onde apontá-las), perderia a SITUAÇÃO que a pessoa
  acompanha em `/minha-conta`, e criaria uma segunda porta para a mesma coisa dentro do
  registro central de contatos (RF29). O preço está na tela: `/voluntariado/candidatura` é
  PÚBLICA e explica a exigência a quem não entrou, em vez de redirecionar.
- **A candidatura são DUAS tabelas sem transação, e o desfecho parcial é visível.**
  `voluntarios` primeiro (a segunda referencia o id dela), `voluntario_areas` depois. Não há
  como fazer as duas de uma vez sem uma função no banco (como `registrar_contato`, de 007),
  e migration não era desta tarefa. Então o único desfecho parcial possível é o menos ruim —
  candidatura registrada, áreas de fora — e ele NÃO é silencioso: a pessoa recebe
  `?aviso=candidatura-sem-areas`, que diz o que faltou e por onde completar, e a lista de
  `/minha-conta` escreve que as áreas não ficaram registradas. Dizer "pronto" ali seria
  mentir sobre a única coisa que a pessoa escolheu; dizer "não deu" a faria mandar de novo —
  e o segundo envio bate na recusa de candidatura duplicada.
- **Candidatar-se NÃO TEM DESFAZER, e é isso que justifica a regra de duplicata.** MEDIDO
  contra o Supabase real: `delete` da própria candidatura responde sucesso com ZERO linhas —
  `public.voluntarios` tem política de insert e de select para a própria pessoa, e nenhuma de
  delete (apagar é de quem é equipe). Por isso quem já tem candidatura em andamento não vê o
  formulário, e `acoes/voluntariado.ts` recusa de novo por conta própria
  (`compartilhado/candidatura.ts` guarda a regra, para as duas pontas não divergirem).
  'inativo' fica FORA da lista de "em andamento" de propósito: quem encerrou o voluntariado
  precisa poder voltar. **O que isso NÃO resolve:** dois envios simultâneos — as duas
  requisições consultam, as duas não encontram nada, as duas gravam. Fechar de verdade é um
  índice único parcial, ou seja, migration.
- **Publicar é um ato separado de escrever.** `salvarPublicacao` não conhece a coluna
  `publicado` — nem para gravar `false` —, então nada vai ao ar por acidente; `publicado` só
  muda por `alternarPublicacao`, que é um `<form>` com botão próprio. Ao publicar, `publicado_em`
  só é carimbado se ainda for nulo (corrigir e republicar não é republicar); ao tirar do ar, a
  data FICA — ela é um fato, e apagá-la seria destruir informação num gesto sem desfazer.
- **Nas atividades, `publicado` nasce `true` — o contrário de `publicacoes`.** É a coluna real
  (`not null default true`, `002_conteudo.sql`), e a consequência inverte o risco: numa notícia
  o descuido põe algo no ar sem querer; numa atividade ele TIRA do ar conteúdo que a ONG tem
  publicado. O remédio é o mesmo — `salvarAtividade` não conhece a coluna, e quem muda é
  `alternarAtividade`, botão separado. E a tela de atividades **não cria e não apaga**: as 11
  vieram da ONG pelo seed, apagar não tem desfazer, e criar sem poder apagar deixaria a equipe
  sem saída depois de um toque errado no celular (regra 4). O banco permite as duas (`for all`);
  quem recusa é `acoes/atividades.ts`, e há teste que falha no dia em que um `insert` ou um
  `delete` aparecer ali.
- **Design system "Ateliê Afro" v1** (01/09/2026, branch `design-system-v1`), que ABSORVEU a
  direção "Aplique" em vez de descartá-la: o gesto continua sendo o deslocamento sólido sem
  desfoque, canto vivo, nada de textura repetida — é literalmente o princípio 2 do sistema
  novo. O que mudou: **uma serifa só em tudo** (Bitter, inclusive em botão e rótulo — não
  existe mais sans no site), a paleta afinada (regra 3), a escala tipográfica menor e a
  **faixa listrada** como divisor de seção, no máximo duas por página. Fontes continuam
  servidas localmente, sem Google Fonts — o handoff carrega Bitter por `<link>` para
  fonts.googleapis.com, e aqui os `.woff2` são versionados (`estilos/fontes.css` explica).
  **Três divergências deliberadas em relação ao handoff, cada uma por uma regra deste
  projeto**, escritas no topo de `estilos/tokens.css`: tamanho em `rem` e não em `px` (senão
  o A+ vira decoração), nada de `vw` em texto, e alto contraste por token e não por
  `filter: saturate(0)`.
  **Como o sistema chega em cada camada:** `estilos/tokens.css` faz os nomes de token antigos
  apontarem para os valores v1 (o site inteiro pega paleta e tipografia sem ser editado);
  `estilos/sistema.css` traz os componentes `.af-*` de verdade, e só `app/page.tsx` os usa;
  `estilos/sistema-aplicado.css` (02/09/2026) é a PELE do sistema sobre os nomes de classe
  antigos — redeclara borda (1,5px), sombra (marrom dura, sem cor de categoria) e peso de
  título (700) das superfícies legadas de `base.css`/`componentes.css`/`admin.css`, escopado
  por `#conteudo` e `.painel` para vencer a especificidade. As telas públicas e as 17 do
  painel ganham a aparência do sistema sem reescrita de markup.

---

## Status por módulo

Atualizado em 01/09/2026 (três frentes em paralelo, cada uma no seu worktree: a RF25 — a
candidatura ao voluntariado; o bucket privado da galeria — item 0j, a única correção deste
dia que é de SEGURANÇA e não de funcionalidade; e o manual da equipe, RNF07. Antes, no
mesmo dia, a RF11 — a área do usuário; o RF29,
que deu à equipe a tela para ler as mensagens; e antes disso,
o RF07 — formulário de contato + migration 007 — e as Tarefas P2, P3 e P4 do painel; antes disso, P1 em 31/08 e o fim do
Bloco A da fase 2, rodada de correção 1). O status descreve
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

**O CAMINHO DO SUCESSO PASSOU A SER EXERCITADO EM 01/09/2026, na RF11.** Até então nada disto
tinha sido percorrido: sem conta confirmada, ninguém entrava. Duas coisas destravaram —
`mailer_autoconfirm` virou `true` no projeto Supabase (MEDIDO em
`GET /auth/v1/settings`; era `false` até 30/08, e é o item 1 de "O que trava hoje" que
encolheu), e a RF11 criou uma conta de teste para medir (item 0o). Com ela, contra o Supabase de
PRODUÇÃO, no Firefox, **com e sem JavaScript**: criar conta grava e já devolve sessão; `/entrar`
autentica; **o cabeçalho mostra o nome de quem entrou por ter entrado de verdade**, e não pela
porta de diagnóstico; `Sair` encerra; `/minha-conta` desenha a ficha e o formulário com o que
veio do banco; e trocar o nome muda o nome do cabeçalho no mesmo gesto.
`DIAGNOSTICO_CABECALHO_COM_SESSAO` continua existindo — a SUÍTE segue sem sessão —, mas deixou
de ser a única evidência.
O caminho da FALHA continua provado por `npm run test:supabase`: `/entrar` com credencial
inexistente devolve "E-mail ou senha não conferem" vindo do Auth e traduzido por
`compartilhado/erros.ts`, e um token recusado vira `/nova-senha?erro=expirado`.

### M1 — Site institucional

| Req | O quê | Status |
|---|---|---|
| RF01 | Página inicial | **pronto** — em `refine-design-system-v1` (02/09) bate com `index.html` do handoff: herói `.af-hero` com foto (`<picture>` 16:9 / 4:5), tiles numerados 01–04 (via CSS, sem texto novo — `paridade-texto` intacto), setores com foto 2:1, "Na mídia" em `.af-media`. Fotos só do cofundador, em `public/imagens/` (ver item 0t) |
| RF02 | Quem somos | **pronto** |
| RF03 | Projetos e atividades (11, do banco) | **pronto**, agora inclusive a edição pela equipe (Tarefa P4, 01/09): `/admin/atividades` lista as 11 e `/admin/atividades/editar?id=` corrige nome, resumo, sinopse e ficha técnica. **Só editar**: não cria e não apaga (o banco permite; a tela não oferece, e diz por quê). Tirar do ar/pôr de volta existe, num botão separado. Ninguém percorreu o caminho autenticado — não há sessão de equipe **PEDIDO V1 (02/09):** `/projetos` virou lista de BLOCOS (título, capa, resumo, "Saber mais") e cada atividade ganhou página própria em `/projetos/[id]`, com sinopse e ficha técnica. O painel passou a CRIAR ("Adicionar projeto") e a subir CAPA — apagar continua fora (item 0w). A capa depende da migration 009, ainda não aplicada (item 0v) |
| RF04 | Notícias e campanhas | **pronto** (Tarefa P2, 01/09/2026) — `/noticias` lê `public.publicacoes` (`servidor/dados/publicacoes.ts`) e a equipe escreve, edita, publica e tira do ar em `/admin/publicacoes`. A tabela está VAZIA (a ONG ainda não publicou nada), então a página continua mostrando o estado vazio da Tarefa A4. Imagem DENTRO de uma publicação continua faltando: a P3 fez a galeria (`public.midia`), não `publicacoes.imagem_caminho` **PEDIDO V1 (02/09):** `/noticias` virou lista de BLOCOS e cada notícia ganhou página própria em `/noticias/[id]`. A IMAGEM na notícia passou a existir — sem migration: `imagem_caminho` e `imagem_alt` estão em `publicacoes` desde a 002, faltava a tela |
| RF05 | Galeria | **tela e envio prontos** (Tarefa P3, 01/09/2026) — `/galeria` lê `public.midia` (`servidor/dados/galeria.ts`, agrupando por álbum) e a equipe sobe foto, publica, tira do ar e apaga em `/admin/galeria`. A tabela está VAZIA e **nenhum byte foi escrito no bucket por este código**, em ambiente nenhum: falta sessão de equipe. RN07 honrada em **quatro** camadas independentes: RLS da tabela, guarda dentro da Action, tela, e — desde 01/09/2026 — o ARQUIVO, com o bucket privado e URL assinada de uma hora (`supabase/migrations/008_galeria_privada.sql`, item 0j). **A migration 008 ainda não foi rodada por ninguém**, e enquanto não for o bucket segue público sem nada quebrar: a sonda de `bucketAindaAberto()` grita no log e põe um aviso permanente no topo de `/admin/galeria`. Só IMAGEM — vídeo não cabe no limite de corpo de uma Server Action (ver `next.config.ts`) **PEDIDO V1 (02/09):** a foto abre em TELA CHEIA, com setas e volta nas pontas — e sem JavaScript o toque abre a imagem no navegador, porque cada miniatura é um `<a>` para ela. O álbum vira LINK para o projeto quando o nome bate com uma atividade (ponte por nome, sem coluna nova — `compartilhado/albuns-e-projetos.ts`) |
| RF06 | Contato institucional | **pronto** |
| RF07 | Formulário de contato | **pronto, e é o PRIMEIRO caminho de sucesso do projeto medido de ponta a ponta** (01/09/2026) — `/contato` grava em `public.contatos` por `acoes/contato.ts`, sem sessão nenhuma (o formulário é público: `anon` tem `grant insert` e a política é `with check (true)`). MEDIDO contra o Supabase real, sem JavaScript: preencher, enviar, redirect para `/contato?aviso=enviada` e a linha gravada. **Uma linha de teste ficou no banco de produção e precisa ser apagada à mão** — ver "O que trava hoje", item 0m. A tela da equipe para ler estes registros passou a existir no mesmo dia (RF29, `/admin/contatos`). O formulário continua DEPOIS dos canais diretos: WhatsApp e telefone a ONG lê hoje, todos os dias, e a fila do painel depende de alguém abri-la |
| RF38 | Para escolas | **pronto** |
| RF39 | Prova social (14 registros) | **pronto** |

### M2 — Contas e acesso

| Req | O quê | Status |
|---|---|---|
| RF08 | Cadastro de voluntário | **pronto** (Tarefa 3: `componentes/AbasEntrar.tsx` chama `criarConta`). **Desde que `mailer_autoconfirm` virou `true` no projeto Supabase, a conta criada já vem com sessão e a pessoa entra na hora** — MEDIDO em 01/09/2026 (RF11): criar conta pelo Auth real devolveu `access_token`, e `signInWithPassword` com o mesmo par funcionou. Era o item 1 de "O que trava hoje", e encolheu. A confirmação por e-mail deixou de barrar a entrada; o envio nativo com cota baixa continua importando para RECUPERAR SENHA e para trocar de e-mail. Falta a gestão pela equipe (RF26) |
| RF09 | Cadastro de doador | idem RF08: é o mesmo formulário, com a caixa "Quero doar ou apoiar" virando `eh_doador` |
| RF10 | Autenticação, papéis acumuláveis | **pronto até onde o e-mail deixa** — as quatro telas enviam (`/entrar`, criar conta, `/recuperar-acesso`, `/nova-senha`), com e sem JavaScript; `/auth/confirm` verifica o link e grava a sessão; `servidor/sessao.ts` lê a sessão com `getUser()`, nunca `getSession()`. **Entrar de verdade passou a funcionar em 01/09/2026** (RF11): com `mailer_autoconfirm` agora `true`, criar conta devolve sessão e `/entrar` autentica — medido no Firefox contra o Auth de produção, com e sem JavaScript, e o cabeçalho mostrou o nome de quem entrou por ter entrado. O caminho da recusa continua provado por `npm run test:supabase`. A Tarefa 4 fechou a ponta que faltava: **o cabeçalho mostra o nome de quem entrou e um "Sair"** no lugar de "Entrar", e o "Sair" é um `<form>` com a Action `sair` — funciona sem JavaScript (medido pelo POST cru, 303 para `/`, e no Firefox com script desligado). O nome vem do metadata da conta, com o e-mail como reserva — e desde a RF11 o nome é um LINK para `/minha-conta`, único caminho até a área do usuário |
| RF11 | Área do usuário | **pronto, e é o primeiro caminho AUTENTICADO do projeto medido de ponta a ponta** (01/09/2026) — `/minha-conta` mostra a ficha da conta, o formulário de nome/telefone/tipo de pessoa (`acoes/conta.ts`), as candidaturas ao voluntariado e as doações registradas. Quem chega sem sessão é mandado para `/entrar` (redirect, não 404 — o porquê está no cabeçalho da página). MEDIDO contra o Supabase de produção, no Firefox, **com e sem JavaScript**: entrar, abrir a área pelo nome no cabeçalho, corrigir o nome, ver o cabeçalho acompanhar, e a recusa de validação devolvendo o formulário preenchido. **Sem bloco de inscrições**, e não é esquecimento: `public.inscricoes` não tem política de leitura para a própria pessoa NEM coluna ligando inscrição a conta (decisão D4) — ver o fim de `servidor/dados/conta.ts`. **Desde a RF25 (mesmo dia) a lista de candidaturas ENCHE de verdade**: `listarMinhasCandidaturas` traz as áreas junto, por embed do PostgREST, e o estado vazio deixou de dizer "candidatar-se pelo site ainda não existe" — ele agora manda para `/voluntariado/candidatura`. `doacoes` continua VAZIA |
| RF12 | Confirmação de maioridade | **pronto** — caixa obrigatória na tela, regra (RN01) recusada no servidor (`criarConta` não chama o `signUp` sem ela, e a caixa é lida pelo conteúdo, não pela presença do campo), e a recusa medida ponta a ponta, inclusive sem JavaScript |
| RF33 | Painel administrativo | **quatro telas de trabalho** — P1 (31/08) deu a fundação (`/admin`, guarda, home, `estilos/admin.css`) e P2 (01/09) deu **publicações**: `/admin/publicacoes` (lista, publicar/tirar do ar) e `/admin/publicacoes/editar` (escrever/editar). P3 (01/09) deu **galeria**: `/admin/galeria` (subir foto, publicar/tirar do ar) e `/admin/galeria/apagar` (a tela de confirmação que substitui um `confirm()`, que não existe sem JavaScript). P4 (01/09) fechou o bloco com **atividades**: `/admin/atividades` (as 11 reais, com tirar do ar/pôr de volta) e `/admin/atividades/editar?id=` (corrigir o texto — sem criar e sem apagar). O RF29 (01/09) acrescentou a quinta, que não estava no plano do bloco: `/admin/contatos`, as mensagens recebidas. Quem não é equipe recebe **404** nas oito rotas, medido; **o caminho autenticado ninguém percorreu**, porque não há sessão utilizável na suíte. O que FOI medido sem sessão está nos relatórios de P2/P3/P4/RF29 e em `testes/publicacoes.test.mjs`, `testes/galeria.test.mjs`, `testes/atividades.test.mjs` e `testes/contatos.test.mjs` **PEDIDO V1 (02/09):** confirmação em toda ação (diálogo `<dialog>` interceptando o submit, com página de confirmação como base sem script), confirmação DUPLA por palavra digitada nas duas telas destrutivas, cartões comprimidos com "Ver mais", paginação nas três filas (com o TOTAL escrito na tela), filtro por situação em voluntários, formulário de envio atrás de um botão `<details>`, e instruções em bullets nas oito telas |
| RF34 | Perfis e permissões | **pronto no banco** — RLS, `eh_equipe()` e o trigger contra escalada, testados contra Postgres real (`npm run rls`). Nenhuma tela exercita isso ainda |

### M3 — Eventos

| Req | O quê | Status |
|---|---|---|
| RF13 | Cadastro e edição de eventos | **pronto** (01/09/2026) — `/admin/eventos` e `/admin/eventos/editar`. `salvarEvento` NÃO conhece `publicado` (a coluna é `not null default false`, como publicações e ao contrário de atividades), e a tela **não apaga**: `inscricoes.evento_id` tem `on delete cascade`, então apagar um evento apagaria a lista de inscritos. Caminho autenticado nunca percorrido |
| RF14 | Agenda pública | **pronto** — deixou de ser "sem dados" com a RF13. ATENÇÃO: o parágrafo que promete inscrição sem conta é texto original da ONG, travado por `paridade-texto`, e passa a ser lido por quem quer participar assim que houver evento publicado. RF15 não existe — decisão do grupo |
| RF15 | Inscrição sem conta | **falta** — tabela e política prontas |
| RF16 | Consulta de inscritos | **falta** |
| RF17 | Lista de presença pelo celular | **falta** |
| RF18 | E-mail de confirmação | **falta** — depende do Brevo |

### M4 — Doações · M5 — Voluntariado

| Req | O quê | Status |
|---|---|---|
| RF19–RF22 | Oferta, análise, registro, histórico | **pronto** (01/09/2026) — `/doar/ofertar` (público, exige conta), `/admin/doacoes`, `/admin/doacoes/responder?id=` e `/admin/doacoes/registrar` (para doação que veio de fora do site: `doador_nome`/`doador_email` com `perfil_id` nulo). **Sem meio de pagamento e sem recibo** — o site registra, não cobra (RN08): `lerOferta` não lê campo de valor, e `valor` só é escrito pela equipe, depois do fato. MEDIDO: `anon` não tem grant nenhum em `doacoes` (`42501`), então o GRANT decide antes da política |
| RF23 | Meios de doação | **pronto** — chave Pix pendente (D7) |
| RF24 | Página de voluntariado (5 áreas, do banco) | **pronto** — e desde a RF25 o botão "Quero me candidatar" aponta para `/voluntariado/candidatura`, não mais para `/entrar`. O TEXTO do botão não mudou, de propósito: o `<main>` desta página é comparado palavra por palavra com o HTML original congelado (`testes/paridade-texto.test.mjs`) |
| RF25 | Candidatura | **pronto** (01/09/2026) — `/voluntariado/candidatura` grava em `public.voluntarios` + `public.voluntario_areas` por `acoes/voluntariado.ts`, e a candidatura aparece em `/minha-conta` com situação, data e áreas. **Exige conta**, e o porquê está no cabeçalho da Action: `perfil_id` é `not null` e a política de insert é `perfil_id = auth.uid()`; gravar em `contatos` com `origem='voluntariado'` para quem não tem conta perderia as áreas, a situação e a RF26. Quem chega sem sessão NÃO é redirecionado: lê por que precisa de conta e recebe o caminho. MEDIDO contra o Supabase de produção, no Firefox, **sem JavaScript**: entrar, marcar duas áreas, enviar, redirect para `/minha-conta?aviso=candidatura`, e a candidatura desenhada com as duas áreas. **Uma candidatura de teste ficou no banco de produção** — item 0q. Quem já tem candidatura em andamento não vê o formulário, e a Action recusa de novo (medido com a guarda da PÁGINA desligada de propósito). **Sem desfazer**: não há política de delete para a própria pessoa |
| RF26 | Gestão de voluntários | **pronto** (01/09/2026) — `/admin/voluntarios` lê as candidaturas com embed de `perfis` e das áreas, e move `situacao` entre as quatro do check. Lê e tria: sem insert, sem delete. **Encerrar devolve à pessoa o direito de se candidatar de novo** (`inativo` fica fora de `SITUACOES_EM_ANDAMENTO`) — é a única ação do painel que muda o que outra pessoa pode fazer no site. ANTES DIZIA: falta, e desde a RF25 **falta, e desde a RF25 há fila esperando** — as candidaturas chegam em `public.voluntarios` com `situacao='novo'`, e nenhuma tela da equipe as lê: hoje isso é o painel do Supabase. A política de leitura da equipe já existe (`voluntarios: equipe gerencia`). Atenção ao item 0q: a primeira linha da tabela é uma candidatura de TESTE |

### M9 — Acervo · M6 — Comunicação · M7 — Relatórios

| Req | O quê | Status |
|---|---|---|
| RF35 | Catálogo com busca | página e busca por `?busca` prontas, **sem dados** |
| RF36 | Visualização e download | **pronto** (01/09/2026), menos o contador — dois caminhos por material: abrir e baixar. ACHADO: o botão de baixar **nunca baixou nada**, porque o atributo `download` do HTML é ignorado ENTRE ORIGENS e o arquivo mora em `<projeto>.supabase.co`; agora vai `?download=<nome>`, e o nome sai do título, não do uuid. A coluna `downloads` continua em zero e a tela não a mostra: contar visitante exige função `security definer` (MEDIDO: `update` anônimo → `42501`) |
| RF37 | Publicação de material | **pronto** (01/09/2026) — `/admin/acervo` e `/admin/acervo/apagar`. Só PDF, por assinatura de bytes (`%PDF-`), até 4 MB. O bucket `acervo` é PÚBLICO de propósito (o oposto da galeria na 008): "tirar do ar" mexe só na tabela, então a tela tem apagar |
| RF27 | Mural de avisos | **bloqueado por migration** (investigado em 01/09/2026, não é código faltando). O escopo pede "visível para voluntários autenticados", e `publicacoes` só sabe `publicado` (mundo) ou não (equipe) — MEDIDO: anônimo com a chave publicável lê `publicado=true` (HTTP 200). Nenhuma política do schema tem a forma `auth.uid() is not null`. Reaproveitar a tabela publicaria comunicação interna na internet aberta |
| RF28 | Mensagem para grupo | **bloqueado pelo Brevo** — duas faltas independentes, as duas confirmadas em 01/09/2026: não existe `supabase/functions/` (a Edge Function `enviar-email` da spec §9 nunca foi escrita) e não há tabela de envios. Os destinatários existem; o que não existe é com o que enviar |
| RF29 | Registro central de contatos | **pronto** (01/09/2026) — `/admin/contatos` lê `public.contatos` (`servidor/dados/contatos.ts`) e a equipe marca o andamento do atendimento: nova → em contato → concluída, e de volta, em qualquer sentido (`acoes/contatos.ts`, uma Action, um `update` de uma coluna). A fila começa por quem ainda espera resposta e o que foi concluído DESCE, nunca some. **Ela lê e tria: não apaga e não edita a mensagem** — o texto recebido é registro. Consequência LGPD em aberto: /privacidade promete exclusão a pedido, e isso só se faz no SQL Editor (item 0n). Ninguém percorreu o caminho autenticado — não há sessão de equipe na suíte; o que foi medido está no relatório e em `testes/contatos.test.mjs` + o bloco RF29 de `npm run rls` |
| RF30–RF32 | Indicadores, CSV, PDF | **RF30 e RF31 prontos** (01/09/2026), RF32 (PDF) falta. Seis números na home do painel, abaixo dos cartões (no topo empurrariam o trabalho para fora da dobra a 375px), com `count` + `head: true` — nenhuma linha atravessa a rede para desenhar um algarismo. **Zero é número; contagem que falhou é traço**, nunca um zero inventado. CSV em `/admin/exportar/{contatos,voluntarios}`, com neutralização de fórmula (`= + - @`) — as aspas NÃO protegem disso. ANTES DIZIA: falta — **falta** — os indicadores da home do painel existiam no site antigo e **não foram portados**; só na `main` |

### Infraestrutura

| Item | Status |
|---|---|
| Banco: 15 tabelas, todas com RLS | **pronto** |
| Migration 007 (limite de envio por visitante) | **escrita e testada, NÃO APLICADA** — `supabase/migrations/007_limite_por_visitante.sql`. Este repositório não tem credencial para aplicar migration (spec §4.1) e nunca vai ter: quem aplica é uma pessoa, no SQL Editor do Supabase, com `supabase/aplicar-tudo.sql` ou só o 007. Provada contra Postgres real em `npm run rls` (12 testes). Ver "O que trava hoje", item 0l |
| Aceite bloqueante da seção 12 | **passa** contra o banco real |
| Seed com conteúdo real | **pronto** — 11 atividades, 14 clipping, 5 áreas |
| Acervo tratado (233 MB → 27 MB) | **pronto** |
| Política de privacidade | **pronto** |
| Repositório no GitHub | **pronto** |
| Deploy Netlify | **nunca rodou** — config pronta e pinada (Node 24.15.0, plugin 5.15.13); falta publicar |
| Deploy Vercel | **nunca rodou** — `vercel.json` pronto (cabeçalhos e cache de fontes, que a Vercel não lê do `netlify.toml`), `engines.node` relaxado para `>=22.0.0`, `VERCEL_PROJECT_PRODUCTION_URL` e `x-vercel-forwarded-for` na cadeia. Projeto importado em 01/09/2026; a Netlify SEGUE configurada como rede de segurança |
| Página de erro 500 (`app/error.tsx`) | **pronto** — com o layout inteiro, como o 404 |
| `/robots.txt` (`app/robots.ts`) | **pronto** — em modo prévia, ver "O que trava hoje" 0c |
| Supabase Storage (bucket `galeria`) | **ligado pelo código** (P3) — `upload`, `remove` e, desde 01/09/2026, `createSignedUrls` no lugar de `getPublicUrl` (item 0j), com o host do projeto no `img-src` da CSP (e **não** no `connect-src`; a URL assinada tem a MESMA origem, medido). **Nenhum arquivo real subiu**: falta sessão de equipe |
| Migration 008 (bucket `galeria` privado) | **escrita e testada, NÃO APLICADA** — `supabase/migrations/008_galeria_privada.sql`. Mesma situação da 007: este repositório não tem credencial para aplicar migration (spec §4.1); quem aplica é uma pessoa, no SQL Editor do Supabase. Provada contra Postgres real em `npm run rls` (bloco "RN07 no ARQUIVO", 6 testes). **Diferente da 007, a falta desta é ANUNCIADA**: a sonda de `bucketAindaAberto()` bate no endereço público sem chave nenhuma e, enquanto ele responder, o painel mostra o aviso. Ver item 0j |
| Edge Function de e-mail | **falta** |
| Manual da ONG (RNF07) | **escrito, não verificado com a equipe** (01/09/2026) — `docs/manual-da-equipe.md` (as quatro telas do painel, entrar/sair/senha, RN07 explicada, o que o painel NÃO faz e por quê, o que fazer quando dá erro) e `docs/guia-rapido-da-equipe.md` (uma página para imprimir). Escrito lendo as telas, passo a passo; **ninguém percorreu o painel autenticado para conferir** (item 3 de "O que trava hoje"), e o treinamento presencial que a RNF07 também pede continua faltando |

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

**Todas as páginas planejadas existem no Next.** A candidatura ao voluntariado (RF25) foi a
última, em 01/09/2026: `/voluntariado/candidatura`, alcançada pelo botão "Quero me
candidatar" de `/voluntariado` — uma rota que NUNCA existiu no site antigo (por isso ela
entra em `PAGINAS_SEM_URL_ANTIGA`, em `testes/redirects.test.mjs`). Antes dela, no mesmo dia,
a área do usuário (RF11): `/minha-conta`, alcançada pelo nome de quem entrou no cabeçalho. Antes dela, no
mesmo dia, a tela da equipe para LER as mensagens de contato (RF29), que fechou o buraco que
o RF07 tinha aberto — formulário público gravando onde ninguém lia. O que falta agora não é
tela portada: são requisitos que nunca tiveram tela (RF13–RF22, RF26–RF32).
O painel em si passou a existir em 31/08/2026 (Tarefa P1): `/admin` é rota real e responde
**404 para quem não é equipe** — o que continua sendo o comportamento certo, e o que
`testes/redirects.test.mjs` agora vigia (a trava mudou de "`/admin` não existe" para
"`/admin` recusa quem não é equipe"). `/admin/index.html` segue sem redirect, decisão
revisitada e mantida naquela tarefa.

### O que a fase 1 entregou além das páginas

- **O navegador não fala com o Supabase**, garantido em três camadas: `import 'server-only'`
  (erro de build, provado), variáveis sem `NEXT_PUBLIC_` não embutidas, e o `connect-src`
  da CSP sem o Supabase. **Desde a Tarefa P3 o host do Supabase aparece no `img-src`**, e
  isso NÃO é uma quarta porta: `img-src` autoriza baixar imagem (as fotos da galeria) e
  quem governa fetch/XHR/WebSocket é o `connect-src`, que continua sem ele. Há teste para
  os dois lados em `testes/galeria.test.mjs`. **Desde 01/09/2026 o bucket é privado e o
  endereço é uma URL assinada** — o que não mexeu no `img-src`, porque a URL assinada tem a
  mesma origem (medido; ver item 0j)
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
0c. **O `noindex` sai em QUATRO lugares, e fazer só um não produz erro visível.** Para o
   lançamento é preciso remover, no mesmo commit:
   0. `X-Robots-Tag` em **`vercel.json`** — vale para o que a Vercel serve, e a
      advertência mora em `vercel.json.LEIA-ME.txt` porque JSON não aceita
      comentário e a Vercel recusa o deploy inteiro se houver chave estranha;
      o guardião BLOQUEIA se esse LEIA-ME sumir.
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
0g. **RESOLVIDO em 02/09/2026 — fica registrado por um ano, e depois some.** Este item dizia
   que `.cabecalho__menu a` usava `clamp(0.84rem, 1.15vw, 0.95rem)`, contra a regra 8: dentro
   de `clamp()` o `vw` fica preso entre dois `rem`, mas o item do menu deixava de responder ao
   A+ na faixa do meio.

   O design system v1 apagou aquela regra junto com o `.cabecalho__menu` inteiro (a navegação
   virou gaveta, `estilos/sistema.css`). MEDIDO: `grep -n "vw" estilos/*.css` só devolve
   COMENTÁRIOS — os avisos de não usar. Não há uma única declaração com `vw` no CSS do
   projeto.

   Fica aqui porque o item era antigo e alguém pode vir procurá-lo. Apagar depois da entrega.

0h. **Decisão tomada, risco aceito: o VLibras continua no painel.** Ele é montado no
   layout raiz, que envolve também `/admin`, e a CSP usa `strict-dynamic` — confiança em
   cadeia para tudo que ele carregar, numa tela que vai mostrar nome, telefone e
   responsável de crianças a partir de 10 anos. Até 31/08/2026 isto era uma *pendência*
   aqui, com "não montar o VLibras em `/admin`" como caminho barato. **O dono do projeto
   decidiu o contrário, em 31/08/2026, com o risco à vista** (registrado também no plano
   do bloco, `docs/superpowers/plans/2026-08-31-painel-administrativo.md`): tirar a
   tradução justo da tela de trabalho da equipe excluiria quem usa Libras, e
   acessibilidade é requisito da ONG (regra 8), não enfeite.
   **O RF29 AGRAVOU ISTO, e não mudou o comportamento.** Até 01/09/2026 o que estava
   pendurado embaixo do `strict-dynamic` era dado da própria equipe e conteúdo
   institucional. `/admin/contatos` é a primeira tela do projeto com dado pessoal de
   TERCEIROS em volume — nome, e-mail, telefone e texto livre de quem escreveu para a ONG,
   na tela, em texto. A decisão de 31/08 continua valendo pelo mesmo motivo (tirar a
   tradução da tela de trabalho excluiria quem usa Libras), e continua sendo do dono do
   projeto; o que mudou foi o tamanho do que está exposto se o widget algum dia for
   comprometido.
   O que muda de status: isto **não é mais uma decisão a tomar**, é um risco em aberto e
   conhecido. O que o reduziria sem tirar a tradução — e continua valendo como próximo
   passo, se alguém quiser gastar nisso: apertar a CSP para o painel (sem
   `strict-dynamic`, com os hosts do VLibras listados um a um), o que exige medir
   caminho a caminho como a fase 1 fez. A Tarefa P1 não mexeu nisso.
0i. **Foto de mais de 8 MB devolve "Internal Server Error" em texto puro, e não há como
   evitar sem sair de Server Action.** Nasceu com a Tarefa P3. MEDIDO em 01/09/2026, e a
   tabela inteira está em `next.config.ts`: **o padrão do Next recusa corpo acima de 1 MB
   respondendo 500** (o `413` só aparece no log do servidor). Foto de celular tem 3 a 8 MB,
   ou seja, o padrão quebraria na primeira foto real. O limite foi para `8mb` e o teto da
   TELA ficou em 4 MB (`LIMITE_ARQUIVO_BYTES`, `compartilhado/validacao.ts`) — a folga entre
   os dois é a faixa em que a pessoa recebe a NOSSA frase, com o tamanho e o que fazer, em
   vez do 500. MEDIDO sem JavaScript: 5 MB → nossa frase, página inteira de pé; 9 MB →
   `Internal Server Error`, sem `<title>`, sem layout. Com JavaScript o formulário avisa
   antes de enviar, o que também poupa o plano de dados de quem está no celular. Dois
   testes travam isso (`testes/galeria.test.mjs`, seção 2) e falham se alguém apagar a
   linha do `next.config.ts` — provado apagando.
   **O que NÃO foi medido: o limite de corpo de função da Netlify.** A branch nunca foi
   publicada (item 0). A escolha de 4 MB parte da conta de que 4 MB binários viram ~5,3 MB
   codificados, sob o limite documentado de 6 MB da plataforma — **conta, não medição**.
   Conferir no primeiro deploy real, subindo uma foto de ~3,5 MB pelo painel. Se a Netlify
   recusar antes, a mensagem será dela, não nossa, e o número aqui precisa cair.
0j. **O conserto do bucket público está ESCRITO e NÃO APLICADO — e é a única coisa que
   falta agora.** Reescrito em 01/09/2026, quando o problema foi corrigido no código.

   **O que era o problema.** `supabase/migrations/006_storage.sql` criou os três buckets
   com `public: true` e uma política de select sem condição. Consequência: uma foto
   GUARDADA, uma SEM AUTORIZAÇÃO e uma TIRADA DO AR continuavam baixáveis por quem tivesse
   o endereço. A coluna `publicado` governava o que a página desenhava; nunca governou o
   arquivo. **MEDIDO em 01/09/2026 contra o projeto de verdade, sem mandar chave nenhuma:**
   `GET /storage/v1/object/public/galeria/nao-existe.jpg` respondeu
   `{"code":"NoSuchKey","message":"Object not found"}` — leia o código: `NoSuchKey`, não
   `NoSuchBucket`. O endereço aceitou o bucket e só reclamou da chave. (Um bucket que não
   existe responde `NoSuchBucket`; a diferença também foi medida.)

   **O que já mudou, no código desta branch:**
   1. `supabase/migrations/008_galeria_privada.sql` torna `galeria` privado e troca a
      leitura de `storage.objects` por uma que exige a linha de `public.midia` publicada E
      autorizada. `acervo` e `identidade` NÃO foram tocados — são material para download
      livre (RF35/RF36); a política deles precisou ser recriada só porque a original cobria
      os três num `in (...)` só, e política do Postgres soma com OU;
   2. `servidor/dados/galeria.ts` trocou `getPublicUrl` por `createSignedUrls` — plural, uma
      requisição para a lista inteira. **`getPublicUrl` continua em `acervo.ts`, de
      propósito.** O prazo é **uma hora**, com a conta escrita em
      `compartilhado/galeria-privada.ts`: prazo curto quebra o `loading="lazy"` (foto abaixo
      da dobra só é baixada quando a pessoa rola até ela, o que pode ser meia hora depois);
      prazo longo recria a brecha com data de validade;
   3. o endereço passou a poder ser NULO, e as duas telas tratam isso de formas opostas: a
      galeria pública OMITE a foto, o painel MANTÉM a linha com uma frase no lugar da
      miniatura — porque é ali que está quem pode apagar a linha órfã.

   **O QUE FALTA, e é uma pessoa:** rodar `008_galeria_privada.sql` no SQL Editor do painel
   do Supabase. Este repositório não tem, e não vai ter, credencial capaz de aplicar
   migration (não existe service_role — spec §4.1). **Enquanto não for rodada, NADA
   QUEBRA** — URL assinada funciona em bucket público também —, e por isso a falta seria
   mais um item 0e. Contra isso existe uma sonda: `bucketAindaAberto()` bate no endereço
   público sem chave nenhuma, e enquanto ele responder `NoSuchKey` o painel desenha um aviso
   permanente no topo de `/admin/galeria` **e** o servidor grita `[galeria] O BUCKET
   "galeria" AINDA É PÚBLICO` no log. Quando a migration for aplicada, o aviso some sozinho
   — e é assim que se confere, porque o lado fechado da sonda não pôde ser medido daqui.
   Depois disso, apagar este item.

   **O QUE MUDA NO RACIOCÍNIO DO "APAGAR", e é sutil.** Antes: "tirar do ar" não cumpria a
   RN07 de jeito nenhum, e só "Apagar" cumpria. Com a migration aplicada, tirar do ar passa
   a cumprir — **com atraso de até uma hora**, porque uma URL assinada é um PORTADOR e as já
   emitidas continuam valendo até vencer. Para o caso urgente da RN07 (autorização retirada,
   foto de criança subida por engano) uma hora é tempo demais, e apagar continua sendo o
   único gesto que age no mesmo instante: sem o arquivo no bucket, toda URL assinada viva
   morre junto. **A galeria continua tendo "Apagar" e a tela de notícias não; o argumento
   mudou de "tirar do ar não resolve" para "tirar do ar demora até uma hora".**
0k. **A fonte dupla das atividades passou a poder DIVERGIR, e nada disso dá erro visível.**
   Nasceu com a Tarefa P4 (01/09/2026): a equipe corrige o texto das 11 atividades em
   `/admin/atividades`, a correção vai para `public.atividades` e **não volta** para
   `dados-iniciais/atividades.json` — ninguém atualiza o repositório a partir do painel, e
   nem poderia (o site em produção não grava no git). A partir da primeira correção:
   1. **queda do banco passa a servir texto DESATUALIZADO** em `/projetos`, e não mais "o
      mesmo conteúdo por outro caminho". O carimbo `data-origem-atividades` no `<main>`
      continua sendo como se descobre isso de fora, e o aviso `[dados]` no log, de dentro;
   2. **deploy sem as variáveis do Supabase** (item 0e) faz o mesmo, de forma permanente e
      silenciosa: o site sobe inteiro, bonito, com o texto de antes das correções;
   3. **`npm run seed` regenera `supabase/seed.sql` a partir do JSON.** O
      `on conflict (id) do nothing` protege as linhas que já existem — rodar o seed num banco
      que já tem as 11 não apaga correção nenhuma —, mas **restaurar** um banco a partir dele
      (banco novo, ou linhas apagadas antes) traz de volta o texto velho. O gerador imprime
      esse aviso a cada execução, e `testes/atividades.test.mjs` falha se ele sumir.

   **Como voltar a alinhar as duas fontes:** exportar `public.atividades` e atualizar
   `dados-iniciais/atividades.json` com o que estiver lá, antes de qualquer restauração.
   Consertar de verdade é decisão do GRUPO, não de quem implementa: ou escolher uma fonte só
   (perdendo a rede de segurança offline) ou dar ao painel um caminho de exportação para o
   JSON, que é commit no repositório — coisa que a equipe da ONG não faz do celular. A
   sinalização está em cinco lugares: `servidor/dados/conteudo.ts`, `acoes/atividades.ts`,
   `ferramentas/gerar-seed.mjs`, a própria tela da equipe (aviso permanente em
   `componentes/ListaAtividades.ts`, mais a frase do "tirar do ar") e este item.
   **Uma segunda ponta, para quando houver correção de verdade no banco:** dois testes de
   `testes/paginas.test.mjs` afirmam o conteúdo de hoje — "mostra as onze atividades" e a
   lista `ATIVIDADES_SEM_SINOPSE`. No modo offline eles continuam determinísticos (leem o
   JSON); em `npm run test:supabase`, a primeira atividade tirada do ar ou o primeiro resumo
   preenchido pela equipe deixa um deles vermelho — será a suíte cobrando conteúdo, não
   defeito de código.

0l. **A migration 007 está escrita, testada e NÃO APLICADA — e o site não avisa por si.**
   Nasceu com o RF07 (01/09/2026). `supabase/migrations/007_limite_por_visitante.sql`
   troca o limite de envio "por cabeçalho" (que neste desenho é sempre o SERVIDOR, ou
   seja, um balde global de 10/hora para o site inteiro — spec §4.6) por um balde por
   VISITANTE, com o hash do IP passado como parâmetro explícito da função
   `public.registrar_contato`. Este repositório **não tem, e não vai ter, credencial capaz
   de aplicar migration** (não existe service_role — spec §4.1): quem aplica é uma pessoa,
   no SQL Editor do Supabase.

   **Enquanto não for aplicada, o formulário CONTINUA FUNCIONANDO** — e é essa a armadilha.
   `acoes/contato.ts` chama a função, recebe `PGRST202` ("não achei essa função"), e cai no
   caminho antigo: um INSERT direto, que grava a mensagem do mesmo jeito. MEDIDO contra o
   Supabase real em 01/09/2026: o envio deu certo e a linha entrou. O que degrada é só a
   qualidade do limite — 10 envios por hora para o site inteiro, e o primeiro spammer (ou a
   primeira turma de escola) fecha o formulário para todo mundo. A única testemunha é uma
   linha `[contato]` no log do servidor, com o nome do arquivo a aplicar.

   **Como aplicar:** `./ferramentas/gerar-sql-completo.sh` já inclui o 007 em
   `supabase/aplicar-tudo.sql`; para um banco que já existe, colar só o
   `007_limite_por_visitante.sql` no SQL Editor. Depois disso, apagar este item.
   `npm run rls` prova a migration contra um Postgres de verdade (12 testes), e é a única
   verificação possível dela: `npm run test:supabase` fala com o projeto de produção, onde
   ela não está.
0m. **Uma linha de teste ficou em `public.contatos` do banco de PRODUÇÃO, e este
   repositório não consegue apagá-la.** Foi gravada em 01/09/2026 para medir o caminho de
   sucesso do RF07 de ponta a ponta (o primeiro do projeto — as quatro tarefas do painel
   nunca conseguiram). É reconhecível pelo e-mail `teste-rf07@exemplo.invalid` e pelo nome
   "TESTE AUTOMATIZADO - apagar (RF07)".

   Apagar exige sessão de equipe: `anon` tem `grant insert` e mais nada em `contatos`
   (medido — `delete` responde `42501 permission denied`, e `select` também). No SQL Editor
   do Supabase:

   ```sql
   delete from public.contatos where email = 'teste-rf07@exemplo.invalid';
   ```

   Nenhum teste automático grava em `contatos`: o único que gravaria está com `skip` no
   modo com credenciais, com o motivo escrito (ver "Comandos").

   **Desde o RF29 essa linha APARECE numa tela** (`/admin/contatos`), para quem for equipe.
   A tela deixa marcá-la como concluída — o que a tira do topo da fila —, mas **não apaga**:
   o `delete` acima continua sendo o único caminho, e é de propósito (item 0n).

0n. **A tela de mensagens não apaga, e /privacidade promete exclusão a pedido.** Nasceu com
   o RF29 (01/09/2026). `/admin/contatos` lê e tria; `acoes/contatos.ts` não tem `insert`
   nem `delete`, e o `update` grava só a coluna `situacao` — porque o texto que a pessoa
   escreveu é registro, e apagar num celular, de pé, não tem desfazer. **O banco permite as
   duas coisas** (`contatos: equipe gerencia`, `for all`, e `authenticated` tem `grant
   delete` — MEDIDO em `npm run rls`, bloco RF29): quem recusa é o código.

   A consequência em aberto: /privacidade diz que a pessoa pode "pedir a exclusão dos seus
   dados", e hoje isso só acontece no SQL Editor do Supabase, à mão. A tela DIZ isso por
   escrito ("fale com quem cuida do site"), e há teste que falha se a frase sumir — mas
   dizer não é cumprir. Fechar de verdade é decisão do grupo: ou uma tela de apagar com
   confirmação (o desenho da galeria, `/admin/galeria/apagar`), ou um procedimento escrito
   no manual da ONG (RNF07, que também falta).

   **Segunda ponta, do mesmo item:** a lista NÃO TEM LIMITE nem paginação. Com uma linha na
   tabela isso é grátis, e um `.limit(n)` numa fila de atendimento esconderia mensagem sem
   dizer que escondeu. No dia em que a lista não couber numa rolagem, o caminho é filtro por
   situação com o total escrito na tela — nunca um corte silencioso.

0o. **Uma conta de teste ficou em `auth.users` e em `public.perfis` do banco de PRODUÇÃO, e
   este repositório não consegue apagá-la.** Foi criada em 01/09/2026 para medir a RF11 — o
   primeiro caminho AUTENTICADO exercitado no projeto: sem ela, a área do usuário teria ido
   ao ar sem ninguém nunca ter aberto a tela pelo caminho normal, que é o que os itens 3 e
   0m já lamentam nas telas do painel.

   É reconhecível pelo e-mail `teste-rf11@exemplo.invalid` e pelo nome
   "TESTE AUTOMATIZADO - apagar (RF11)". **`eh_equipe` é `false` e precisa continuar sendo**
   — ela é a conta de uma pessoa comum, e é justamente isso que a torna útil para medir a
   área do usuário. Ela não tem candidatura nem doação: as duas tabelas continuam vazias.

   **A senha NÃO está neste repositório, de propósito.** Para medir de novo, defina uma nova
   pelo painel do Supabase (*Authentication → Users*). Para apagar, é lá também
   (*Authentication → Users → Delete user*, que leva a linha de `public.perfis` junto, pelo
   `on delete cascade` de `001_base.sql`): `anon` e `authenticated` não apagam conta, e não
   existe service_role neste projeto (spec §4.1).

   Nenhum teste automático cria conta: o `signUp` só é exercitado por unidade, com o Auth
   fora do caminho.

0p. **Trocar a senha não pede a senha ATUAL.** Nasceu visível com a RF11, que pôs em
   `/minha-conta` um link "Trocar minha senha" apontando para `/nova-senha` — aquela página
   mostra o formulário para quem tem sessão, e `definirNovaSenha` confere a sessão de novo,
   então o caminho funciona sem uma linha de código nova. **O link não cria o risco: ele o
   torna visível.** Antes dele, quem pegasse um celular com a sessão aberta já trocava a
   senha digitando o endereço na barra.

   O cenário é real e é o da regra 4: celular pessoal, compartilhado, no meio de um evento.
   Fechar de verdade é ligar `reauthentication` no Supabase (`updateUser` passa a exigir um
   código enviado por e-mail antes de aceitar senha nova) — o que reintroduz a dependência do
   envio de e-mail, hoje com cota baixa. É decisão do grupo, não de quem implementa. Enquanto
   não for tomada, o que existe é o "Sair" no cabeçalho, em toda página.

0q. **Uma segunda conta de teste e UMA CANDIDATURA ficaram no banco de PRODUÇÃO, e este
   repositório não consegue apagar nenhuma das duas.** Foram criadas em 01/09/2026 para
   medir a RF25 de ponta a ponta, sem JavaScript, que é a única forma de saber se
   candidatar-se funciona.

   - conta: `rf25.teste@exemplo.test`, nome "TESTE AUTOMATIZADO - apagar (RF25)",
     `eh_equipe` **false** (e precisa continuar sendo). Apagar é no painel do Supabase
     (*Authentication → Users → Delete user*), que leva `public.perfis` junto pelo
     `on delete cascade`;
   - **1 linha em `public.voluntarios`** (situação `novo`, mensagem "Texto que não pode se
     perder.") e **2 em `public.voluntario_areas`** (`acervo` e `comunicacao`). Apagar a
     conta leva as três junto, pelo mesmo cascade. Se alguém quiser apagar só a candidatura,
     é no SQL Editor — `anon` e `authenticated` não têm política de delete nesta tabela
     (MEDIDO: `delete` responde sucesso com zero linhas).

   **A senha NÃO está neste repositório, de propósito** — a mesma disciplina do item 0o.
   Para medir de novo, defina uma nova pelo painel do Supabase.

   **Consequência para a RF26 (gestão de voluntários), quando ela existir:** a primeira
   candidatura que a equipe vai ver na tela é esta, de teste. Ou se apaga antes, ou a tela
   nasce com uma linha que não é de ninguém.

   Nenhum teste automático cria candidatura: os 28 da RF25 são puros, varredura de código
   ou requisições anônimas.

0r. **Seis frentes rodaram em paralelo em 01/09/2026, e três coisas ficaram sabidas do
   MÉTODO, não do produto.** (a) Worktree isolado resolve a colisão de commits, mas não a
   de arquivo: `compartilhado/avisos-do-painel.ts`, `componentes/PainelInicio.ts`,
   `estilos/admin.css`, `testes/apoio/rotas-migracao.mjs` e `testes/redirects.test.mjs`
   conflitaram em quase toda integração — são listas que TODA tela nova precisa alimentar.
   Quem integrar de novo: quase todo conflito é apêndice puro, e a receita que funcionou foi
   conferir se a versão da branch é `base + apêndice` (`head -n <linhas da base>` + `cmp`) e,
   sendo, anexar a cauda sobre a versão já integrada. (b) **Duas frentes criaram a MESMA
   constante** (`LIMITE_FAIXA_ETARIA`, as duas com 80) e o build só acusou no merge —
   unificada, com o porquê escrito em `compartilhado/validacao.ts`. (c) A suíte subia sempre
   na porta 3123 e duas frentes se atropelavam; `PORTA_TESTES` existe desde então, e o
   padrão continua 3123 para quem roda sozinho. **Sintoma a reconhecer:** rodar `npm test`
   com outras frentes de pé deu 235 falhas de uma vez — era disputa de porta, não regressão.

0s. **O `CLAUDE.md` foi atualizado CENTRALMENTE nessa rodada, não pelas frentes.** As seis
   foram instruídas a não tocá-lo, para não conflitarem entre si, e a escrever no relatório o
   que iria para cá. Isso funcionou, mas abre um buraco conhecido: o que não foi transcrito
   se perdeu junto com os relatórios. Se algo aqui parecer incompleto sobre eventos, doações,
   acervo, voluntários, indicadores ou o manual, a fonte é o relatório da tarefa, não o código.

0t. **O design system v1 está EM `migracao-nextjs` desde 02/09/2026** (era uma branch;
   mesclada por fast-forward, sem conflito). Ele troca a linguagem visual do site inteiro — tokens, tipografia, cabeçalho,
   gaveta, barra de acessibilidade, rodapé. Em `refine-design-system-v1` (02/09/2026) a home
   passou a bater com `index.html` do handoff e o sistema alcançou as demais telas. O que
   MUDOU nesta rodada, e o que ainda falta:

   1. **Os espaços de imagem do sistema (`.af-ph`) — PREENCHIDOS na home.** O herói (16:9 no
      celular, retrato 4:5 no desktop, via `<picture>`) e os três cartões de setor (2:1)
      agora têm foto real, em `public/imagens/`, geradas de `docs/info-venturus/` com Pillow.
      Decisão do dono do projeto: **só imagens do cofundador Wil Oliveira** — adulto, figura
      pública (imprensa nacional, Teatro Municipal). Nenhuma criança identificável vai ao ar
      (RN07, regra 9). A foto `( Ateliê Afro Cultural ).jpg.jpeg`, que mostra o rosto de uma
      criança, foi descartada. **A autorização foi confirmada pelo dono do projeto em
      02/09/2026** ("SIM FOMOS AUTORIZADOS, mas não use foto das crianças") — a regra 9 deixou
      de ser bloqueante para estas cinco.

      `.af-ph` continua em `sistema.css` SEM USO em página nenhuma, e isso é de propósito: ele
      é o espaço declarado para onde ainda não há foto. Hoje não há esse lugar; ele existe para
      o dia em que houver.

      **Uma pendência sobrou, e não é RN07:** `public/imagens/heroi-retrato.jpg` (o herói do
      desktop) tem a marca d'água "TEATRO MUNICIPAL — ADÉLIA LORENZETTI" queimada no canto.
      Isso é AUTORIA, não autorização de uso de imagem — parece crédito de fotógrafa. Decisão
      do dono em 02/09: **manter**, com o crédito visível. Registrado para que ninguém o
      recorte achando que é sujeira.
   2. **A lista "Na mídia" virou `.af-media`.** `componentes/SecaoNaMidia.ts` agora emite o
      markup do sistema (barra colorida de 6px, `af-media__item/__barra/__corpo/__titulo/
      __meta`). `testes/secao-na-midia.test.mjs` e `testes/paginas.test.mjs` foram
      atualizados. `.clipping` continua vivo em `componentes/SecaoOndeEstivemos.ts`
      (/para-escolas), que não faz parte do desenho da home.
   3. **O cabeçalho tem TRÊS faixas no desktop, o handoff desenha duas.** Ocre (marca +
      "Aa" + Entrar), creme (os controles de acessibilidade) e marrom (os 11 links). O
      handoff põe os controles dentro da faixa ocre. Para fazer isso, `.af-header` precisa
      virar grade no desktop, e a centralização em 1180px de cada faixa complica. Fica como
      está: os controles ficam VISÍVEIS no desktop, que é o princípio 6 do sistema.

   **Uma decisão do sistema que precisa ser conferida com gente de verdade:** o corpo do
   texto caiu de 17px para 14,5px (0,90625rem), que é o que o handoff especifica. A ONG
   pediu "textos grandes". O A+ recupera com folga (137,5% dá 19,9px, mais que os 17px de
   antes), mas o padrão ficou menor — e quem nunca toca no A+ é a maioria. Se o grupo achar
   pequeno, é UMA linha: `--af-body` em `estilos/tokens.css`.

0v. **A migration 009 foi APLICADA em 02/09/2026, e o efeito foi medido.**
   `supabase/migrations/009_imagem_na_atividade.sql` acrescentou `imagem_caminho` e
   `imagem_alt` a `public.atividades`.

   **Conferido contra o projeto de verdade, sem mandar chave de escrita nenhuma:** as duas
   colunas respondem no PostgREST e as onze atividades continuam válidas, com as duas nulas.
   O site parou de usar o caminho de fallback — o aviso `009_imagem_na_atividade` não aparece
   mais no log, e `/projetos` serve `data-origem-atividades="banco"`.

   **E a 008 não foi afrouxada por efeito colateral**, que era o risco. As duas respostas
   diferem exatamente como o desenho prevê: `identidade` responde `NoSuchKey` (bucket aceito,
   só falta o arquivo — ou seja, PÚBLICO) e `galeria` responde `NoSuchBucket` (PRIVADO). A
   política de INSERT de 006 segue intacta e cobre `identidade`; a 008 só mexeu na de leitura.

   **O que NINGUÉM percorreu ainda: subir uma capa de verdade.** Tentei com o remendo local, e
   a RLS recusou — corretamente: o remendo finge o `ehEquipe()` do NOSSO código, e o
   `public.eh_equipe()` do BANCO olha `auth.uid()`, que naquela sessão era anônimo. O caminho
   da FALHA ficou provado (erro no campo certo, formulário preservado, nenhum órfão no
   bucket); o do SUCESSO só quem tem sessão de equipe prova. **É um item da lista de "O que
   trava hoje" nº 3.**

0w. **Criar atividade pelo painel passou a existir, e isso AGRAVA o item 0k.** O pedido V1
   pediu "adicionar projeto", e o dono do projeto aprovou. Uma atividade criada em
   `/admin/atividades/editar` (sem `?id=`) existe **só no banco**: `dados-iniciais/
   atividades.json` não a conhece, e ninguém atualiza o repositório a partir do painel.

   **A consequência prática:** um deploy sem as variáveis do Supabase (item 0e) faz a página
   de projetos servir as onze do JSON e sumir com as novas — sem erro nenhum, sem aviso na
   tela.

   **APAGAR continua fora, e o argumento não mudou:** é o único gesto sem desfazer.
   `testes/atividades.test.mjs` falha se um `.delete(` aparecer na Action, e exige que exista
   exatamente UM `insert`. O que sustenta permitir criar é a existência da saída: uma
   atividade criada por engano pode ser TIRADA DO AR pelo botão que já existe — some da
   página, o texto fica guardado. Há teste que falha se `alternarAtividade` sumir.

   **Um achado sobre o conteúdo da ONG, que vale registrar:** o apelido (`id`) de uma
   atividade nova é derivado do título, e ele reproduz nove dos onze ids do seed. Os outros
   dois foram encurtados à mão pela ONG — "Brasil Negreiro: imaginário em liberdade" virou
   `brasil-negreiro`. Isso não é defeito da derivação; é uma pessoa decidindo que o endereço
   ficava melhor curto. A tela **não oferece editar o endereço**, porque mudar o `id` quebraria
   os links já compartilhados.

0u. **A chave Pix da tela é `chaveteste-123`, e ela NÃO PODE IR PARA O LANÇAMENTO.**
   Nasceu em 02/09/2026, a pedido do dono do projeto, para a apresentação — a decisão D7 (a
   chave real da ONG) continua pendente, porque a conta institucional ainda está sendo
   organizada.

   O QR ao lado dela também é falso, desenhado à mão em `componentes/QrCodeDeTeste.ts`, e
   **não codifica nada**: nenhum leitor o reconhece. Isso é característica, não limitação —
   um QR que parece de verdade e não funciona faz a pessoa concluir que doou.

   **Três marcas independentes dizem que é teste**, e o número é o desenho: a caixa ocre
   acima da chave, a tarja DENTRO do SVG (que sobrevive a uma captura de tela circulando por
   WhatsApp) e a legenda logo abaixo do QR, junto do gesto de apontar a câmera.

   **A trava é uma reconciliação, e foi provada nos dois sentidos** (`testes/pix.test.mjs`):
   chave que parece de teste com `PIX_E_DE_TESTE = false` reprova; chave que parece real com
   `true` também. Não dá para tirar o aviso sem trocar a chave, nem trocar a chave sem tirar
   o aviso.

   **Para o lançamento:** trocar `CHAVE_PIX` e `PIX_E_DE_TESTE` em `app/doar/page.tsx`, e
   trocar `QrCodeDeTeste` por um QR de verdade — que é decisão à parte, porque gerar QR exige
   biblioteca (regra 7) ou a imagem pronta vinda do banco da ONG. Depois disso, apagar este
   item.

0x. **`npm run test:supabase` ficou vermelho por CONTEÚDO, não por defeito — e o mecanismo que
   faltava passou a existir.** Ao percorrer o painel em 02/09/2026, a equipe publicou uma
   foto, um material, um evento e uma notícia de teste. Dez testes ficaram vermelhos de uma
   vez, todos afirmando "a tabela está vazia hoje".

   O item 0k já previa isso para as atividades — "será a suíte cobrando conteúdo, não defeito
   de código" — e previa sem ter mecanismo. Agora tem.

   **O conserto NÃO foi afrouxar a asserção**, foi cobrar o invariante certo:

       OU a lista está vazia E o estado vazio traz o texto real,
       OU a lista tem itens E o estado vazio NÃO aparece.

   As duas metades importam: sem a segunda, uma página que desenhasse itens E o "ainda não
   publicamos nada" ao mesmo tempo passaria — e é exatamente essa contradição que a pessoa
   veria na tela. `vazioOuCheio()` mora em `testes/paginas-vazias-a4.test.mjs`, e foi provado
   verde nos DOIS modos: com a tabela vazia (offline) e com ela cheia (com credenciais).

   **Se um teste voltar a supor tabela vazia, ele volta a apodrecer.** Uma suíte que fica
   vermelha por hábito é uma suíte que ninguém lê.

**Do projeto, válidos para as duas branches:**

1. **O e-mail do Supabase encolheu de bloqueador para incômodo — e a MENSAGEM DA TELA ficou
   desatualizada.** Até 30/08/2026 o projeto estava com `mailer_autoconfirm: false`, ou seja,
   todo cadastro exigia abrir um link antes de a pessoa conseguir entrar, e o envio nativo tem
   cota baixíssima (`over_email_send_rate_limit`) — os dois juntos faziam o site inteiro de
   contas estar de pé com ninguém conseguindo entrar.

   **MEDIDO em 01/09/2026 (RF11): `mailer_autoconfirm` agora é `true`.**
   `GET /auth/v1/settings` do projeto responde assim, e o comportamento bate: um `signUp`
   devolveu `access_token` na hora, e `signInWithPassword` com o mesmo par funcionou em
   seguida. Ou seja, **criar conta e entrar já funcionam de ponta a ponta, sem e-mail nenhum
   no caminho.**

   O que continua dependendo do envio, e por isso o item não sai: **recuperar senha**
   (`resetPasswordForEmail`) e **trocar de e-mail** — é por isso que `/minha-conta` não
   oferece troca de e-mail e diz isso por escrito. Saída definitiva continua sendo apontar o
   Auth para o SMTP do Brevo.

   **A PONTA SOLTA:** `MENSAGEM_CONTA_CRIADA` (`acoes/autenticacao.ts`) ainda diz "abra o link
   e depois volte para entrar — antes disso a entrada não funciona". Com autoconfirm ligado
   isso deixou de ser verdade: a pessoa já pode entrar, e a frase manda esperar um e-mail que
   não vem. Não foi corrigida pela RF11 porque é texto de OUTRA tela e a mudança de
   configuração pode não ter sido deliberada — **conferir com quem mexeu no painel do
   Supabase antes de reescrever**. Se o autoconfirm veio para ficar, a frase certa é "conta
   criada, você já está dentro".
2. **Não existe conta de administrador.** Criar pelo painel do Supabase (não precisa mais de
   *Auto Confirm User*, com `mailer_autoconfirm: true` — ver item 1) e promover com
   `update public.perfis set eh_equipe = true where email = '...'`. **Existe, desde
   01/09/2026, uma conta comum utilizável** (item 0o) — ela NÃO é equipe, e é assim que
   precisa continuar.
3. **O painel existe INTEIRO (P1 a P4, mais o RF29), e ninguém o viu pelo caminho normal.**
   A Tarefa P1 (31/08/2026) construiu a fundação: guarda, home e estilo; P2, P3 e P4
   (01/09/2026) as três telas de trabalho, e o RF29 (01/09/2026) a quinta,
   `/admin/contatos`. O que trava NÃO é mais o item 1 (entrar já funciona): é que **ninguém
   concedeu `eh_equipe` a nenhuma conta** — o item 2. Sem sessão
   de equipe NA SUÍTE, **o caminho autenticado do painel nunca foi percorrido por um teste**: a home
   do painel foi conferida
   com o navegador só depois de um remendo local temporário no `ehEquipe()`, que não foi
   commitado, e por teste de unidade do componente (`testes/painel-inicio.test.mjs`). Não
   existe porta de diagnóstico para o painel, de propósito — uma variável que abra o painel
   é uma variável que abre o painel, e as telas de P2/P3/P4/RF29 penduram dado pessoal ali. A P4
   conferiu as duas telas dela com o navegador de outro jeito, declarado no relatório:
   montando os COMPONENTES REAIS com o CSS real numa bancada local (`react-dom/server` +
   um `http` de brinquedo), a 375px e a 1280px. É a tela desenhada, não a tela servida —
   foi assim que se viu que o `<summary>` da ficha técnica tinha perdido o triângulo de
   "isto abre" por causa de um `display: flex` (regra 10 de novo).
   **O RF29 foi mais longe e mediu a tela SERVIDA**, com o mesmo remendo local não commitado
   (`ehEquipe()` devolvendo true por variável de ambiente, mais três mensagens de mentira no
   lugar da consulta): `next build` + `next start`, Firefox headless, `javascript.enabled =
   false`. O que isso provou e a bancada de componentes não provaria: o `<details>` da
   mensagem abre e fecha sem uma linha de script, e **o botão de triagem faz o POST, chega à
   Server Action, volta em 303 e a caixa de aviso aparece na lista** — no caso medido com
   `?aviso=erro`, porque a sessão do cliente era anônima e o Postgres recusou o `update`
   (`42501`, visto no log). É o mais perto do caminho autenticado que se chegou; o que
   continua sem medição é o `update` dando CERTO.
   **O QUE MUDOU EM 01/09/2026, com a RF11:** o caminho autenticado do SITE deixou de ser
   teórico — entrar, ver o próprio nome no cabeçalho, abrir `/minha-conta`, gravar e ver a
   tela mudar foi tudo medido contra o Supabase de produção, com e sem JavaScript. O que
   falta ao painel é só a permissão: **basta um `update public.perfis set eh_equipe = true`
   numa conta para as cinco telas passarem a ser mediáveis do mesmo jeito.** Isso é o item 2,
   e é uma linha de SQL no painel do Supabase — não é mais um problema de e-mail. E foi assim que se viu que o parágrafo da
   mensagem estava com o recuo dobrado a 375px (regra 10 de novo).
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

- ~~Conta de administrador que adiciona, remove e atualiza projetos, agenda, notícias e
  galeria~~ — **feito**: é o RF33, e as oito telas existem. "Remove" ficou de fora em
  atividades e eventos, de propósito e com o argumento escrito (itens 0k e 0w).
- ~~Botão flutuante de WhatsApp no canto inferior direito~~ — **feito em 02/09/2026**
  (`componentes/BotaoWhatsApp.ts`). O aviso da nota original valia: MEDIDO a 390px, o
  VLibras fica na borda DIREITA na altura do meio da tela, não no canto — o canto inferior
  estava livre. Há teste que falha se um dos dois se mover para cima do outro
  (`testes/paginas.test.mjs`), e a instrução do grupo continua valendo: mover o botão,
  nunca remover o VLibras.

**A lista está vazia.** Os pedidos que chegaram depois estão em
`docs/alterações-atelie-v1/`, e os 34 itens dela foram feitos em 02/09/2026 — menos os dois
que o próprio pedido marcou como "apenas se der tempo" (painel com gráficos e integração com
gateway de pagamento), que continuam fora.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
