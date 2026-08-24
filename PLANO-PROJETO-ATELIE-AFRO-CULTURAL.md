# Plano de Projeto — Ateliê Afro Cultural

> **Documento de handoff.** Contexto completo do projeto para desenvolvimento em outra máquina.
> Revisão 2 — 23/08/2026. Fatec Innovation Challenge.

---

## 0. Como usar este documento

Você é o agente que vai construir esta aplicação. Este documento é sua **única fonte de contexto** —
assuma que não existe nenhuma conversa anterior.

**Antes de escrever código:**

1. Leia o documento inteiro. As seções 3 (restrições), 12 (segurança) e 9 (fora do escopo) são as que
   mais restringem decisões — não pule.
2. Rode a skill `superpowers:brainstorming` para desenhar a aplicação. **Não use o brainstorming para
   re-decidir o escopo** — ele já está fechado aqui. Use para decidir *como* implementar: estrutura de
   arquivos, componentes, ordem de execução, padrões de código.
3. As perguntas listadas na seção 16 já têm premissa definida. Não pergunte de novo ao usuário a menos
   que ele traga informação nova da ONG.

**Regras de comportamento neste projeto:**

- **Não invente requisitos.** Cada requisito abaixo tem origem rastreada no formulário respondido pela ONG.
  A seção 9 lista o que foi deliberadamente recusado, com motivo. Se você achar que algo falta, proponha
  ao usuário — não implemente por conta própria.
- **Não use conteúdo fictício.** A seção 18 traz o conteúdo real da organização — nomes, espetáculos,
  fichas técnicas, contatos, clipping. Use isso. Nunca lorem ipsum, nunca eventos ou depoimentos inventados.
- **Não trate segurança como etapa final.** Ver seção 12.

---

## 1. A organização

**Ateliê Afro Cultural** — espaço educativo de criação, reflexão e valorização da cultura e memória
afro-brasileira.

| Campo | Valor |
|---|---|
| CNPJ | 24.369.179/0001-17 |
| Endereço | Rua Dr. Paulo Gatti, 135 — Vila Romero, São Paulo/SP — CEP 02468-030 |
| Região | Sede na Casa Verde, zona norte de SP. O trabalho circula por diversas regiões da cidade |
| Idealizadores | Wil Oliveira e Nathália (Nathy) Monteiro — casal de artistas |
| Tempo de atuação | Entre 3 e 10 anos |
| Equipe | 1 a 5 pessoas (voluntários + colaboradores pagos) |
| Telefone / WhatsApp | (11) 95396-8344 |
| E-mail | atelieafro@gmail.com |
| Instagram | @atelie_afrocultural |
| TikTok | @ateli.afro.cultur |
| YouTube | canal `UCWeZ-53etejdUzUi3eR81zg` |

**Slogan oficial:** *"Espaço educativo de criação, reflexão e valorização da cultura e memória afro brasileira"*

**Missão (transcrição literal):** promover a valorização da cultura e da memória afro-brasileira por meio
da arte, da educação e das vivências artísticas culturais, fortalecendo a identidade, a autoestima e o
sentimento de pertencimento de crianças, jovens e adultos.

**Valores:** ancestralidade, respeito à diversidade, equidade, ética, coletividade, afeto, inclusão,
fortalecimento da identidade e do pertencimento, construção de uma sociedade antirracista.

**Público atendido:** crianças, jovens e adultos, de todas as etnias, descendências e faixas etárias.

**Três setores de atuação** (usar essa divisão na página "Quem somos"):

- **Literário** — livros de temática negra, leituras, pesquisas, análises, contação de histórias,
  exercícios e técnicas de teatro.
- **Musical** — cantigas, instrumentos e corporeidade negra, movimentos de capoeira. Referências citadas
  pela própria ONG: jongo, maculelê, maracatu, forró, samba, rap, hip hop, funk.
- **Artístico criativo** — pintura em tela, materiais reciclados para figurinos e cenários, desenho,
  escultura, colagem.

### Situação atual (o problema a resolver)

- **Todos os processos são manuais.** A ONG nunca usou nenhum sistema, aplicativo ou plataforma digital.
- **Não possui dispositivos próprios** (nem computador, nem tablet). Tem internet confiável no local.
- Divulgação acontece por redes sociais, WhatsApp, boca a boca, eventos e e-mail.
- **Doações são raras.** Quando ocorrem, chegam por Pix na conta pessoal do proponente Wil Oliveira.
- Em 2021, após aparecer no programa do Caldeirão do Huck em rede nacional, muitas pessoas e empresas
  quiseram apoiar e a ONG não conseguiu responder: *"não tínhamos nem estrutura nem preparo"*.
- Há alguém na equipe com conhecimento básico de tecnologia. A manutenção após a entrega será da própria ONG.

### A frase que orienta o projeto

Perguntada sobre qual único problema resolveria com tecnologia, a ONG respondeu:

> *"O Ateliê Afro Cultural enfrenta dificuldades para ampliar sua visibilidade, captar recursos e organizar
> o relacionamento com apoiadores, parceiros e participantes."*

**Visibilidade, recursos e relacionamento.** Todo requisito deve poder ser reconduzido a um desses três eixos.

---

## 2. Objetivo do sistema

| # | Objetivo declarado pela ONG | Módulos |
|---|---|---|
| O1 | Apresentar institucionalmente a organização e divulgar missão, história, projetos e impactos sociais | M1 |
| O2 | Divulgar trabalhos, oficinas, apresentações, eventos e conteúdos educativos | M1, M3, M9 |
| O3 | Facilitar o contato com escolas, instituições, pessoas, empresas parceiras, patrocinadores e apoiadores | M1, M6 |
| O4 | Incentivar novas parcerias, doações, ações de voluntariado e oportunidades de colaboração | M4, M5 |
| O5 | Ampliar o alcance das iniciativas e fortalecer a valorização da cultura e da memória afro-brasileira | Todos |

