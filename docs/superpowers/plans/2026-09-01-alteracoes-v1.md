# Alterações V1 — planejamento

**Fonte:** `docs/alterações-atelie-v1/` (o markdown do Notion + 6 capturas de tela).
**Escrito em:** 01/09/2026, contra o commit `9434690`, com o site já no ar em
`https://venturus-atelie.vercel.app`.
**Status deste documento:** proposta. Nada foi implementado.

---

## 1. O tamanho real do pedido

São **37 itens**. Contei um a um, atribuí tamanho olhando o código que cada um toca, e
somei: **entre 9 e 13 dias de trabalho**, sem contar o que depende de material que a ONG
ainda não entregou.

A entrega é **04/09/2026**. Faltam três dias.

Isso não é motivo para recusar nada — é motivo para **ordenar**. O plano abaixo separa o
que cabe do que não cabe, e diz por quê. A escolha final do corte é do grupo; o que eu
posso fazer é entregar o corte com o preço de cada linha escrito ao lado.

---

## 2. O que eu medi antes de planejar

Sete descobertas que mudam o plano. Todas verificadas no código, não deduzidas.

| # | Achado | Consequência |
|---|---|---|
| 1 | `publicacoes.imagem_caminho` e `imagem_alt` **já existem** (`002_conteudo.sql:44-45`), com `check` exigindo alt junto da imagem | "Imagem na notícia" **não precisa de migration**. É formulário + upload + render. |
| 2 | `atividades` **não tem** coluna de imagem | "Imagem no projeto" **precisa de migration** — e migration neste projeto é uma pessoa colando SQL no painel do Supabase. |
| 3 | `midia.publicacao_id` existe; **`atividade_id` não** | "Menção ao projeto da foto" ou usa o campo `album` (sem migration) ou pede coluna nova. |
| 4 | `doacoes.tipo` já aceita `item` e `recurso_financeiro`; `valor` já existe | O fluxo de dinheiro **cabe no esquema atual**, menos o "marquei que paguei", que é situação nova → migration. |
| 5 | `perfis` **não tem CPF nem CNPJ** | O filtro "cpf/pj" na tela de voluntários exige coluna nova + decisão de LGPD. Não é só tela. |
| 6 | `testes/paridade-texto.test.mjs` compara o `<main>` de **11 rotas públicas** palavra por palavra com o HTML congelado do site antigo | **Qualquer redesenho que mude TEXTO em página pública deixa a suíte vermelha.** É o maior obstáculo escondido deste pedido. |
| 7 | Nenhuma lista do painel tem paginação, filtro ou recolhimento. Zero ocorrências de `range(`, `limit`, `offset` em `servidor/dados/` | Paginação é trabalho novo em **9 telas**, não um ajuste. |

Duas observações que valem tanto quanto os achados:

- **A máscara de telefone existe** (`formatarTelefone`, `compartilhado/validacao.ts:60`) e é usada
  em **dois** formulários: `AbasEntrar` e `FormularioMeusDados`. Não está em contato,
  candidatura, nem no registro de doação. O pedido está certo, e o conserto é barato porque a
  função já está escrita e testada.
- **`/admin/galeria` e `/admin/acervo` desenham o formulário de envio acima da lista, sempre.**
  É exatamente o que o pedido manda esconder atrás de um botão.

---

## 3. As dez decisões que travam trabalho

Nenhuma destas é minha. Cada uma muda o que se constrói, e várias mudam se dá para construir.

### D1 — O teste de paridade de texto: o que fazer com ele

`paridade-texto.test.mjs` existe para provar que **nenhuma palavra da ONG se perdeu na
migração**. Ele fez o trabalho dele: pegou `e-mailatelieafro@gmail.com` quando ninguém
estava olhando.

Agora ele vira obstáculo: "pequenos blocos com saber mais" em `/projetos` e `/noticias`,
nomes dos fundadores em `/quem-somos`, o mapa — tudo isso muda o `<main>`.

Três saídas:

