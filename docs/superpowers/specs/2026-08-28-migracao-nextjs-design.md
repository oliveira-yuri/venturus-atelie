# Migração para Next.js — decisões de implementação

Data: 28/08/2026
Estado: aprovado para planejamento

## 1. Contexto e como esta decisão foi tomada

O site do Ateliê Afro Cultural é hoje estático puro: 15 páginas HTML, 7 custom
elements, 29 arquivos JS, 1.066 linhas de CSS, 217 testes. Publica na Netlify,
dados no Supabase, proteção por Row Level Security.

O grupo decidiu migrar para Next.js pela renderização no servidor.

Registro honesto do caminho: a recomendação técnica foi **não migrar antes de
04/09**, porque as vantagens de segurança do servidor podiam ser compradas por
cerca de 4 horas de trabalho no stack atual (corrigir 16 `innerHTML`, acrescentar
política de conteúdo, testar o limite anti-robô), contra 6 a 8 dias de migração.
O grupo avaliou e decidiu migrar. Esta spec existe para que a migração dê certo.

**Consequência aceita:** os 22 requisitos ainda não construídos continuam não
construídos em 04/09.

## 2. Decisões travadas

| Decisão | Escolha | Alternativas descartadas |
|---|---|---|
| Quanto de servidor | O navegador nunca fala com o Supabase | Só build (`output: export`); servidor com RLS mantendo consulta pelo cliente |
| Estratégia | Big bang em branch, um deploy no fim | Página por página; pré-visualização paralela |
| Linguagem | TypeScript | JavaScript; TS só nas rotas |
| Forma da camada de servidor | Server Components + Server Actions | Route Handlers como API interna; híbrido |

Versões verificadas em 28/08/2026: Next 16.3.3, React 19.2.8,
`@netlify/plugin-nextjs` 5.15.13, `@supabase/ssr` 0.12.5, `supabase-js` 2.112.4,
Node 24.15 (local).

## 3. Arquitetura

```
app/
  layout.tsx              raiz: <html lang="pt-BR" suppressHydrationWarning>,
                          CSS global, fontes locais, script anti-piscada
  page.tsx                quem-somos/  projetos/  agenda/  noticias/  galeria/
                          acervo/  para-escolas/  voluntariado/  doar/  contato/
                          privacidade/  entrar/  recuperar-acesso/
  auth/confirm/route.ts   recebe token_hash da recuperação de senha (PKCE)
  admin/
    layout.tsx            página do painel; a guarda real está no middleware
    page.tsx

componentes/   Cabecalho (servidor)      MenuMovel (cliente)
               Rodape (servidor)         Acessibilidade (cliente)
               CardAtividade (servidor)  CampoFormulario (cliente)
               VLibras (cliente, DOM fora da árvore do React)

servidor/
  supabase.ts             cliente com a sessão da pessoa, lida de cookie
  sessao.ts               lê a sessão, responde "é equipe?"
  dados/*.ts              os 7 módulos de hoje, com import 'server-only'

acoes/                    Server Actions: inscricao.ts, contato.ts, auth.ts
compartilhado/            validacao.ts, preferencias.ts, erros.ts
estilos/                  as 1.066 linhas de CSS
middleware.ts             renova sessão, aplica CSP com nonce, protege /admin
```

**Atravessa quase intacto:** CSS (com 6 seletores a ajustar, ver 3.2), os JSON de
conteúdo real, as migrations SQL, e `validacao`/`preferencias`/`erros`, que já são
funções puras.

**Reescrito:** as 15 páginas em JSX, os 7 custom elements em componentes, e os 9
scripts de página, que deixam de existir.

### 3.1 Divisão servidor/cliente

Apenas 4 componentes são de cliente: `MenuMovel` (estado aberto/fechado),
`Acessibilidade` (`localStorage`), `CampoFormulario` e `VLibras`. O resto renderiza
no servidor. Efeito colateral bom: a navegação passa a existir no HTML entregue, e
o `<noscript>` hoje duplicado em 15 arquivos deixa de ser necessário.

