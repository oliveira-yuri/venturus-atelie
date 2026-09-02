import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, '..');
const COMPONENTES = path.join(RAIZ, 'componentes');

/**
 * =====================================================================
 * A MÁSCARA DE TELEFONE PRECISA ESTAR ONDE HÁ CAMPO DE TELEFONE
 * =====================================================================
 *
 * O pedido V1 relatou: "máscara de telefone onde tem o campo de telefone
 * (página de contato por exemplo não está aplicando a máscara)". A causa
 * era estrutural, não um esquecimento pontual: a função vivia COPIADA em
 * dois formulários, e o terceiro simplesmente não recebeu a cópia.
 *
 * Consertar o formulário de contato sem consertar a ESTRUTURA deixaria a
 * mesma armadilha armada para o quarto formulário. Por isso a função virou
 * `componentes/mascara-telefone.ts` (um lugar só) e este teste reconcilia
 * as duas listas, nos DOIS sentidos:
 *
 *   · todo componente com `name="telefone"` liga `mascararTelefone`;
 *   · nenhum componente liga a máscara sem ter campo de telefone (o que
 *     seria código morto, e sinal de que o campo foi removido e o handler
 *     ficou).
 *
 * É varredura de código, e não de navegador, de propósito: ela roda em
 * milissegundos e pega o defeito no arquivo, não na tela.
 */

// O próprio módulo da máscara fica de fora das varreduras: ele CITA
// `name="telefone"` no comentário que explica o que faz, e não é
// formulário nenhum. Sem esta exclusão ele apareceria como "tem campo de
// telefone e não liga a máscara" — falso positivo que ensinaria a ignorar
// o teste.
const MODULO_DA_MASCARA = 'mascara-telefone.ts';

function componentes() {
  return readdirSync(COMPONENTES)
    .filter((nome) => nome.endsWith('.tsx') || nome.endsWith('.ts'))
    .filter((nome) => nome !== MODULO_DA_MASCARA)
    .map((nome) => ({ nome, fonte: readFileSync(path.join(COMPONENTES, nome), 'utf-8') }));
}

const TEM_CAMPO = /nome="telefone"|name="telefone"/;
const LIGA_MASCARA = /onChange=\{mascararTelefone\}/;

test('todo formulário com campo de telefone liga a máscara', () => {
  const semMascara = componentes()
    .filter(({ fonte }) => TEM_CAMPO.test(fonte) && !LIGA_MASCARA.test(fonte))
    .map(({ nome }) => nome);

  assert.deepEqual(semMascara, [],
    'estes componentes têm campo de telefone e NÃO ligam mascararTelefone no <form>: '
    + `${semMascara.join(', ')}. O handler vai no <form> (o evento chega por `
    + 'borbulhamento), nunca no <input>, porque CampoFormulario não expõe onChange.');
});

test('ninguém liga a máscara sem ter campo de telefone', () => {
  const sobrando = componentes()
    .filter(({ fonte }) => LIGA_MASCARA.test(fonte) && !TEM_CAMPO.test(fonte))
    .map(({ nome }) => nome);

  assert.deepEqual(sobrando, [],
    `estes componentes ligam mascararTelefone e não têm campo de telefone: ${sobrando.join(', ')}`);
});

test('a máscara existe num lugar só — ninguém redefine a função localmente', () => {
  const copias = componentes()
    .filter(({ fonte }) => /function mascararTelefone\s*\(/.test(fonte))
    .map(({ nome }) => nome);

  assert.deepEqual(copias, [],
    `estes componentes redefinem mascararTelefone em vez de importar de `
    + `componentes/mascara-telefone.ts: ${copias.join(', ')}. Duas cópias divergem; `
    + 'foi assim que o formulário de contato ficou sem máscara.');
});

test('há pelo menos três formulários com telefone — o teste não passa por vacuidade', () => {
  // Sem esta trava, apagar `name="telefone"` de todo lugar deixaria os dois
  // primeiros testes verdes com listas vazias.
  const comCampo = componentes().filter(({ fonte }) => TEM_CAMPO.test(fonte));
  assert.ok(comCampo.length >= 3,
    `só ${comCampo.length} componentes com campo de telefone; esperava ao menos 3 `
    + '(criar conta, meus dados, contato)');
});