Personalidade que o site deve transmitir, marcada pela ONG: **acolhedor / próximo das pessoas** e
**simples / direto ao ponto**. As opções "sério/institucional" e "jovem/dinâmico" **não** foram marcadas.

---

## 3. Restrições inegociáveis

Leia esta seção como um contrato. Violar qualquer item aqui invalida a entrega.

### 3.1 Enquadramento — o mais importante

**O Ateliê Afro Cultural NÃO é uma ONG de assistência social.** É uma organização de **arte, cultura e
identidade do povo negro**.

Consequências concretas:

- A home **não** abre com apelo do tipo "ajude crianças carentes". Abre com arte, cultura e identidade.
- **Nada de estética de pena.** Sem fotos de sofrimento, sem linguagem de caridade, sem contador de
  "vidas salvas".
- O site **não recebe doação de alimento ou roupa**. Recebe livros, instrumentos musicais, materiais de
  arte, itens de acervo e recursos financeiros. O formulário de doação deve deixar isso claro no texto.
- Se o site parecer campanha assistencialista, ele está errado mesmo que funcione tecnicamente.

### 3.2 Stack

- **Front-end:** HTML, CSS e JavaScript. **Sem framework de build** (sem React, sem Vue, sem bundler).
  `supabase-js` carregado por CDN como módulo ES.
- **Back-end:** **Supabase** — PostgreSQL, Auth, Storage e Edge Functions. Região **São Paulo**.
- **Hospedagem do front:** serviço estático gratuito com deploy por Git (Netlify, Vercel ou GitHub Pages).
- **E-mail transacional:** provedor externo (Resend, Brevo ou similar) acionado por Edge Function.
  ⚠️ O envio nativo do Supabase Auth tem limite muito baixo e serve **apenas** para e-mails de
  autenticação — não use para confirmação de inscrição nem para resposta de doação.
- **Sem aplicativo nativo.** Web responsiva acessada por navegador.
- **Geração de PDF** (certificados, relatórios): no navegador, para evitar função de servidor.

### 3.3 Mobile obrigatório

A ONG **não possui dispositivos próprios**. Toda a operação administrativa acontece no celular pessoal
da equipe. Publicar um evento, marcar presença durante o evento e responder a uma doação **precisam
funcionar inteiramente pelo celular**. Painel administrativo é mobile-first, não "mobile também".

### 3.4 Identidade visual

Paleta definida pela **própria ONG**, com significado atribuído por eles. Não é escolha estética da
equipe de desenvolvimento e não deve ser alterada.

| Cor | Significado declarado pela ONG |
|---|---|
| **Amarelo escuro** | Luz, sabedoria, criatividade, prosperidade, força da ancestralidade |
| **Azul claro** | Céu, esperança, serenidade, espiritualidade, conhecimento, confiança |
| **Marrom neutro** | Terra, mãe África, raízes, ancestralidade, resistência, memória dos povos africanos e afro-brasileiros |

Valores hexadecimais **propostos** como ponto de partida (validar com a ONG — a fachada da sede e as
camisetas da equipe são amarelo saturado com letras escuras):

```
--amarelo:  #E0A400   /* principal */
--azul:     #7FA9CE   /* apoio; use #2E5C8A quando precisar de contraste de texto */
--marrom:   #8A6A4A   /* neutro */
--tinta:    #241C12   /* texto, marrom levado ao escuro */
--fundo:    #FAF6EE   /* fundo claro, levemente quente */
```

- **Logotipo:** mapa da África estilizado com "Ateliê Afro Cultural". A ONG só possui versão em **baixa
  qualidade** e declarou que **não há restrições de uso da marca** — pedir arquivo vetorial ou propor redesenho.
- **Tom de comunicação:** acolhedor, humanizado, simples e sincero. Vale para todo texto de interface,
  inclusive mensagens de erro e botões.

### 3.5 Acessibilidade

Declarada como necessária pela ONG, que citou textualmente "áudio, textos grandes, contraste de cores".

- Controle de **tamanho de fonte** (A- / A / A+) e **alto contraste** na barra superior, em todas as páginas.
- **Texto alternativo em todas as imagens** — o site é fotográfico; sem alt ele é inútil no leitor de tela.
- Navegação completa por teclado e foco visível.
- HTML semântico.
- Legendas ou alternativa em áudio nos vídeos.
- Linguagem simples, sem jargão.
- Considerar **VLibras** (widget gratuito do gov.br) — baixo esforço, alto impacto.

---

## 4. Atores

| Ator | Quem é | O que faz | Precisa de conta? |
|---|---|---|---|
| **Visitante** | Público externo: famílias, escolas, empresas, imprensa, comunidade | Navega, lê, consulta agenda, **inscreve-se em eventos**, **baixa material do acervo**, vê galeria, envia mensagem | **Não** |
| **Voluntário** | Pessoa maior de 18 anos que se candidata a colaborar | Cadastra-se, escolhe áreas de atuação, acompanha situação, recebe avisos | Sim |
| **Doador** | Pessoa física ou jurídica que oferece apoio | Cadastra-se, descreve o que pode doar, acompanha resposta e histórico | Sim |
| **Equipe / Admin** | Wil, Nathy e colaboradores (1 a 5 pessoas) | Publica conteúdo e eventos, gerencia inscrições e presença, analisa doações, gere voluntários, envia avisos, consulta indicadores | Sim |

**Conta existe apenas para voluntário, doador e equipe.** Todo o resto do site é acessível sem login.

---

## 5. Requisitos funcionais

39 requisitos em 9 módulos. A coluna **Origem** aponta a seção do formulário respondido pela ONG que
justifica cada um (`§1` a `§9`); `equipe` indica decisão do time de desenvolvimento.

### M1 — Site institucional e divulgação

