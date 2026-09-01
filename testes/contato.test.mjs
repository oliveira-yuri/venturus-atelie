/**
 * Contato (RF07) — o formulário público de /contato, gravando em
 * `public.contatos`, mais a metade do site da migration 007 (o limite de
 * envio por visitante).
 *
 * ===================================================================
 * ESTE ARQUIVO É DIFERENTE DOS QUATRO DO PAINEL, E VALE DIZER POR QUÊ
 * ===================================================================
 *
 * testes/publicacoes.test.mjs, galeria.test.mjs e atividades.test.mjs
 * começam todos com o mesmo aviso: não existe sessão de equipe, então o
 * caminho do SUCESSO não roda em lugar nenhum. Aqui roda — quem envia é o
 * público, `anon` tem `grant insert` em `public.contatos` e a política é
 * `for insert with check (true)`.
 *
 * O que NÃO está neste arquivo, de propósito: nenhum teste automático
 * envia um formulário VÁLIDO com o Supabase configurado. Isso gravaria uma
 * linha inventada no banco de produção a cada rodada de
 * `npm run test:supabase`, e gastaria o limite de envio de quem usa o site.
 * O caminho do sucesso contra o banco real foi percorrido à mão, uma vez,
 * e está no relatório da tarefa — com o que foi gravado escrito lá.
 *
 * O que sobra aqui, e cobre o resto:
 *
 *   1. AS DECISÕES PURAS — o que é uma mensagem válida, o que conta como
 *      consentimento, de qual cabeçalho sai a origem, o que o `?aviso=`
 *      pode dizer de volta, e como um erro do banco vira frase.
 *   2. O QUE A PÁGINA SERVE, por HTTP, contra o servidor da suíte.
 *   3. QUE A SERVER ACTION NÃO GANHE UMA GUARDA DE EQUIPE POR ENGANO —
 *      varredura do código-fonte, e é o CONTRÁRIO da varredura das Actions
 *      do painel.
 *   4. O ENVIO SEM JAVASCRIPT, com Firefox, apertando o botão.
 *
 * A prova de que o hash calculado aqui é o MESMO que o Postgres calcula
 * mora em testes/rls.test.mjs, que tem um Postgres de verdade à mão.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Builder, By, until } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import {
  lerContato, validarContato,
  LIMITE_NOME, LIMITE_EMAIL, LIMITE_INSTITUICAO, LIMITE_MENSAGEM
} from '../compartilhado/validacao.ts';
import {
  ipDoVisitante, hashDaOrigem, origemDoVisitante, CABECALHOS_DE_IP, SEM_IP
} from '../compartilhado/origem-do-visitante.ts';
import { avisoDeContato } from '../compartilhado/avisos-de-contato.ts';
import { mensagemDeErroDeEnvio, LIMITE_DE_ENVIOS, FUNCAO_NAO_EXISTE } from '../compartilhado/erros.ts';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const COM_SUPABASE = process.env.COM_SUPABASE === '1'
  || process.env.COM_SUPABASE === 'chave-errada';

function formulario(campos) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

/** Uma mensagem de exemplo. NÃO é contato de ninguém — é dado de teste. */
const VALIDO = {
  nome: 'Fulana de Teste',
  email: 'fulana@exemplo.test',
  mensagem: 'Mensagem de teste automatizado.',
  consentimento: 'on'
};

// =====================================================================
// 1. As decisões puras
// =====================================================================

test('o formulário é lido campo a campo, e campo que não está na lista não existe', () => {
  const dados = formulario({
    ...VALIDO,
    telefone: '11953968344',
    instituicao: 'EMEF de Teste',
    // Os três campos que uma requisição montada à mão tentaria injetar.
    // `origem` tem `check (origem in (...))` e é coluna de trabalho da ONG;
    // `situacao` decide se a mensagem aparece como pendente para quem
    // atende — nascer 'concluido' é nascer invisível; e
    // `consentimento_dados` é a coluna que a LGPD apoia. Se `lerContato`
    // espalhasse o FormData num objeto, os três chegariam ao insert.
    origem: 'doacao',
    situacao: 'concluido',
    consentimento_dados: 'true'
  });

  assert.deepEqual(lerContato(dados), {
    nome: 'Fulana de Teste',
    email: 'fulana@exemplo.test',
    telefone: '11953968344',
    instituicao: 'EMEF de Teste',
    mensagem: 'Mensagem de teste automatizado.',
    consentimento: true
  });
});

