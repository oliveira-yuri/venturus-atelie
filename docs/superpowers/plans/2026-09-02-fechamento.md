# Plano de fechamento — 02/09/2026

Cobre as três frentes pedidas, na ordem em que precisam acontecer:

1. **Acertar o que o merge do PR #1 deixou torto** (branch `design-system-v1`)
2. **Levar `design-system-v1` para `migracao-nextjs`**
3. **As alterações V1** (`docs/alterações-atelie-v1/`), reconciliadas com o que o design
   system já entregou

**Entrega em produção: 04/09/2026. Faltam 2 dias.**

Substitui, na parte 3, o plano de 01/09 (`2026-09-01-alteracoes-v1.md`) — aquele foi escrito
antes do design system e conta itens que já estão prontos.

---

## Estado medido agora (não suposto)

| Fato | Medida |
|---|---|
| `design-system-v1` | 5 commits à frente de `migracao-nextjs` |
| `migracao-nextjs` | **não andou** desde a saída da branch |
| Conflitos no merge | **zero** — é fast-forward puro |
| Suíte | 1080 testes, 1067 passando, 0 falhas, 4 pulados, 9 todo |
| Guardião de deploy | passa |
| Autores na branch | Yuri + Antonio Mortari (`6171d95`, commit vazio de validação de acesso) |

---

# PARTE 1 — Acertar o merge do PR #1

Revisei o PR inteiro. **Dois defeitos já foram corrigidos e publicados** (`c9cc3d0`):
o `order` do herói no `<img>` em vez do `<picture>`, e a corrida no helper de teste da barra
de acessibilidade. O que segue é o que **ainda** está em aberto.

### 1.1 — BLOQUEADOR: autorização de uso de imagem das cinco fotos

