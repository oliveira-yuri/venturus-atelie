# Design de implementação — Ateliê Afro Cultural

Data: 24/08/2026
Entrega em produção: **04/09/2026**
Documento de escopo: `PLANO-PROJETO-ATELIE-AFRO-CULTURAL.md` (revisão 2)

Esta spec decide **como** construir. O **que** construir está fechado no documento de escopo e não é
reaberto aqui. Onde esta spec acrescenta algo, a origem está marcada.

---

## 1. Contexto de execução

| Fato | Consequência para o design |
|---|---|
| 11 dias corridos até a entrega em produção | O plano é diário, não por fase de 1,5 semana |
| Equipe de 4 pessoas fornecendo informação; desenvolvimento feito pelo agente | O gargalo é acesso a contas, conteúdo e validação — não velocidade de código |
| Escopo completo mantido, sem recorte | Registrado: a estimativa do documento é de 13,5 pessoa-semanas. A decisão de manter o escopo é do usuário, tomada com essa informação à vista |
| Contas externas ainda não existem | Credenciais entram por `site/config.js`. **Não há Docker nesta máquina**, então `supabase start` local não roda: o banco precisa ser o projeto na nuvem, região São Paulo. A Fundação não depende dele; a Fase 02 em diante, sim |

Nenhuma restrição da seção 3 do documento de escopo é relaxada por causa do prazo. Em particular, o
teste de acesso indevido da seção 12 continua bloqueante para o go-live.

---

## 2. Arquitetura da interface

**Decisão: multi-página estático com custom elements.** Cada página é um arquivo `.html` real; a
estrutura compartilhada (cabeçalho, rodapé, controles de acessibilidade) é composta em tempo de
execução por custom elements carregados como módulos ES.

Alternativas descartadas:

- **SPA com router próprio** — entrega documento vazio para buscador e para leitor de tela sem JS.
  Visibilidade é o primeiro dos três eixos declarados pela ONG (seção 1 do escopo); a opção conflita
  com o objetivo central e com RNF02.
- **HTML compartilhado copiado em cada página** — torna simples editar uma página e caro editar o
  que é comum: trocar um item de menu vira 15 edições, e as páginas divergem com o tempo, contra RNF07.

**Custom elements sem Shadow DOM.** O Shadow DOM isolaria o CSS e quebraria o controle global de
tamanho de fonte e de alto contraste, que precisa atravessar todos os componentes. Light DOM com
prefixo `aac-`.

**Limite conhecido:** o cabeçalho depende de JavaScript. O conteúdo de `<main>` — o que é indexado e
lido por leitor de tela — é HTML estático e não depende disso. Um `<noscript>` no rodapé publica os
links essenciais e os cinco contatos do RF06.

---

## 3. Estrutura do repositório

```
material-origem/          arquivos brutos da ONG — fora do deploy e do versionamento
acervo-web/               saída do tratamento do R3 — fora do versionamento
ferramentas/
  tratar-acervo.sh        compressão de PDF e conversão de .pptx
testes/
  seguranca.test.mjs      aceite bloqueante da seção 12
  *.test.mjs              demais testes, rodados com `node --test`
supabase/
  migrations/             uma migration por assunto, cada uma com suas políticas
  functions/enviar-email/ Edge Function (Deno)
  seed.sql                clipping, atividades e áreas de voluntariado reais
docs/
  superpowers/specs/      esta spec
  manual-ong.md           RNF07
site/                     ← raiz de publicação
  index.html quem-somos.html projetos.html agenda.html noticias.html
  galeria.html acervo.html para-escolas.html doar.html voluntariado.html
  contato.html entrar.html minha-area.html privacidade.html
  admin/
    index.html eventos.html presenca.html inscritos.html doacoes.html
    voluntarios.html publicacoes.html galeria.html acervo.html
    contatos.html avisos.html relatorios.html
  assets/
    css/    tokens.css  base.css  componentes.css  impressao.css
    js/
      componentes/  aac-header.js  aac-rodape.js  aac-acessibilidade.js
                    aac-aviso.js  aac-card-evento.js  aac-card-material.js
                    aac-form-campo.js  aac-imagem.js
      dados/        supabase.js  eventos.js  inscricoes.js  doacoes.js
                    voluntarios.js  publicacoes.js  acervo.js  contatos.js
                    indicadores.js
      util/         estados-lista.js  erros.js  fila-offline.js  imagem.js
      paginas/      um módulo por página que precisa de dado
    img/
  config.js               URL do projeto + anon key
netlify.toml
```

