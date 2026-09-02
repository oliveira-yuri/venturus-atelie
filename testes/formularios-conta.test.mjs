/**
 * Os três formulários de conta ENVIANDO — /entrar (entrar e criar conta) e
 * /recuperar-acesso, ligados às Server Actions na Tarefa 3 da autenticação.
 *
 * Os outros arquivos olham o HTML que o servidor entrega
 * (testes/pagina-entrar.test.mjs, testes/pagina-recuperar-acesso.test.mjs).
 * Este aperta o botão.
 *
 * DOIS NAVEGADORES, e é o ponto do arquivo:
 *
 *  1. SEM JAVASCRIPT (`javascript.enabled=false`, como em
 *     testes/sem-javascript.test.mjs). É a bateria que importa: o projeto
 *     promete funcionar sem script, e um formulário é onde essa promessa
 *     mais facilmente se perde — basta alguém trocar o `action={...}` da
 *     Server Action por um `onSubmit` com fetch e o envio some para quem
 *     está sem JavaScript, sem nenhum erro em lugar nenhum. Medido aqui:
 *     preencher, apertar, e a resposta do servidor volta na página.
 *  2. COM JAVASCRIPT, para o que só existe hidratado: o foco levado ao
 *     primeiro campo com erro (regra 8 — sem isso, quem usa teclado ou
 *     leitor de tela não é levado a nada depois de enviar) e a máscara de
 *     telefone.
 *
 * O QUE ESTE ARQUIVO NÃO MEDE, e é limite conhecido: nenhum caminho de
 * SUCESSO. Entrar de verdade precisa de uma conta que ninguém tem
 * (CLAUDE.md, "O que trava hoje", item 2); criar conta de verdade gravaria
 * uma pessoa inventada no Supabase de produção e queimaria a cota de e-mail
 * (item 1). O que dá para exercitar sem inventar nada é a recusa — que é
 * também o que a maioria das pessoas vai ver enquanto o item 1 não fechar.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, By, until } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const COM_SUPABASE = process.env.COM_SUPABASE === '1'
  || process.env.COM_SUPABASE === 'chave-errada';

/**
 * O que o servidor responde a uma tentativa de entrar com credencial que
 * não existe — muda com o modo da suíte, não com o código (mesma convenção
 * de DESTINO_DE_TOKEN_QUE_NAO_VALE em testes/nova-senha.test.mjs):
 *
 *   - offline (`npm test`): sem SUPABASE_URL, a Action nem tenta e devolve
 *     a recusa honesta de `semSupabase()`;
 *   - com credenciais (`npm run test:supabase`): a pergunta é feita ao Auth
 *     de verdade, que responde `invalid_credentials`, e compartilhado/
 *     erros.ts traduz.
 *
 * Nos dois casos a prova é a mesma: a resposta veio do CORPO da Action, e
 * não da validação de formato que roda antes dela.
 */
const RECUSA_DE_ENTRADA = COM_SUPABASE
  ? /E-mail ou senha não conferem/
  : /As contas ainda não estão disponíveis neste endereço/;

/** Endereço com forma válida e sem dono — só para receber a recusa. */
const EMAIL_SEM_CONTA = 'ninguem-sem-conta@example.com';

let semScript;
let comScript;

before(async () => {
  const semJs = new Options().addArguments('-headless');
  semJs.setPreference('javascript.enabled', false);
  semScript = await new Builder().forBrowser('firefox').setFirefoxOptions(semJs).build();

  comScript = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless')).build();
});

after(async () => {
  await semScript?.quit();
  await comScript?.quit();
});

/** Escreve num campo pelo id (o `prefixo` de CampoFormulario entra no id). */
async function escrever(navegador, id, valor) {
  const campo = await navegador.findElement(By.css(`#${id}`));
  await campo.clear();
  await campo.sendKeys(valor);
}

async function enviar(navegador, formulario) {
  await navegador.findElement(By.css(`#${formulario} button[type="submit"]`)).click();
  // Sem script a resposta é uma página nova; com script, uma re-renderização.
  // Nos dois casos o que se espera é a caixa de aviso deixar de estar
  // escondida — esperar por ela cobre os dois sem `sleep` arbitrário.
  await navegador.wait(async () => {
    const avisos = await navegador.findElements(By.css('#aviso'));
    if (avisos.length === 0) return false;
    return (await avisos[0].getAttribute('hidden')) === null;
  }, 10_000, 'a caixa de aviso não apareceu depois do envio');
}

/** O texto do <p class="campo__erro"> de um campo, ou '' se não houver. */
function erroDoCampo(html, idDoCampo) {
  const achado = new RegExp(`<p class="campo__erro" id="${idDoCampo}-erro"[^>]*>([^<]*)</p>`)
    .exec(html);
  return achado ? achado[1].trim() : '';
}