- **(a) Rebaselinar** — congelar o HTML de HOJE como novo original. Barato, e joga fora a
  garantia: a partir daí o teste só prova que a página não mudou desde ontem.
- **(b) Trocar a natureza do teste** — de "o `<main>` é idêntico" para "**toda frase do
  original ainda aparece em algum lugar do site**". Mais caro (meio dia), e mantém a
  garantia que importa: texto da ONG não some. **É o que eu recomendo.**
- **(c) Excluir rota por rota**, como já se faz com as listas dinâmicas. Barato por rota,
  mas ao fim do redesenho o teste não cobre mais quase nada — e ninguém percebe.

> **Sem esta decisão, o Bloco D inteiro não começa.**

### D2 — Popup sem JavaScript

O pedido quer confirmação em popup para **todas** as ações, e confirmação dupla para as
destrutivas. Este site funciona sem JavaScript por requisito, medido rota a rota
(`testes/sem-javascript.test.mjs`). `confirm()` não existe sem script — foi por isso que
`/admin/galeria/apagar` nasceu como **página** de confirmação.

Proposta: **um padrão só**, `<dialog>` com aprimoramento progressivo.

- Com script: o botão abre o `<dialog>`, a pessoa confirma ali, um toque.
- Sem script: o mesmo botão é um link para a página de confirmação que já existe.
- Destrutivo: a confirmação exige **digitar a palavra** (o nome do que se apaga), não só um
  segundo clique — dois cliques seguidos no celular são um gesto só.

Preciso do aval porque isso vira o padrão de ~15 telas, e mudar depois é caro.

### D3 — Fotos: a regra 9

"Colocar imagens dos projetos", "imagens dos fundadores", "melhorar o design com imagens".

**Nenhuma foto vai ao ar sem autorização de uso de imagem registrada (RN07/regra 9).** O
público inclui crianças a partir de 10 anos. Em `material-origem/` há 7 imagens, e nenhuma
delas veio com autorização.

O que dá para fazer **sem asset nenhum**: ícones. SVG desenhado à mão, inline, sem
biblioteca, sem autorização. Cobre "ícones nas redes sociais", "ícones nos tipos de contato",
e boa parte do "melhorar o design".

O que **não** dá: fotos de projeto, fotos de fundadores. Isso é a ONG entregar arquivo +
autorização assinada.

### D4 — Logo no rodapé

`CLAUDE.md` registra: o logotipo só existe bordado nas camisetas, em baixa qualidade. Por
isso a marca é tipográfica. Se existe um vetor, ele resolve o item do rodapé **e** o ícone
do navegador de uma vez. Se não existe, o ícone do navegador vira um desenho tipográfico
(as iniciais no amarelo da ONG) — que é honesto e leva 30 minutos.

### D5 — Chave Pix e QR Code

O fluxo de doação em dinheiro pede: escolher valor → ver chave Pix e QR Code → marcar que
pagou.

Duas faltas:
- **A chave Pix não existe** no projeto (decisão D7, pendente desde o começo). Sem ela, a
  tela mostra o aviso que já mostra hoje.
- **QR Code precisa ser gerado.** A regra 7 proíbe biblioteca de UI; um gerador de QR não é
  UI, mas é biblioteca. Ou o grupo abre exceção (`qrcode`, ~20 KB, roda no servidor e cospe
  SVG), ou a ONG entrega o QR como imagem estática, ou o site mostra só a chave copiável.
  **Recomendo a exceção**: QR estático amarra o valor, e chave copiável no celular é um
  gesto pior.

### D6 — CPF/CNPJ

O filtro de voluntários pede "cpf/pj". Hoje não se coleta documento em lugar nenhum.
Coletar CPF significa: coluna nova, validação, e um dado sensível a mais na tela que já é a
mais exposta do painel (item 0h do `CLAUDE.md`). **Recomendo adiar** — o filtro por nome,
e-mail, área e situação resolve o problema real (achar uma pessoa na lista) sem coletar
documento de ninguém.

### D7 — Admin criando projeto