Só `site/` é publicado. `material-origem/` e `acervo-web/` ficam fora do versionamento (244 MB).

**Chaves.** A anon key é versionada em `site/config.js` — é pública por construção e a seção 12 do
escopo já registra isso. A service role key nunca entra no repositório: existe apenas como secret da
Edge Function.

---

## 4. Convenções de código

- **Português em toda parte**: tabelas, colunas, funções JS, classes CSS e nomes de arquivo
  (kebab-case, sem acento). O modelo de dados do escopo já é português; estender ao código inteiro é
  o que sustenta RNF07 — quem mantém depois reconhece o que lê.
- Módulos ES nativos, `type="module"`, sem transpilação. `supabase-js` por CDN.
- CSS em quatro arquivos: `tokens.css` (paleta, escalas, espaçamento), `base.css` (reset, tipografia,
  foco visível), `componentes.css`, `impressao.css`.
- Classes semânticas simples. Sem framework CSS, sem utilitários atômicos.
- Um arquivo por responsabilidade. Arquivo que cresce demais é sinal de fronteira errada.

### Paleta

Valores da seção 3.4 do escopo, a validar com a ONG:

```css
--amarelo: #E0A400;  --azul: #7FA9CE;  --azul-texto: #2E5C8A;
--marrom:  #8A6A4A;  --tinta: #241C12; --fundo: #FAF6EE;
```

---

## 5. Acessibilidade — mecanismo

Implementada na fundação, não na fase final.

```css
html { font-size: var(--escala-fonte, 100%); }        /* tudo o mais em rem */
html[data-contraste="alto"] { --fundo:#FFF; --tinta:#000; ... }
```

- Os botões A- / A / A+ e o de contraste alteram essas duas coisas e gravam em `localStorage`.
- Um script inline curto no `<head>` reaplica a preferência **antes da primeira pintura**. Sem isso a
  página pisca no tamanho errado a cada navegação — e num site multi-página isso é constante.
- `aac-form-campo` emite rótulo, campo e mensagem de validação vinculados. Não existe caminho no
  código para criar campo sem rótulo.
- **O painel recusa upload de imagem sem texto alternativo.** Acessibilidade que depende de boa
  vontade de quem publica não sobrevive à entrega; validada no formulário, sobrevive.
- Skip link, landmarks, foco visível, navegação completa por teclado.
- VLibras (widget gov.br) no rodapé.

---

## 6. Modelo de dados e segurança

As 13 tabelas do escopo (seção 10). Decisões acrescentadas aqui:

- **`perfis` com três booleanos** — `eh_voluntario`, `eh_doador`, `eh_equipe` — porque RF10 permite
  acumular papéis, o que uma coluna única de papel não representa. Mais `maioridade_confirmada`
  (RN01, RF12).
- **Situações em `text` com `CHECK`**, não `enum`. Enum do Postgres é caro de alterar, e
  `novo / em_contato / concluido` vai mudar.
- **Busca do acervo**: coluna `tsvector` gerada de título e descrição com dicionário `portuguese` e
  índice GIN. Full-text nativo, sem serviço extra (RF35).
- **Storage**: buckets `galeria` e `acervo` com leitura pública e escrita restrita à equipe;
  `identidade` para o logotipo. Políticas de bucket entram junto com os buckets.

### Três armadilhas decididas antes de aparecerem

Cada uma leva ao mesmo desfecho — desativar a RLS para "destravar" — que é o risco R1.

1. **Recursão de política.** Uma política em `perfis` que consulta `perfis` para saber se o usuário é
   equipe causa recursão infinita. Solução: função `public.eh_equipe()` marcada `SECURITY DEFINER`,
   criada na primeira migration e usada por todas as políticas.
2. **Insert público que aparenta falhar.** Em `inscricoes` e `contatos` a escrita é pública e a
   leitura é negada. O `supabase-js` devolve a linha inserida por padrão, e como ler é proibido a
   inserção parece falhar mesmo tendo gravado. Todo insert público usa `.insert(dados)` sem
   `.select()`, com comentário explicando o porquê no código.
3. **Ordem.** Cada migration cria a tabela **e** suas políticas no mesmo arquivo. Nunca existe tabela
   sem política. Isso antecipa a segurança da fase 02 do escopo para dentro de todas as fases.