### 3.2 CSS: os 6 seletores por nome de tag

Medido, não estimado. `aac-card-atividade` (2 ocorrências em `componentes.css`),
`aac-form-campo` (3), `aac-nav-admin` (1 em `admin.css`). Esses seletores param de
casar quando o componente passa a renderizar `<article class="...">`. São 6 de
~1.066 linhas.

Nenhum custom element usa Shadow DOM próprio, então não há CSS órfão. A única
menção a `shadowRoot` no projeto é o código que atravessa o Shadow DOM **do
VLibras** para corrigir imagens sem `alt` — ver 5.3.

**Sem CSS Modules e sem Tailwind.** A acessibilidade depende da cascata global
(`--escala-fonte` no `html`, seletores `[data-contraste="alto"]`, `rem` em todo
texto); o CSS já foi auditado com axe-core e teve dois defeitos visuais corrigidos
com o usuário olhando a tela; e o RNF07 diz que a ONG mantém depois.

**Sem `next/font`.** Ele renomeia as variáveis de fonte e mexeria em CSS calibrado,
em troca de otimização que 88 KB de fonte local não precisa. Fica o `fontes.css`
atual com `@font-face` apontando para `/fontes/`.

### 3.3 URLs

`/quem-somos.html` vira `/quem-somos`. Os 15 redirecionamentos entram no
`next.config`. Ver 7.3 para a armadilha do arquivo esquecido em `public/`.

## 4. Segurança

### 4.1 Uma chave só

`servidor/supabase.ts` usa a chave publicável mais o token da pessoa, lido do
cookie via `@supabase/ssr`. Consulta como aquela pessoa: **o RLS continua sendo
quem decide o que ela vê.**

**Não existe `supabase-admin.ts` neste projeto.** Ao mapear os casos de uso, nenhum
precisou furar o RLS — inclusive a inscrição sem conta funciona com o cliente
anônimo, como funciona hoje. Um arquivo morto com a chave secreta é pior que
arquivo nenhum: a variável passaria a existir na Netlify, apareceria em log de build
de qualquer script que rode `printenv`, e ficaria a um typo de `NEXT_PUBLIC_` de
vazar.

**Regra:** no dia em que alguém precisar de verdade da chave que ignora o RLS, o ato
de criar o arquivo é o alarme. Criar custa dois minutos. Um comentário obrigatório
num arquivo que já existe é um alarme que ninguém é obrigado a ler.

### 4.2 Os dois portões

Enquanto toda leitura passar pela sessão da pessoa, o código da rota e a política do
banco são um **E**: a requisição precisa sobreviver aos dois, e o efetivo é o mais
restritivo. Os dois modos de divergência são chatos e seguros — rota libera e RLS
nega dá tela vazia; rota nega e RLS libera dá acesso negado indevido.

Isso vira um **OU**, com o mais permissivo vencendo, no dia em que a primeira rota
usar a chave que ignora o RLS. É por isso que essa chave não existe aqui.

### 4.3 O que melhora só por mudar de lugar

- A chave sai do repositório e do navegador. Hoje está versionada em
  `site/config.js` e é entregue a todo visitante. Vira variável de ambiente do
  servidor, **sem `NEXT_PUBLIC_`**.
- O `esm.sh` desaparece. Hoje o `supabase-js` é baixado de um CDN de terceiro a cada
  visita. Vira dependência npm que nunca chega ao navegador. Um terceiro a menos na
  política de privacidade — que precisa ser atualizada.
- Os 16 `innerHTML` deixam de existir: React escapa texto por construção.

### 4.4 `server-only` é garantia de compilador, não de convenção

Cada módulo em `servidor/dados/` começa com `import 'server-only'`. Se alguém
importar um desses num componente de cliente, **o build falha**.

Limite conhecido: o pacote usa exports condicionais — com a condição `react-server`
ativa carrega um arquivo vazio; sem ela, carrega um `throw`. Consequência para os
testes em 6.1.

### 4.5 `acoes/` são endpoints HTTP públicos

