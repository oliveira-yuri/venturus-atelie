import { Builder, By, until } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { writeFileSync } from 'node:fs';
const B = 'http://localhost:3214';
const S = process.env.SAIDA || '/tmp';

const d = await new Builder().forBrowser('firefox')
  .setFirefoxOptions(new Options().addArguments('-headless')).build();
try {
  await d.manage().window().setRect({ width: 450, height: 1000 });
  await d.get(B + '/entrar');
  await d.wait(until.elementLocated(By.css('#painel-entrar input[name="email"]')), 15000);
  await d.findElement(By.css('#painel-entrar input[name="email"]')).sendKeys('entrega@exemplo.test');
  await d.findElement(By.css('#painel-entrar input[name="senha"]')).sendKeys('entrega123');
  await d.findElement(By.css('#painel-entrar button[type="submit"]')).click();
  await d.wait(async () => (await d.getPageSource()).includes('href="/minha-conta"'), 25000);

  await d.get(B + '/admin/avisos');
  await new Promise((r) => setTimeout(r, 900));

  const info = await d.executeScript(`
    var itens = document.querySelectorAll('.cartao-painel');
    var aviso = document.querySelector('.aviso p');
    return {
      quantos: itens.length,
      avisoDaUrl: aviso ? aviso.textContent.trim().slice(0, 90) : null,
      titulos: [].map.call(itens, function (i) {
        var t = i.querySelector('.cartao-painel__titulo');
        var m = i.querySelector('.etiqueta');
        return (t ? t.textContent : '?') + ' [' + (m ? m.textContent : 'sem marca') + ']';
      }),
      estadoVazio: (document.querySelector('.estado') || {}).textContent || null
    };
  `);
  console.log('  ' + JSON.stringify(info, null, 2).split('\n').join('\n  '));

  const h = await d.executeScript('return document.body.scrollHeight');
  await d.manage().window().setRect({ width: 450, height: Math.min(Number(h) + 40, 2600) });
  await new Promise((r) => setTimeout(r, 400));
  writeFileSync(S + '/avisos-painel.png', Buffer.from(await d.takeScreenshot(), 'base64'));
} finally {
  await d.quit();
}