Hoje `/admin/atividades` **edita e não cria**, por decisão registrada: as 11 atividades
vieram da ONG pelo seed, apagar não tem desfazer, e criar sem poder apagar deixa a equipe
sem saída depois de um toque errado no celular.

O pedido quer o botão "Adicionar projeto". Dá para fazer, e o preço é conhecido: **agrava o
item 0k** (a fonte dupla). Uma atividade criada pelo painel existe só no banco; se o
Supabase cair ou o deploy subir sem as variáveis, ela some da página e ninguém é avisado.

Se for aprovado, vem junto: criar **e** apagar (com D2 aplicado), senão a armadilha do
toque errado volta.

### D8 — Google Maps

Duas telas pedem o mapa embutido. Um `<iframe>` do Google exige abrir a política de
conteúdo (`frame-src`) e faz o navegador de quem visita falar com o Google — o que a
política de privacidade precisa passar a dizer. Alternativa sem nada disso: um link
"Ver no mapa" que abre o app de mapas do celular.

**Recomendo o iframe**, com a linha correspondente em `/privacidade`. O pedido é claro e o
custo é uma diretiva de CSP mais uma frase.

### D9 — Botão do painel no menu

Para o menu mostrar "Painel" a quem é equipe, o layout precisa perguntar ao banco se a
pessoa é equipe **em toda página**, e passar isso ao cabeçalho. Hoje ele passa só um nome.

Não é risco de segurança — quem autoriza é a RLS, e o painel continua respondendo 404 para
quem não é equipe, venha o link de onde vier. **É custo**: uma consulta ao Postgres por
página, para desenhar um link. Dá para amortizar com `cache()` por requisição (que já é
como `ehEquipe()` funciona). Registro para ficar decidido, não descoberto depois.

### D10 — Migration 009

Se D3/D5/D7 forem aprovados, tudo o que precisa de banco cabe em **um arquivo só**, colado
uma vez no SQL Editor:

- `atividades.imagem_caminho` + `imagem_alt` (mesmo `check` de `publicacoes`);
- `doacoes.situacao` ganha `pagamento_informado`;
- índices para a paginação.

**Junto com ela vai a 007, que continua pendente.** Uma colagem, dois problemas resolvidos.

---

## 4. Os blocos

Ordem de execução. Cada bloco entrega algo que funciona sozinho.

### Bloco 0 — Pendências que já existiam (30 min de pessoa, 0 de código)

| # | O quê | Quem |
|---|---|---|
| 0.1 | Aplicar a migration 007 no SQL Editor | Você |
| 0.2 | Supabase → Site URL para `https://venturus-atelie.vercel.app`; Redirect URLs com `/auth/confirm` | Você |
| 0.3 | Percorrer as 17 rotas do painel autenticado, no celular | Você |

**Não é opcional e não é meu.** O 0.3 em especial: o painel inteiro foi construído e
testado, e quase nada dele foi aberto pelo caminho normal. Toda correção do Bloco H parte
do que essa caminhada encontrar.

### Bloco A — Correções e travas (1 dia)

O que está errado hoje e é barato consertar. **Sem dependência de decisão nenhuma.**

| # | O quê | Onde | Tam. |
|---|---|---|---|
| A1 | Letras quebrando no A+ — **medir primeiro**, no Firefox, a 375px, nas cinco escalas | `estilos/*.css` | M |
| A2 | Máscara de telefone em contato, candidatura e registro de doação | 3 formulários | P |
| A3 | Varredura: todo campo do site tem validação de servidor e mensagem própria | `compartilhado/validacao.ts` | M |
| A4 | Criar conta → entrar na hora e ir para a home | `acoes/autenticacao.ts` | P |
| A5 | Tipo de pessoa (física/jurídica) no cadastro | `AbasEntrar`, `criarConta` | P |
| A6 | Ícone do navegador | `app/icon.svg` | P |