Server Action não é função privada de página. Qualquer pessoa que descubra o ID da
action faz POST direto, sem passar por tela nenhuma. `server-only` garante que o
*código* não vai para o navegador; não garante que a *chamada* venha de onde se
espera.

**Portanto cada action revalida entrada e permissão por conta própria, como rota de
API — porque é.** Vale para `inscricao.ts`, `contato.ts` e `auth.ts`. Teste
correspondente em 6.2.

### 4.6 Rate limit: o balde global

`005_contencao.sql` limita a 10 envios por hora por origem, identificando a origem
pelo `x-forwarded-for` que o PostgREST expõe em `request.headers`.

**No desenho novo quem faz a requisição ao Supabase é o servidor da Netlify**, então
esse cabeçalho passa a ser o mesmo para todo mundo. O limite não fica fraco: vira um
balde global de 10/hora para o site inteiro. Um spammer esgota a cota de todos, e
depois de 10 inscrições legítimas ninguém mais se inscreve. É negação de serviço
contra quem usa.

**Conserto (migration 007):** o servidor lê o IP real do visitante
(`x-nf-client-connection-ip` na Netlify, `x-forwarded-for` no `next dev` local),
calcula o hash SHA-256 e passa a origem como **parâmetro explícito** da função.
Determinístico e testável.

Quando nenhum dos dois existir, a origem é gravada como `desconhecida` — e todos os
envios sem IP identificável compartilham um balde, que é o comportamento seguro:
degrada para o limite global de hoje em vez de desligar o limite.

Descartado: injetar cabeçalho próprio no cliente do Supabase e esperar que o gateway
não reescreva. Depende de infraestrutura de terceiro e exigiria medição.

**Revisar o próprio limite na mesma migration.** 10/hora por IP agrupa
desconhecidos atrás de CGNAT de operadora móvel, e o site tem página
`para-escolas`: uma turma inscrevendo do laboratório da escola sai por um IP só e
estoura em 10. Bug de hoje, não da migração, mas é a hora de olhar.

### 4.7 Chaves no formato novo

O projeto está nas chaves legadas (JWT `eyJ...` com `"role":"anon"`). As chaves
`anon` e `service_role` serão descontinuadas até o fim de 2026; o recomendado são
`sb_publishable_...` e `sb_secret_...`. A publicável tem os mesmos privilégios
baixos da anon, então o RLS se comporta igual. Como o projeto está sendo reescrito de
qualquer jeito, começar já nas novas evita fazer duas vezes. Ver 9.

## 5. Acessibilidade e hidratação

Maior risco técnico da migração. A acessibilidade é requisito da ONG.

### 5.1 O script anti-piscada e o `<html>`

Continua sendo script inline clássico no `<head>` do `layout.tsx`.

**`suppressHydrationWarning` no `<html>` é obrigatório, não opcional.** No App Router
o `<html>` vem do `layout.tsx` e está dentro da árvore do React; os atributos dele são
comparados na hidratação, e o script acabou de acrescentar `data-contraste` e a
variável de escala que não estavam no HTML do servidor. Sem a supressão há aviso e
risco de remontagem. A supressão vale um nível só — o `<html>` e seus atributos, não
os descendentes — que é exatamente o escopo necessário.

### 5.2 CSP com nonce

**Nonce, não hash.** O App Router injeta os próprios scripts inline com o payload
RSC (`self.__next_f.push(...)`), cujo conteúdo varia por página e por render — não
há hash a pré-calcular. A alternativa seria `'unsafe-inline'`, que anula a política.
Existe contorno via script de pós-build que extrai os inline e reescreve o HTML;
descartado por ser peça frágil num projeto que outra pessoa vai manter.

**Custo real, declarado com precisão:** qualquer página que use `servidor/supabase.ts`
lê cookie e **já é dinâmica de qualquer jeito**. O nonce só encarece as três páginas
que seriam de fato estáticas: `quem-somos`, `privacidade`, `para-escolas`.

### 5.3 VLibras