test('nome, e-mail e mensagem são obrigatórios, e os erros voltam todos de uma vez', () => {
  const { valido, erros } = validarContato(lerContato(formulario({})));

  assert.equal(valido, false);
  assert.match(erros.nome, /Escreva seu nome/);
  assert.match(erros.email, /endereço completo/);
  assert.match(erros.mensagem, /Escreva sua mensagem/);
  assert.match(erros.consentimento, /concorde com o uso dos seus dados/);
});

test('telefone e instituição são opcionais — mensagem sem os dois é válida', () => {
  const { valido, erros } = validarContato(lerContato(formulario(VALIDO)));
  assert.equal(valido, true, `recusou uma mensagem completa: ${JSON.stringify(erros)}`);
});

test('sem o consentimento a mensagem é recusada — é o que o banco também recusa', () => {
  const semCaixa = { ...VALIDO };
  delete semCaixa.consentimento;

  const { valido, erros } = validarContato(lerContato(formulario(semCaixa)));

  assert.equal(valido, false, 'aceitou envio sem consentimento de uso dos dados');
  assert.match(erros.consentimento, /política de privacidade/);
});

test('caixa de marcar: "false" no corpo da requisição NÃO conta como marcada', () => {
  // O navegador manda "on" quando marcada e OMITE o campo quando não. Quem
  // monta a requisição à mão manda o que quiser — inclusive a string
  // "false", que é verdadeira em JavaScript. Ver `marcado()` em
  // compartilhado/validacao.ts.
  for (const valor of ['false', '0', 'off', 'não', ' ']) {
    const campos = lerContato(formulario({ ...VALIDO, consentimento: valor }));
    assert.equal(campos.consentimento, false,
      `"${valor}" foi tratado como consentimento dado`);
  }
});

test('espaço em branco não é mensagem: "   " é recusado como vazio', () => {
  const { erros } = validarContato(lerContato(formulario({ ...VALIDO, mensagem: '   ' })));
  assert.match(erros.mensagem, /Escreva sua mensagem/);
});

test('as quebras de linha do MEIO da mensagem sobrevivem ao trim', () => {
  const campos = lerContato(formulario({ ...VALIDO, mensagem: '\n\n  um\n\ndois  \n\n' }));
  assert.equal(campos.mensagem, 'um\n\ndois');
});

test('telefone é opcional, mas quando vem precisa do DDD', () => {
  const curto = validarContato(lerContato(formulario({ ...VALIDO, telefone: '95396' })));
  assert.match(curto.erros.telefone, /DDD/);

  const bom = validarContato(lerContato(formulario({ ...VALIDO, telefone: '(11) 95396-8344' })));
  assert.equal(bom.valido, true, `recusou telefone válido: ${JSON.stringify(bom.erros)}`);
});

test('cada campo tem teto de tamanho — a Action é endpoint público, e text no Postgres não tem', () => {
  const grande = (n) => 'a'.repeat(n + 1);

  const porNome = validarContato(lerContato(formulario({ ...VALIDO, nome: grande(LIMITE_NOME) })));
  assert.match(porNome.erros.nome, /passou de 120 caracteres/);

  const porEmail = validarContato(lerContato(formulario({
    ...VALIDO, email: `${'a'.repeat(LIMITE_EMAIL)}@exemplo.test`
  })));
  assert.match(porEmail.erros.email, /passou de 254 caracteres/);

  const porInstituicao = validarContato(lerContato(formulario({
    ...VALIDO, instituicao: grande(LIMITE_INSTITUICAO)
  })));
  assert.match(porInstituicao.erros.instituicao, /passou de 160 caracteres/);

  const porMensagem = validarContato(lerContato(formulario({
    ...VALIDO, mensagem: grande(LIMITE_MENSAGEM)
  })));
  assert.match(porMensagem.erros.mensagem, /passou de 5000 caracteres/);
});

