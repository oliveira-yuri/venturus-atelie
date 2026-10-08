/**
 * O novo layout (Análise UX-UI, 08/10/2026 — fases 1 e 2 do plano de
 * migração): a moldura do site e os componentes base.
 *
 * Tudo aqui roda SEM navegador — HTML cru do servidor (o que alcança quem
 * visita sem JavaScript) e componentes renderizados com react-dom/server.
 * O comportamento com script (abrir a folha, Esc, foco) continua nos testes
 * de Selenium de cabecalho/navegador/foco-navegacao.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina.ts';
import { ItemDeLista } from '../componentes/ItemDeLista.ts';
import { FiltroEmChips } from '../componentes/FiltroEmChips.ts';
import { Abas } from '../componentes/Abas.ts';
import { EstadoVazio } from '../componentes/EstadoVazio.ts';
import { Aplique } from '../componentes/Aplique.ts';
import { SeloDeData, partesDaData } from '../componentes/SeloDeData.ts';
import BarraDeAcao, { LinkDeVoltar } from '../componentes/BarraDeAcao.ts';

const BASE = process.env.URL_BASE || 'http://localhost:3123';
const html = (c) => renderToStaticMarkup(c);

/* ------------------------------------------------------------------
   A moldura, no HTML que o servidor entrega
   ------------------------------------------------------------------ */

