import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarCadastro, validarEntrada, formatarTelefone, apenasDigitos
} from '../site/assets/js/util/validacao.js';

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
