import { Builder, By, until } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { writeFileSync } from 'node:fs';
const B = 'http://localhost:3214';
const S = process.env.SAIDA || '/tmp';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

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

  // ---- 1. o mural ANTES de tudo: a conta não é voluntária ativa ----
  await d.get(B + '/avisos');
  await espera(700);
  const antes = await d.executeScript(
    'var e=document.querySelector(".estado"); return e ? e.textContent.trim().slice(0,80) : "(sem estado)"');
  console.log('  /avisos sem ser voluntário: ' + antes);

  // ---- 2. publicar o aviso ----
  await d.get(B + '/admin/avisos');
  await espera(700);
  const botaoPublicar = await d.findElements(By.xpath("//button[contains(., 'Publicar')]"));
  if (botaoPublicar.length === 0) { console.log('  ❌ não achei o botão Publicar'); }
  else {
    await d.executeScript('arguments[0].click()', botaoPublicar[0]);
    await espera(2500);
    const msg = await d.executeScript(
      'var a=document.querySelector(".aviso p"); return a ? a.textContent.trim().slice(0,110) : null');
    console.log('  publicou → ' + msg);
  }

  // ---- 3. candidatar-se ao voluntariado ----
  await d.get(B + '/voluntariado/candidatura');
  await espera(900);
  const caixas = await d.findElements(By.css('input[type="checkbox"][name^="area"]'));
  console.log('  áreas oferecidas na candidatura: ' + caixas.length);
  if (caixas.length > 0) {
    await d.executeScript('arguments[0].click()', caixas[0]);
    const enviar = await d.findElements(By.css('form.formulario button[type="submit"]'));
    if (enviar.length) {
      await d.executeScript('arguments[0].click()', enviar[0]);
      await espera(3000);
      console.log('  candidatura → ' + (await d.getCurrentUrl()).replace(B, ''));
    }
  }
} finally {
  await d.quit();
}