test('a barra de atalhos chega no HTML cru: Início, Agenda, Biblioteca e o Menu como LINK para a âncora', async () => {
  const pagina = await fetch(`${BASE}/`).then((r) => r.text());
  const barra = pagina.match(/<nav[^>]*aria-label="Atalhos"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(barra, 'a barra de atalhos não chegou do servidor');

  const hrefs = [...barra.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  for (const destino of ['/', '/agenda', '/acervo']) assert.ok(hrefs.includes(destino), `faltou ${destino}`);

  // Sem JavaScript, "Menu" precisa levar a algum lugar: um <button> ali
  // seria controle morto.
  assert.match(barra, /<a[^>]+class="af-burger"[^>]*href="#menu-principal"|<a[^>]+href="#menu-principal"[^>]*class="af-burger"/);
  assert.doesNotMatch(barra, /role="button"/, 'o servidor já entregou o Menu como botão — sem JS ele não funcionaria');
});

test('o "Aa" chega como link para os controles de leitura, que estão dentro da folha do menu', async () => {
  const pagina = await fetch(`${BASE}/`).then((r) => r.text());
  assert.match(pagina, /<a[^>]+href="#barra-acessibilidade"/);

  const folha = pagina.match(/<div[^>]*id="menu-principal"[\s\S]*?<\/header>/)?.[0] || '';
  assert.match(folha, /id="barra-acessibilidade"/, 'os controles de leitura saíram da folha do menu');
});

test('o WhatsApp está na folha do menu, como link comum, FORA do <nav> — e não há mais botão flutuante', async () => {
  const pagina = await fetch(`${BASE}/`).then((r) => r.text());

  const folha = pagina.match(/<div[^>]*id="menu-principal"[\s\S]*?<\/header>/)?.[0] || '';
  assert.match(folha, /<a[^>]+href="https:\/\/wa\.me\/5511953968344"/, 'o WhatsApp sumiu da folha do menu');

  // Fora do <nav aria-label="Principal">: é ação, não destino do site — e o
  // <nav> é contado como 11 em testes/cabecalho.test.mjs.
  const nav = pagina.match(/<nav[^>]*aria-label="Principal"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.doesNotMatch(nav, /wa\.me/, 'o WhatsApp entrou no <nav> principal');

  assert.doesNotMatch(pagina, /class="zap"/, 'o botão flutuante de WhatsApp voltou');
});

test('o cabeçalho traz o logotipo da ONG com o nome no alt', async () => {
  const pagina = await fetch(`${BASE}/`).then((r) => r.text());
  const cabecalho = pagina.match(/<header[\s\S]*?<\/header>/)?.[0] || '';
  assert.match(cabecalho, /<img[^>]+src="\/imagens\/logo-atelie\.png"[^>]+alt="Ateliê Afro Cultural"|<img[^>]+alt="Ateliê Afro Cultural"[^>]+src="\/imagens\/logo-atelie\.png"/);
});

test('as telas de conta usam o layout focado: "Voltar", sem barra de atalhos', async () => {
  for (const rota of ['/entrar', '/recuperar-acesso', '/nova-senha']) {
    const pagina = await fetch(`${BASE}${rota}`).then((r) => r.text());
    assert.match(pagina, /class="af-header cabecalho af-header--focado"/, `${rota} sem layout focado`);
    assert.doesNotMatch(pagina, /aria-label="Atalhos"/, `${rota} ainda desenha a barra de atalhos`);
    // A navegação inteira continua no HTML: sem JavaScript, é ela que leva
    // a pessoa para fora daqui.
    assert.match(pagina, /<nav[^>]*aria-label="Principal"/, `${rota} perdeu o menu sem JavaScript`);
  }
});

test('o rodapé continua com os cinco canais do RF06, e sem o terceiro botão de doar', async () => {
  const pagina = await fetch(`${BASE}/privacidade`).then((r) => r.text());
  const rodape = pagina.match(/<footer[\s\S]*?<\/footer>/)?.[0] || '';
  const canais = rodape.match(/<ul[^>]*class="af-footer__links[\s\S]*?<\/ul>/)?.[0] || '';
  assert.equal([...canais.matchAll(/<a /g)].length, 5);
  assert.doesNotMatch(rodape, /href="\/doar"/);
});

/* ------------------------------------------------------------------
   Os tokens: escala de tipo e elevação
   ------------------------------------------------------------------ */

test('a escala de tipo do novo layout está nos tokens, em rem (o A+ continua escalando)', () => {
  const tokens = readFileSync(new URL('../estilos/tokens.css', import.meta.url), 'utf8');
  assert.match(tokens, /--af-h1: 2rem;/);
  assert.match(tokens, /--af-h2: 1\.375rem;/);
  assert.match(tokens, /--af-body: 1rem;/);
  assert.match(tokens, /--af-overline: 0\.75rem;/);
  assert.match(tokens, /--af-h1: 3rem;/, 'o H1 do desktop é 48px');
});

test('campos e avisos perderam a sombra dura (elevação em três níveis)', () => {
  const aplicado = readFileSync(new URL('../estilos/sistema-aplicado.css', import.meta.url), 'utf8');
  const campo = aplicado.match(/#conteudo \.campo input:not\(\[type="checkbox"\]\)[\s\S]*?\}/)?.[0] || '';
  assert.match(campo, /min-height: 3\.25rem/, 'o campo tem 52px de altura');
  assert.match(campo, /box-shadow: none/);
  const aviso = aplicado.match(/#conteudo \.aviso,[\s\S]*?\}/)?.[0] || '';
  assert.match(aviso, /box-shadow: none/);
});

/* ------------------------------------------------------------------
   Os componentes base
   ------------------------------------------------------------------ */

test('CabecalhoDaPagina: sobretítulo, H1 e lead, e omite o que não veio', () => {
  const cheio = html(createElement(CabecalhoDaPagina, { sobretitulo: 'Participar', titulo: 'Agenda', lead: 'Lead.' }));
  assert.match(cheio, /<p class="af-overline af-cabecalho-pagina__sobre">Participar<\/p><h1 class="af-h1">Agenda<\/h1><p class="af-cabecalho-pagina__lead">Lead\.<\/p>/);

  const so = html(createElement(CabecalhoDaPagina, { titulo: 'Agenda' }));
  assert.doesNotMatch(so, /__sobre|__lead/, 'sem texto, sem parágrafo vazio (regra 2)');
});

test('ItemDeLista: com href a linha inteira é o link e tem seta; sem href, nem link nem seta', () => {
  const link = html(createElement(ItemDeLista, { href: '/agenda', titulo: 'Participar', numero: '02' }));
  assert.match(link, /^<a class="af-item af-item--numerado" href="\/agenda">/);
  assert.match(link, /af-item__seta/);

  const linha = html(createElement(ItemDeLista, { titulo: 'Só leitura' }));
  assert.match(linha, /^<div class="af-item">/);
  assert.doesNotMatch(linha, /af-item__seta/);
});

test('FiltroEmChips: cada chip é um link, e só o escolhido leva aria-current', () => {
  const saida = html(createElement(FiltroEmChips, {
    rotulo: 'Filtrar por gênero',
    opcoes: [{ texto: 'Todas', href: '/projetos', ativo: true, contagem: 11 }, { texto: 'Contação', href: '/projetos?genero=c' }]
  }));
  assert.match(saida, /<nav class="af-chips" aria-label="Filtrar por gênero">/);
  assert.equal([...saida.matchAll(/aria-current="true"/g)].length, 1);
  assert.match(saida, /Todas<span class="af-chip__contagem"> · 11<\/span>/);
  assert.equal(html(createElement(FiltroEmChips, { rotulo: 'x', opcoes: [] })), '');
});

test('Abas: links com aria-current="page" na escolhida — não role="tab"', () => {
  const saida = html(createElement(Abas, {
    rotulo: 'Quando', abas: [{ texto: 'Em breve', href: '/agenda', ativa: true }, { texto: 'Já aconteceu', href: '/agenda?quando=antes' }]
  }));
  assert.doesNotMatch(saida, /role="tab/);
  assert.equal([...saida.matchAll(/aria-current="page"/g)].length, 1);
});

test('EstadoVazio: as ações são botões de verdade, e o texto vem de quem chama', () => {
  const saida = html(createElement(EstadoVazio, {
    titulo: 'Nada por aqui', acoes: [{ texto: 'Instagram', href: 'https://instagram.com/atelie_afrocultural', externo: true }]
  }));
  assert.match(saida, /<a class="af-btn af-btn--outline af-vazio__acao" href="https:\/\/instagram\.com\/atelie_afrocultural" rel="noopener">Instagram<\/a>/);
  assert.doesNotMatch(saida, /af-vazio__texto/);
});

test('Aplique: o destaque é um gesto declarado, com o elemento escolhido', () => {
  assert.equal(html(createElement(Aplique, { como: 'article' }, 'x')), '<article class="af-aplique">x</article>');
});

test('SeloDeData: a data é a do fuso da ONG, e o leitor de tela ouve por extenso', () => {
  // 01h de domingo em UTC ainda é sábado em São Paulo.
  const partes = partesDaData('2026-10-18T01:00:00.000Z');
  assert.equal(partes.semana, 'SÁB');
  assert.equal(partes.dia, '17');
  assert.equal(partes.mes, 'OUT');

  const saida = html(createElement(SeloDeData, { iso: '2026-10-18T01:00:00.000Z', destaque: true }));
  assert.match(saida, /class="af-selo af-selo--destaque"/);
  assert.match(saida, /<span class="apenas-leitor-de-tela">sábado, 17 de outubro<\/span>/);
});

test('BarraDeAcao: envio liga ao <form> pelo atributo form, e LinkDeVoltar diz o destino', () => {
  const envio = html(createElement(BarraDeAcao, { principal: { texto: 'Confirmar inscrição', formulario: 'form-inscricao' } }));
  assert.match(envio, /<div class="af-barra-acao" role="region" aria-label="Próximo passo">/);
  assert.match(envio, /<button type="submit" form="form-inscricao"/);

  const voltar = html(createElement(LinkDeVoltar, { texto: 'Projetos', href: '/projetos' }));
  assert.match(voltar, /<a href="\/projetos">.*Voltar para <\/span>Projetos<\/a>/);
});
