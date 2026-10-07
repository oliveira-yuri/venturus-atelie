import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { montarIcs, escaparTextoIcs, dataIcs, dobrarLinha } from '../compartilhado/calendario.ts';
import { enderecoDoSite, enderecoAbsoluto } from '../compartilhado/endereco-do-site.ts';
import { linkDoWhatsApp } from '../compartilhado/compartilhar.ts';
import { dividirParaLeitura } from '../compartilhado/leitura-em-voz-alta.ts';
import { dadosEstruturadosDosEventos } from '../compartilhado/dados-estruturados.ts';
import { codigoDaContagem, hostDaContagem } from '../compartilhado/contagem-de-visitas.ts';
import { ListaEventos } from '../componentes/ListaEventos.ts';

const EVENTO = {
  id: 'oficina-1', titulo: 'Oficina, de "tambor"; nível 1', descricao: 'Linha 1\nLinha 2',
  comeca_em: '2026-11-05T22:00:00.000Z', termina_em: null, local: 'Casa Verde, SP', faixa_etaria: null
};

test('.ics: instante em UTC, escape de vírgula/ponto e vírgula/quebra de linha e fim padrão', () => {
  const ics = montarIcs(EVENTO, 'https://x.test/agenda#oficina-1', new Date('2026-10-07T12:00:00Z'));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261105T220000Z\r\n/);
  assert.match(ics, /DTEND:20261106T000000Z\r\n/, 'sem termina_em, dura 2 horas');
  assert.match(ics, /SUMMARY:Oficina\\, de "tambor"\; nível 1\r\n/);
  assert.match(ics, /DESCRIPTION:Linha 1\\nLinha 2\r\n/);
  assert.match(ics, /LOCATION:Casa Verde\\, SP\r\n/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});

test('.ics: campos sem dado são omitidos, não inventados (regra 2)', () => {
  const ics = montarIcs({ ...EVENTO, descricao: null, local: null }, 'https://x.test/');
  assert.doesNotMatch(ics, /DESCRIPTION|LOCATION/);
});

test('.ics: linhas longas dobram em 75 octetos sem partir caractere acentuado', () => {
  const dobrada = dobrarLinha('SUMMARY:' + 'ã'.repeat(80));
  for (const parte of dobrada.split('\r\n')) {
    assert.ok(new TextEncoder().encode(parte).length <= 75);
  }
  assert.equal(dobrada.replace(/\r\n /g, ''), 'SUMMARY:' + 'ã'.repeat(80));
  assert.equal(escaparTextoIcs('a\\b'), 'a\\\\b');
  assert.equal(dataIcs('2026-11-05T22:00:00.000Z'), '20261105T220000Z');
});

test('endereço do site: URL_DO_SITE vence, Vercel vem sem esquema, e o último recurso é o oficial', () => {
  assert.equal(enderecoDoSite({ URL_DO_SITE: 'https://a.test/' }), 'https://a.test');
  assert.equal(enderecoDoSite({ VERCEL_PROJECT_PRODUCTION_URL: 'b.vercel.app' }), 'https://b.vercel.app');
  assert.equal(enderecoDoSite({}), 'https://www.atelieafrocultural.site');
  assert.equal(enderecoAbsoluto('/agenda', {}), 'https://www.atelieafrocultural.site/agenda');
});

test('compartilhar: o link do WhatsApp leva título e endereço ABSOLUTO, codificados', () => {
  const link = linkDoWhatsApp('Oficina & festa', 'https://x.test/agenda#a');
  assert.ok(link.startsWith('https://wa.me/?text='));
  assert.equal(decodeURIComponent(link.split('text=')[1]), 'Oficina & festa — https://x.test/agenda#a');
});

