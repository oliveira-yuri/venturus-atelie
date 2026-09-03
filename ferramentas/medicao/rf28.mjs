import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { entrar, espera, clicarEConfirmar } from './apoio.mjs';
const B = process.env.BASE || 'http://localhost:3214';

const d = await new Builder().forBrowser('firefox')
  .setFirefoxOptions(new Options().addArguments('-headless')).build();
try {
  await d.manage().window().setRect({ width: 450, height: 1200 });
  await entrar(d, B, 'entrega@exemplo.test', 'entrega123');
  await d.get(B + '/admin/avisos');
  await espera(900);

  // O grupo é um <select> dentro do formulário de envio.
  const grupos = await d.executeScript(`
    var s = document.querySelector('select[name="grupo"]');
    if (!s) return null;
    return [].map.call(s.options, function (o) { return o.value + '|' + o.text; });
  `);
  console.log('  grupos oferecidos: ' + JSON.stringify(grupos));

  if (!grupos) { console.log('  ❌ o formulário de envio não apareceu — o aviso está publicado?'); }
  else {
    await d.executeScript(`
      var s = document.querySelector('select[name="grupo"]');
      s.value = 'voluntarios';
      s.dispatchEvent(new Event('change', { bubbles: true }));
    `);
    const r = await clicarEConfirmar(d, 'Enviar por e-mail');
    console.log('  enviar: ' + JSON.stringify(r));
    const msg = await d.executeScript(
      'var a=document.querySelector(".aviso p"); return a ? a.textContent.trim().slice(0,160) : null');
    console.log('  → ' + msg);
  }
} finally {
  await d.quit();
}
