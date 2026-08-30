import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarCadastro, validarEntrada, validarRecuperacao,
  lerCadastro, lerEntrada, lerRecuperacao,
  formatarTelefone, apenasDigitos
} from '../compartilhado/validacao.ts';

const CADASTRO_VALIDO = {
  nome: 'Maria da Silva',
  email: 'maria@exemplo.com.br',
  telefone: '(11) 95396-8344',
  senha: 'uma senha longa o suficiente',
  maioridade: true,
  consentimento: true,
  papeis: ['voluntario']
};

test('um cadastro completo é aceito', () => {
  const { valido, erros } = validarCadastro(CADASTRO_VALIDO);
  assert.equal(valido, true, `erros inesperados: ${JSON.stringify(erros)}`);
  assert.deepEqual(erros, {});
});

test('RN01: cadastro sem confirmação de maioridade é recusado', () => {
  const { valido, erros } = validarCadastro({ ...CADASTRO_VALIDO, maioridade: false });
  assert.equal(valido, false);
  assert.ok(erros.maioridade, 'faltou o erro de maioridade');
});

test('a mensagem de maioridade explica por que existe', () => {
  const { erros } = validarCadastro({ ...CADASTRO_VALIDO, maioridade: false });
  // Regra da seção 11: dizer o que houve e o que fazer, sem vaguidão.
  assert.ok(erros.maioridade.length > 20, 'mensagem curta demais para explicar');
  assert.doesNotMatch(erros.maioridade, /inválido|erro|obrigatório$/i);
});

test('cadastro sem consentimento de dados é recusado', () => {
  const { valido, erros } = validarCadastro({ ...CADASTRO_VALIDO, consentimento: false });
  assert.equal(valido, false);
  assert.ok(erros.consentimento);
});

test('nome vazio ou só com espaços é recusado', () => {
  for (const nome of ['', '   ', '\t']) {
    const { valido, erros } = validarCadastro({ ...CADASTRO_VALIDO, nome });
    assert.equal(valido, false, `aceitou nome ${JSON.stringify(nome)}`);
    assert.ok(erros.nome);
  }
});

test('e-mail sem arroba ou sem domínio é recusado', () => {
  for (const email of ['maria', 'maria@', '@exemplo.com', 'maria@exemplo', 'a b@c.com']) {
    const { valido } = validarCadastro({ ...CADASTRO_VALIDO, email });
    assert.equal(valido, false, `aceitou e-mail inválido: ${email}`);
  }
});

test('e-mails brasileiros comuns são aceitos', () => {
  for (const email of ['a@b.co', 'maria.silva@exemplo.com.br', 'nome+tag@dominio.org']) {
    const { valido, erros } = validarCadastro({ ...CADASTRO_VALIDO, email });
    assert.equal(valido, true, `recusou e-mail válido ${email}: ${erros.email}`);
  }
});

test('senha curta é recusada com a exigência dita por extenso', () => {
  const { valido, erros } = validarCadastro({ ...CADASTRO_VALIDO, senha: 'curta' });
  assert.equal(valido, false);
  assert.match(erros.senha, /8/, 'a mensagem precisa dizer o mínimo');
});

test('telefone é opcional, mas se vier precisa ter DDD', () => {
  assert.equal(validarCadastro({ ...CADASTRO_VALIDO, telefone: '' }).valido, true);
  assert.equal(validarCadastro({ ...CADASTRO_VALIDO, telefone: '95396834' }).valido, false);
  assert.equal(validarCadastro({ ...CADASTRO_VALIDO, telefone: '11953968344' }).valido, true);
});

test('é preciso escolher ao menos um papel', () => {
  const { valido, erros } = validarCadastro({ ...CADASTRO_VALIDO, papeis: [] });
  assert.equal(valido, false);
  assert.ok(erros.papeis);
});

test('RF10: a pessoa pode ser voluntária e doadora ao mesmo tempo', () => {
  const { valido } = validarCadastro({ ...CADASTRO_VALIDO, papeis: ['voluntario', 'doador'] });
  assert.equal(valido, true);
});

test('ninguém se cadastra como equipe pelo formulário', () => {
  // O papel de equipe é concedido à mão. Aceitá-lo aqui seria escalada de
  // privilégio pela porta da frente.
  const { valido, erros } = validarCadastro({ ...CADASTRO_VALIDO, papeis: ['equipe'] });
  assert.equal(valido, false);
  assert.ok(erros.papeis);
});

test('todos os erros vêm juntos, não um de cada vez', () => {
  // Formulário que revela um erro por vez faz a pessoa tentar várias vezes.
  const { erros } = validarCadastro({
    nome: '', email: 'x', telefone: '', senha: '123',
    maioridade: false, consentimento: false, papeis: []
  });
  assert.ok(Object.keys(erros).length >= 5, `veio só ${Object.keys(erros).length} erro(s)`);
});

