/**
 * ferramentas/entrega/gerar-proposta.mjs — a Proposta de Impacto.
 *
 * =====================================================================
 * TODA AFIRMACAO AQUI TEM FONTE, E A FONTE APARECE NA PAGINA
 * =====================================================================
 *
 * O material e' o Formulario de Levantamento respondido pela PROPRIA ONG
 * (material-origem/), e as citacoes sao literais — inclusive os erros de
 * digitacao, que ficam como estao. E' a regra 2 do projeto aplicada a um
 * documento de entrega: nada de numero estimado, nada de "impacto
 * esperado" que ninguem prometeu.
 *
 * O QUE ESTE DOCUMENTO NAO FAZ, e a ausencia e' o ponto: ele nao diz
 * quantas pessoas serao alcancadas. A ONG nao mediu nada ate hoje —
 * "todos os nossos processos atualmente sao feitos de maneira manual" —,
 * entao qualquer numero de alcance seria inventado. O que ele diz e' outra
 * coisa, e e' verificavel: QUAIS medicoes passam a existir, e por que
 * antes elas nao existiam.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { PROJETO } from './dados.mjs';
import { ESTILO } from './estilo-documento.mjs';

const DESTINO = 'entrega/00-proposta-de-impacto';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Uma citação literal do formulário, com a seção de origem. */
const cita = (texto, secao) =>
  `<blockquote>${esc(texto)}<cite>Formulário de Levantamento, §${esc(secao)}</cite></blockquote>`;

const EXTRA = `
blockquote {
  margin: 1em 0;
  padding: .7em 1em;
  border-left: 5px solid var(--ocre);
  background: var(--creme);
  font-style: italic;
  break-inside: avoid;
}
blockquote cite {
  display: block;
  margin-top: .4em;
  font-style: normal;
  font-size: 8.5pt;
  opacity: .8;
}
.dor { break-inside: avoid; margin-bottom: 1.4em; }
.dor h3 { margin-bottom: .2em; }
.dor .antes, .dor .depois { margin: .3em 0; padding-left: 1.4em; position: relative; }
.dor .antes::before { content: "Antes"; }
.dor .depois::before { content: "Agora"; }
.dor .antes::before, .dor .depois::before {
  position: absolute; left: 0; top: 0;
  font-size: 7.5pt; font-weight: bold; text-transform: uppercase;
  letter-spacing: .05em; opacity: .7;
}
.dor .antes { padding-left: 3.4em; }
.dor .depois { padding-left: 3.4em; }
`;

function dor(titulo, antes, depois) {
  return `<div class="dor">
    <h3>${esc(titulo)}</h3>
    <p class="antes">${antes}</p>
    <p class="depois">${depois}</p>
  </div>`;
}

const documento = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Proposta de Impacto — ${esc(PROJETO.nome)}</title>
<style>${ESTILO}${EXTRA}</style>
</head>
<body>

<section class="capa">
  <div class="capa__faixa"></div>
  <h1>Proposta de Impacto</h1>
  <p class="sub">${esc(PROJETO.nome)} — ${esc(PROJETO.subtitulo)}</p>
  <dl>
    <dt>Organização</dt><dd>Ateliê Afro Cultural · CNPJ 24.369.179/0001-17</dd>
    <dt>Onde</dt><dd>Casa Verde, zona norte de São Paulo</dd>
    <dt>Contexto</dt><dd>${esc(PROJETO.contexto)}</dd>
    <dt>Entrega</dt><dd>${esc(PROJETO.entrega)}</dd>
    <dt>Sistema no ar</dt><dd>${esc(PROJETO.endereco)}</dd>
  </dl>
  <div class="capa__faixa capa__faixa--fim"></div>
</section>

<h2>1. A organização</h2>

<p>O Ateliê Afro Cultural é um espaço de arte, cultura e memória afro-brasileira na Casa
Verde, zona norte de São Paulo. Está em atividade há <strong>entre 3 e 10 anos</strong> e é
mantido por <strong>1 a 5 pessoas</strong>, entre voluntários e colaboradores.</p>

${cita('Promover a valorização da cultura e da memória afro-brasileira por meio da arte, da educação e das vivências artísticas culturais, fortalecendo a identidade, a autoestima e o sentimento de pertencimento de crianças, jovens e adultos.', '1 — missão')}