test('um File no lugar de um campo de texto não vira a string "[object File]"', () => {
  const dados = new FormData();
  dados.set('nome', new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
  dados.set('mensagem', new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));

  const campos = lerContato(dados);
  assert.equal(campos.nome, '');
  assert.equal(campos.mensagem, '');
});

// =====================================================================
// 2. A origem do visitante (a metade do site da migration 007)
// =====================================================================

/**
 * Os cabeçalhos escritos PELA PLATAFORMA, um por hospedagem suportada.
 *
 * Nenhuma das duas escreve o da outra, então na prática só um existe por
 * requisição — mas os dois precisam vencer o `x-forwarded-for`, que é o
 * único da lista que quem faz a requisição consegue mandar.
 *
 * Os nomes vieram da documentação de cada plataforma, não de memória; o de
 * onde saiu cada um está no bloco de segurança de
 * `compartilhado/origem-do-visitante.ts`. O da Vercel NUNCA foi visto numa
 * requisição de verdade: o projeto nunca foi publicado lá.
 */
const CABECALHOS_DE_PLATAFORMA = [
  ['Netlify', 'x-nf-client-connection-ip'],
  ['Vercel', 'x-vercel-forwarded-for']
];

for (const [plataforma, cabecalho] of CABECALHOS_DE_PLATAFORMA) {
  test(`o cabeçalho da ${plataforma} (${cabecalho}) vence o x-forwarded-for — a ordem é a defesa contra forjar o balde`, () => {
    // `x-forwarded-for` pode ser mandado por quem faz a requisição: se ele
    // viesse primeiro, trocar de balde a cada envio seria trivial e o
    // limite não existiria. O cabeçalho da plataforma é escrito por ela.
    const ler = (nome) => ({
      [cabecalho]: '203.0.113.7',
      'x-forwarded-for': '198.51.100.1',
      'x-real-ip': '198.51.100.2'
    })[nome];

    assert.equal(ipDoVisitante(ler), '203.0.113.7');
  });
}

test('TODO cabeçalho de plataforma vem antes do x-forwarded-for na lista', () => {
  // Afirmação por PROPRIEDADE, não por posição. Antes isto era
  // `CABECALHOS_DE_IP[0] === 'x-nf-client-connection-ip'`, o que travava o
  // índice 0 e não dizia nada sobre um segundo cabeçalho de plataforma —
  // acrescentar o da Vercel na frente do da Netlify teria quebrado o teste
  // sem nada de errado ter acontecido, e acrescentá-lo DEPOIS do
  // `x-forwarded-for` (que é o erro de verdade) teria passado.
  const forjavel = CABECALHOS_DE_IP.indexOf('x-forwarded-for');
  assert.notEqual(forjavel, -1, 'x-forwarded-for saiu da lista');

  for (const [plataforma, cabecalho] of CABECALHOS_DE_PLATAFORMA) {
    const posicao = CABECALHOS_DE_IP.indexOf(cabecalho);
    assert.notEqual(
      posicao, -1,
      `${cabecalho} (${plataforma}) sumiu de CABECALHOS_DE_IP — o limite de envio naquela `
      + 'plataforma passa a ser contado pelo x-forwarded-for, e ninguém vê diferença nenhuma '
      + 'até chegar o envio em massa.'
    );
    assert.ok(
      posicao < forjavel,
      `${cabecalho} (${plataforma}) ficou DEPOIS de x-forwarded-for.\n`
      + '  x-forwarded-for é mandado por quem faz a requisição: com ele na frente, qualquer\n'
      + '  pessoa troca de balde a cada envio e o limite de 30/hora por origem deixa de\n'
      + '  existir, sem erro nenhum aparecer. Ver o bloco de segurança em\n'
      + '  compartilhado/origem-do-visitante.ts.'
    );
  }
});

test('x-forwarded-for é uma lista, e quem interessa é o primeiro da fila', () => {
  const ler = (nome) => (nome === 'x-forwarded-for' ? '198.51.100.1, 10.0.0.1, 10.0.0.2' : null);
  assert.equal(ipDoVisitante(ler), '198.51.100.1');
});