Sobre **A1**: o pedido diz "quebrando letras". Três suspeitos, e eu não vou adivinhar qual é
— `overflow-wrap: break-word` nos títulos (`base.css:26`), `overflow-wrap: anywhere` no nome
de quem entrou (`componentes.css:81`), e o botão "Alto contraste", que não tem `nowrap` e
cresce junto com a fonte. A regra 10 deste projeto existe por causa disso: abrir a página,
aumentar a fonte, olhar. Depois consertar.

Sobre **A4**: isso também apaga a ponta solta do item 1 do `CLAUDE.md` — a mensagem que ainda
manda a pessoa esperar um e-mail que não vem mais.

### Bloco B — Confirmação (1 dia · exige D2)

| # | O quê | Tam. |
|---|---|---|
| B1 | O padrão: `<dialog>` + fallback de página, num componente só | M |
| B2 | Aplicar em toda ação do painel | M |
| B3 | Confirmação dupla (digitar o nome) nas destrutivas: apagar foto, apagar material | P |
| B4 | Candidatura enviada → confirmação + volta para a home | P |
| B5 | Doação registrada → agradecimento | P |

B1 é a peça cara; B2–B5 são aplicação.

### Bloco C — Menu e navegação (meio dia · exige D9)

| # | O quê | Tam. |
|---|---|---|
| C1 | Redesenhar o menu sem perder a facilidade | M |
| C2 | "Minha conta" no menu (hoje só o nome no topo leva lá) | P |
| C3 | "Painel" no menu, para quem é equipe | P |
| C4 | Acessibilidade acoplada ao menu | M |

**C4 merece cuidado.** Os botões A-/A/A+ e alto contraste hoje estão visíveis em toda
página, sempre. Metê-los dentro de um menu que abre e fecha os esconde de quem mais precisa
deles. A regra 8 diz que acessibilidade não se troca por estética. Proposta: **acoplados ao
menu, mas visíveis fora dele** — no mesmo grupo visual, sem ficarem atrás de um clique.

### Bloco D — Páginas públicas (2–3 dias · exige D1, D3, D8)

| # | O quê | Depende | Tam. |
|---|---|---|---|
| D1t | Reescrever o teste de paridade conforme a decisão D1 | D1 | M |
| D2t | Ícones: redes sociais, canais de contato, seções | — | M |
| D3t | Mapa em `/quem-somos` e `/contato` + linha na privacidade | D8 | P |
| D4t | Logo e ícones no rodapé | D4 | P |
| D5t | Início: imagens e ícones | D3 | G |
| D6t | Quem somos: imagens e fundadores | D3 | G |

D2t entrega valor visível **sem depender de asset nenhum** e pode ir antes de tudo.
D5t e D6t ficam parados enquanto não houver foto autorizada — e o plano diz isso agora, não
no dia 3.

### Bloco E — Projetos e notícias em blocos (2 dias · exige D1, D7, D10)

| # | O quê | Tam. |
|---|---|---|
| E1 | `/projetos` vira blocos + "Saber mais" → `/projetos/[id]` | G |
| E2 | `/noticias` vira blocos + "Saber mais" → `/noticias/[id]` | G |
| E3 | Imagem na notícia pelo painel (colunas já existem) | M |
| E4 | Imagem no projeto pelo painel | M |
| E5 | "Adicionar projeto" no painel | M |

E1 e E2 são o coração deste bloco e mudam o `<main>` das duas rotas — por isso D1 vem antes.

### Bloco F — Galeria (1 dia)

| # | O quê | Tam. |
|---|---|---|
| F1 | Abrir a foto em tela cheia e navegar entre elas | G |
| F2 | Mostrar a que projeto a foto pertence | P |

F1 sem JavaScript degrada para o que já existe: a foto abre no próprio endereço.

### Bloco G — Apoiar (2 dias · exige D5, D10)

| # | O quê | Tam. |
|---|---|---|
| G1 | Escolher o tipo antes do resto: dinheiro ou item | P |
| G2 | Dinheiro: valor → chave Pix + QR → "já paguei" | G |
| G3 | Item: descrever → a equipe entra em contato | P |
| G4 | Painel: responder **sem** mudar a situação (o GAP do pedido) | M |
| G5 | Painel: marcar recebida → entra no total | P |
| G6 | Agradecimento | P |