<p><strong>Não é uma organização assistencialista</strong>, e essa distinção governa o produto
inteiro: o público não é atendido, é <em>formado</em>. Por isso não há no site estética de
pena, linguagem de caridade nem contador de "vidas salvas" — há um catálogo de espetáculos,
uma agenda de oficinas e um acervo educativo.</p>

<p>O público começa aos <strong>10 anos</strong>, e essa é a informação que mais decide
arquitetura: cada dado pessoal que o sistema guarda pode ser de uma criança.</p>

<h2 class="secao">2. O problema, nas palavras da ONG</h2>

<p>Este documento não interpreta a dor da organização — ele a cita. As três frases abaixo são
literais do formulário que a própria ONG respondeu, e são o motivo de o projeto existir.</p>

<h3>2.1 Tudo é feito à mão</h3>

${cita('Sim, todos os nossos processos atualmente são feitos de maneira manual.', '4 — processos manuais')}

<p>Não há planilha, não há sistema, não há cadastro. Inscrição em oficina, lista de presença,
contato de quem quer ajudar, registro de doação — tudo vive em conversas de WhatsApp e na
memória de quem estava lá.</p>

<h3>2.2 A oportunidade que passou</h3>

${cita('Sim. No ano de 2021, passamos no programa do Caldeirão de Huck, em rede nacional e muitas pessoas e empresas queriam nos apoiar, porem não tínhamos nem estrutura nem preparo.', '4 — perda de oportunidades')}

<p><strong>Esta é a frase mais importante do formulário.</strong> Ela descreve um evento
datado, de alcance nacional, em que a demanda existiu e a organização não teve como
recebê-la. Não foi falta de causa, nem de público, nem de interesse — foi falta de
<em>estrutura para atender</em>.</p>

<p>É a diferença entre uma ONG que precisa de mais visibilidade e uma que já teve visibilidade
e não conseguiu convertê-la. O problema a resolver não é ser vista: é <strong>ter para onde
mandar quem viu</strong>.</p>

<h3>2.3 A doação sem registro</h3>

${cita('Dificilmente recebemos doações, quando isso acontece e realizado via pix na conta do proponente Wil Oliveira.', '4 — controle de doações')}

<p>Duas consequências, e nenhuma delas é sobre dinheiro. A primeira: <strong>não existe
registro institucional</strong> — a única memória de uma doação é o extrato pessoal de alguém.
A segunda: para uma empresa que queira apoiar, um Pix para conta de pessoa física é um
obstáculo de <em>governança</em>, não de valor.</p>

<h3>2.4 Nenhum equipamento</h3>

${cita('(X) Não possui dispositivos próprios', '7 — tecnologia')}

<p>A ONG não tem computador. Toda operação acontece no celular pessoal de quem faz — muitas
vezes de pé, no meio de um evento. Isso não é um detalhe de conforto: é a restrição que
elimina metade das soluções possíveis.</p>

<h2 class="secao">3. O que o sistema muda</h2>

<p>Cada bloco abaixo liga uma dor citada acima a um mecanismo que existe e está no ar.
Nenhum deles promete resultado; todos descrevem <em>capacidade</em>.</p>

${dor('Quem quer participar, se inscreve sozinho',
  'A pessoa manda mensagem no WhatsApp. Alguém precisa ver, responder, anotar em algum lugar, e lembrar no dia.',
  '<strong>Inscrição sem conta</strong>, direto na página do evento — o sistema confere a vaga, pede o responsável quando é menor de idade e registra a autorização de uso de imagem. A ONG abre a lista pronta.')}

${dor('Quem quer ajudar, encontra a porta',
  'Em 2021 a demanda chegou por televisão nacional e não havia onde recebê-la.',
  '<strong>Três portas abertas o tempo todo:</strong> um formulário de contato que grava num registro central com fila de atendimento, uma candidatura de voluntariado com áreas de atuação, e uma oferta de doação que a equipe responde por escrito e por e-mail. Nada mais depende de alguém lembrar.')}