Dois problemas independentes.

**CSP.** Não basta `script-src`. O nonce vai na própria tag `<script src>` do
VLibras: com `'strict-dynamic'` as fontes por host em `script-src` são **ignoradas**,
então liberar o domínio do governo ali não vale nada — o nonce na tag propaga
confiança para o que ele carregar, que é o comportamento desejado. `connect-src` e
`img-src` não sofrem com `strict-dynamic` e continuam precisando do host na lista.
Verificar se o player exige `wasm-unsafe-eval` medindo com o console aberto, não
deduzindo: se a política ficar curta, ele falha em silêncio.

**React.** Ele injeta DOM por fora. Vai em componente de cliente com `ref`, conteúdo
vazio e `suppressHydrationWarning`, para a reconciliação nunca disputar os nós dele.

**Não perder na migração:** a correção que atravessa o `shadowRoot` do VLibras para
dar `alt` às imagens dele mora hoje em `aac-rodape.js`. Se ficar para trás, as 3
violações de acessibilidade voltam.

### 5.4 Hidratação do componente de acessibilidade

Os 4 botões têm estado visual vindo do `localStorage`, que o servidor não conhece.
O servidor renderiza **sempre no estado neutro** e um `useEffect` sincroniza depois.
A aparência correta já foi aplicada pelo script anti-piscada no `<html>`, então
ninguém vê o tamanho errado — só o botão leva um instante para se marcar como ativo.

### 5.5 Navegação do roteador: regressão possível

Hoje cada navegação é carregamento completo, o cenário ideal para leitor de tela: o
foco volta ao topo, o título novo é anunciado. Com o roteador do App Router a
navegação vira parcial, e foco e anúncio de rota passam a poder falhar em silêncio.

Nenhum teste atual pega isso: `paginas.test.mjs` conta botões, `navegador.test.mjs`
verifica escala e contraste. Ver 6.2 e 8.

### 5.6 Duas regras do CSS que nenhum teste pega

- **Nada de `vw` em texto** — ignora o controle A+, que é o requisito que a ONG pediu.
- **`hyphens: manual` pareado com `overflow-wrap: break-word`** — já está assim em
  `base.css:26-27`. O primeiro evita "perten-cimento" partido; o segundo evita que
  palavra longa transborde o container no A+ a 200%, que seria falha de refluxo.

## 6. Testes

### 6.1 O que atravessa

| Arquivo | Linhas | Situação |
|---|---|---|
| `rls` | 464 | Intacto. Só builtins + `embedded-postgres`, fala com o Postgres direto |
| `validacao` | 129 | Muda o caminho do import para `compartilhado/` |
| `conteudo` | 92 | Muda o caminho dos JSON |
| `preferencias` | 76 | Muda o caminho do import |
| `erros` | 52 | Muda o caminho do import |
| `seguranca` | 147 | **Muda mais que o import** — ver abaixo |

**Nenhum dos seis importa de `servidor/dados/`.** Verificado por inspeção dos
imports. Portanto o aceite bloqueante **não depende** de
`node --test --conditions=react-server`. Essa flag só passa a ser necessária se
nascer teste que importe a camada de dados diretamente — e nesse caso ela entra no
`npm test`, com validação no passo 3, nunca no fim.

**`seguranca.test.mjs` precisa de ajuste real:** ele lê `site/config.js` com
`readFileSync`, e esse arquivo deixa de existir. Passa a ler variável de ambiente.
É uma linha, mas é o aceite bloqueante da seção 12 — merece precisão em vez de
"sobrevive sem tocar".

`rls` e `seguranca` continuam provando o mesmo, contra o mesmo banco.

### 6.2 O que muda de arranjo

`navegador` (233), `paginas` (216), `painel` (254), `links` (100),
`sem-javascript` (91). Muda o bloco `before`; as asserções ficam.

`node --test` roda cada arquivo em processo separado, e subir o Next cinco vezes é
lento demais. O `npm test` passa a construir uma vez, subir um servidor, exportar a
URL por variável de ambiente e rodar tudo contra ele.