test('validarEntrada cobre e-mail e senha', () => {
  assert.equal(validarEntrada({ email: 'a@b.co', senha: 'qualquer' }).valido, true);
  assert.equal(validarEntrada({ email: 'invalido', senha: 'qualquer' }).valido, false);
  assert.equal(validarEntrada({ email: 'a@b.co', senha: '' }).valido, false);
});

test('formatarTelefone monta o formato brasileiro conforme se digita', () => {
  assert.equal(formatarTelefone('11'), '(11');
  assert.equal(formatarTelefone('119'), '(11) 9');
  assert.equal(formatarTelefone('11953968344'), '(11) 95396-8344');
  assert.equal(formatarTelefone('1132334455'), '(11) 3233-4455');
});

test('formatarTelefone ignora o que não é dígito', () => {
  assert.equal(formatarTelefone('(11) 95396-8344'), '(11) 95396-8344');
  assert.equal(formatarTelefone('abc11def95396'), '(11) 95396');
});

test('formatarTelefone descarta dígitos além do 11º', () => {
  assert.equal(formatarTelefone('119539683449999'), '(11) 95396-8344');
});

test('apenasDigitos limpa a máscara para gravar', () => {
  assert.equal(apenasDigitos('(11) 95396-8344'), '11953968344');
  assert.equal(apenasDigitos(''), '');
});

// =====================================================================
// Leitura do FormData — a entrada real das Server Actions
//
// Os testes acima chamam validarCadastro/validarEntrada com um objeto
// pronto. Nenhuma Server Action recebe objeto pronto: recebe FormData, e o
// que ela lê dali é o que vai (ou não) para o banco. Testar só a validação
// deixaria de fora justamente a camada onde mora a regra 6 do CLAUDE.md —
// nenhum campo chega ao cadastro sem ter sido lido pelo nome.
//
// Spec §4.5: Server Action é endpoint HTTP público. O corpo destes testes é
// montado à mão, sem formulário nenhum, porque é assim que um atacante
// chama.
// =====================================================================

function formulario(campos) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) {
    if (valor !== undefined && valor !== null) dados.append(nome, valor);
  }
  return dados;
}

/** O cadastro completo como o formulário de /entrar o envia. */
const CADASTRO_ENVIADO = {
  nome: 'Maria da Silva',
  email: 'maria@exemplo.com.br',
  telefone: '(11) 95396-8344',
  senha: 'uma senha longa',
  voluntario: 'on',
  maioridade: 'on',
  consentimento: 'on'
};

test('caminho feliz: o cadastro que o formulário envia é lido e aceito', () => {
  const lido = lerCadastro(formulario(CADASTRO_ENVIADO));

  assert.deepEqual(lido, {
    nome: 'Maria da Silva',
    email: 'maria@exemplo.com.br',
    telefone: '(11) 95396-8344',
    senha: 'uma senha longa',
    maioridade: true,
    consentimento: true,
    papeis: ['voluntario']
  });

  const { valido, erros } = validarCadastro(lido, { exigirPapel: false });
  assert.equal(valido, true, `erros inesperados: ${JSON.stringify(erros)}`);
});

test('e-mail inválido enviado por FormData é recusado', () => {
  const lido = lerCadastro(formulario({ ...CADASTRO_ENVIADO, email: 'maria@exemplo' }));
  const { valido, erros } = validarCadastro(lido, { exigirPapel: false });
  assert.equal(valido, false);
  assert.ok(erros.email);
});

test('senha curta enviada por FormData é recusada', () => {
  const lido = lerCadastro(formulario({ ...CADASTRO_ENVIADO, senha: '1234567' }));
  const { valido, erros } = validarCadastro(lido, { exigirPapel: false });
  assert.equal(valido, false);
  assert.match(erros.senha, /8/);
});

test('nome vazio enviado por FormData é recusado', () => {
  const lido = lerCadastro(formulario({ ...CADASTRO_ENVIADO, nome: '   ' }));
  assert.equal(lido.nome, '');
  const { valido, erros } = validarCadastro(lido, { exigirPapel: false });
  assert.equal(valido, false);
  assert.ok(erros.nome);
});

test('RN01: caixa de maioridade ausente no corpo é recusada', () => {
  // Caixa não marcada não é enviada pelo navegador: o campo simplesmente
  // não existe no corpo. É o caso mais comum, e o que precisa falhar.
  const { maioridade, ...semMaioridade } = CADASTRO_ENVIADO;
  const lido = lerCadastro(formulario(semMaioridade));
  assert.equal(lido.maioridade, false);

  const { valido, erros } = validarCadastro(lido, { exigirPapel: false });
  assert.equal(valido, false);
  assert.ok(erros.maioridade);
});

test('consentimento ausente no corpo é recusado', () => {
  const { consentimento, ...semConsentimento } = CADASTRO_ENVIADO;
  const lido = lerCadastro(formulario(semConsentimento));
  assert.equal(lido.consentimento, false);

  const { valido, erros } = validarCadastro(lido, { exigirPapel: false });
  assert.equal(valido, false);
  assert.ok(erros.consentimento);
});