| ID | Requisito | Descrição | Origem | Fase |
|---|---|---|---|---|
| RF01 | Página inicial institucional | Apresenta o Ateliê, o slogan, a missão e os caminhos principais: conhecer, participar, ser voluntário, apoiar | §3 | 1 |
| RF02 | Página "Quem somos" | História, idealizadores e os três setores de atuação (literário, musical, artístico criativo) | §1, §3 | 1 |
| RF03 | Projetos e atividades | Lista oficinas, apresentações e vivências, cada uma com descrição, público e formato. Editável pela equipe | §3 | 1 |
| RF04 | Notícias e campanhas | A equipe cria, edita, publica e despublica notícias, campanhas e resultados. Listagem pública + página individual | §6 | 1 |
| RF05 | Galeria de fotos e vídeos | Álbuns por ação ou evento, com imagens e vídeos incorporados | §2, §3 | 1 |
| RF06 | Contato institucional | Exibe telefone, e-mail, WhatsApp, redes sociais e endereço — os cinco itens nomeados pela ONG | §8 | 1 |
| RF07 | Formulário de contato geral | Canal para escolas, instituições, empresas e imprensa. Mensagens vão para o registro central (RF29) | §3 | 1 |
| RF38 | Área "Para Escolas" | Página dedicada ao público escolar: que atividades existem, faixas etárias, formatos e duração, o que a escola precisa providenciar, formulário próprio de solicitação | §3 | 1 |
| RF39 | Prova social | Seção "Na mídia" e "Onde já estivemos", alimentada pelo clipping real da ONG (ver seção 18). A equipe pode acrescentar registros | §3, §4 + equipe | 1 |

### M2 — Cadastro de usuários e acesso

| ID | Requisito | Descrição | Origem | Fase |
|---|---|---|---|---|
| RF08 | Cadastro de voluntário | Nome, e-mail, telefone, senha e áreas de interesse. Gera perfil tipo voluntário | §6 | 2 |
| RF09 | Cadastro de doador | Nome ou razão social, e-mail, telefone, tipo (PF/PJ). Gera perfil tipo doador | §6 | 2 |
| RF10 | Autenticação | Entrar, sair e recuperar acesso. Uma pessoa pode acumular os papéis de voluntário e doador | §6 | 2 |
| RF11 | Área do usuário | Consulta e edição dos próprios dados, das próprias candidaturas e do próprio histórico de doações | §6 | 2 |
| RF12 | Confirmação de maioridade | Caixa obrigatória no cadastro, atendendo RN01 | §5 | 2 |

### M3 — Gerenciamento de eventos

| ID | Requisito | Descrição | Origem | Fase |
|---|---|---|---|---|
| RF13 | Cadastro e edição de eventos | Título, descrição, data e hora, local, faixa etária, vagas (opcional), imagem. Publicar ou manter rascunho | §6 | 3 |
| RF14 | Agenda pública | Lista visual dos próximos eventos, filtros simples, destaque para o que acontece em breve. Eventos passados permanecem acessíveis | §6 | 3 |
| RF15 | Inscrição em evento | **Sem necessidade de conta.** Formulário direto. Se a inscrição for para menor, o responsável se identifica (RN02). Reduzir atrito importa mais que histórico individual | §6 | 3 |
| RF16 | Consulta de inscritos | A equipe visualiza e exporta a lista de inscritos de cada evento | §6 | 3 |
| RF17 | Lista de presença | No dia, a equipe marca presença dos inscritos **pelo celular**. O total alimenta os indicadores | §6 | 3 |
| RF18 | E-mail de confirmação | O inscrito recebe e-mail automático com data, hora e local | §6 | 3 |

### M4 — Gestão de doações

| ID | Requisito | Descrição | Origem | Fase |
|---|---|---|---|---|
| RF19 | Oferta de doação | O doador registra o que pretende doar em **campo de descrição livre**, com indicação do tipo (item ou recurso financeiro). Campo aberto de propósito: filtrar depois custa menos que perder oferta por lista fechada | §6 | 4 |
| RF20 | Análise e resposta | A equipe aceita ou recusa. O doador recebe a decisão por e-mail, com mensagem editável e combinação de entrega quando aceita | §6 | 4 |
| RF21 | Registro de doação recebida | Data, doador, descrição e valor quando aplicável. A equipe também registra doações recebidas fora do site | §6 | 4 |
| RF22 | Histórico por doador | Todas as ofertas e doações de um doador, visíveis à equipe e, na parte que lhe cabe, ao próprio doador | §6 | 4 |
| RF23 | Meios de doação | Página que exibe como doar, incluindo chave Pix institucional. **O sistema não processa pagamentos** (RN08) | §3, §4 | 4 |

### M5 — Área de voluntariado

| ID | Requisito | Descrição | Origem | Fase |
|---|---|---|---|---|
| RF24 | Página de voluntariado | Explica o que é ser voluntário no Ateliê e apresenta as áreas de atuação em linguagem simples | §6 | 4 |
| RF25 | Candidatura | Seleção de uma ou mais áreas de atuação e mensagem livre. Vinculada ao cadastro RF08. **Sem controle de disponibilidade** (fase futura) | §6 | 4 |
| RF26 | Gestão de voluntários | Consulta de candidaturas, filtro por área, alteração de situação: novo / em contato / ativo / inativo | §6 | 4 |

**Áreas de atuação do voluntariado** (usar exatamente estas cinco):

1. **Apoio pedagógico e oficinas** — reforço escolar, contação de histórias, oficinas de percussão, dança, turbantes e artes manuais
2. **Comunicação e mídias** — fotos, vídeos, textos para redes sociais, divulgação de projetos e editais
3. **Produção de eventos** — montagem de exposições, recepção de público, feiras culturais, apresentações
4. **Organização de acervo** — catalogação de livros, roupas, instrumentos musicais, fantasias e peças de memória ancestral
5. **Apoio administrativo** — captação de recursos, planejamento de projetos, atendimento à comunidade

### M9 — Acervo aberto

