# Ateliê Afro Cultural — guia do projeto

Site para o **Ateliê Afro Cultural**, ONG de arte, cultura e memória afro-brasileira na Casa Verde,
zona norte de São Paulo. Fatec Innovation Challenge.

**Fonte de verdade do escopo:** `PLANO-PROJETO-ATELIE-AFRO-CULTURAL.md`
**Decisões de implementação:** `docs/superpowers/specs/2026-08-24-atelie-afro-cultural-design.md`
**Migração para Next.js (decidida em 28/08/2026):** `docs/superpowers/specs/2026-08-28-migracao-nextjs-design.md`
— até o portão go/no-go do passo 2 ser vencido, `main` continua sendo o site que vai ao ar
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

**Na branch `migracao-nextjs`** (Next.js — ver "Estado da migração" abaixo):

```bash
npm test                        # suíte completa, modo offline (235 testes)
npm run test:supabase           # a mesma suíte, contra o banco real (236)
npm run test:supabase-degradado # prova que falha de consulta não vira silêncio
npm run verificar-deploy        # guardião: barra deploy inseguro
npm run rls                     # políticas de segurança contra Postgres real
npx next dev                    # servir o site
npx @axe-core/cli http://localhost:3000/ --browser firefox   # acessibilidade
```

O modo offline é o padrão **de propósito**: ele roda sem rede, sem `.env.local`, e é
determinístico. O `test:supabase` é o que exercita a camada de dados de verdade — sem
ele, o site pode servir o JSON versionado com o Supabase configurado e ninguém saber.

**Na branch `main`** (site estático, o que está no ar hoje):

```bash
node --test                  # suíte completa (217 testes)
python3 -m http.server 8080 --directory site
```

Comuns às duas:

```bash
node ferramentas/gerar-seed.mjs      # regenera supabase/seed.sql dos JSON
./ferramentas/gerar-sql-completo.sh  # junta migrations + seed num arquivo
```

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
7. **Sem framework nem bundler.** HTML, CSS e JS puros, módulos ES nativos.
8. **Acessibilidade é requisito**, não preferência: a ONG pediu "áudio, textos grandes, contraste".
   Nunca trocar acessibilidade por estética — em particular, não usar `vw` em texto, que ignora o
   controle A+.
9. **Nenhuma foto no ar sem autorização de uso de imagem registrada** (RN07). O público inclui
   crianças a partir de 10 anos.
10. **Verificar olhando.** Bateria de testes não substitui abrir a página. Dois defeitos visíveis
    passaram por 216 testes verdes.

## Arquitetura em uma tela

- **Multi-página estático.** Cada página é um `.html` real; cabeçalho e rodapé são custom elements
  sem Shadow DOM (o Shadow DOM quebraria os controles globais de fonte e contraste).
- **Navegação sem JavaScript** fica num `<noscript>` no HTML estático de cada página — nunca dentro
  de um componente, que só existe se o script rodar.
- **Camada de dados isolada:** páginas falam só com `site/assets/js/dados/*.js`, nunca com
  `supabase-js` direto.
- **Fonte dupla:** `conteudo.js` lê JSON versionado quando não há Supabase e a tabela quando há.
- **Insert público sem `.select()`:** em `inscricoes` e `contatos` a leitura é negada; pedir a linha
  de volta faz a inserção *parecer* que falhou.
- **Design "Aplique":** um gesto só — deslocamento sólido que simula peça costurada. Nenhuma
  textura de fundo repetida. Fontes servidas localmente, sem Google Fonts.

---

## Status por módulo

Atualizado em 28/08/2026.

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
| RF33 | Painel administrativo | **casca pronta** — só a home |
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

**Duas versões do site coexistem, e é preciso saber em qual se está mexendo:**

| | `main` | `migracao-nextjs` |
|---|---|---|
| O que é | site estático em `site/` | Next.js 16 + TypeScript |
| Está no ar | **sim** | não — nunca publicada |
| Páginas | 15 | **3** (`/quem-somos`, `/privacidade`, `/para-escolas`) + home casca |
| Testes | 217 | 235 (offline) / 236 (com banco) |

**Os 12 requisitos que só existem em `main`:** RF01 (home), RF03 (projetos), RF04, RF05,
RF06 (contato), RF08–RF12 (contas e acesso), RF14 (agenda), RF23 (doar), RF24
(voluntariado), RF33 (painel), RF35 (acervo). Na branch nova essas rotas dão **404**.

Os 404 são intencionais nesta fase e vigiados por `testes/links-menu.test.mjs`, que
separa `ROTAS_PRONTAS` de `ROTAS_PENDENTES` e falha nos dois sentidos — cada página
migrada obriga a mover a rota de lista.

### O que a fase 1 entregou além das 3 páginas

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
   byte a mesma de `site/config.js`, ainda no formato JWT antigo. Enquanto não for
   rotacionada, o ganho declarado na spec §4.3 é nominal.
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
3. **Sete páginas do painel são prometidas e só `index.html` existe** — `eventos`, `presenca`,
   `contatos`, `mais`, `doacoes`, `publicacoes`. Os links quebram para quem está autenticado, e o
   teste de links não pega porque o painel redireciona sem sessão. **Lacuna de teste conhecida.**
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
