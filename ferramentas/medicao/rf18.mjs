import { Builder, By, until } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { espera } from './apoio.mjs';
const B = process.env.BASE || 'https://venturus-atelie.vercel.app';
const EV = process.env.EVENTO;

const d = await new Builder().forBrowser('firefox')
  .setFirefoxOptions(new Options().addArguments('-headless')).build();
try {
  await d.manage().window().setRect({ width: 450, height: 1200 });
  await d.get(`${B}/agenda/${EV}/inscricao`);
  await d.wait(until.elementLocated(By.css('input[name="nome"]')), 20000);

  await d.findElement(By.css('input[name="nome"]'))
    .sendKeys('TESTE AUTOMATIZADO - apagar (RF18)');
  await d.findElement(By.css('input[name="email"]')).sendKeys('teste-rf18@exemplo.invalid');
  await d.executeScript(`
    var c = document.querySelector('input[name="consentimento"]');
    if (c && !c.checked) c.click();
  `);
  await espera(400);

  const botao = await d.findElement(By.css('#form-inscricao button[type="submit"]'));
  await d.executeScript('arguments[0].click()', botao);
  await espera(6000);

  console.log('  URL: ' + (await d.getCurrentUrl()).replace(B, ''));
  const msg = await d.executeScript(`
    var a = document.querySelector('#aviso p') || document.querySelector('.aviso p');
    return a ? a.textContent.trim().slice(0, 220) : '(sem aviso)';
  `);
  console.log('  mensagem: ' + msg);
} finally {
  await d.quit();
}