**G4 é um defeito real de hoje**, não um enfeite: responder e mudar de situação é o mesmo
gesto, então a equipe não consegue mandar um recado sem mexer no andamento.

### Bloco H — Painel (2–3 dias)

| # | O quê | Tam. |
|---|---|---|
| H1 | Paginação: um padrão só, aplicado nas 9 listas | G |
| H2 | Blocos comprimidos: nome + o essencial, "Ver mais" abre o resto | G |
| H3 | Filtros em voluntários: nome, e-mail, área, situação | M |
| H4 | Formulário de envio atrás de um botão (galeria, acervo) | P |
| H5 | Reescrever as instruções: bullets, destaque no que importa | M |

H2 e a compressão das capturas que você mandou são a mesma coisa: hoje cada candidatura
ocupa uma tela inteira de celular. Com 20 candidaturas, a equipe rola para sempre.

### Bloco I — Só se sobrar tempo

Dashboard com gráficos e gateway de pagamento. O próprio pedido os marca assim. Não entram
em nenhum cenário de três dias.

---

## 5. O que cabe em três dias

Não cabe tudo. O que cabe, na minha leitura:

**Cenário recomendado — "o site fica melhor e nada quebra"**

```
Dia 1   Bloco 0 (você, 30 min)  +  Bloco A completo  +  D2t (ícones)
Dia 2   Bloco B (confirmações)  +  Bloco C (menu)    +  G4 (o GAP da doação)
Dia 3   Bloco H parcial: H4, H5, H1 nas duas listas que mais crescem
        (voluntários e contatos)
```

Entrega **18 dos 37 itens**, incluindo todos os que são defeito e não gosto. Não mexe no
`<main>` de página pública nenhuma, então a suíte continua verde e a decisão D1 pode ser
tomada com calma, depois da entrega.

**O que fica de fora, e é bom dizer em voz alta:** os blocos D (imagens), E (blocos com
"saber mais"), F (galeria) e G quase inteiro. São os itens mais visíveis do pedido, e são
justamente os que dependem de material da ONG e de decisões do grupo.

**Se o grupo preferir o visível ao correto**, o cenário alternativo troca o Dia 3 por E1+E2
(projetos e notícias em blocos) — mas aí D1 precisa ser decidida hoje, e a paginação do
painel fica para depois da entrega.

---

## 6. A pergunta do documento

> **Como evitar o possível problema de ter 1 pessoa com 2 ou mais contas.**

Resposta em três camadas, da mais barata à mais cara:

1. **O e-mail já é único.** `auth.users` recusa cadastro repetido, e a mensagem de erro já
   está traduzida. O que existe hoje impede a mesma pessoa de criar duas contas **com o mesmo
   e-mail**.
2. **Documento único (CPF/CNPJ)** resolveria de verdade — e é a decisão D6. Custa uma coluna,
   uma validação, e passar a guardar um dado sensível a mais. Para uma ONG deste tamanho, é
   caro para o que resolve.
3. **A pergunta melhor é "por que isso incomoda?"** Se for contagem de voluntários, a
   deduplicação certa é na tela da equipe: mostrar candidaturas com e-mail ou telefone
   parecidos lado a lado, e deixar uma pessoa decidir. Se for fraude em doação, o site não
   cobra nada — não há o que fraudar.

**Recomendo (1) + (3), e adiar (2).** Duas contas da mesma pessoa não causam dano neste
sistema; coletar CPF de todo mundo, sim.

---

## 7. O que este plano não resolve

- Fotos e logo: é a ONG entregar arquivo **e** autorização.
- Chave Pix: decisão D7 do projeto, aberta desde o começo.
- Treinamento presencial da equipe (RNF07): o manual está escrito, o treinamento não
  aconteceu.
- Migration 007: continua sem ser aplicada, e o formulário de contato continua funcionando
  com o limite errado, em silêncio.