### 6.3 Testes novos: promessa versus o que de fato observam

| Teste | O que observa | O que isso prova — e o que não prova |
|---|---|---|
| Varredura de `.next/static` **e do HTML renderizado das 15 páginas** por URL/chave do Supabase | Strings nos artefatos de cliente e no payload RSC embutido no HTML | Prova que nem o código nem o dado saíram. `.next/static` sozinho seria insuficiente: se um Server Component passar objeto do Supabase como prop para componente de cliente, o dado sai serializado em `self.__next_f.push(...)` no HTML e não encosta em `.next/static` |
| POST direto numa Server Action sem permissão | Código de resposta e efeito no banco | Prova que aquela action revalida. **Não** prova que as outras revalidam — precisa de um caso por action |
| Dois visitantes distintos ocupam baldes distintos | Contagem em `envios_recentes` por origem após dois envios com IPs diferentes | Prova que a origem chega individualizada ao banco |
| Foco após navegação do roteador | `document.activeElement` e `document.title` após clique no cabeçalho | Prova onde o foco parou. **Não** prova o que o leitor de tela anuncia — ver 8 |
| Nonce presente e VLibras carrega sob a política | Cabeçalho da resposta, ausência de erro de CSP no console, botão do VLibras presente | Prova que a política não quebrou o plugin |
| As 15 URLs antigas redirecionam | Código 301/308 e destino | Prova o redirect. Só vale com o teste de `public/` limpo (7.3) |

## 7. Deploy

### 7.1 Netlify

`netlify.toml` declara `@netlify/plugin-nextjs` 5.15.13, `command = "next build"`,
e o `publish` sai de `site/`.

### 7.2 A armadilha das dependências

Hoje o `NPM_FLAGS = "--omit=dev"` existe porque o `embedded-postgres` baixa binários
do PostgreSQL e **já derrubou o build de vocês uma vez**.

Mas `typescript` e os `@types/*` são devDependencies e o `next build` precisa deles.
Manter `--omit=dev` como está **quebra o build**. Duas saídas, a decidir no passo 1:

- subir `typescript` e `@types/*` para `dependencies` — feio, honesto, funciona; ou
- abandonar `--omit=dev` e conter o `embedded-postgres` por `optionalDependencies`
  ou por um `postinstall` que pula o download quando `CI` está setado.

**Recomendado: a primeira.** Subir `typescript` e `@types/*` para `dependencies` é
semanticamente feio, mas preserva intacta a proteção que já salvou o build de vocês
uma vez. A segunda saída mexe justamente na trava do `embedded-postgres` para
resolver um problema que não é dele.

O passo 1 resolve isso em dez minutos. Está escrito aqui para ninguém perder uma
tarde.

Variáveis no painel da Netlify, nenhuma com `NEXT_PUBLIC_`: `SUPABASE_URL` e a chave
publicável.

### 7.3 O guardião de deploy, reduzido ao que é verificável

`verificar-antes-do-deploy.mjs` fica com:

- os **valores** das variáveis de ambiente (chave secreta em lugar errado, chave com
  `role` errado)
- a varredura de HTML e artefatos de 6.3
- as tabelas sem RLS e sem grant explícito, como hoje
- **falhar se sobrar qualquer `.html` em `public/`** — o `next.config` não redireciona
  caminho que existe como arquivo, então um `quem-somos.html` esquecido derruba o
  redirect correspondente sem avisar

**Removido do plano:** procurar "import de `servidor/`" nos artefatos construídos.
Depois do bundle os caminhos de módulo não existem mais; o check passaria sempre, em
silêncio. Guardião que dá luz verde sem olhar é pior que guardião nenhum.

## 8. Ordem de execução e o portão

Big bang só é seguro se der para descobrir cedo que deu errado, enquanto `main` ainda
tem site funcionando.

1. Esqueleto do Next, resolver 7.2, **deploy vazio em branch deploy** — provar o
   pipeline antes de portar qualquer coisa