test('lista de eventos: o que ainda vem ganha inscrição, agenda e compartilhar; o passado, nada', () => {
  const vem = renderToStaticMarkup(createElement(ListaEventos, { eventos: [EVENTO], mensagemVazio: 'v', inscricoesAbertas: true }));
  assert.match(vem, /href="\/agenda\/oficina-1\/calendario"/);
  assert.match(vem, /href="https:\/\/wa\.me\/\?text=/);
  assert.match(vem, /data-compartilhar-url="https:\/\/[^"]+\/agenda#oficina-1"/);
  const passou = renderToStaticMarkup(createElement(ListaEventos, { eventos: [EVENTO], mensagemVazio: 'v' }));
  assert.doesNotMatch(passou, /calendario|wa\.me/);
});

test('ouvir a página: trechos curtos, em limites de frase, sem perder texto', () => {
  const texto = 'Primeira frase. Segunda frase! ' + 'palavra '.repeat(100) + 'Fim.';
  const trechos = dividirParaLeitura(texto, 120);
  assert.ok(trechos.length > 1);
  assert.ok(trechos.every((t) => t.length <= 120));
  assert.equal(trechos.join(' ').replace(/\s+/g, ' '), texto.replace(/\s+/g, ' ').trim());
  assert.deepEqual(dividirParaLeitura('   '), []);
});

test('JSON-LD: sem evento não há script; com evento, omite o que falta e fecha o </script>', () => {
  assert.equal(dadosEstruturadosDosEventos([], (c) => c), null);
  const json = dadosEstruturadosDosEventos([{ ...EVENTO, descricao: '</script><b>', local: null }], (c) => `https://x.test${c}`);
  assert.ok(!json.includes('</script>'), 'o texto não pode fechar a tag');
  const [ld] = JSON.parse(json);
  assert.equal(ld['@type'], 'Event');
  assert.equal(ld.location, undefined);
  assert.equal(ld.url, 'https://x.test/agenda#oficina-1');
});

test('contagem de visitas: desligada sem código, e o código vira host só se for seguro', () => {
  assert.equal(hostDaContagem({}), null);
  assert.equal(hostDaContagem({ GOATCOUNTER_CODIGO: 'atelie-afro' }), 'https://atelie-afro.goatcounter.com');
  for (const ruim of ['a.b', 'a b', 'x;y', 'a/../b', '-a', '']) {
    assert.equal(codigoDaContagem({ GOATCOUNTER_CODIGO: ruim }), null, ruim);
  }
});

// ---------------------------------------------------------------------
// Relatório por período
// ---------------------------------------------------------------------
import { intervaloDoPeriodo, lerPeriodo, lerDeslocamento, resumirPeriodo, emReais } from '../compartilhado/periodo.ts';

test('período: limites em meia-noite de São Paulo (UTC−3), fim exclusivo, alinhado ao calendário', () => {
  const hoje = new Date('2026-10-07T12:00:00Z');
  const mes = intervaloDoPeriodo('mes', 0, hoje);
  assert.deepEqual([mes.inicio, mes.fim], ['2026-10-01T03:00:00.000Z', '2026-11-01T03:00:00.000Z']);
  assert.equal(mes.rotulo, 'outubro de 2026');
  const tri = intervaloDoPeriodo('trimestre', 0, hoje);
  assert.deepEqual([tri.inicio, tri.fim], ['2026-10-01T03:00:00.000Z', '2027-01-01T03:00:00.000Z']);
  assert.equal(tri.rotulo, '4º trimestre de 2026');
  const sem = intervaloDoPeriodo('semestre', -1, hoje);
  assert.deepEqual([sem.inicio, sem.fim], ['2026-01-01T03:00:00.000Z', '2026-07-01T03:00:00.000Z']);
  assert.equal(sem.rotulo, '1º semestre de 2026');
  const ano = intervaloDoPeriodo('ano', -1, hoje);
  assert.deepEqual([ano.inicio, ano.fim], ['2025-01-01T03:00:00.000Z', '2026-01-01T03:00:00.000Z']);
});

test('período: virada de ano e 1º de outubro às 00h30 de SP ainda é outubro', () => {
  const janeiro = intervaloDoPeriodo('mes', -1, new Date('2026-01-15T12:00:00Z'));
  assert.equal(janeiro.inicio, '2025-12-01T03:00:00.000Z');
  // 2026-10-01T03:30Z = 00h30 de 1º de outubro em SP
  assert.equal(intervaloDoPeriodo('mes', 0, new Date('2026-10-01T03:30:00Z')).rotulo, 'outubro de 2026');
  // 2026-10-01T02:30Z = 23h30 de 30 de setembro em SP
  assert.equal(intervaloDoPeriodo('mes', 0, new Date('2026-10-01T02:30:00Z')).rotulo, 'setembro de 2026');
});

test('período: a querystring só passa o que está na lista, e futuro não existe', () => {
  assert.equal(lerPeriodo('trimestre'), 'trimestre');
  for (const ruim of ['dia', '', undefined, ['mes'], 'MES']) assert.equal(lerPeriodo(ruim), null);
  assert.equal(lerDeslocamento('-2'), -2);
  assert.equal(lerDeslocamento('3'), 0);
  assert.equal(lerDeslocamento('abc'), 0);
  assert.equal(lerDeslocamento('-99999'), 0);
});

test('resumo do período: separa crianças, presentes e "sem conferir" (que não são faltas) e soma só o financeiro', () => {
  const resumo = resumirPeriodo(
    [
      { id: 'a', inscricoes: [
        { eh_menor: true, presencas: { presente: true } },
        { eh_menor: false, presencas: [{ presente: false }] },
        { eh_menor: true, presencas: null }
      ] },
      { id: 'b', inscricoes: null }
    ],
    [
      { tipo: 'recurso_financeiro', situacao: 'recebida', valor: '150.10' },
      { tipo: 'recurso_financeiro', situacao: 'recebida', valor: 0.2 },
      { tipo: 'item', situacao: 'recebida', valor: null }
    ]
  );
  assert.deepEqual(resumo, {
    atividades: 2, inscritos: 3, criancasInscritas: 2, presentes: 1, criancasPresentes: 1,
    semConferir: 1, doacoesRecebidas: 3, itensRecebidos: 1, valorRecebidoEmCentavos: 15030
  });
  assert.match(emReais(15030).replace(/\s/g, ' '), /R\$ 150,30/);
});