function textoDoAviso(html) {
  const bloco = /<div id="aviso"[^>]*>([\s\S]*?)<\/div>/.exec(html);
  assert.ok(bloco, 'não achei a caixa de aviso na resposta');
  assert.doesNotMatch(bloco[0], /\shidden(\s|=|>)/, 'o aviso continuou escondido depois do envio');
  return bloco[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// =====================================================================
// Sem JavaScript
// =====================================================================

test('sem JavaScript: /recuperar-acesso recusa e-mail malformado, e o erro chega vinculado ao campo', async () => {
  await semScript.get(`${BASE}/recuperar-acesso`);
  await escrever(semScript, 'campo-email', 'isto-nao-e-um-email');
  await enviar(semScript, 'form-recuperar');

  const html = await semScript.getPageSource();
  assert.equal(erroDoCampo(html, 'campo-email'), 'Confira o e-mail.');
  assert.match(html, /aria-invalid="true"/, 'o campo com erro não foi marcado como inválido');
  assert.equal(textoDoAviso(html), 'Confira o que está marcado abaixo e envie de novo.');
});

test('sem JavaScript: /entrar recusa os dois campos vazios de uma vez', async () => {
  await semScript.get(`${BASE}/entrar`);
  await enviar(semScript, 'form-entrar');

  const html = await semScript.getPageSource();
  // Todos os erros de uma vez — regra escrita em compartilhado/validacao.ts:
  // formulário que revela um erro por vez faz a pessoa tentar várias vezes.
  assert.equal(erroDoCampo(html, 'entrar-campo-email'), 'Confira o e-mail.');
  assert.equal(erroDoCampo(html, 'entrar-campo-senha'), 'Escreva sua senha.');
});

test('sem JavaScript: /entrar leva a tentativa até o corpo da Action, não só até a validação', async () => {
  await semScript.get(`${BASE}/entrar`);
  await escrever(semScript, 'entrar-campo-email', EMAIL_SEM_CONTA);
  await escrever(semScript, 'entrar-campo-senha', 'uma-senha-qualquer');
  await enviar(semScript, 'form-entrar');

  assert.match(textoDoAviso(await semScript.getPageSource()), RECUSA_DE_ENTRADA);
});

test('sem JavaScript: o formulário de criar conta é alcançável, e RN01 recusa quem não confirma a maioridade', async () => {
  // Sem script não há troca de aba: os dois painéis chegam abertos do
  // servidor (componentes/AbasEntrar.tsx). Se algum dia o painel voltar a
  // chegar com `hidden`, este teste falha aqui — no findElement — que é
  // exatamente o defeito que ele existe para pegar.
  await semScript.get(`${BASE}/entrar`);
  await escrever(semScript, 'criar-campo-nome', 'Maria da Silva');
  await escrever(semScript, 'criar-campo-email', EMAIL_SEM_CONTA);
  await escrever(semScript, 'criar-campo-senha', 'uma senha longa o suficiente');
  await semScript.findElement(By.css('#criar-campo-consentimento')).click();
  await enviar(semScript, 'form-criar');

  const html = await semScript.getPageSource();
  assert.match(erroDoCampo(html, 'criar-campo-maioridade'), /^Só quem tem 18 anos ou mais/,
    'RN01/RF12: a caixa de maioridade não recusou o cadastro');
  // A recusa é do cadastro inteiro, e a pessoa precisa saber onde olhar.
  assert.equal(textoDoAviso(html), 'Confira o que está marcado abaixo e envie de novo.');
});

test('sem JavaScript: a máscara de telefone não é regra — o cadastro aceita o telefone como a pessoa escrever', async () => {
  await semScript.get(`${BASE}/entrar`);
  await escrever(semScript, 'criar-campo-nome', 'Maria da Silva');
  await escrever(semScript, 'criar-campo-email', EMAIL_SEM_CONTA);
  await escrever(semScript, 'criar-campo-telefone', '11953968344');
  await escrever(semScript, 'criar-campo-senha', 'uma senha longa o suficiente');
  await enviar(semScript, 'form-criar');

  const html = await semScript.getPageSource();
  assert.equal(erroDoCampo(html, 'criar-campo-telefone'), '',
    'o telefone sem máscara foi recusado — sem JavaScript não existe máscara, '
    + 'e o servidor lê só os dígitos (apenasDigitos)');

  // TRAVA DE SEGURANÇA, e não é decoração: este teste preenche um cadastro
  // quase inteiro, e as duas caixas obrigatórias que ele deixa em branco
  // (maioridade e consentimento) são o que garante que a Action pare na
  // validação e NUNCA chegue ao signUp. Em `npm run test:supabase` isso é a
  // diferença entre um teste e uma pessoa inventada gravada no Supabase de
  // produção, com uma cota de e-mail queimada junto. Se algum dia a regra
  // mudar e o cadastro passar, este assert cai antes de o dano existir.
  assert.equal(textoDoAviso(html), 'Confira o que está marcado abaixo e envie de novo.',
    'o cadastro passou da validação — este teste nunca pode chegar a criar conta');
});

test('sem JavaScript: a recusa devolve o que a pessoa escreveu — menos a senha', async () => {
  // DEFEITO MEDIDO NA TAREFA 3, e o motivo de `valores` existir em
  // EstadoFormulario: antes disto, uma caixa esquecida devolvia o cadastro
  // inteiro em branco, e a pessoa redigitava oito campos no celular.
  await semScript.get(`${BASE}/entrar`);
  await escrever(semScript, 'criar-campo-nome', 'Maria da Silva');
  await escrever(semScript, 'criar-campo-email', EMAIL_SEM_CONTA);
  await escrever(semScript, 'criar-campo-telefone', '(11) 95396-8344');
  await escrever(semScript, 'criar-campo-senha', 'uma senha longa o suficiente');
  await semScript.findElement(By.css('#criar-campo-voluntario')).click();
  await semScript.findElement(By.css('#criar-campo-consentimento')).click();
  // Falta a maioridade de propósito: é a recusa.
  await enviar(semScript, 'form-criar');

  const valor = async (id) =>
    (await semScript.findElement(By.css(`#${id}`))).getAttribute('value');

  assert.equal(await valor('criar-campo-nome'), 'Maria da Silva');
  assert.equal(await valor('criar-campo-email'), EMAIL_SEM_CONTA);
  assert.equal(await valor('criar-campo-telefone'), '(11) 95396-8344');

  const marcada = async (id) =>
    (await semScript.findElement(By.css(`#${id}`))).isSelected();
  assert.equal(await marcada('criar-campo-voluntario'), true, 'a escolha de papel se perdeu');
  assert.equal(await marcada('criar-campo-consentimento'), true, 'o consentimento se perdeu');
  assert.equal(await marcada('criar-campo-maioridade'), false,
    'a caixa que a pessoa NÃO marcou não pode voltar marcada');

  // A senha NÃO volta: escrevê-la no HTML da resposta a deixaria no cache
  // do navegador, no histórico e em qualquer log de proxy pelo caminho.
  const html = await semScript.getPageSource();
  assert.doesNotMatch(html, /uma senha longa o suficiente/,
    'a senha voltou no HTML da resposta');
});

// =====================================================================
// Com JavaScript
// =====================================================================

test('com JavaScript: a recusa também devolve o que a pessoa escreveu', async () => {
  // Caminho diferente do de cima e com a mesma exigência: aqui quem apaga o
  // formulário é o React 19, que dá reset() no <form> ao fim de uma action.
  await comScript.get(`${BASE}/recuperar-acesso`);
  await comScript.wait(until.elementLocated(By.css('#campo-email')), 10_000);
  await escrever(comScript, 'campo-email', 'maria@exemplo');
  await enviar(comScript, 'form-recuperar');

  assert.equal(await comScript.findElement(By.css('#campo-email')).getAttribute('value'),
    'maria@exemplo',
    'o e-mail recusado sumiu do campo — a pessoa tem que redigitar para corrigir uma letra');
});

test('com JavaScript: depois de um envio recusado, o foco vai para o primeiro campo com erro', async () => {
  await comScript.get(`${BASE}/entrar`);
  await comScript.wait(until.elementLocated(By.css('#form-entrar button[type="submit"]')), 10_000);
  // Só a senha preenchida: o erro é do e-mail, que é o primeiro campo.
  await escrever(comScript, 'entrar-campo-senha', 'uma-senha-qualquer');
  await enviar(comScript, 'form-entrar');

  const focado = await comScript.executeScript('return document.activeElement?.id || "";');
  assert.equal(focado, 'entrar-campo-email',
    'o foco ficou onde estava: quem usa teclado ou leitor de tela não é levado ao erro');
});

test('com JavaScript: o telefone é formatado enquanto se digita, e o valor colado é aceito', async () => {
  await comScript.get(`${BASE}/entrar`);
  // COM script os painéis se comportam como abas de novo: o de criar conta
  // fica `hidden` até alguém escolher a aba — e campo escondido não recebe
  // digitação (medido: sem este clique o teste falha em
  // ElementNotInteractableError, o que também prova que o recolhimento
  // depois da hidratação está funcionando).
  await comScript.wait(until.elementLocated(By.css('#aba-criar')), 10_000);
  await comScript.findElement(By.css('#aba-criar')).click();
  await comScript.wait(
    until.elementIsVisible(await comScript.findElement(By.css('#criar-campo-telefone'))), 10_000);

  await escrever(comScript, 'criar-campo-telefone', '11953968344');
  assert.equal(await comScript.findElement(By.css('#criar-campo-telefone')).getAttribute('value'),
    '(11) 95396-8344', 'a máscara de celular não foi aplicada');

  // Fixo tem oito dígitos depois do DDD: o hífen muda de lugar.
  await escrever(comScript, 'criar-campo-telefone', '1132334455');
  assert.equal(await comScript.findElement(By.css('#criar-campo-telefone')).getAttribute('value'),
    '(11) 3233-4455', 'a máscara de telefone fixo não foi aplicada');

  // Colar: o valor entra de uma vez, e o campo tem que ficar com ele (a
  // máscara não pode comer o que foi colado).
  await comScript.executeScript(`
    const campo = document.querySelector('#criar-campo-telefone');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(campo, '(11) 95396-8344');
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  assert.equal(await comScript.findElement(By.css('#criar-campo-telefone')).getAttribute('value'),
    '(11) 95396-8344', 'o valor colado já formatado foi alterado pela máscara');
});

/* =====================================================================
   TIPO DE PESSOA NO CADASTRO (pedido V1)
   =====================================================================

   Antes deste bloco o cadastro NÃO perguntava, e `acoes/autenticacao.ts`
   gravava `tipo_pessoa: 'fisica'` fixo — o comentário no código dizia isso
   com todas as letras. Uma escola, empresa ou coletivo que se cadastrasse
   entrava como pessoa física e só descobria depois, em /minha-conta.

   Três coisas precisam continuar verdade, e cada teste mede uma:

     1. o campo existe na tela e NÃO vem pré-escolhido — um <select> sem
        opção vazia já chega com a primeira selecionada, que é o mesmo
        padrão silencioso de antes, só que visível;
     2. a Action recusa quem não escolheu (o `required` do HTML é sugestão:
        Server Action é endpoint HTTP público, spec §4.5);
     3. a Action recusa valor fora da lista fechada — senão o insert
        quebraria no banco, no `check` de 001_base.sql, em vez de na tela.
   ===================================================================== */

test('o cadastro pergunta o tipo de pessoa, e não vem pré-escolhido', async () => {
  const html = await fetch(`${BASE}/entrar`).then((r) => r.text());

  const bloco = html.match(/<select[^>]*name="tipo_pessoa"[\s\S]*?<\/select>/);
  assert.ok(bloco, 'o formulário de criar conta não tem campo tipo_pessoa');

  assert.match(bloco[0], /required/,
    'o campo de tipo de pessoa não é obrigatório');
  assert.match(bloco[0], /<option[^>]*value=""/,
    'o <select> não tem opção vazia: o navegador já chega com "física" escolhida, '
    + 'que é exatamente o padrão silencioso que este item veio consertar');

  // As duas opções reais, e nada além delas.
  const valores = [...bloco[0].matchAll(/<option[^>]*value="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(valores, ['', 'fisica', 'juridica'],
    `o select desenhou ${JSON.stringify(valores)}; esperava a vazia mais as duas do check de 001_base.sql`);
});

test('criarConta recusa cadastro sem tipo de pessoa, e com tipo inventado', async () => {
  const { validarCadastro } = await import('../compartilhado/validacao.ts');

  const base = {
    nome: 'Fulana de Teste',
    email: 'fulana@exemplo.test',
    senha: 'senha-comprida-o-bastante',
    maioridade: true,
    consentimento: true,
    papeis: ['voluntario']
  };

  const semTipo = validarCadastro({ ...base }, { exigirPapel: false });
  assert.equal(semTipo.valido, false, 'passou sem escolher o tipo de pessoa');
  assert.ok(semTipo.erros.tipo_pessoa, 'não apontou o erro no campo tipo_pessoa');

  const inventado = validarCadastro({ ...base, tipo_pessoa: 'equipe' }, { exigirPapel: false });
  assert.equal(inventado.valido, false, 'aceitou tipo_pessoa fora da lista fechada');

  for (const valido of ['fisica', 'juridica']) {
    const ok = validarCadastro({ ...base, tipo_pessoa: valido }, { exigirPapel: false });
    assert.equal(ok.valido, true,
      `recusou "${valido}", que está no check de 001_base.sql: ${JSON.stringify(ok.erros)}`);
  }
});