test('sem cabeçalho nenhum a origem é "desconhecida" — um balde só, e não nenhum limite', () => {
  // Comportamento seguro pedido pela spec §4.6: degrada para o limite
  // global de antes, em vez de desligar o limite. Cabeçalho presente mas
  // VAZIO conta como ausente.
  assert.equal(ipDoVisitante(() => null), SEM_IP);
  assert.equal(ipDoVisitante(() => ''), SEM_IP);
  assert.equal(ipDoVisitante(() => '  ,  '), SEM_IP);
  assert.equal(ipDoVisitante(() => undefined), SEM_IP);
});

test('o que vai ao banco é um hash SHA-256, nunca o endereço', () => {
  const hash = origemDoVisitante((nome) => (nome === 'x-forwarded-for' ? '203.0.113.7' : null));

  assert.match(hash, /^[0-9a-f]{64}$/, 'o formato precisa casar com o `~ ^[0-9a-f]{64}$` da migration 007');
  assert.ok(!hash.includes('203.0.113.7'), 'o endereço apareceu no valor gravado');

  // DOIS VETORES ESCRITOS À MÃO, e não gerados pelo próprio código: um
  // teste que calcula o esperado com a implementação aprova qualquer coisa
  // que ela passe a devolver. Estes dois valores são os do `sha256` do
  // Postgres, e é isso que testes/rls.test.mjs confere contra um banco de
  // verdade — se a soma daqui mudar, os baldes dos dois lados deixam de ser
  // o mesmo balde e nada na tela acusa.
  assert.equal(hashDaOrigem('desconhecida'),
    'd32330ff2b019c4f5b9717b19b488ed78df9b98e9074a99df8a6420f4bf768c3');
  assert.equal(hashDaOrigem('203.0.113.7'),
    'fec52565aa0cf18f57d7cf5b3ac728503b8992d2d6f7d46da1d1201090902b02');
  assert.equal(hash, hashDaOrigem('203.0.113.7'));
});

// =====================================================================
// 3. O aviso da URL e a tradução de erro
// =====================================================================

test('o aviso da URL só escolhe uma frase nossa — nunca traz uma', () => {
  assert.equal(avisoDeContato('Deposite na chave Pix 000'), null);
  assert.equal(avisoDeContato(undefined), null);
  assert.equal(avisoDeContato(['enviada']), null);

  // `Object.hasOwn`: sem ele, estes três devolveriam algo herdado do
  // protótipo de Object e a tela tentaria desenhar aquilo.
  for (const herdado of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(avisoDeContato(herdado), null, `"${herdado}" atravessou a lista fechada`);
  }

  assert.equal(avisoDeContato('enviada')?.ok, true);
});

test('a confirmação diz que a mensagem foi registrada, e NÃO promete prazo de resposta', () => {
  // Regra 2 do CLAUDE.md aplicada a uma confirmação: a tela da equipe para
  // ler estes registros (RF29) ainda não existe, então "responderemos em
  // até X" seria promessa que ninguém fez. O que a frase faz é apontar
  // para o canal que funciona hoje.
  const { texto } = avisoDeContato('enviada');

  assert.match(texto, /registrada com o Ateliê/);
  assert.match(texto, /\(11\) 95396-8344/, 'a confirmação precisa terminar num canal real');
  assert.doesNotMatch(texto, /\d+\s*(horas|dias|úteis)/,
    'a confirmação promete um prazo de resposta que ninguém prometeu');
});

test('o limite de envio do banco vira uma frase, e não um erro de Postgres', () => {
  const traduzido = mensagemDeErroDeEnvio({ code: LIMITE_DE_ENVIOS, message: 'muitos envios em pouco tempo' });

  assert.equal(traduzido.conhecido, true);
  assert.match(traduzido.mensagem, /ponto de acesso/);
  assert.match(traduzido.mensagem, /WhatsApp/, 'a recusa precisa oferecer um caminho que não dependa de esperar');
  assert.doesNotMatch(traduzido.mensagem, /P0001|PGRST|postgres/i, 'jargão vazou para a tela');
});