${dor('A doação vira registro',
  'A memória de uma doação era o extrato pessoal de uma pessoa física.',
  'Toda oferta fica registrada com data, doador, descrição e — quando aplicável — valor, e a resposta da ONG fica junto. O sistema <strong>não processa pagamento</strong>: ele registra o que aconteceu, que é exatamente o que faltava.')}

${dor('A operação cabe no celular',
  'Não há computador. Publicar qualquer coisa dependia de quem tivesse um por perto.',
  'As <strong>21 telas do painel</strong> são desenhadas para a mão, não para o mouse. A lista de presença é a mais extrema: sem paginação, botões grandes, e funciona <strong>sem JavaScript</strong> — o que importa num galpão com internet ruim.')}

${dor('O acervo alcança quem a agenda não alcança',
  'Uma oficina atende uma turma. O conteúdo produzido ficava com quem estava na sala.',
  'O <strong>acervo aberto</strong> publica material educativo com busca por texto e download livre, sem cadastro. É o único módulo cujo alcance não é limitado pela agenda física da ONG — e responde ao que ela chamou de "sonho" no formulário: <em>uma biblioteca digital com conteúdos produzidos pelo Ateliê</em>.')}

<h2 class="secao">4. Como o impacto será medido</h2>

<p><strong>Este documento não apresenta números de alcance, e a ausência é deliberada.</strong>
A organização nunca mediu nada — não por descuido, mas porque não havia com o quê. Estimar
agora seria inventar uma linha de base.</p>

<p>O que o projeto entrega no lugar é o <em>instrumento</em>. A partir da entrega, estes
números passam a existir e a ser lidos pela própria equipe, do celular:</p>

<table>
  <thead><tr><th>O que passa a ser contado</th><th>Onde</th><th>Para quê</th></tr></thead>
  <tbody>
    <tr><td>Inscritos por evento, e quantos de fato vieram</td><td>Lista de presença</td><td>Prestação de contas de edital</td></tr>
    <tr><td>Mensagens recebidas e em que pé está cada atendimento</td><td>Registro central de contatos</td><td>Nenhuma oportunidade se perde por esquecimento</td></tr>
    <tr><td>Candidaturas de voluntariado, por área</td><td>Painel de voluntários</td><td>Saber com quem se conta</td></tr>
    <tr><td>Ofertas de doação, resposta dada e o que foi recebido</td><td>Painel de doações</td><td>Registro institucional, no lugar do extrato pessoal</td></tr>
    <tr><td>Os seis indicadores do momento</td><td>Início do painel</td><td>O que precisa de atenção hoje</td></tr>
    <tr><td>Tudo isso em planilha e em PDF</td><td>Exportação e relatório</td><td>Anexar a edital, sem apoio técnico</td></tr>
  </tbody>
</table>

<div class="nota">
  <strong>A honestidade que este quadro exige</strong>
  Um número que não respondeu aparece como <em>traço</em>, nunca como zero. Zero é uma
  afirmação — "ninguém se inscreveu" —, e num relatório que vira anexo de e-mail um zero
  inventado sobrevive à causa. A mesma disciplina vale para a lista de presença, que tem
  <strong>três</strong> estados e não dois: veio, não veio, e <em>ninguém conferiu</em>. Sem o
  terceiro, uma lista que ninguém abriu viraria uma lista de faltas.
</div>

<h2 class="secao">5. Os critérios de sucesso da própria ONG</h2>

<p>A seção 9 do formulário lista como a organização saberá que o projeto deu certo. Abaixo,
cada critério e o que o sistema faz por ele — e onde ele não faz nada, isso está dito.</p>

<table>
  <thead><tr><th>Critério, nas palavras da ONG</th><th>O que o sistema faz</th></tr></thead>
  <tbody>
    <tr><td>"Crescimento no número de crianças inscritas e participantes das atividades"</td>
        <td>Inscrição sem conta remove o atrito, e a lista de presença passa a contar quem de fato veio. <strong>O número existe pela primeira vez</strong></td></tr>
    <tr><td>"Aumento da participação de escolas, famílias e comunidades"</td>
        <td>A área "Para Escolas" reúne atividades, faixas etárias, formatos e o que a escola precisa providenciar, com formulário próprio</td></tr>
    <tr><td>"Mais empresas e pessoas apoiando por meio de doações e parcerias"</td>
        <td>Oferta de doação com resposta registrada e enviada por e-mail. <strong>O sistema não capta recurso</strong> — ele impede que quem ofereceu fique sem resposta</td></tr>
    <tr><td>"Depoimentos e avaliações positivas"</td>
        <td>Não há mecanismo de depoimento no escopo entregue. É um caminho natural para a próxima fase</td></tr>
    <tr><td>"Ampliação do acesso aos conteúdos educativos"</td>
        <td>O acervo aberto, com busca e download livre sem cadastro</td></tr>
    <tr><td>"Expansão para novos territórios e maior reconhecimento"</td>
        <td>Depende de divulgação e de trabalho da ONG. O site é condição, não causa</td></tr>
  </tbody>