### Contenção de envio automatizado

Efeito colateral que a seção 12 do escopo aponta. Sem servidor no meio:

- Trigger `BEFORE INSERT` em `inscricoes` e `contatos` que conta envios por hash de IP, lido de
  `current_setting('request.headers')`, com limite por hora.
- Campo honeypot escondido no formulário.
- Revisão humana da lista pela equipe, como o escopo já prevê.

Sem captcha: custo zero, nenhum atrito para quem se inscreve, e a seção 12 pede apenas limite por
origem e revisão humana. **A permissão de leitura não é afrouxada em nenhuma hipótese.**

### Aceite bloqueante, automatizado

`testes/seguranca.test.mjs`, com o test runner nativo do Node 24 (zero dependências): conecta
com a anon key **sem autenticar** e tenta ler `inscricoes`, `voluntarios`, `doacoes`, `contatos` e
`presencas`. Todas precisam voltar vazias.

O teste é escrito **antes** das políticas e visto falhando uma vez. Teste que nunca falhou não prova
nada — pode estar consultando a tabela errada e passando sempre. Roda antes de cada deploy.

---

## 7. Camada de dados e componentes

**Fronteira:** nenhuma página fala com `supabase-js` diretamente. Um módulo por assunto em
`assets/js/dados/` exporta funções em português (`listarEventosPublicados()`, `inscreverEmEvento()`,
`marcarPresenca()`). A página chama a função e recebe dado pronto.

Ganho concreto: mudança de schema toca um arquivo em vez de chamadas espalhadas por 15 páginas, e
essas funções são testáveis com `node --test` sem navegador.

**Três estados obrigatórios em toda lista** — carregando, vazio, erro — por um helper único
(`util/estados-lista.js`). Sem isso cada tela inventa um comportamento e a agenda vira página branca
quando o sinal cai.

**Texto de erro** segue a seção 11 do escopo: diz o que houve e o que fazer, sem pedir desculpas.

```
✗  "Erro: Failed to fetch"
✗  "Ops! Algo deu errado :( Desculpe!"
✓  "Não foi possível carregar a agenda. Verifique sua conexão."  [ Tentar de novo ]
```

**Regra dos componentes: componente não busca dado, componente recebe dado.** Quem busca é a página.
É o que permite o mesmo cartão de evento servir a agenda pública e o painel, e é o que os torna
testáveis isoladamente.

---

## 8. Painel administrativo

Mobile-first por RNF08 — a ONG não possui dispositivos próprios.

- Navegação **inferior** no celular, na zona do polegar; lateral no desktop.
- Alvos de toque de 44px; nada que dependa de hover.
- Tabela vira lista de cartões no celular. Formulários com `inputmode` correto.

**Tela de presença (RF17)** é a única usada sob pressão real — meio do evento, fila de crianças,
uma mão no celular, sinal instável. Tratamento próprio:

- Nome grande, um botão único alternando presente/ausente.
- Busca por nome no topo e contador fixo ("23 de 40 presentes").
- **Marcação otimista** com fila local (`util/fila-offline.js`): o botão responde na hora, o envio vai
  depois, e reenvia sozinho se a rede falhar. A fila de crianças não espera a rede.
- **Realtime**: dois celulares marcando ao mesmo tempo se veem, sem duplicar.

**Upload de imagem** comprimido no navegador via canvas antes de subir (`util/imagem.js`). A ONG
fotografa com celular e envia arquivos de vários MB; sem compressão o Storage gratuito se esgota e a
galeria fica pesada em rede móvel, contra RNF11 e RNF10.

---

## 9. E-mail e PDF

**Provedor: Brevo.** A decisão D6 assume que não há domínio próprio, e o Resend exige domínio
verificado para enviar a terceiros. O Brevo aceita remetente verificado por e-mail simples
(`atelieafro@gmail.com`). Escolher Resend significaria descobrir o bloqueio no meio da semana da
entrega.

**Edge Function `enviar-email`** é o único ponto do projeto com a service role key. Ela **não confia
no payload**: recebe apenas o identificador do registro, busca os dados no banco e monta a mensagem.
Sem isso, o endereço da função seria um formulário aberto para enviar e-mail em nome da ONG. Também
tem limite por origem. Serve RF18, RF20 e RF28.

O envio nativo do Supabase Auth fica restrito a recuperação de senha, como o escopo determina.