test('código não previsto vira mensagem genérica E se declara desconhecido, para o log ficar com o erro', () => {
  const traduzido = mensagemDeErroDeEnvio({ code: '42P01', message: 'relation does not exist' });

  assert.equal(traduzido.conhecido, false);
  assert.doesNotMatch(traduzido.mensagem, /42P01|relation/,
    'o erro cru do Postgres chegou à tela');
  assert.match(traduzido.mensagem, /atelieafro@gmail\.com/);
});

test('o código de "função não existe" é o que faz a Action cair no caminho antigo', () => {
  // Não é erro de quem enviou: é a migration 007 ainda não aplicada. O
  // valor precisa ser o do PostgREST — errar a constante faria a Action
  // mostrar uma falha em vez de gravar pelo caminho antigo, e ninguém
  // notaria até alguém tentar enviar uma mensagem de verdade.
  assert.equal(FUNCAO_NAO_EXISTE, 'PGRST202');
});

// =====================================================================
// 4. A varredura da Server Action — o CONTRÁRIO da varredura do painel
// =====================================================================

/** O código sem os comentários — mesma função de testes/publicacoes.test.mjs. */
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n');
}

async function codigoDaAction() {
  const caminho = fileURLToPath(new URL('../acoes/contato.ts', import.meta.url));
  return semComentarios(await readFile(caminho, 'utf8'));
}

test('a Action de contato NÃO chama ehEquipe() — este formulário é público, e isso é o desenho', async () => {
  // Existe porque a próxima pessoa a ler as quatro Actions irmãs
  // (publicações, galeria, atividades) vai encontrar `ehEquipe()` em todas
  // e concluir que aqui faltou. Não faltou: `contatos: qualquer pessoa
  // escreve` (`for insert with check (true)`, 004_pessoas.sql) e quem
  // escreve para a ONG não tem conta. Uma guarda aqui fecharia o único
  // canal do site que qualquer pessoa pode usar — e o teste que quebraria
  // seria só este.
  assert.doesNotMatch(await codigoDaAction(), /ehEquipe/,
    'acoes/contato.ts passou a exigir sessão de equipe. Se isso foi de propósito, o RF07 mudou '
    + 'de escopo e este teste precisa ser revisto junto — não apagado sozinho.');
});

test('a Action não espalha o FormData num objeto', async () => {
  assert.doesNotMatch(await codigoDaAction(), /\.\.\.\s*campos/,
    'é assim que um campo inventado no corpo da requisição chega inteiro ao banco '
    + '(regra 6 do CLAUDE.md)');
});

test('a Action nunca escreve `situacao` — o fluxo de atendimento é da equipe, não de quem escreve', async () => {
  // Sem isto, um `situacao=concluido` no corpo faria a mensagem nascer
  // invisível para quem atende.
  assert.doesNotMatch(await codigoDaAction(), /situacao/,
    'acoes/contato.ts menciona `situacao`. Se isso virar um valor gravado, uma mensagem pode '
    + 'nascer já concluída e ninguém a lê.');
});

