# Ateliê Afro Cultural — guia do projeto

Site para o **Ateliê Afro Cultural**, ONG de arte, cultura e memória afro-brasileira na Casa Verde,
zona norte de São Paulo. Fatec Innovation Challenge.

**Fonte de verdade do escopo:** `PLANO-PROJETO-ATELIE-AFRO-CULTURAL.md`
**Decisões de implementação:** `docs/superpowers/specs/2026-08-24-atelie-afro-cultural-design.md`
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
node --test                  # suíte completa (217 testes)
npm run verificar-deploy     # guardião: barra deploy inseguro
npm run rls                  # políticas de segurança contra Postgres real
python3 -m http.server 8080 --directory site   # servir o site
npx @axe-core/cli http://localhost:8080/ --browser firefox   # acessibilidade
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

## O que trava hoje

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
