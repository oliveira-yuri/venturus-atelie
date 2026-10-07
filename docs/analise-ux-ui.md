# Análise de UX/UI — Ateliê Afro Cultural

**Base:** branch `migracao-nextjs` (já com o PR #4), em 06/10/2026.
**Escopo:** navegação, conteúdo, formulários, conta, acessibilidade, desempenho e painel da equipe.
**Restrição:** tudo abaixo preserva a identidade atual (paleta ocre/azul/marrom, aplique, tipografia Bitter).

## Como foi feito, e o que NÃO foi visto

- **Visto rodando** (Chromium, 390px e 1440px): 20 rotas públicas, com métricas automáticas de
  títulos, rótulos de campo, `alt`, alvos de toque, foco por teclado, peso e requisições.
- **Lido no código, não visto:** o painel da equipe (exige sessão de equipe, que este ambiente não tem),
  `/minha-conta`, o formulário de inscrição em evento e o formulário de oferta de doação logado.
- **Sem dados:** o ambiente roda sem Supabase, então agenda, notícias, galeria e acervo apareceram
  vazios, e as áreas de voluntariado apareceram como "ainda sendo organizadas". Os estados vazios foram
  avaliados; as listas cheias, não.
- **Não foi feito:** teste com pessoas reais, nem em aparelho físico. Onde digo "provável", é inferência.

> **Atualização de 06/10/2026:** os itens 1, 2, 5, 6, 7, 9, 12, 13, 14, 16, 17 e 18 foram
> implementados (ver o `CLAUDE.md`). Seguem abertos: 3 (candidatura e doação sem conta, decisão de
> produto), 4 (Pix de teste), 8 (menu), 10 (lista de "Onde já estivemos"), 11 (mapa) e o VLibras
> sob demanda.

## O que já está bom (manter)

- Hierarquia limpa: uma `h1` por página, sem salto de nível, título único por página, `lang="pt-BR"`.
- Todos os campos têm rótulo; nenhuma imagem sem `alt`; foco por teclado visível em 30 Tabs seguidos.
- `autocomplete` e `inputMode` corretos nos formulários, estado de envio pendente em 10 deles.
- Tom de voz acolhedor e consistente, e as dicas de preenchimento ("Opcional. Com DDD…") são exemplares.
- Acessibilidade de verdade: A+ até 137,5%, alto contraste, VLibras, navegação sem JavaScript.
- Mobile: sem rolagem lateral em nenhuma rota, e o rodapé agora compacto.

---

## Prioridade alta — afetam a conversão ou a confiança

### 1. O botão de WhatsApp cobre texto em quase toda página do celular
Mesmo com a fonte normal, ele fica fixo no meio da área de leitura e tapa linhas de `/voluntariado`,
`/voluntariado/candidatura`, `/projetos/[id]`, `/quem-somos` e o rodapé (cobre o "TikTok" em `/acervo`).
**Melhoria:** recolher para só o ícone depois de rolar; escondê-lo nas páginas que já têm botão de WhatsApp
no corpo (`/contato`, `/para-escolas`, `/doar`) e no rodapé; e dar `padding-bottom` ao fim da página.

### 2. Login e cadastro sempre mandam para a home
Toda ação de conta termina em `redirect('/')` (`acoes/autenticacao.ts:388`, `:499`, `:601`). Quem clicou em
"Quero me candidatar" ou "Oferecer uma doação", criou a conta e caiu na home precisa reencontrar o caminho.
Para a equipe, o login também cai na home pública, e só então é preciso abrir a gaveta e achar "Painel da equipe".
**Melhoria:** parâmetro `?voltar=` validado (só caminhos internos), e a equipe vai direto para `/admin`.

### 3. Candidatura e doação exigem conta antes de mostrar qualquer campo
As duas páginas viram um muro de explicação ("Para se candidatar é preciso ter uma conta") com dois botões.
É o ponto mais provável de desistência nas duas dores que a ONG declarou (captar apoio e voluntários),
e a de 2021 foi justamente perder gente que queria ajudar.
**Melhoria:** mostrar o formulário já preenchível, e pedir a conta no envio (ou criá-la inline com e-mail e
senha no mesmo passo). Alternativa de menor custo: um formulário curto "Quero ajudar" sem conta, que cai
no registro central de contatos (RF29), que já existe.
Detalhe: em `/voluntariado/candidatura` o "fale com a gente pelo WhatsApp (11) 95396-8344 ou pelo e-mail…"
continua em texto puro, **o mesmo defeito que corrigi em `/doar/ofertar`**.

### 4. O Pix de teste e o QR falso aparecem na página pública de doação
`/doar` mostra "chaveteste-123" e um QR marcado "EXEMPLO — NÃO FUNCIONA". O aviso é honesto, mas para um
visitante real a seção "Doação em dinheiro" é uma promessa que não se cumpre, na página mais sensível do site.
**Melhoria:** esconder o bloco inteiro atrás de uma variável de ambiente até a chave real existir (decisão D7),
trocando por "Para doar em dinheiro hoje, fale pelo WhatsApp".

### 5. A página 404 diz que o site está "sendo reconstruído"
"Algumas páginas do menu ainda estão em preparação e chegam nas próximas semanas" — texto de fase de obra.
Hoje todas as páginas do menu existem. **Melhoria:** trocar por "Não achamos esta página" + atalhos para
Projetos, Agenda e Contato.

### 6. Estados vazios mandam ir ao Instagram ou WhatsApp, sem link
`/noticias` ("Siga a gente no Instagram ou fale pelo WhatsApp") e `/acervo` têm a instrução em texto puro.
`/agenda` eu já corrigi. **Melhoria:** os mesmos links, como botões.

---

## Prioridade média — fricção e polimento

### 7. Desktop: três bordas esquerdas diferentes e metade da tela vazia
Em `/entrar`: logo do cabeçalho em x=162, título e formulário em x=146, listra em x≈130. Em `/doar`: 121, 109, 97.
A coluna de texto ocupa só a metade esquerda em `/doar`, `/entrar` e `/quem-somos`, e a direita fica em branco.
O logotipo do rodapé também fica fora do centro (centro ≈590px numa tela de 1440).
**Melhoria:** um único contêiner para cabeçalho, conteúdo e rodapé; e duas colunas onde há o que pôr do outro
lado (em `/doar`, um cartão lateral "Como doar" com os dois botões; em `/entrar`, "Entrar" ao lado de "Criar conta").

### 8. Menu com 11 itens e sem destaque para a ação principal
No desktop são 11 links em uma faixa, sem hierarquia, e "Apoiar" se repete em "Doar agora" do rodapé.
**Melhoria:** botão "Apoiar" em ocre no cabeçalho, à direita de "Entrar", e agrupar o menu em três blocos
(Conhecer, Participar, Ler), com a gaveta do celular seguindo os mesmos grupos.

### 9. `/acervo`: o botão "Buscar" fica colado na caixa de resultado
Sem margem entre o botão e o estado vazio. Defeito de espaçamento, de uma linha de CSS.

### 10. `/para-escolas`: a lista "Onde já estivemos" ocupa ~40% da página no celular
São 11 cartões com borda e sombra, um embaixo do outro, só para listar lugares. E o pedido de atividade, que
é o objetivo da página, só aparece no fim.
**Melhoria:** lista simples (sem cartão) em duas colunas, e botão "Solicitar atividade" também no topo.

### 11. Mapa do Google embutido no meio do texto
`/quem-somos` pesa 1.085 KB (contra 447 KB da home), e o mapa interativo é uma armadilha de rolagem no celular
(o dedo que rola a página move o mapa). Ele também puxa `fonts.googleapis.com`, o que contradiz a regra
"sem Google Fonts".
**Melhoria:** imagem estática do mapa com "Abrir no Maps" (vale também para `/contato`).

### 12. Senha: sem "mostrar senha"
Nenhum campo de senha tem o botão. No celular, digitar senha às cegas é causa comum de erro e de "esqueci
minha senha". Mostrar também a regra de tamanho **antes** do envio, no cadastro.

### 13. A home não mostra o que está acontecendo
Há "Ver a agenda" como botão, mas nenhuma faixa com o próximo evento. Quando houver evento publicado, uma
linha "Próxima atividade: data, nome, botão Quero me inscrever" é o atalho mais curto para a inscrição,
que a ONG chamou de indispensável.

### 14. Alvos de toque abaixo de 44px
Na lista de `/projetos` os títulos-link têm 23px de altura (o "Saber mais" já cobre o toque, então é pequeno),
e a caixa de consentimento do contato tem 26px. Ampliar a área clicável do rótulo.

---

## Painel da equipe — lido no código, não visto

### 15. Sem navegação entre telas do painel
Cada tela tem só "← Painel" no topo. Quem marca presença, abre os inscritos e volta à agenda passa pela home
do painel a cada troca. Pelo celular e de pé, é o oposto de "tudo na ponta do polegar".
**Melhoria:** barra fixa na parte de baixo, só no painel e só no celular, com 4 destinos: Início, Agenda,
Mensagens, Mais.

### 16. Os números do painel ficam abaixo dos cartões
"Mensagens recebidas" não diz que há 3 esperando; é preciso rolar até a seção de números. Um selo no
próprio cartão ("3 novas") responde "o que está me esperando" sem rolar.

### 17. Envio de foto grande falha em texto puro
O `CLAUDE.md` registra (item 0i): foto acima de 8 MB devolve "Internal Server Error" sem layout. É a pior
falha possível para quem está de pé no meio de um evento. **Melhoria:** reduzir a foto no próprio celular
antes de enviar, ou ao menos checar o tamanho e avisar antes.

### 18. O manual da equipe existe, mas o painel não aponta para ele
Há `docs/manual-da-equipe.md`, mas a equipe não o encontra de dentro do painel. Um link "Ajuda" no topo e uma
dica de uma linha no primeiro acesso resolvem sem treinamento extra.

---

## Desempenho e acessibilidade

- **VLibras carrega em toda página** (45 requisições e 2 hosts externos já na home). Carregá-lo só quando a
  pessoa toca no botão reduziria o peso do primeiro acesso em rede móvel. Exige cuidado: o projeto tem
  testes e uma CSP feitos em torno dele, e tirar a tradução não é opção.
- O botão "Alto contraste" ligado agora mostra "✓"; vale o mesmo cuidado em outros estados que só usam cor.

---

## Plano sugerido

| Etapa | Itens | Esforço |
|---|---|---|
| **Já, em um PR curto** (CSS e copy) | 1, 5, 6, 9, 14 | horas |
| **Antes de divulgar o site** | 4, 2, 12 | 1 dia |
| **Conversão** | 3, 8, 13 | 2–3 dias |
| **Painel (maior ganho para a ONG operar)** | 15, 16, 17, 18 | 2–3 dias |
| **Refino de layout** | 7, 10, 11 | 1–2 dias |

## O que eu recomendo validar com a ONG
1. Se aceitam um formulário "Quero ajudar" **sem conta** (item 3) — é uma decisão de produto, não de design.
2. Se o botão "Apoiar" pode virar o destaque do cabeçalho (item 8).
3. Quem da equipe vai usar o painel de pé: um teste de 15 minutos com ela, no celular dela, vale mais
   do que qualquer um dos itens 15–18 deste documento.