**A regra 9 é bloqueante e o próprio PR reconhece isso por escrito** (item 0t do `CLAUDE.md`,
reescrito por ele: *"Pendência: confirmar a autorização de uso de imagem do fundador antes do
deploy"*).

Conferi as cinco olhando, uma a uma: todas do cofundador **Wil Oliveira**, adulto, figura
pública, sempre com objetos do ateliê. **Nenhuma criança** — a foto que mostrava rosto de
criança foi descartada de propósito, e isso está escrito no script gerador. O critério está
certo. O que falta é o **registro**: a RN07 pede autorização registrada, não julgamento de
quem implementa.

- **Quem resolve:** você, com o Wil. Um "sim" por escrito (mensagem, e-mail, formulário)
  basta para existir registro.
- **Se não der até o deploy:** trocar as cinco `<img>` pelo `.af-ph`, que já existe em
  `estilos/sistema.css`. É meia hora, e o site continua de pé.
- **Tamanho:** P (a troca), mas é **decisão sua**, não trabalho meu.

### 1.2 — A foto do berimbau tem marca d'água de terceiro

`public/imagens/heroi-retrato.jpg` (o herói do desktop) carrega *"TEATRO MUNICIPAL — ADÉLIA
LORENZETTI"* queimado no canto inferior direito. **Isso não é RN07, é autoria** — parece
crédito de fotógrafa.

Três saídas, em ordem de preferência:
1. confirmar com a ONG que há permissão de uso e **manter o crédito visível** (é o que a
   marca d'água já faz);
2. trocar por outra foto do acervo próprio;
3. recortar a marca — **não recomendo**: remover crédito de fotógrafa é pior que exibi-lo.

**Tamanho:** P. **Decisão sua.**

### 1.3 — `<strong>` virou `<span>` em "Na mídia"

Na conversão para `.af-media`, `componentes/SecaoNaMidia.ts` trocou
`<strong>Folha de S.Paulo</strong>` por `<span class="af-media__titulo">`. O peso visual
continua (vem do CSS), mas a **ênfase semântica** que o leitor de tela anunciava se perdeu.

É pequeno e defensável — em lista de menções à imprensa, o negrito era mais apresentação que
ênfase. Mas num projeto onde acessibilidade é requisito, a troca merece ser deliberada, não
incidental. **Proposta:** voltar a `<strong className="af-media__titulo">`. Uma linha, sem
efeito visual.

**Tamanho:** P.

### 1.4 — O cabeçalho tem três faixas no desktop; o handoff desenha duas

Já está registrado no item 0t como divergência conhecida. **Proposta: deixar como está.**
Os controles de acessibilidade ficam **visíveis**, que é o princípio 6 do próprio sistema, e
juntar as faixas exige transformar `.af-header` em grade com centralização em 1180px por
faixa. Não paga, a dois dias da entrega.

**Tamanho:** M, se um dia for feito. **Recomendo não fazer agora.**

### 1.5 — Reconferir a quebra de letras no A+ (item A1 do plano de 01/09)

O pedido V1 abre com *"quebrando letras quando aumenta o tamanho da fonte"*. O design system
**mudou toda a tipografia** — família, escala, pesos —, então a medição de antes não vale
mais. Precisa ser refeita: Firefox, 320 e 390px, nas cinco escalas do A+, olhando.

**Tamanho:** M. **Entra na Parte 3, bloco A.**

---

# PARTE 2 — Merge de `design-system-v1` em `migracao-nextjs`

### O que é, tecnicamente

`migracao-nextjs` não recebeu nenhum commit desde que a branch saiu. O merge é
**fast-forward**: `migracao-nextjs` simplesmente passa a apontar para o mesmo commit.
**Zero conflito**, medido com `git merge-tree`.

### Passos

1. Rodar a suíte inteira **na branch de origem** — feito: 1080/0 falhas.
2. Rodar `npm run verificar-deploy` — feito: passa.
3. `git checkout migracao-nextjs`
4. `git merge --ff-only design-system-v1` — o `--ff-only` é a trava: se por acaso a branch
   tiver andado, o comando **falha em vez de criar um merge commit silencioso**.
5. Rodar a suíte de novo, já em `migracao-nextjs`. Não é paranoia barata: é a única forma de
   pegar diferença de ambiente entre as duas.
6. `git push origin migracao-nextjs`

### O que acontece depois do push, e você precisa saber antes

**A Vercel vai construir e publicar.** `migracao-nextjs` é a branch de produção do projeto na
Vercel — ou seja, **`venturus-atelie.vercel.app` passa a servir o design system**, com as
cinco fotos.

Isso amarra a Parte 2 à decisão **1.1**: publicar antes de a autorização existir põe foto de
pessoa no ar sem registro. **Recomendo esta ordem:**

- se a autorização estiver confirmada → merge e push, o site novo vai ao ar;
- se ainda não estiver → **fazer o merge, mas trocar as fotos pelo `.af-ph` antes do push**.
  O design vai ao ar completo, sem foto de ninguém, e as fotos entram num commit de uma linha
  quando o "sim" chegar.

`main` **não é tocada** em nenhum dos dois casos — ela segue sendo o site estático antigo.

**Tamanho:** P (o merge em si são 4 comandos). O que custa é a decisão de 1.1.

---

# PARTE 3 — Alterações V1

## O que o design system já entregou (não replanejar)

Três dos 37 itens saíram junto com o sistema:

| Item do pedido | Estado |
|---|---|
| "Mudar o design desse menu sem perder a facilidade" | **pronto** — virou gaveta |
| "Acessibilidade de tamanho de fonte acoplada ao menu" | **pronto** — botão "Aa" |
| "Início: melhorar o design colocando imagens e ícones" | **imagens prontas**; ícones não |

**Sobram 34.**

## As decisões que continuam travando trabalho

Do plano de 01/09, e **nenhuma foi respondida ainda**. Repito só as que travam:

- **D1 — o teste de paridade de texto.** Continua sendo o obstáculo do Bloco E (projetos e
  notícias em blocos). Recomendação inalterada: trocar "o `<main>` é idêntico" por "toda
  frase do original ainda aparece em algum lugar do site".
- **D2 — o padrão de popup sem JavaScript.** `<dialog>` com script, página de confirmação
  sem script, e digitar o nome nas destrutivas.
- **D5 — chave Pix e QR Code.** Sem a chave, a tela mostra o aviso que já mostra. O QR exige
  abrir exceção para uma biblioteca.
- **D7 — admin criando projeto** (agrava a fonte dupla, item 0k).
- **D8 — Google Maps** (iframe + linha na política de privacidade).

E uma nova, que o design system criou:

- **D11 — o corpo do texto caiu de 17px para 14,5px.** É o que o handoff especifica. A ONG
  pediu "textos grandes". O A+ recupera com folga, mas o padrão ficou menor. Se o grupo achar
  pequeno, é **uma linha** em `estilos/tokens.css`.

## Blocos, na ordem de execução

### Bloco A — Correções e travas · 1 dia · sem depender de decisão nenhuma

| # | O quê | Tam. |
|---|---|---|
| A1 | Letras quebrando no A+ — **medir primeiro** com a tipografia nova, 320 e 390px, nas 5 escalas | M |
| A2 | Máscara de telefone em contato, candidatura e registro de doação (hoje só 2 dos 6 formulários têm) | P |
| A3 | Varredura: todo campo tem validação de servidor e mensagem própria | M |
| A4 | Criar conta → entrar na hora e ir para a home (apaga a mensagem que manda esperar e-mail) | P |
| A5 | Tipo de pessoa no cadastro — hoje `tipo_pessoa` é **fixo em `'fisica'`** em `acoes/autenticacao.ts:442` | P |
| A6 | Ícone do navegador (`app/icon.svg`) — **não existe nenhum hoje** | P |
| A7 | 1.3 desta lista: `<strong>` de volta em "Na mídia" | P |

### Bloco B — Confirmação · 1 dia · exige D2

| # | O quê | Tam. |
|---|---|---|
| B1 | O padrão: `<dialog>` + página de confirmação, num componente só | M |
| B2 | Aplicar em toda ação do painel | M |
| B3 | Confirmação dupla (digitar o nome) nas destrutivas | P |
| B4 | Candidatura enviada → confirmação e volta para a home | P |
| B5 | Doação registrada → agradecimento | P |

### Bloco C — Menu · meio dia · exige D9

Só sobraram dois itens; os outros dois vieram com o sistema.

| # | O quê | Tam. |
|---|---|---|
| C1 | "Minha conta" na gaveta | P |
| C2 | "Painel" na gaveta, para quem é equipe — exige o layout passar `ehEquipe` ao cabeçalho | P |

### Bloco H — Painel · 2 dias

| # | O quê | Tam. |
|---|---|---|
| H1 | Paginação: um padrão só, nas 9 listas — **hoje não existe `range`/`limit` em nenhuma** | G |
| H2 | Blocos comprimidos: nome + o essencial, "Ver mais" abre o resto | G |
| H3 | Filtros em voluntários: nome, e-mail, área, situação (**sem CPF** — decisão D6) | M |
| H4 | Formulário de envio atrás de um botão (galeria e acervo) | P |
| H5 | Instruções em bullets, com destaque no que importa | M |

### Bloco G — Apoiar · 2 dias · exige D5

| # | O quê | Tam. |
|---|---|---|
| G4 | **Responder sem mudar a situação** — é defeito de hoje, não enfeite | M |
| G1 | Escolher o tipo antes do resto | P |
| G2 | Dinheiro: valor → Pix + QR → "já paguei" | G |
| G3 | Item: descrever → a equipe entra em contato | P |
| G5 | Marcar recebida → entra no total | P |

### Bloco D — Páginas públicas · 2 dias · exige D3, D8

| # | O quê | Tam. |
|---|---|---|
| D2t | Ícones: redes sociais, canais de contato — **sem depender de asset nenhum** | M |
| D3t | Mapa em `/quem-somos` e `/contato` + linha na privacidade | P |
| D4t | Logo e ícones no rodapé | P |
| D6t | Quem somos: imagens e fundadores | G |

### Bloco E — Projetos e notícias em blocos · 2 dias · exige D1, D7, migration 009

| # | O quê | Tam. |
|---|---|---|
| E1 | `/projetos` vira blocos + "Saber mais" → `/projetos/[id]` | G |
| E2 | `/noticias` vira blocos + "Saber mais" → `/noticias/[id]` | G |
| E3 | Imagem na notícia pelo painel (**colunas já existem**, sem migration) | M |
| E4 | Imagem no projeto pelo painel (**precisa de migration**) | M |
| E5 | "Adicionar projeto" no painel | M |

### Bloco F — Galeria · 1 dia

| # | O quê | Tam. |
|---|---|---|
| F1 | Abrir a foto em tela cheia e navegar entre elas | G |
| F2 | Mostrar a que projeto a foto pertence | P |

### Bloco I — Só se sobrar tempo

Dashboard com gráficos e gateway de pagamento. O próprio pedido os marca assim.

---

# O que cabe em 2 dias

Não cabe tudo — 34 itens contra ~9 dias de trabalho. O que cabe:

```
HOJE (02/09)
  · Parte 1: decidir 1.1 (autorização) e 1.2 (marca d'água)  — você, 15 min
  · Parte 1: A7 (o <strong>)                                  — eu, 5 min
  · Parte 2: merge + push, com ou sem as fotos                 — eu, 15 min
  · Bloco A completo                                           — eu, 1 dia
  · Suas pendências: migration 007, Site URL do Supabase       — você, 30 min

AMANHÃ (03/09)
  · Bloco B (confirmações) + Bloco C (menu)
  · G4 (o GAP da doação — é defeito, não enfeite)
  · H4 + H5 (formulário atrás de botão, instruções)

04/09 — dia da entrega
  · H1 nas duas listas que mais crescem (contatos e voluntários)
  · Percorrer o painel logado, no celular  — você, e ninguém pode fazer por você
  · Deploy final
```

**Entrega 15 dos 34** — e, o mais importante, **todos os que são defeito e não gosto**:
validação, máscara, login instantâneo, tipo de pessoa, ícone do navegador, o GAP da doação,
paginação onde a lista cresce.

**Fica de fora, e é bom dizer em voz alta:** os blocos D (mapas, ícones, fundadores), E
(projetos e notícias em blocos), F (galeria em tela cheia) e a maior parte do G (fluxo do
Pix). São os itens mais visíveis do pedido, e são justamente os que dependem de material da
ONG e de decisão do grupo.

**Se o grupo preferir o visível ao correto**, o troco é o dia 03: E1+E2 no lugar de B+C — mas
aí **D1 precisa ser decidida hoje**.

---

# Pendências que não são de código

Continuam abertas, e nenhuma delas dá erro visível quando esquecida:

| # | O quê | Quem |
|---|---|---|
| 1 | Aplicar `007_limite_por_visitante.sql` no SQL Editor | Você |
| 2 | Supabase → Site URL para `https://venturus-atelie.vercel.app`; Redirect URLs com `/auth/confirm` | Você |
| 3 | **Percorrer as 17 rotas do painel autenticado, no celular** | Você |
| 4 | Autorização de uso de imagem (1.1) e a marca d'água (1.2) | Você + a ONG |
| 5 | Chave Pix (D7 do projeto) | A ONG |
| 6 | Treinamento presencial da equipe (RNF07) | Você + a ONG |

O item 3 continua sendo o de maior valor por minuto gasto: o painel inteiro foi construído e
testado, e quase nada dele foi aberto pelo caminho normal.
