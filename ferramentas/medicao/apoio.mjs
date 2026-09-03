import { By, until } from 'selenium-webdriver';

export const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function entrar(d, base, email, senha) {
  await d.get(base + '/entrar');
  await d.wait(until.elementLocated(By.css('#painel-entrar input[name="email"]')), 15000);
  await d.findElement(By.css('#painel-entrar input[name="email"]')).sendKeys(email);
  await d.findElement(By.css('#painel-entrar input[name="senha"]')).sendKeys(senha);
  await d.findElement(By.css('#painel-entrar button[type="submit"]')).click();
  await d.wait(async () => (await d.getPageSource()).includes('href="/minha-conta"'), 25000);
}

/**
 * Clica num botão do painel e ATRAVESSA o diálogo de confirmação.
 *
 * Toda ação do painel passa pelo `<dialog>` de ConfirmacaoDeAcoes (pedido
 * V1) — foi por isso que o primeiro clique "publicou" e nada aconteceu: o
 * submit foi interceptado e ficou esperando alguém confirmar.
 *
 * As destrutivas pedem uma PALAVRA digitada; esta função a preenche quando
 * o campo aparece.
 */
export async function clicarEConfirmar(d, textoDoBotao) {
  const botoes = await d.findElements(
    By.xpath(`//button[contains(normalize-space(.), ${JSON.stringify(textoDoBotao)})]`));
  if (botoes.length === 0) return { ok: false, motivo: 'botão não encontrado' };

  await d.executeScript('arguments[0].click()', botoes[0]);
  await espera(600);

  const temDialogo = await d.executeScript(
    'var x=document.querySelector("dialog.af-dialogo"); return !!(x && x.open)');

  if (temDialogo) {
    // Confirmação dupla: o botão só habilita depois da palavra certa.
    const palavra = await d.executeScript(`
      var l = document.querySelector('label[for="dialogo-palavra"] strong');
      return l ? l.textContent.trim() : null;
    `);
    if (palavra) {
      const campo = await d.findElement(By.css('#dialogo-palavra'));
      await campo.sendKeys(palavra);
      await espera(300);
    }
    const confirmar = await d.findElement(By.css('.af-dialogo__confirmar'));
    await d.executeScript('arguments[0].click()', confirmar);
  }

  await espera(2800);
  return { ok: true, passouPorDialogo: temDialogo };
}
