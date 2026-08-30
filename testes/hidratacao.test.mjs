/**
 * Verifica que nenhuma pagina diverge entre o HTML enviado pelo servidor e o
 * que o React monta no cliente durante a hidratacao.
 *
 * A API classica `manage().logs().get('browser')` nao existe neste
 * geckodriver para Firefox (responde "HTTP method not allowed"). Por isso
 * usamos o inspetor de log do WebDriver BiDi, que e o caminho que de fato
 * funciona neste ambiente.
 *
 * Producao minifica a mensagem de erro do React para
 * "Minified React error #418..." (a familia de erros de hidratacao vai de
 * #418 a #425) — por isso o padrao abaixo cobre tanto o texto de
 * desenvolvimento quanto o codigo minificado de producao.
 *
 * Este teste tem que falhar fechado: se o inspetor de log nao inicializar,
 * ele nao tem como observar nada, e um teste cego que passa e pior que
 * nenhum teste — da confianca falsa exatamente onde a decisao de
 * continuar ou abortar o deploy vai ser tomada.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import getLogInspector from 'selenium-webdriver/bidi/logInspector.js';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

/** Cobre o texto de desenvolvimento e o codigo minificado #418-#425 de produção. */
const AVISO_HIDRATACAO = /hydrat|react\.dev\/errors\/4(1[89]|2[0-5])|did not match|server rendered/i;

let navegador;
let erroInspetor;
let avisos;

before(async () => {
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless').enableBidi())
    .build();

  avisos = [];
  try {
    const inspetor = await getLogInspector(navegador);
    await inspetor.onConsoleEntry((entrada) => {
      if (AVISO_HIDRATACAO.test(entrada.text)) avisos.push(entrada.text);
    });
    await inspetor.onJavascriptException((entrada) => {
      if (AVISO_HIDRATACAO.test(entrada.text)) avisos.push(entrada.text);
    });
  } catch (erro) {
    erroInspetor = erro;
  }
});

after(async () => { await navegador?.quit(); });

test('nenhum aviso de divergencia de hidratacao', async () => {
  if (erroInspetor) {
    assert.fail(
      `captura de log indisponivel: este teste nao pode verificar nada (${erroInspetor.message})`
    );
  }

  // Tarefa A6, Rodada de correção 1: componentes/Cabecalho.tsx virou
  // Client Component (usePathname, para o aria-current de "Entrar") e passa
  // a hidratar em TODA página, não só nesta amostra — e /entrar acrescenta
  // componentes/AbasEntrar.tsx (estado de aba), o Client Component mais
  // novo do projeto. As três rotas da Tarefa A6 entram aqui para cobrir os
  // dois.
  for (const rota of [
    '/', '/quem-somos', '/privacidade', '/para-escolas',
    '/contato', '/entrar', '/recuperar-acesso'
  ]) {
    avisos.length = 0;
    await navegador.get(`${BASE}${rota}`);
    await navegador.sleep(600);
    assert.deepEqual(avisos, [], `divergencia de hidratacao em ${rota}: ${JSON.stringify(avisos)}`);
  }
});