2. **VLibras + acessibilidade + CSP com nonce + hidratação do `<html>`** ⟵ portão
3. Camada de dados no servidor, `server-only`, validação da flag de teste (6.1), e o
   teste de varredura (6.3)
4. As 15 páginas e os 6 seletores de CSS
5. Auth com PKCE, `app/auth/confirm/route.ts`, template de e-mail com `token_hash`
6. Painel com a guarda no middleware
7. Migration 007 — origem por parâmetro explícito e revisão do limite
8. Redirects, guardião de deploy, política de conteúdo final

**Os passos 1 e 2 rodam em branch deploy, não no site de produção.** Se o passo 1
reescrever o `netlify.toml` da produção, "voltar para `main`" vira rollback de
configuração da Netlify, não só de git. O portão só é barato se a volta for barata.

### 8.1 Critério de falha do portão, em termos verificáveis

O passo 2 é go/no-go. Aborta se **qualquer** um destes não for verdade ao fim de um
dia de trabalho:

- O botão do VLibras aparece na home e, ao ser clicado, o player abre
- O console não registra nenhum `Refused to execute` nem `Refused to connect` em
  nenhuma das 15 páginas
- `npx @axe-core/cli` retorna **0 violações** na home, como retorna hoje
- Após clicar em "Quem somos" no cabeçalho: `document.title` mudou **e**
  `document.activeElement` é o `<h1>` da página nova (não o `<body>`, não o link
  clicado)
- Nenhum aviso de divergência de hidratação no console em `/`, `/entrar` e
  `/quem-somos`
- A escala de fonte escolhida persiste após navegação **do roteador**, não só após
  recarga completa

Abortar significa voltar para `main`, que continua publicável, e gastar os dias
restantes nos requisitos que faltam.

**Verificação com leitor de tela real (NVDA ou Orca) é tarefa manual do passo 2, com
resultado registrado.** O axe-core analisa página parada; a falha de 5.5 só existe na
transição.

## 9. Dependências externas — pedir hoje, não no dia do passo 5

Não estão sob controle de quem desenvolve, e estão no meio da ordem de execução.
Ambas dependem da mesma pessoa no mesmo dashboard do Supabase:

1. **Confirmar que o projeto está em fluxo PKCE e trocar o template de e-mail de
   recuperação para `token_hash`.** No fluxo implícito o token chega no fragmento da
   URL (`#access_token=...`), que o navegador nunca envia ao servidor — num site que
   passa a ser todo servidor, recuperação de senha simplesmente não funciona.
2. **Verificar se `sb_publishable_` está disponível para o projeto e rotacionar**
   (ver 4.7).

Continuam pendentes de antes da migração: SMTP do Brevo (o limite de e-mail nativo
bloqueia todo cadastro hoje), conta de administrador, validação de conteúdo com a
ONG, autorizações de uso de imagem, logotipo vetorial, chave Pix.

## 10. O que fica fora

Os 22 requisitos não construídos. Em 04/09 a entrega são **os mesmos 17 requisitos
de hoje, reconstruídos**, mais: o navegador não fala com o banco, os 16 `innerHTML`
não existem, a chave saiu do repositório e do navegador, o painel é protegido antes
de o HTML sair do servidor, há política de conteúdo, e o balde global de rate limit
foi consertado (bug que existe hoje).

## 11. Riscos conhecidos

| Risco | Mitigação |
|---|---|
| Acessibilidade degrada na navegação parcial | Portão do passo 2 com critério verificável (8.1) + leitor de tela real |
| VLibras não carrega sob CSP | Medido no passo 2, antes de qualquer página ser portada |
| Autorização passa a existir em dois lugares | Consulta pela sessão da pessoa mantém o banco como guarda final (4.2) |
| Server Action chamada direto | Revalidação em cada action (4.5) + um teste por action (6.3) |
| Prazo estoura | Portão do passo 2; `main` permanece publicável; passos 1-2 em branch deploy |
| Dependência externa atrasa o passo 5 | Pedido feito junto com esta spec (9) |
