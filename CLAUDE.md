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
npm test                        # suíte completa, modo offline (391 testes)
npm run test:supabase           # a mesma suíte, contra o banco real (392)
npm run test:supabase-degradado # prova que falha de consulta não vira silêncio
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

Os 391 são 381 passando, 1 pulado com motivo declarado e 9 `test.todo` — os do painel
(RF33), que descrevem requisitos válidos cuja forma de verificar só existe no Bloco B.

## Regras invioláveis

Cada uma vem do escopo e violá-la invalida a entrega.

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
- **Camada de dados isolada e só do servidor:** páginas falam com `servidor/dados/*.ts`, nunca com
  `supabase-js` direto, e todo módulo de `servidor/` começa com `import 'server-only'`.
- **Fonte dupla:** `servidor/dados/conteudo.ts` lê o JSON versionado de `dados-iniciais/` quando não
  há Supabase e a tabela quando há.
- **Insert público sem `.select()`:** em `inscricoes` e `contatos` a leitura é negada; pedir a linha
  de volta faz a inserção *parecer* que falhou.
- **Design "Aplique":** um gesto só — deslocamento sólido que simula peça costurada. Nenhuma
  textura de fundo repetida. Fontes servidas localmente, sem Google Fonts.

---

## Status por módulo

Atualizado em 30/08/2026 (fim do Bloco A da fase 2). O status descreve **esta branch**, já sem
o `site/` estático.

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
| RF08 | Cadastro de voluntário | **pronto** — mas veja "trava" abaixo |
| RF09 | Cadastro de doador | **pronto** — mesma trava |
| RF10 | Autenticação, papéis acumuláveis | **pronto** |
| RF11 | Área do usuário | **falta** |
| RF12 | Confirmação de maioridade | **pronto** |
| RF33 | Painel administrativo | **falta** — Bloco B. A casca que existia no site antigo não foi portada; `/admin` dá 404 de propósito |
| RF34 | Perfis e permissões | **pronto** e testado |

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
| RF35 | Catálogo com busca | página pronta, **sem dados** |
| RF36 | Visualização e download | **falta** |
| RF37 | Publicação de material | **falta** |
| RF27 | Mural de avisos | **falta** |
| RF28 | Mensagem para grupo | **falta** |
| RF29 | Registro central de contatos | **falta** |
| RF30–RF32 | Indicadores, CSV, PDF | **falta** — indicadores da home do painel prontos |

### Infraestrutura

| Item | Status |
|---|---|
| Banco: 15 tabelas, todas com RLS | **pronto** |
| Aceite bloqueante da seção 12 | **passa** contra o banco real |
| Seed com conteúdo real | **pronto** — 11 atividades, 14 clipping, 5 áreas |
| Acervo tratado (233 MB → 27 MB) | **pronto** |
| Política de privacidade | **pronto** |
| Repositório no GitHub | **pronto** |
| Deploy Netlify | em configuração |
| Edge Function de e-mail | **falta** |
| Manual da ONG (RNF07) | **falta** |

---

## Estado da migração para Next.js

**Decidida pelo grupo em 28/08/2026**, contra a recomendação técnica registrada na spec.
Spec: `docs/superpowers/specs/2026-08-28-migracao-nextjs-design.md`
Portão go/no-go: `docs/superpowers/plans/2026-08-28-resultado-do-portao.md` — **GO**

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
   uma única execução real na Netlify**. Não há `engines` no `package.json` nem
   `NODE_VERSION` fixado, e o TypeScript 7.0.2 nunca foi exercitado fora da máquina de
   desenvolvimento. É o maior risco de cronograma e resolve em 30 minutos.
0b. **A chave do Supabase não saiu do repositório.** A que está em `.env.local` é byte a
   byte a mesma que ficou versionada em `site/config.js` — arquivo que a Tarefa A8 apagou
   desta branch, mas que continua no histórico do git e na branch `main`. Apagar não
   rotaciona: enquanto a chave não for trocada no Supabase, o ganho declarado na spec §4.3
   é nominal.
0c. **`X-Robots-Tag: noindex` está em DOIS lugares** — `middleware.ts` e `netlify.toml`,
   ambos marcados "PRÉVIA". Se só um for removido no lançamento, o site entra no ar
   invisível para buscadores.
0d. **A suíte fica vermelha sem `.env.local`** — o teste de vazamento falha de propósito:
   um teste que não sabe o que procurar não prova nada. Quem clonar o repositório precisa
   do arquivo, ou usar só o que não depende dele.
0e. **Decisão pendente: o VLibras roda no layout raiz**, e a CSP usa `strict-dynamic`, que
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