</table>

<h2 class="secao">6. O que este projeto não resolve</h2>

<p>A ONG nomeou três dificuldades principais. O sistema toca <strong>uma e meia</strong>, e
dizer isso é parte da proposta.</p>

<table>
  <thead><tr><th>Dificuldade declarada</th><th>O projeto</th></tr></thead>
  <tbody>
    <tr><td><strong>Captação de recursos e sustentabilidade financeira</strong></td>
        <td>Parcialmente. Ele abre e organiza o canal, e garante resposta a quem ofereceu — mas <strong>não capta, não cobra e não processa pagamento</strong></td></tr>
    <tr><td><strong>Ampliação de parcerias e visibilidade</strong></td>
        <td>Sim, e é onde ele mais pesa: dá endereço próprio, presença pública e um lugar para onde mandar quem se interessou</td></tr>
    <tr><td><strong>Espaço físico adequado e estrutura</strong></td>
        <td>Não, e nenhum software resolveria</td></tr>
  </tbody>
</table>

<p>Duas outras honestidades:</p>

<ul>
  <li>A <strong>conta institucional</strong> para receber doações ainda está sendo organizada
  pela ONG. Enquanto isso, a chave Pix exibida no site é de teste, e diz isso em três lugares
  diferentes — inclusive dentro da imagem, para sobreviver a uma captura de tela circulando
  por mensagem;</li>
  <li>o <strong>treinamento presencial</strong> da equipe não aconteceu. O manual está escrito
  e há um guia de uma página para imprimir, mas manual não substitui alguém do lado.</li>
</ul>

<h2 class="secao">7. Sustentabilidade</h2>

<p>A ONG declarou dificuldade de sustentabilidade financeira e é mantida por 1 a 5 pessoas.
Um sistema que custasse mensalidade seria abandonado, e um que exigisse programador para
publicar uma notícia seria pior que nenhum.</p>

<table>
  <thead><tr><th>Item</th><th>Custo</th></tr></thead>
  <tbody>
    <tr><td>Hospedagem, banco de dados, autenticação e armazenamento</td><td>camada gratuita</td></tr>
    <tr><td>Envio de e-mail</td><td>camada gratuita</td></tr>
    <tr><td>Domínio próprio</td><td>cerca de R$ 40 por ano</td></tr>
    <tr><td><strong>Total recorrente</strong></td><td><strong>o domínio, e mais nada</strong></td></tr>
  </tbody>
</table>

<p>E a manutenção do <em>conteúdo</em> é da própria ONG, que foi o que ela respondeu quando
perguntada quem cuidaria do sistema depois. Nenhuma tela exige código: notícia, evento, foto,
material do acervo, texto de projeto e aviso interno são todos editáveis pelo painel, do
celular.</p>

<div class="nota">
  <strong>Por que isso é uma decisão de impacto, e não técnica</strong>
  Um site que depende de quem o construiu tem prazo de validade curto. A entrega precisa
  sobreviver ao semestre — e a única forma de isso acontecer é a equipe conseguir mexer nele
  sozinha, do aparelho que ela tem.
</div>

<p class="rodape-doc">
  ${esc(PROJETO.nome)} · Proposta de Impacto · ${esc(PROJETO.entrega)}.
  Todas as citações são literais do Formulário de Levantamento respondido pela organização.
</p>

</body>
</html>`;

await mkdir(DESTINO, { recursive: true });
await writeFile(`${DESTINO}/proposta-de-impacto.html`, documento);
console.log(`  ✅ ${DESTINO}/proposta-de-impacto.html`);
