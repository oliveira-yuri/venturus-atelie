/**
 * ferramentas/entrega/capturar-telas.mjs — os protótipos.
 *
 * =====================================================================
 * SÃO AS TELAS DE VERDADE, NÃO MOCKUPS
 * =====================================================================
 *
 * O site é levantado com `next start` e as credenciais de produção, e o
 * Firefox fotografa o que ele serve. A vantagem sobre um mockup é que o
 * protótipo NÃO PODE mentir: se uma tela estiver quebrada, ela sai
 * quebrada aqui.
 *
 * =====================================================================
 * A SESSÃO, QUANDO HÁ
 * =====================================================================
 *
 * 21 das 39 telas respondem 404 sem sessão de equipe. Com
 * `ENTREGA_EMAIL` e `ENTREGA_SENHA` no ambiente, o capturador ENTRA pelo
 * formulário real de /entrar antes de começar — nada de cookie forjado,
 * nada de remendo no código: é o mesmo caminho de uma pessoa.
 *
 * Sem as variáveis, ele captura só o que é público e ANOTA no índice
 * quais telas ficaram de fora. Um protótipo que esconde o que não
 * conseguiu mostrar é pior que um incompleto.
 *
 * Uso:
 *   node ferramentas/entrega/capturar-telas.mjs
 *   ENTREGA_EMAIL=... ENTREGA_SENHA=... node ferramentas/entrega/capturar-telas.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { Builder, By, until } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { FLUXOS, LARGURAS, EVENTO } from './telas.mjs';

const BASE = process.env.URL_CAPTURA || 'http://localhost:3210';
const SAIDA = 'entrega/03-prototipos';
const EMAIL = process.env.ENTREGA_EMAIL;
const SENHA = process.env.ENTREGA_SENHA;

/** O id de um evento publicado real, para as telas que dependem de um. */
async function acharEvento() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_CHAVE_PUBLICAVEL;
  if (!url || !chave) return null;

  try {
    const r = await fetch(
      `${url}/rest/v1/eventos?select=id&publicado=eq.true&order=comeca_em.desc&limit=1`,
      { headers: { apikey: chave } });
    const linhas = await r.json();
    return Array.isArray(linhas) && linhas[0] ? linhas[0].id : null;
  } catch { return null; }
}

async function entrar(navegador) {
  await navegador.get(`${BASE}/entrar`);
  await navegador.wait(until.elementLocated(By.css('#painel-entrar input[name="email"]')), 15000);
  await navegador.findElement(By.css('#painel-entrar input[name="email"]')).sendKeys(EMAIL);
  await navegador.findElement(By.css('#painel-entrar input[name="senha"]')).sendKeys(SENHA);
  await navegador.findElement(By.css('#painel-entrar button[type="submit"]')).click();

  // O cabeçalho troca "Entrar" pelo nome de quem entrou — é o sinal de
  // que a sessão existe de verdade, e não que o POST apenas voltou.
  await navegador.wait(async () => {
    const html = await navegador.getPageSource();
    return html.includes('href="/minha-conta"');
  }, 25000, 'não deu para entrar: o cabeçalho não mostrou a conta');
}

async function main() {
  const evento = await acharEvento();
  if (!evento) console.warn('  ⚠️  nenhum evento publicado: as telas que dependem de um vão sair no estado de erro');

  const navegador = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();

  const feitas = [];
  const puladas = [];

  try {
    let temSessao = false;
    if (EMAIL && SENHA) {
      await entrar(navegador);
      temSessao = true;
      console.log(`  ✅ sessão aberta como ${EMAIL}`);
    } else {
      console.log('  ⚠️  sem ENTREGA_EMAIL/ENTREGA_SENHA — só as telas públicas');
    }

    for (const fluxo of FLUXOS) {
      for (const tela of fluxo.telas) {
        const precisaSessao = fluxo.equipe || tela.sessao;
        if (precisaSessao && !temSessao) {
          puladas.push({ ...tela, fluxo: fluxo.id });
          continue;
        }

        const rota = tela.rota.replace(EVENTO, evento ?? 'sem-evento');
        const nomeBase = (fluxo.id + rota.replace(/[/?=&]/g, '-')).replace(/-+/g, '-');

        for (const largura of LARGURAS) {
          await navegador.manage().window().setRect({
            width: largura.px, height: largura.altura
          });
          await navegador.get(`${BASE}${rota}`);
          await navegador.executeScript('return document.fonts ? document.fonts.ready : true');

          // A gaveta do menu e a barra de acessibilidade chegam ABERTAS no
          // HTML e são recolhidas na hidratação. Capturar antes disso
          // fotografaria um estado que ninguém vê.
          await navegador.wait(async () => await navegador.executeScript(
            'return !!document.querySelector(".af-burger[aria-expanded]")'), 8000)
            .catch(() => {});

          /*
           * PÁGINA INTEIRA, e não a janela.
           *
           * `takeScreenshot()` do WebDriver fotografa a ÁREA VISÍVEL. A
           * primeira versão disto entregava toda tela cortada na altura da
           * janela — a página inicial parava no herói, e quem avaliasse
           * concluiria que a página é aquilo.
           *
           * O jeito é medir o documento e crescer a janela antes de
           * fotografar. O teto de 4500px existe porque uma página muito
           * longa viraria um PNG de vários MB, e o pacote inteiro precisa
           * caber num zip que alguém baixa.
           */
          const alturaReal = await navegador.executeScript(
            'return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)');

          await navegador.manage().window().setRect({
            width: largura.px,
            height: Math.min(Math.max(Number(alturaReal) + 40, largura.altura), 4500)
          });

          // Depois de crescer a janela, dar um instante para o layout
          // reagir — barras que dependem de altura, imagens com lazy.
          await navegador.executeScript('window.scrollTo(0, 0)');
          await navegador.executeScript(
            'return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');

          const arquivo = `${nomeBase}-${largura.chave}.png`;
          const png = await navegador.takeScreenshot();
          await writeFile(`${SAIDA}/telas/${arquivo}`, Buffer.from(png, 'base64'));
        }

        feitas.push({ ...tela, fluxo: fluxo.id, base: nomeBase });
        console.log(`  ✅ ${tela.nome}`);
      }
    }
  } finally {
    await navegador.quit();
  }

  await writeFile(`${SAIDA}/capturas.json`,
    JSON.stringify({ feitas, puladas, evento, em: new Date().toISOString() }, null, 2));

  console.log(`\n  ${feitas.length} telas capturadas, ${puladas.length} puladas.`);
}

await mkdir(`${SAIDA}/telas`, { recursive: true });
await main();
