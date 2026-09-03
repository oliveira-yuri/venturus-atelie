import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { writeFileSync } from 'node:fs';
import { entrar, espera, clicarEConfirmar } from './apoio.mjs';

const B = process.env.BASE || 'http://localhost:3214';
const S = process.env.SAIDA || '/tmp';

const d = await new Builder().forBrowser('firefox')
  .setFirefoxOptions(new Options().addArguments('-headless')).build();
try {
  await d.manage().window().setRect({ width: 450, height: 1000 });
  await entrar(d, B, 'entrega@exemplo.test', 'entrega123');

  // ---- publicar o aviso ----
  await d.get(B + '/admin/avisos');
  await espera(800);
  const pub = await clicarEConfirmar(d, 'Publicar');
  console.log('  publicar: ' + JSON.stringify(pub));
  const msg = await d.executeScript(
    'var a=document.querySelector(".aviso p"); return a ? a.textContent.trim().slice(0,120) : null');
  console.log('  → ' + msg);

  // ---- promover a candidatura a ATIVO ----
  await d.get(B + '/admin/voluntarios?busca=entrega');
  await espera(900);
  const quantas = await d.executeScript('return document.querySelectorAll(".cartao-painel").length');
  console.log('  o filtro por "entrega" achou ' + quantas + ' candidatura(s)');
  const prom = await clicarEConfirmar(d, 'Marcar como voluntariando');
  console.log('  promover: ' + JSON.stringify(prom));

  // ---- o mural, agora ----
  await d.get(B + '/avisos');
  await espera(900);
  const mural = await d.executeScript(`
    var arts = document.querySelectorAll('article');
    var est = document.querySelector('.estado');
    return { avisos: arts.length,
             titulo: arts[0] ? arts[0].querySelector('h2').textContent.trim() : null,
             estado: est ? est.textContent.trim().slice(0,70) : null };
  `);
  console.log('  MURAL: ' + JSON.stringify(mural));

  const h = await d.executeScript('return document.body.scrollHeight');
  await d.manage().window().setRect({ width: 450, height: Math.min(Number(h) + 40, 2200) });
  await espera(400);
  writeFileSync(S + '/mural.png', Buffer.from(await d.takeScreenshot(), 'base64'));
} finally {
  await d.quit();
}