Origem: §6 (pergunta sobre diferencial — *"uma biblioteca digital com conteúdos produzidos pelo Ateliê
Afro Cultural, sobre cultura e memória afro-brasileira"*), §3 (objetivo O2) e §9 (*"compartilhar nossos
conteúdos educativos com pessoas de todo o Brasil"*).

É o único módulo cujo alcance **não é limitado pela agenda física da ONG**. Uma oficina atende uma turma;
um material publicado atende qualquer escola do país. É também o que dá substância à área "Para Escolas".

| ID | Requisito | Descrição | Origem | Fase |
|---|---|---|---|---|
| RF35 | Catálogo do acervo | Listagem dos materiais produzidos pelo Ateliê, com filtro por tema e faixa etária, e busca por texto (usar full-text search do Postgres) | §6, §3 | 5 |
| RF36 | Visualização e download | Cada material lido na própria página e baixável. Download livre, sem cadastro | §6 | 5 |
| RF37 | Publicação de material | A equipe envia arquivo, preenche título, descrição, tema e faixa etária, e publica sem apoio técnico | §6, §7 | 5 |

⚠️ **Dependência bloqueante:** este módulo não pode ser entregue antes do tratamento do acervo descrito no
risco R3 (seção 15). Um único PDF do material atual tem **104 MB**.

### M6 — Comunicação interna

⚠️ **Ambiguidade no formulário:** o item foi marcado como *"Comunicação interna: Chat, mensagens, e-mail?"*
— com ponto de interrogação escrito pela própria ONG. Como as ferramentas atuais deles são WhatsApp e
e-mail, interpretamos como **mensagens e e-mail**, não chat em tempo real. Confirmar (decisão D2).

| ID | Requisito | Descrição | Origem | Fase |
|---|---|---|---|---|
| RF27 | Mural de avisos | A equipe publica avisos visíveis para voluntários autenticados | §6 | 6 |
| RF28 | Mensagem para grupo | Envio de e-mail para conjunto selecionado: inscritos de um evento, voluntários de uma área, ou todos os doadores | §6 | 6 |
| RF29 | Registro central de contatos | Toda mensagem, candidatura e oferta de doação aparece numa lista única com situação (novo / em contato / concluído). Responde diretamente à perda de oportunidades de 2021 | §4, §6 | 6 |

### M7 — Relatórios

⚠️ **Ambiguidade no formulário:** a caixa "Relatórios" **não foi marcada**, mas a linha de detalhamento foi
preenchida: *"finanças, atividades, número de atendidos, acesso ao site, novos parceiros, valores, número
de atividades desenvolvidas/realizadas no mês ou no trimestre ou semestre"*. Além disso, §9 lista números
como critérios de sucesso. Requisitos propostos, a confirmar (decisão D3).

| ID | Requisito | Descrição | Origem | Fase |
|---|---|---|---|---|
| RF30 | Painel de indicadores | Por mês, trimestre ou semestre: atividades realizadas, inscritos, participantes presentes, novos voluntários, novos doadores, valores recebidos | §6, §9 | 6 |
| RF31 | Exportação em CSV | Inscritos, voluntários e doações exportáveis, para prestação de contas e editais | §6 | 6 |
| RF32 | Relatório em PDF | Documento do período com indicadores consolidados, gerado pela equipe sem apoio técnico | §6 | 6 |

### M8 — Administração

| ID | Requisito | Descrição | Origem | Fase |
|---|---|---|---|---|
| RF33 | Painel administrativo | Área única onde a equipe opera todos os módulos. **Mobile-first** — a ONG não possui dispositivos próprios | §7 | 2 |
| RF34 | Perfis e permissões | Distinção entre equipe e usuários externos. Apenas a equipe acessa dados pessoais e funções de gestão | §5 | 2 |

---

## 6. Requisitos não funcionais

| ID | Requisito | Critério verificável | Origem |
|---|---|---|---|
| RNF01 | Responsividade | Todas as telas, públicas e administrativas, operáveis em celular e tablet. A ONG marcou "Sim, muito importante" | §8 |
| RNF02 | Acessibilidade | Controle de tamanho de fonte e contraste na barra superior; alt em todas as imagens; navegação por teclado; foco visível; legendas ou alternativa em áudio | §8 |
| RNF03 | Facilidade de uso | Linguagem simples, sem jargão | §3, §8 |
| RNF04 | Idioma | Interface em português. Inglês fora do MVP | §8 |
| RNF05 | Tom de comunicação | Todo texto de interface acolhedor, humanizado, simples e sincero | §2 |
| RNF06 | Identidade visual | Logotipo, slogan e paleta da organização | §2 |
| RNF07 | Autonomia de manutenção | Todo conteúdo editável sem código, com manual escrito e treinamento | §7 |
| RNF08 | Operação sem equipamento próprio | Publicar evento, marcar presença e responder doação possíveis inteiramente pelo celular | §7 |
| RNF09 | Proteção de dados pessoais | Dados de inscritos, voluntários e doadores acessíveis apenas à equipe; política de privacidade publicada; coleta mínima | §5, §6 |
| RNF10 | Custo de operação | Compatível com organização de 1 a 5 pessoas que declara dificuldade de sustentabilidade financeira | §1, §4 |
| RNF11 | Desempenho em rede móvel | Imagens e documentos otimizados; vídeos servidos pelo canal de YouTube que a ONG já mantém | §8 |
| RNF12 | Execução em navegador | Web, sem aplicativo nativo a instalar | equipe |

---

## 7. Regras de negócio

| ID | Regra | Justificativa |
|---|---|---|
| RN01 | Somente maiores de 18 anos criam conta | O público inclui crianças a partir de 10 anos; conta de menor exigiria consentimento específico do responsável |
| RN02 | Menor participa por inscrição feita por responsável identificado | Decorre de RN01 |
| RN03 | O sistema recebe ofertas compatíveis com a natureza da organização: livros, instrumentos, materiais artísticos, acervo e recursos financeiros | O Ateliê é espaço de arte, cultura e memória — não de assistência social. A interface deve deixar isso claro no formulário |
| RN04 | Toda oferta de doação recebe resposta registrada — aceite ou recusa — comunicada por e-mail | Responde à perda de oportunidades relatada pela ONG |
| RN05 | Dados pessoais de inscritos, voluntários e doadores só são visíveis para perfis da equipe | RNF09 |
| RN06 | CPF é campo condicional por evento, solicitado apenas quando a instituição parceira exigir | Coleta mínima. O formulário da ONG não exige CPF em nenhum ponto |
| RN07 | Publicar foto de participante depende de autorização de uso de imagem registrada | O público inclui crianças e a ONG usa muito material fotográfico |
| RN08 | O sistema registra doações recebidas, mas **não processa pagamentos** | A ONG pediu "registro de doações recebidas", não meio de pagamento |

---

## 8. Arquitetura

| Camada | Escolha | Justificativa |
|---|---|---|
| Interface | HTML, CSS e JS sem framework de build | RNF12; manutenção acessível a quem tem conhecimento básico |
| Hospedagem do front | Estático gratuito com deploy por Git | RNF10 |
| Banco de dados | Supabase — PostgreSQL com API REST auto-gerada (PostgREST) | Persistência de eventos, inscrições, doações, voluntários |
| Autenticação | Supabase Auth | RF08–RF12 |
| Arquivos | Supabase Storage | Galeria (RF05) e acervo (RF35–RF37) |
| Busca no acervo | Full-text search nativo do Postgres | RF35, sem serviço extra |
| Lista de presença | Supabase Realtime | Duas pessoas fazendo check-in em dois celulares ficam sincronizadas |
| E-mail | Provedor externo via Edge Function | RF18, RF20, RF28 |
| Região | São Paulo | Latência e residência de dados |
| Fase futura (IA) | `pgvector` já vem embutido no Supabase | O assistente virtual pedido pela ONG cabe na mesma infra, sem troca de stack |

---

## 9. Fora do escopo

**Não implemente nada desta seção sem autorização explícita do usuário.**

### 9.1 Declarado pela ONG, mas adiado

| Item | Como foi declarado | Por que fica fora |
|---|---|---|
| **Assistente virtual com IA** | §6, "outras funcionalidades": assistente que responde sobre o Ateliê, sugere atividades e orienta patrocinadores | Exige base de conteúdo consolidada (só existe depois do M1) e custo recorrente de modelo, incompatível com RNF10 na fase inicial |
| **Versão em inglês** | §8: português marcado, inglês *"também se possível"* | Condicional no próprio formulário. Traduzir o site inteiro dobraria o custo de manutenção de conteúdo, contra RNF07 |
| **Disponibilidade do voluntário** | Não consta do formulário; foi proposto e depois adiado | Granularidade real varia entre dias, semanas e quinzenas. Modelar antes de conhecer a rotina da ONG geraria retrabalho garantido |

### 9.2 Avaliado e recusado — sem origem no formulário

- **Catálogo contratável de espetáculos** com ficha técnica e pedido de orçamento — operacionalmente pesado
  para uma equipe de 1 a 5 pessoas. O contato institucional fica coberto por RF07 e RF38.
- **Lista fechada de itens desejados** (wishlist) — com requisitos ainda abstratos, lista fechada corta
  oportunidade. RF19 permanece em texto livre.
- Certificado de participação e declaração de horas de voluntariado.
- Material de apresentação para patrocinadores com níveis de apoio.
- Lista de espera para eventos esgotados.
- Boletim por e-mail.
- **Seção "Nossos apoiadores"** — a ONG declarou que **não possui** patrocinador nem parceiro institucional.
  Uma lista vazia produz o efeito social inverso. RF39 usa apenas o que já é verificável.

---

## 10. Modelo de dados

Treze entidades cobrem os 39 requisitos.

| Tabela | Conteúdo | Requisitos |
|---|---|---|
| `perfis` | Dados do usuário autenticado e seu papel: voluntário, doador ou equipe | RF08–RF12, RF34 |
| `atividades` | Oficinas, apresentações e vivências do catálogo institucional | RF03 |
| `eventos` | Uma realização datada, com local, vagas e situação de publicação | RF13, RF14 |
| `inscricoes` | Inscrição de participante em evento, com dados do responsável quando menor | RF15, RF16 |
| `presencas` | Marcação de comparecimento do inscrito no dia | RF17 |
| `voluntarios` | Candidatura e situação do voluntário | RF25, RF26 |
| `areas_voluntariado` | As cinco áreas de atuação e o vínculo de cada voluntário com elas | RF24, RF25 |
| `doacoes` | Oferta, decisão de aceite ou recusa, item ou valor, data de recebimento | RF19–RF22 |
| `publicacoes` | Notícias, campanhas e resultados | RF04 |
| `midia` | Fotos e vídeos por álbum, vinculados a eventos ou publicações | RF05 |
| `contatos` | Registro central de mensagens recebidas com situação de atendimento | RF07, RF29, RF38 |
| `acervo` | Materiais do acervo aberto: tema, faixa etária, arquivo, contagem de downloads | RF35–RF37 |
| `clipping` | Registros de mídia e instituições onde a ONG já atuou | RF39 |

Os indicadores de RF30 são obtidos por consulta agregada sobre `eventos`, `inscricoes`, `presencas`,
`voluntarios` e `doacoes` — **não criam tabela própria**.

---

## 11. Identidade e conteúdo — regras de escrita

- Use o slogan oficial literalmente; não reescreva.
- Nomes próprios corretos: **Wil Oliveira**, **Nathália (Nathy) Monteiro**. Grafias que aparecem nos
  materiais e devem ser normalizadas para essas: "Will Oliveira", "Nathy Monteiro", "Nathi Nunes".
- Botões dizem exatamente o que acontece. Mensagem de erro explica o que houve e como resolver, sem
  pedir desculpas e sem vaguidão.
- Nunca use texto de preenchimento. Se faltar conteúdo real, pergunte ao usuário.

---

## 12. Segurança e proteção de dados

**Esta é a seção com maior potencial de dano se for tratada por último. Ela entra na fase 02, não no fim.**

Como a interface é servida estaticamente, a **anon key do Supabase fica visível no código-fonte** — isso é
esperado e não é uma falha. O que protege os dados é **exclusivamente a Row Level Security** no Postgres.

O erro clássico é: "não está funcionando" → desativar a RLS → funciona → entregar assim. Nesse cenário,
qualquer pessoa com o DevTools aberto lê a tabela inteira de inscritos. Numa organização que atende
crianças a partir de 10 anos, isso deixa de ser bug e vira incidente de dados pessoais.

### Política de acesso por tabela

| Tabela | Leitura pública | Escrita pública | Equipe |
|---|---|---|---|
| `eventos`, `atividades`, `publicacoes`, `midia`, `acervo`, `clipping` | Sim | Não | Total |
| `inscricoes` | **Não** | Inserir apenas, sem autenticação | Total |
| `voluntarios`, `doacoes`, `contatos` | **Não** | Inserir apenas | Total |
| `perfis` | Só o próprio registro | Só o próprio registro | Total |
| `presencas` | **Não** | Não | Total |

### Teste de aceite bloqueante

Com a anon key e **sem estar autenticado**, tentar ler `inscricoes`, `voluntarios`, `doacoes` e `contatos`.
O resultado precisa ser **vazio em todas**. Enquanto esse teste não passar, o sistema não vai ao ar.

### Efeito colateral da inscrição sem conta

Permitir inserção sem autenticação em `inscricoes` e `contatos` reduz atrito — que é o objetivo — mas abre
porta para envio automatizado em massa. Contenção suficiente: limite de envios por origem e revisão humana
da lista pela equipe. **O que não pode acontecer é a permissão de leitura ser afrouxada junto com a de escrita.**

### Conformidade

- Política de privacidade publicada: quais dados, para quê, por quanto tempo.
- Ateliê Afro Cultural identificado como controlador, com canal para solicitações do titular.
- Consentimento explícito no cadastro e na inscrição, em linguagem simples.
- Autorização de uso de imagem registrada na inscrição (RN07).
- Coleta mínima: nenhum campo obrigatório sem finalidade declarada (RN06).

---

## 13. Plano de execução

Oito fases sequenciais e cumulativas. Estimativa total: **13,5 semanas de esforço** (não são datas).

| Fase | Nome | Entrega | Requisitos | Esforço |
|---|---|---|---|---|
| **00** | Fundação | Repositório, projeto Supabase (região SP), hospedagem estática, esqueleto responsivo, sistema visual derivado da identidade. Fecha paleta e logotipo | RNF06, RNF12 | 1 sem |
| **01** | Site institucional | Todo o conteúdo público: home, quem somos, projetos, notícias, galeria, contato, "Para Escolas" e prova social. Se o projeto parasse aqui, a ONG já teria site funcionando | RF01–RF07, RF38, RF39, RNF01, RNF03, RNF05, RNF11 | 2,5 sem |
| **02** | Contas, acesso e painel | Cadastro, autenticação, área do usuário, painel admin mobile-first e **a RLS**. Segurança entra aqui | RF08–RF12, RF33, RF34, RNF08, RNF09 | 1,5 sem |
| **03** | Eventos | Agenda, inscrição sem conta, consulta de inscritos, presença pelo celular, e-mail de confirmação | RF13–RF18 | 1,5 sem |
| **04** | Doações e voluntariado | Oferta em texto livre, análise com resposta por e-mail, registro do recebido, histórico, página e gestão de voluntariado | RF19–RF26 | 2 sem |
| **05** | Acervo aberto | Catálogo com filtro, leitura e download, publicação pela equipe. **Depende do reprocessamento dos arquivos (R3)** | RF35–RF37 | 1,5 sem |
| **06** | Comunicação e relatórios | Avisos, mensagem a grupos, registro central de contatos, indicadores com exportação. **Primeiro candidato a corte** | RF27–RF32 | 1,5 sem |
| **07** | Acessibilidade, testes e transferência | Auditoria de acessibilidade, teste de acesso indevido, política de privacidade, otimização do acervo, manual e treinamento presencial | RNF02, RNF07, RNF09, RNF10, RNF11 | 2 sem |

Se o prazo for menor que 13,5 semanas, **cortar a fase 06** devolve o projeto a 12 semanas sem bloquear
nenhuma outra fase — é a única que depende de confirmações ainda em aberto.

---

## 14. Critérios de aceite

| Módulo | Critério |
|---|---|
| M1 | A equipe da ONG publica uma notícia com foto, **pelo celular**, sem apoio técnico. Os cinco contatos aparecem e funcionam. Um professor encontra "Para Escolas" a partir da home em no máximo dois cliques |
| M2 | Uma pessoa cria conta de voluntário, sai, recupera acesso e edita os próprios dados. O cadastro é recusado sem confirmação de maioridade |
| M3 | A equipe cria um evento pelo celular, ele aparece na agenda, alguém se inscreve **sem criar conta**, recebe o e-mail de confirmação, e a presença é marcada no dia |
| M4 | Um doador registra uma oferta, a equipe recusa, o doador recebe o e-mail. Em seguida a equipe registra uma doação recebida com valor e ela aparece no histórico |
| M5 | Uma candidatura com duas áreas chega ao painel, é filtrada por área e tem a situação alterada para "em contato" |
| M9 | A equipe publica um material pelo celular. Um visitante o encontra por filtro de faixa etária, lê e baixa. O arquivo abre em menos de 5 s em conexão móvel |
| M6 | Um aviso aparece para voluntários autenticados. Uma mensagem enviada aos inscritos de um evento chega às caixas de entrada |
| M7 | O painel apresenta os números do trimestre corrente e o CSV abre corretamente em planilha |
| **Segurança** | O teste de leitura indevida da seção 12 retorna **vazio** em todas as tabelas protegidas |
| **Acessibilidade** | Site navegável só pelo teclado; todas as imagens com alt; controles de fonte e contraste funcionam em todas as páginas |
| **Transferência** | Uma pessoa da ONG executa sozinha, pelo celular, as quatro tarefas mais frequentes: publicar notícia, criar evento, marcar presença e responder a uma doação |

---

## 15. Riscos

| # | Risco | Grau | Mitigação |
|---|---|---|---|
| R1 | RLS mal configurada expõe dados pessoais de participantes, incluindo menores | **Crítico** | Segurança na fase 02; teste de leitura indevida como aceite bloqueante |
| R3 | Acervo de 233 MB, com um PDF de 104 MB, inviabiliza uso em rede móvel e **bloqueia a fase 05** | **Crítico** | Reexportar em resolução web antes da fase 05; converter .pptx para PDF; vídeos pelo YouTube |
| R12 | Módulo de doações construído sem saber por que as doações são raras — pode resolver o problema errado | Alto | Responder D11 e D12 antes da fase 04 |
| R5 | A ONG não consegue operar por não ter computador próprio | Alto | RNF08 bloqueante; aceite executado no celular da própria equipe |
| R8 | Doação continua indo para conta pessoal, comprometendo a confiança de quem doa pelo site | Alto | Decisão D7 antes da fase 04; até lá, informar com clareza quem recebe |
| R2 | Projeto gratuito de banco hiberna por inatividade e o site parece quebrado | Alto | Verificar limites vigentes na documentação; definir quem assume o plano pago (D8) |
| R4 | E-mails de confirmação e de resposta a doação não são entregues | Médio | Provedor externo desde a fase 03; nunca usar o envio nativo de autenticação para isso |
| R6 | Conflito de identidade visual atrasa a interface | Médio | Resolvido: adota-se a paleta da ONG |
| R7 | Logotipo só existe em baixa qualidade | Médio | Pedir vetor na fase 00; não há restrição de marca |
| R10 | Publicação de imagem de criança sem autorização registrada | Alto | RN07 implementada junto com a inscrição, na fase 03 |
| R11 | Seção de apoiadores nasceria vazia — a ONG não possui patrocinador nem parceiro | Médio | RF39 usa só o que é verificável: mídia e instituições onde já se apresentou |

---

## 16. Decisões pendentes

**Cada uma tem uma premissa definida. Siga a premissa e siga em frente — não bloqueie o trabalho.**
Se o usuário trouxer resposta da ONG, atualize.

| # | Questão | Premissa a adotar | Bloqueia |
|---|---|---|---|
| D2 | "Comunicação interna" é chat, mensagem no sistema ou e-mail? | Mensagens no sistema + e-mail. Sem chat em tempo real | Fase 06 |
| D3 | Relatórios entram no escopo? A caixa não foi marcada, mas o detalhamento foi preenchido | Sim, implementar RF30–RF32 | Fase 06 |
| D5 | Quais dados são realmente necessários na inscrição? | Nome, e-mail, telefone. CPF **apenas** como campo condicional por evento (RN06) | Fase 03 |
| D6 | Existe domínio próprio? A ONG marcou "Sim, os dois" e "Só e-mail" ao mesmo tempo | Assumir que não há domínio; usar subdomínio do serviço de hospedagem | Fases 00 e 07 |
| D7 | Haverá chave Pix institucional? A ONG **já tem CNPJ** — a questão é se está ativo e se há conta vinculada, não abrir empresa | Campo de chave Pix configurável no painel, vazio por padrão. A página de doação informa com clareza quem recebe | Fase 04 |
| D8 | Quem assume manutenção e custo da infraestrutura após a entrega? | Tudo no plano gratuito; documentar limites e custo de upgrade no manual | Fase 07 |
| D9 | Existe logotipo em alta resolução? Se não, a ONG autoriza redesenho? | Usar o de baixa qualidade com tratamento; propor vetorização | Fase 00 |
| D10 | Prazo real e tamanho da equipe | Perguntar ao usuário antes de gerar cronograma com datas | Cronograma |
| D11 | **Por que as doações são raras?** Falta de doadores, de quem leve ou recolha, ou de clareza sobre o que é aceito? | Assumir as três: divulgar bem, explicar o que é aceito, e prever combinação de entrega no fluxo de aceite | Fase 04 |
| D12 | **Que "estrutura" faltou em 2021?** Espaço físico, organização documental, ou capacidade de responder a contatos? | Assumir capacidade de resposta — é a única das três que este projeto resolve, via RF29 | Fase 04 |

### Já resolvidas

- **D1 — Paleta:** adota-se a declarada pela ONG (amarelo escuro, azul claro, marrom neutro). As cores têm
  significado atribuído por eles; preferência estética da equipe de desenvolvimento não é critério.
- **D4 — Login:** conta apenas para voluntário, doador e equipe. Inscrição em evento e download do acervo
  **não** exigem cadastro.

---

## 17. Indicadores de sucesso

Critérios pelos quais a própria ONG julgará o projeto, e o que o sistema passa a medir.

| Critério declarado pela ONG | O que o sistema mede | Requisito |
|---|---|---|
| Crescimento no número de crianças inscritas e participantes | Inscrições e presenças por período | RF30 |
| Aumento da participação de escolas, famílias e comunidades | Mensagens recebidas por origem no registro central | RF29 |
| Mais empresas e pessoas apoiando por doações e parcerias | Novos doadores e doações registradas por período | RF30 |
| Depoimentos e avaliações positivas | Publicações e mensagens recebidas | RF04, RF29 |
| Ampliação do acesso aos conteúdos educativos | Downloads por material do acervo — o único indicador que mede alcance fora de São Paulo | RF35, RF36 |
| Expansão das ações para novos territórios | Eventos realizados por local e por período | RF30 |

Nenhum desses números existe hoje: todos os processos da ONG são manuais. A capacidade de apresentá-los
é, por si só, um resultado do projeto.

---

## 18. Conteúdo real disponível

Use este conteúdo para construir. **Não invente espetáculos, datas, depoimentos ou parceiros.**

### 18.1 Catálogo de espetáculos e vivências

Todos são de contação de história performática ou vivência brincante. Formato geral: **adaptável a
qualquer espaço**; rider típico **1 caixa de som + 1 microfone**; classificação **livre**.

| Título | Formato | Duração | Elenco | Observações |
|---|---|---|---|---|
| **Banzo** | Contação de história performática | 50 min | Wil Oliveira | Parte do sentimento de "banzo" — nostalgia e saudade da pátria e da liberdade sentidas pelos africanos escravizados. Propõe diálogo e interação com o público |
| **Brasil Negreiro: Imaginário em Liberdade** | Peça / contação | — | Wil Oliveira | Idealização e atuação de Wil Oliveira. Apresentado no Espaço Malungo e no Teatro Municipal |
| **Catirina e Nego Dito** | Contação performática com fantoches e música ao vivo | 50 min | Wil Oliveira (narrador/cantor/músico) e Davi Santos (bonequeiro) | História do auto do boi. Fantoches de personagens negros, tecidos de chita, tambores, cantigas. Direção de Wil Oliveira |
| **A Cabaça e o Canto Ancestral** | Contação de história | — | Wil Oliveira | Sobre povos ancestrais que atribuem a criação do universo à cabaça. Boneco de cabaça chamado "Porongo" conduz a história, canta e toca instrumentos |
| **Cafú e o Café** | Contação de história | — | Wil Oliveira | — |
| **Eu Griot** | Contação de história | — | Wil Oliveira | — |
| **Memória Negra** | Contação de história | — | Wil Oliveira | — |
| **Batuque na Cozinha** | Contação / vivência | — | Wil Oliveira | — |
| **Brincadeiras Encantadas na Mata** | História-brincante interativa | A combinar | Wil Oliveira e Nathi Nunes | Crianças e adultos numa aventura de faz de conta, com comandos, música, sons da mata, elementos sensoriais e brincadeiras. Cenário de chitas, cabaças, palha sisal, pinhos e troncos |
| **Projeto Brincantes** | Vivência de brincadeiras populares | — | Wil Oliveira e Nathy Monteiro | Resgate de brincadeiras da cultura popular afro-brasileira |
| **Ateliê Afro Cultural Itinerante** | Projeto de circulação | — | — | Leva parte do acervo e do conhecimento produzido a outros espaços |

### 18.2 Clipping — "Na mídia" e "Onde já estivemos" (RF39)

Todos verificáveis nos materiais da ONG. **Não acrescente nenhum outro sem confirmação.**

**Mídia:** Rede Globo (programa "The Wall" e Caldeirão do Huck, 2021) · Jornal Folha de S.Paulo

**Instituições onde já se apresentou:** SESC Interlagos · SESC Santo Amaro · Fábricas de Cultura (Jaçanã) ·
Casas de Cultura de São Paulo (incl. Casa de Cultura São Rafael) · Teatro Municipal Adélia Lorenzetti ·
Praças da Cultura (Subprefeitura Pirituba/Jaraguá) · Espaço Malungo · Ambev (ação de Dia das Crianças,
Campinas, 2021) · Subsecretaria de Igualdade Racial ("II Festa Preta", Parque Bosque Maia)

**Programações recorrentes:** Mês da Consciência Negra · "(Re)Existência do Povo Negro" (SESC)

⚠️ Verificar grafias e datas com a ONG antes de publicar.

### 18.3 Arquivos existentes

Pasta de origem: `Informações - Ateliê Afro Cultural`

- **13 PDFs** — portfólio institucional, releases dos espetáculos, currículo do Wil, formulário respondido
- **2 arquivos .pptx** — "Cafú e o Café" (36 MB cada)
- **Imagens .png/.jpeg** — logo e cartazes
- **1 vídeo .MP4**
- **4 links de galeria** hospedados em `meualbum.co`:
  `/omxupfoc` · `/dffx0xik` · `/ibkgdq69` · `/z8oyy422`

⚠️ **Tratamento obrigatório antes de publicar (risco R3):** o conjunto soma ~233 MB. Três arquivos
concentram quase tudo — um PDF de **104 MB** e dois .pptx de **36 MB** cada.

1. Reexportar os PDFs em resolução web (o de 104 MB deve cair para poucos MB sem perda visível em tela)
2. Converter os .pptx para PDF — a ONG quer que sejam visualizados e baixados, não editados
3. **Vídeo não vai para o Storage** — usar o canal de YouTube que a ONG já mantém
4. Migrar as galerias do `meualbum.co` para a galeria própria (RF05) — hoje são dependência frágil de
   serviço de terceiro

---

## 19. Rastreabilidade

Todo requisito deste documento tem origem numa seção do **Formulário de Levantamento — ONGs** respondido
pela organização:

| Código | Seção | O que fornece |
|---|---|---|
| §1 | Identidade da ONG | Dados institucionais, missão, valores, público, porte |
| §2 | Identidade Visual e Marca | Logo, paleta, slogan, tom de comunicação |
| §3 | Objetivo e Visão do Site | Finalidade do sistema e personalidade esperada |
| §4 | Dores e Desafios | Processos manuais, perdas por desorganização, controle atual |
| §5 | Público-Alvo do Site | Atores, perfis, faixa etária |
| §6 | Funcionalidades do Site | Origem principal dos requisitos funcionais |
| §7 | Tecnologia e Infraestrutura | Restrições de dispositivo, manutenção, ferramentas atuais |
| §8 | Requisitos Não Funcionais | Responsividade, acessibilidade, idioma, contatos |
| §9 | Expectativas e Critérios de Sucesso | Indicadores de sucesso |

Um requisito sem origem rastreável **não entra no escopo**. Se você identificar algo que falta, proponha
ao usuário citando qual seção o justificaria — não implemente por conta própria.