test('o insert em contatos NÃO pede a linha de volta — a leitura é negada e o sucesso pareceria falha', async () => {
  // O contrário das Actions do painel, onde `.select("id")` é obrigatório.
  // A assimetria convida a "corrigir" o lado errado: aqui `anon` só tem
  // `grant insert`, então pedir a linha de volta faria a inserção PARECER
  // que falhou depois de ter gravado — e a pessoa mandaria tudo de novo.
  assert.doesNotMatch(await codigoDaAction(), /\.select\s*\(/,
    'acoes/contato.ts pede a linha de volta. Ver o bloco "Insert público sem .select()" no '
    + 'CLAUDE.md.');
});

test('a origem do visitante é calculada aqui e passada como parâmetro — não deixada para o banco adivinhar', async () => {
  const codigo = await codigoDaAction();

  // A forma é conferida, e não só a menção: a primeira versão deste teste
  // procurava `/origemDoVisitante/` no arquivo inteiro e continuava verde
  // com a chamada trocada por uma constante — o `import` sozinho já casava.
  assert.match(codigo, /const\s+origem\s*=\s*origemDoVisitante\s*\(/,
    'a Action parou de calcular a origem do visitante: o limite volta a ser o balde global de '
    + '005 (spec §4.6), porque quem fala com o Supabase é sempre este servidor');
  assert.match(codigo, /p_visitante:\s*origem\b/,
    'a origem calculada deixou de ser o que vai como parâmetro de registrar_contato');
});

// =====================================================================
// 5. O que a página serve
// =====================================================================

test('/contato responde 200 e traz o formulário pronto no HTML do servidor', async () => {
  const resposta = await fetch(`${BASE}/contato`);
  assert.equal(resposta.status, 200);

  const html = await resposta.text();

  assert.match(html, /<form[^>]+id="form-contato"[^>]+method="POST"/,
    'o formulário precisa ser um <form> com POST — é o que funciona sem JavaScript');

  for (const campo of ['nome', 'email', 'telefone', 'instituicao', 'mensagem', 'consentimento']) {
    assert.match(html, new RegExp(`name="${campo}"`), `o campo "${campo}" não está no HTML servido`);
  }

  // Os cinco campos do esquema, e nada além: `origem` e `situacao` são
  // colunas de trabalho da ONG e não podem ter campo na tela.
  assert.doesNotMatch(html, /name="situacao"/);
  assert.doesNotMatch(html, /name="origem"/);
});

test('a caixa de consentimento é obrigatória e diz o que a pessoa está afirmando', async () => {
  const html = await fetch(`${BASE}/contato`).then((r) => r.text());

  assert.match(
    html,
    /<input id="campo-consentimento" required="" [^>]*type="checkbox" name="consentimento"\/>/,
    'a caixa de consentimento perdeu o `required` (ou mudou de nome)'
  );

  assert.match(
    html,
    /<label for="campo-consentimento">Concordo que o Ateliê use estes dados para responder minha mensagem\./,
    'o rótulo do consentimento mudou — ele precisa dizer o QUE está sendo consentido, não "aceito os termos"'
  );
});

test('o parágrafo do consentimento aponta para a política de privacidade, com o espaço no lugar', () => {
  // Comparação por IGUALDADE, e é o que COBERTURA_DAS_EXCLUSOES de
  // testes/paridade-texto.test.mjs aponta: a seção inteira do formulário
  // sai daquela comparação, então esta é a única fronteira texto-elemento
  // do formulário que alguém observa. Sem o `{' '}` no JSX sairia
  // "está napolítica de privacidade" — o defeito real que motivou aquele
  // arquivo.
  const ESPERADO = 'Usamos o que você escrever aqui só para responder você. O que guardamos, '
    + 'por quanto tempo, e como pedir a exclusão está na '
    + '<a href="/privacidade">política de privacidade</a>.';

  return fetch(`${BASE}/contato`)
    .then((r) => r.text())
    .then((html) => {
      // O React marca a fronteira entre texto e elemento com <!-- -->; ele
      // não é texto e some na extração de paridade-texto, então some aqui
      // também, para a comparação ser sobre o ESPAÇO e não sobre o comentário.
      const limpo = html.replace(/<!-- -->/g, '');
      assert.ok(limpo.includes(ESPERADO),
        'o parágrafo do consentimento mudou (ou perdeu o espaço antes do link).\n'
        + `esperado: ${ESPERADO}`);
    });
});

test('o título da seção nova é o que testes/paridade-texto.test.mjs exclui da comparação', async () => {
  const html = await fetch(`${BASE}/contato`).then((r) => r.text());

  // Se o id sumir, aquela exclusão para de casar e o teste de paridade
  // falha com "elemento a excluir não foi encontrado" — mas só do lado
  // renderizado, onde a presença não é exigida. Ou seja: sem esta linha,
  // apagar o id passaria despercebido e o texto do formulário entraria na
  // comparação com o HTML original.
  assert.match(html, /<h2 id="titulo-mensagem">Ou mande uma mensagem por aqui<\/h2>/);
});

test('os canais diretos continuam ANTES do formulário — eles são o que a ONG lê hoje', async () => {
  const html = await fetch(`${BASE}/contato`).then((r) => r.text());

  const canais = html.indexOf('id="titulo-canais"');
  const mensagem = html.indexOf('id="titulo-mensagem"');
  const endereco = html.indexOf('id="titulo-endereco-contato"');

  assert.ok(canais > 0 && mensagem > 0 && endereco > 0, 'uma das três seções sumiu de /contato');
  assert.ok(canais < mensagem,
    'o formulário passou à frente dos canais diretos. A tela da equipe para ler `contatos` '
    + '(RF29) ainda não existe: quem tem pressa precisa ver WhatsApp e e-mail primeiro.');
  assert.ok(mensagem < endereco, 'a ordem das seções mudou — ver o comentário de app/contato/page.tsx');
});

/**
 * O <main> da resposta, e SÓ ele.
 *
 * MEDIDO nesta tarefa, e é a razão de esta função existir: comparar o
 * documento inteiro dá falso vermelho. O Next serializa o estado do
 * roteador — a URL, com a querystring — dentro dos `self.__next_f.push(...)`
 * do fim do <body>, então QUALQUER texto posto em `?aviso=` reaparece no
 * HTML, escapado, dentro de uma string de JavaScript. Isso não é conteúdo
 * da página e não é injeção; é o payload de hidratação. O que a lista
 * fechada de compartilhado/avisos-de-contato.ts precisa garantir é que
 * aquele texto não vire CONTEÚDO — e conteúdo é o que está no <main>.
 */
function main(html) {
  const abre = html.match(/<main\b[^>]*id="conteudo"[^>]*>/i);
  assert.ok(abre, 'não achou <main id="conteudo"> na resposta');
  const inicio = abre.index + abre[0].length;
  const fim = html.indexOf('</main>', inicio);
  assert.ok(fim !== -1, 'não achou </main> na resposta');
  return html.slice(inicio, fim);
}

test('a confirmação só aparece com o ?aviso= da lista fechada', async () => {
  const CONFIRMACAO = 'Mensagem recebida';
  const buscar = (url) => fetch(`${BASE}${url}`).then((r) => r.text()).then(main);

  const semParametro = await buscar('/contato');
  assert.ok(!semParametro.includes(CONFIRMACAO),
    'a confirmação aparece sem ninguém ter enviado nada — e isso quebraria testes/paridade-texto');

  const comLixo = await buscar('/contato?aviso=toString');
  assert.ok(!comLixo.includes(CONFIRMACAO), '`?aviso=toString` atravessou a lista fechada');

  const comInjecao = await buscar(
    `/contato?aviso=${encodeURIComponent('Ligue para (11) 0000-0000')}`);
  assert.ok(!comInjecao.includes('0000-0000'),
    'INJEÇÃO: o texto do `?aviso=` virou conteúdo da página da ONG');

  const enviada = await buscar('/contato?aviso=enviada');
  assert.ok(enviada.includes(CONFIRMACAO), 'a confirmação não aparece depois do redirect de sucesso');
  assert.match(enviada, /role="status"/);
});

// =====================================================================
// 6. O envio SEM JavaScript — Firefox, apertando o botão
// =====================================================================
//
// É a bateria que importa: o projeto promete funcionar sem script, e um
// formulário é onde essa promessa mais facilmente se perde — basta alguém
// trocar o `action={...}` da Server Action por um `onSubmit` com fetch e o
// envio some, em silêncio, para quem está sem JavaScript.
// =====================================================================

/**
 * O envio VÁLIDO só roda no modo offline, e a razão é a única boa razão
 * para um `skip`: no modo com credenciais ele gravaria uma linha inventada
 * em `public.contatos` do projeto de produção A CADA RODADA, e gastaria o
 * limite de envio de quem usa o site — sem ter como apagar depois (`anon`
 * não tem `delete`, e não existe service_role neste projeto, spec §4.1).
 *
 * O que ele prova no modo offline continua sendo o que interessa aqui: o
 * POST sem script atravessa a validação e chega ao CORPO da Action, que
 * sem Supabase configurado responde a recusa honesta de `semSupabase()`.
 */
const MOTIVO_DO_SKIP = 'no modo com credenciais este teste gravaria uma linha de teste no '
  + 'Supabase de produção, que `anon` não consegue apagar depois';

test('sem JavaScript: o formulário recusa e devolve TUDO o que a pessoa escreveu', async () => {
  const opcoes = new Options().addArguments('-headless');
  opcoes.setPreference('javascript.enabled', false);
  const navegador = await new Builder().forBrowser('firefox').setFirefoxOptions(opcoes).build();

  try {
    await navegador.get(`${BASE}/contato`);

    const MENSAGEM = 'Mensagem longa de teste, que ninguém quer redigitar no celular.';

    await navegador.findElement(By.css('#campo-nome')).sendKeys('Fulana de Teste');
    await navegador.findElement(By.css('#campo-email')).sendKeys('fulana@exemplo.test');
    await navegador.findElement(By.css('#campo-telefone')).sendKeys('11953968344');
    await navegador.findElement(By.css('#campo-mensagem')).sendKeys(MENSAGEM);
    // A caixa de consentimento fica DESMARCADA de propósito: é a recusa que
    // este teste exercita, e ela não grava nada em banco nenhum.

    await navegador.findElement(By.css('#form-contato button[type="submit"]')).click();

    const aviso = await navegador.wait(until.elementLocated(By.css('#aviso-formulario')), 10_000);
    await navegador.wait(until.elementIsVisible(aviso), 10_000);

    assert.match(await aviso.getText(), /Confira o que está marcado abaixo/,
      'o POST sem script não chegou à Action');

    const erro = await navegador.findElement(By.css('#campo-consentimento-erro')).getText();
    assert.match(erro, /concorde com o uso dos seus dados/,
      'o erro não voltou vinculado ao campo do consentimento');

    // O que motiva `valorInicial` em CampoFormulario: sem ele a recusa
    // devolve o formulário em branco e a mensagem inteira se perde.
    assert.equal(await navegador.findElement(By.css('#campo-nome')).getAttribute('value'),
      'Fulana de Teste');
    assert.equal(await navegador.findElement(By.css('#campo-email')).getAttribute('value'),
      'fulana@exemplo.test');
    assert.equal(await navegador.findElement(By.css('#campo-mensagem')).getAttribute('value'),
      MENSAGEM, 'a mensagem escrita se perdeu na recusa');
  } finally {
    await navegador.quit();
  }
});

test('sem JavaScript: o envio válido atravessa a validação e chega ao corpo da Action',
  { skip: COM_SUPABASE ? MOTIVO_DO_SKIP : false },
  async () => {
    const opcoes = new Options().addArguments('-headless');
    opcoes.setPreference('javascript.enabled', false);
    const navegador = await new Builder().forBrowser('firefox').setFirefoxOptions(opcoes).build();

    try {
      await navegador.get(`${BASE}/contato`);

      await navegador.findElement(By.css('#campo-nome')).sendKeys('Fulana de Teste');
      await navegador.findElement(By.css('#campo-email')).sendKeys('fulana@exemplo.test');
      await navegador.findElement(By.css('#campo-mensagem')).sendKeys('Mensagem de teste.');
      await navegador.findElement(By.css('#campo-consentimento')).click();

      await navegador.findElement(By.css('#form-contato button[type="submit"]')).click();

      const aviso = await navegador.wait(until.elementLocated(By.css('#aviso-formulario')), 10_000);
      await navegador.wait(until.elementIsVisible(aviso), 10_000);

      const texto = await aviso.getText();

      // Sem Supabase a Action responde `semSupabase()` — o que prova que a
      // validação passou e o corpo rodou. E a frase precisa terminar num
      // canal real: esta página é pública, e quem não conseguiu enviar
      // simplesmente vai embora se não souber por onde mais falar.
      assert.match(texto, /não está disponível neste endereço/,
        'o envio válido não chegou ao corpo da Action');
      assert.match(texto, /WhatsApp \(11\) 95396-8344/);
      assert.match(texto, /atelieafro@gmail\.com/);
    } finally {
      await navegador.quit();
    }
  });
