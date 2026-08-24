import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESCALAS, PADRAO, CHAVE_ARMAZENAMENTO,
  proximaEscala, lerPreferencias, gravarPreferencias
} from '../site/assets/js/util/preferencias.js';

/** Dublê de localStorage. Aceita falhar de propósito para testar o modo anônimo. */
function armazenamentoFalso({ conteudo = {}, quebrado = false } = {}) {
  return {
    getItem(chave) {
      if (quebrado) throw new Error('acesso negado');
      return chave in conteudo ? conteudo[chave] : null;
    },
    setItem(chave, valor) {
      if (quebrado) throw new Error('acesso negado');
      conteudo[chave] = String(valor);
    },
    conteudo
  };
}

test('proximaEscala avança um degrau', () => {
  assert.equal(proximaEscala(100, 1), ESCALAS[ESCALAS.indexOf(100) + 1]);
});

test('proximaEscala retrocede um degrau', () => {
  assert.equal(proximaEscala(100, -1), ESCALAS[ESCALAS.indexOf(100) - 1]);
});

test('proximaEscala para no maior degrau em vez de estourar', () => {
  const maior = ESCALAS[ESCALAS.length - 1];
  assert.equal(proximaEscala(maior, 1), maior);
});

test('proximaEscala para no menor degrau em vez de estourar', () => {
  assert.equal(proximaEscala(ESCALAS[0], -1), ESCALAS[0]);
});

test('proximaEscala volta ao padrão diante de valor desconhecido', () => {
  assert.equal(proximaEscala(999, 1), PADRAO.escala);
});

test('lerPreferencias devolve o padrão quando nada foi gravado', () => {
  assert.deepEqual(lerPreferencias(armazenamentoFalso()), PADRAO);
});

test('lerPreferencias recupera o que foi gravado', () => {
  const armazenamento = armazenamentoFalso();
  gravarPreferencias(armazenamento, { escala: 125, contraste: 'alto' });
  assert.deepEqual(lerPreferencias(armazenamento), { escala: 125, contraste: 'alto' });
});

test('lerPreferencias ignora conteúdo corrompido em vez de quebrar a página', () => {
  const armazenamento = armazenamentoFalso({
    conteudo: { [CHAVE_ARMAZENAMENTO]: 'isto não é json' }
  });
  assert.deepEqual(lerPreferencias(armazenamento), PADRAO);
});

test('lerPreferencias descarta escala fora da lista de degraus', () => {
  const armazenamento = armazenamentoFalso({
    conteudo: { [CHAVE_ARMAZENAMENTO]: JSON.stringify({ escala: 9999, contraste: 'normal' }) }
  });
  assert.equal(lerPreferencias(armazenamento).escala, PADRAO.escala);
});

test('lerPreferencias não lança quando o armazenamento é inacessível', () => {
  // Navegador em modo anônimo com cookies bloqueados lança ao tocar em localStorage.
  assert.deepEqual(lerPreferencias(armazenamentoFalso({ quebrado: true })), PADRAO);
});

test('gravarPreferencias não lança quando o armazenamento é inacessível', () => {
  assert.doesNotThrow(() =>
    gravarPreferencias(armazenamentoFalso({ quebrado: true }), PADRAO));
});