test('caixa marcada com "false" ou "0" não vale como marcada', () => {
  // Quem chama a Action à mão não está preso ao "on" do navegador. Se a
  // leitura olhasse só a presença do campo, `maioridade=false` no corpo
  // passaria por confirmação de maioridade — e RN01 é regra legal, não
  // preferência de tela.
  for (const valor of ['false', '0', 'off', 'não', '   ']) {
    const lido = lerCadastro(formulario({ ...CADASTRO_ENVIADO, maioridade: valor }));
    assert.equal(lido.maioridade, false, `aceitou ${JSON.stringify(valor)} como marcada`);
  }
});

test('telefone é opcional: ausente no corpo, o cadastro passa', () => {
  const { telefone, ...semTelefone } = CADASTRO_ENVIADO;
  const lido = lerCadastro(formulario(semTelefone));
  assert.equal(lido.telefone, '');

  const { valido, erros } = validarCadastro(lido, { exigirPapel: false });
  assert.equal(valido, true, `erros inesperados: ${JSON.stringify(erros)}`);
});

test('nenhum campo além dos previstos atravessa a leitura', () => {
  // Regra 6 do CLAUDE.md: eh_equipe nunca vem do cadastro. Já houve escalada
  // de privilégio real neste projeto. O corpo abaixo é a tentativa óbvia.
  const lido = lerCadastro(formulario({
    ...CADASTRO_ENVIADO,
    eh_equipe: 'true',
    papeis: 'equipe',
    id: '00000000-0000-0000-0000-000000000000'
  }));

  assert.deepEqual(Object.keys(lido).sort(), [
    'consentimento', 'email', 'maioridade', 'nome', 'papeis', 'senha', 'telefone'
  ]);
  assert.deepEqual(lido.papeis, ['voluntario']);
  assert.equal(JSON.stringify(lido).includes('equipe'), false);
});

test('os dois papéis acumulam, e só eles (RF10)', () => {
  const lido = lerCadastro(formulario({
    ...CADASTRO_ENVIADO, voluntario: 'on', doador: 'on', equipe: 'on'
  }));
  assert.deepEqual(lido.papeis, ['voluntario', 'doador']);
});

test('campo que não é texto não vira senha nem nome', () => {
  // FormData.get() devolve string OU File. Um arquivo enviado no campo
  // "senha" viraria "[object File]" num String() distraído: uma senha de 15
  // caracteres que ninguém digitou.
  const dados = formulario(CADASTRO_ENVIADO);
  dados.set('senha', new File(['conteúdo qualquer'], 'senha.txt'));
  dados.set('nome', new File([''], 'nome.txt'));

  const lido = lerCadastro(dados);
  assert.equal(lido.senha, '');
  assert.equal(lido.nome, '');
  assert.equal(validarCadastro(lido, { exigirPapel: false }).valido, false);
});

test('a senha é lida sem aparar espaços', () => {
  // Aparar aqui e não aparar no cadastro (ou o contrário) trancaria a pessoa
  // fora da própria conta sem nada na tela explicando.
  const lido = lerEntrada(formulario({ email: 'maria@exemplo.com.br', senha: '  com espaco  ' }));
  assert.equal(lido.senha, '  com espaco  ');
});

test('lerEntrada apara o e-mail, que é onde o espaço sobra sem querer', () => {
  const lido = lerEntrada(formulario({ email: '  maria@exemplo.com.br ', senha: 'qualquer' }));
  assert.equal(lido.email, 'maria@exemplo.com.br');
  assert.equal(validarEntrada(lido).valido, true);
});

test('formulário de entrar vazio é recusado nos dois campos', () => {
  const { valido, erros } = validarEntrada(lerEntrada(formulario({})));
  assert.equal(valido, false);
  assert.ok(erros.email);
  assert.ok(erros.senha);
});

test('recuperação de acesso valida só o e-mail', () => {
  assert.equal(validarRecuperacao(lerRecuperacao(formulario({ email: 'maria@exemplo.com.br' }))).valido, true);
  assert.equal(validarRecuperacao(lerRecuperacao(formulario({ email: 'maria' }))).valido, false);
  assert.equal(validarRecuperacao(lerRecuperacao(formulario({}))).valido, false);
});

test('exigirPapel: o padrão continua exigindo, a Action pede para não exigir', () => {
  const semPapel = lerCadastro(formulario({
    ...CADASTRO_ENVIADO, voluntario: undefined
  }));
  assert.deepEqual(semPapel.papeis, []);

  // Padrão (site antigo): exige.
  assert.equal(validarCadastro(semPapel).valido, false);
  // Como acoes/autenticacao.ts chama: as caixas não são obrigatórias na tela.
  assert.equal(validarCadastro(semPapel, { exigirPapel: false }).valido, true);
});
