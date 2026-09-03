import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { entrar, espera, clicarEConfirmar } from './apoio.mjs';
const B = process.env.BASE || 'https://venturus-atelie.vercel.app';

const d = await new Builder().forBrowser('firefox')
  .setFirefoxOptions(new Options().addArguments('-headless')).build();
try {
  await d.manage().window().setRect({ width: 450, height: 1200 });
  await entrar(d, B, 'entrega@exemplo.test', 'entrega123');
  await d.get(B + '/admin/avisos');
  await espera(1200);

  const antes = await d.executeScript(`
    var f = document.querySelector('form.aviso-envio');
    var b = f ? f.querySelector('button[type="submit"]') : null;
    return { temFormulario: !!f, temBotao: !!b,
             rotuloBotao: b ? b.textContent.trim() : null,
             confirmar: f ? f.getAttribute('data-confirmar-rotulo') : null };
  `);
  console.log('  antes: ' + JSON.stringify(antes));

  await d.executeScript(`
    var s = document.querySelector('select[name="grupo"]');
    s.value = 'voluntarios';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await clicarEConfirmar(d, 'Enviar por e-mail');
  await espera(3500);

  console.log('  URL depois: ' + (await d.getCurrentUrl()).replace(B, ''));
  const depois = await d.executeScript(`
    var a = document.querySelector('.aviso p');
    return a ? a.textContent.trim().slice(0, 200) : '(sem caixa de aviso)';
  `);
  console.log('  mensagem: ' + depois);
} finally {
  await d.quit();
}