**PDF (RF32): `window.print()` com `impressao.css`**, não biblioteca via CDN. Zero dependência,
tipografia melhor, e — o que decide — funciona no celular pelo "compartilhar → salvar em PDF". A ONG
não tem computador; um gerador em JavaScript afinado para desktop resolveria o requisito errado.

---

## 10. Testes

Nada além do que já existe na máquina.

| O quê | Como |
|---|---|
| Acesso indevido (aceite bloqueante) | `node --test` |
| Módulos da camada de dados | `node --test` contra o projeto Supabase na nuvem |
| Acessibilidade automatizável | `npx @axe-core/cli` |
| Teclado, leitor de tela, contraste | checklist manual — o automatizado cobre parte |
| Os 11 critérios da seção 14 do escopo | checklist executado no celular, não no desktop |

---

## 11. Tratamento do acervo (risco R3)

Iniciado em 24/08, porque não depende de decisão nenhuma. `ferramentas/tratar-acervo.sh`:

1. `soffice --headless --convert-to pdf` nos dois `.pptx` de 36 MB
2. `gs -dPDFSETTINGS=/ebook` com redução para 150 dpi em todos os PDFs, incluindo o de 104 MB
3. Vídeo vai para o canal de YouTube da ONG, não para o Storage
4. Galerias do `meualbum.co` (`/omxupfoc`, `/dffx0xik`, `/ibkgdq69`, `/z8oyy422`) migradas para a
   galeria própria (RF05). Os arquivos originais não estão no material recebido — apenas os atalhos.
   A equipe precisa fornecer as fotos em alta, e apenas aquelas com autorização de uso de imagem
   registrada (RN07)

Destrava a fase 05 sem consumir tempo de ninguém — é processamento em segundo plano.

---

## 12. Ordem de execução

| Dia | Entrega |
|---|---|
| 24–25/08 | Repositório, sistema visual, cabeçalho/rodapé/acessibilidade, utilitários de erro e estado, contrato do cliente Supabase. Acervo tratado |
| 26–27/08 | Site institucional completo com conteúdo real — 9 páginas (RF01–RF07, RF38, RF39) |
| 28/08 | Projeto Supabase na nuvem, `eh_equipe()`, migrations com políticas, teste de segurança escrito falhando e depois passando, autenticação, casca do painel (RF08–RF12, RF33, RF34) |
| 29/08 | Eventos: agenda, inscrição sem conta, inscritos, presença com Realtime (RF13–RF17) |
| 30/08 | Edge Function e Brevo; doações ponta a ponta (RF18, RF19–RF23) |
| 31/08 | Voluntariado e acervo aberto (RF24–RF26, RF35–RF37) |
| 01/09 | Comunicação interna e relatórios (RF27–RF32) |
| 02/09 | Auditoria de acessibilidade, política de privacidade, desempenho |
| 03/09 | Deploy em produção com contas reais; teste de aceite no celular da ONG |
| 04/09 | Reserva para imprevisto, manual e treinamento |

Segurança não é uma fase: cada migration nasce com suas políticas e o teste roda desde o primeiro dia.

---

## 13. Dependências da equipe

Como o desenvolvimento é feito pelo agente, este é o caminho crítico real.

| Prazo | O que | Bloqueia |
|---|---|---|
| **Hoje** | Criar Supabase (região São Paulo), Netlify e Brevo | **Fase 02, em 28/08** — sem Docker local, não há alternativa ao projeto na nuvem |
| 27/08 | Validar textos institucionais; conferir grafias e datas do clipping (seção 18.2 pede explicitamente) | Publicação do site |
| 27/08 | Logotipo em vetor ou autorização para redesenho (D9) | Sistema visual |
| 29/08 | Fotos com autorização de uso de imagem registrada (RN07, risco R10), incluindo os arquivos dos quatro álbuns do `meualbum.co` — o material recebido traz só os atalhos | Galeria (RF05) |
| 30/08 | Chave Pix institucional, ou confirmação de que segue a conta pessoal (D7) | Página de doação |
| 03/09 | Uma pessoa da ONG executando as quatro tarefas no próprio celular | Aceite de transferência |

---

## 14. Premissas mantidas do escopo

As decisões D2, D3, D5, D6, D7, D8, D9, D11 e D12 seguem as premissas já definidas na seção 16 do
documento de escopo. D10 foi respondida pelo usuário: equipe de 4 pessoas, entrega em 04/09/2026.

Nada da seção 9 (fora do escopo) é implementado.
