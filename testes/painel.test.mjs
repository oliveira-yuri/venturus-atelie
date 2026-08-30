/**
 * Verificações do painel administrativo.
 *
 * O RNF08 é bloqueante: a ONG não possui computador, e publicar evento,
 * marcar presença e responder doação precisam funcionar inteiramente pelo
 * celular. "Mobile-first" só vale como afirmação se alguém medir.
 *
 * Marcados como `test.todo` na Tarefa A1 da fase 2: o painel é RF33/Bloco B,
 * e as telas serão inteiramente reescritas no app Next — a implementação
 * abaixo falava com o `admin/*.html` do site estático, por um servidor
 * próprio. A Tarefa A8 apagou `site/`; a referência de consulta para o
 * Bloco B é a cópia congelada do painel real,
 * `testes/apoio/html-original/admin/index.html`. Não haveria o que
 * "reapontar": a página que este arquivo mediu nunca existiu no Next, e o
 * HTML que vier no Bloco B pode ter marcação, classes e fluxo de
 * autenticação diferentes dos que os seletores abaixo assumiam
 * (`.nav-admin`, `#form-entrar`, `#aba-criar`...).
 *
 * `test.todo` em vez de apagar ou comentar o código: os 12 casos descrevem
 * requisitos do RF33/RNF08/RN01/RN05 que continuam valendo — só a forma de
 * verificar é que muda. Um `test.todo` conta em toda rodada de `npm test`;
 * código comentado não aparece em relatório nenhum.
 *
 * Reativação: nove dos doze dependem de uma tela de PAINEL que só existe no
 * Bloco B, ainda sem plano escrito, e continuam `test.todo`. Três NÃO —
 * "rótulo vinculado", "as duas abas funcionam pelo teclado" e "RF12: a
 * caixa de maioridade" verificavam marcação e interação de teclado em
 * `/entrar`, sem precisar de autenticação nenhuma — e a Tarefa A6 (que
 * porta essa tela, app/entrar/page.tsx + componentes/AbasEntrar.tsx) os
 * reativa como testes de verdade no fim deste arquivo, contra a rota nova.
 * Prender os doze ao Bloco B (achado da rodada de correção 1 desta tarefa)
 * teria deixado essas três verificações — uma delas regra de negócio (RF12:
 * só maior de 18 anos cria conta) — esquecidas por um bloco inteiro além do
 * necessário. Cada `test.todo` que resta diz contra qual tarefa reativar.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

let navegador;

// `before`/`after` deste arquivo rodam uma vez por execução da suíte,
// mesmo que a maioria dos testes abaixo continue `test.todo` (que não
// executa corpo nenhum) — só os três reativados no fim do arquivo usam
// `navegador`.
before(async () => {
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();
});

after(async () => { await navegador?.quit(); });

test.todo('a navegação fica na parte de baixo no celular — zona do polegar '
  + '(RNF08: painel mobile-first; reativar contra a tela nova do Bloco B)');

test.todo('a navegação do painel não cobre o conteúdo '
  + '(RNF08; reativar contra a tela nova do Bloco B)');

test.todo('todo alvo de toque do painel tem 44px no celular '
  + '(RNF08 + acessibilidade, regra 8 do CLAUDE.md; reativar contra a tela nova do Bloco B)');

test.todo('o painel não rola na horizontal no celular '
  + '(RNF08; reativar contra a tela nova do Bloco B)');

test.todo('no desktop a navegação vira lateral '
  + '(RF33; reativar contra a tela nova do Bloco B)');

test.todo('os ícones da navegação são decorativos para o leitor de tela '
  + '(acessibilidade, regra 8 do CLAUDE.md; reativar contra a tela nova do Bloco B)');

test.todo('o painel pede noindex — não é conteúdo público '
  + '(RF33/RN05; reativar contra a tela nova do Bloco B)');

test.todo('o painel recusa quem não está autenticado — redireciona para /entrar E preserva '
  + 'o destino de retorno (parâmetro destino=), para voltar ao painel depois de entrar em vez '
  + 'da home '
  + '(RN05 + RF34: dados pessoais só para a equipe; reativar contra a tela nova do Bloco B, '
  + 'com o fluxo de autenticação real que a Tarefa A6 traz para /entrar)');

test.todo('o painel pede noindex na página real '
  + '(RF33; reativar contra a tela nova do Bloco B)');

// =====================================================================
// Reativados pela Tarefa A6 contra /entrar de verdade (app/entrar/page.tsx
// + componentes/AbasEntrar.tsx). Corpo adaptado do commit histórico
// (`git show effe333:testes/painel.test.mjs`): mesma verificação, seletor
// igual onde o HTML se manteve igual (`#form-entrar input`, `#aba-criar`,
// `#painel-criar`) — só o endereço muda, de um servidor estático próprio
// servindo o `entrar.html` do site antigo para BASE + '/entrar' no Next.
// Exceção:
// `#campo-maioridade` virou `#criar-campo-maioridade` na Rodada de
// correção 1 (ver o `prefixo` de componentes/CampoFormulario.ts) — os dois
// `<form>` (entrar/criar) coexistem sempre no DOM, o painel oculto só
// ganha `hidden`, e sem prefixo os campos "email"/"senha" dos dois
// formulários geravam o MESMO id.
//
// Os três valiam com todo campo desabilitado (a decisão "sem envio" da
// Tarefa A6) e continuam valendo agora que a Tarefa 3 da autenticação
// habilitou os campos e ligou as Server Actions: rótulo vinculado,
// alternância de aba e o atributo `required` não dependem do estado do
// envio. O que o envio mudou aqui foi um detalhe do primeiro teste — ver o
// filtro de `input[type=hidden]` logo abaixo.
test('/entrar: os campos têm rótulo vinculado', async () => {
  await navegador.manage().window().setRect({ width: 375, height: 720 });
  await navegador.get(`${BASE}/entrar`);
  await navegador.wait(async () =>
    (await navegador.findElements(By.css('#form-entrar input'))).length > 0, 5000);

  // `input[type=hidden]` fica de fora: desde a Tarefa 3 da autenticação os
  // dois <form> chamam Server Actions, e o Next serializa a referência de
  // cada uma em campos escondidos ($ACTION_REF_..., $ACTION_KEY) — é o que
  // faz o envio funcionar sem JavaScript. Campo escondido não é controle de
  // ninguém: não aparece na tela, não recebe foco, não entra na árvore de
  // acessibilidade, e exigir <label> para ele seria exigir rótulo para um
  // detalhe do framework. (Antes desta linha o teste os acusava como
  // "campos sem rótulo vinculado" — falso positivo medido nesta tarefa.)
  const semRotulo = await navegador.executeScript(`
    return [...document.querySelectorAll('input')]
      .filter((campo) => campo.type !== 'hidden')
      .filter((campo) => {
        if (!campo.id) return true;
        return !document.querySelector('label[for="' + campo.id + '"]');
      })
      .map((campo) => campo.name || campo.type);
  `);

  assert.deepEqual(semRotulo, [], 'campos sem rótulo vinculado');

  // Rótulo vinculado não basta se o id estiver DUPLICADO — o achado real da
  // Rodada de correção 1: um `label[for="campo-email"]` existia, mas
  // resolvia para o campo do OUTRO formulário (os dois "email"/"senha" de
  // entrar/criar geravam o mesmo id antes do `prefixo`). Esta suíte não
  // tinha nenhum assert de unicidade — o teste acima aceitava a duplicata
  // porque só perguntava "existe algum label para este id", não "existe só
  // um elemento com este id em toda a página".
  const idsRepetidos = await navegador.executeScript(`
    const contagem = {};
    [...document.querySelectorAll('[id]')].forEach((el) => {
      contagem[el.id] = (contagem[el.id] || 0) + 1;
    });
    return Object.entries(contagem).filter(([, n]) => n > 1).map(([id]) => id);
  `);

  assert.deepEqual(idsRepetidos, [], `ids duplicados em /entrar: ${idsRepetidos.join(', ')}`);
});

test('/entrar: as duas abas funcionam pelo teclado', async () => {
  await navegador.get(`${BASE}/entrar`);
  await navegador.wait(async () =>
    (await navegador.findElements(By.css('#aba-criar'))).length > 0, 5000);

  await navegador.findElement(By.css('#aba-criar')).click();

  const estado = await navegador.executeScript(`
    return {
      criarVisivel: !document.querySelector('#painel-criar').hidden,
      entrarEscondido: document.querySelector('#painel-entrar').hidden,
      selecionada: document.querySelector('#aba-criar').getAttribute('aria-selected')
    };
  `);

  assert.equal(estado.criarVisivel, true, 'o painel de criar conta não apareceu');
  assert.equal(estado.entrarEscondido, true, 'os dois painéis ficaram visíveis');
  assert.equal(estado.selecionada, 'true', 'a aba não foi marcada como selecionada');
});

test('RF12: a caixa de maioridade existe e é obrigatória', async () => {
  await navegador.get(`${BASE}/entrar`);
  await navegador.wait(async () =>
    (await navegador.findElements(By.css('#aba-criar'))).length > 0, 5000);
  await navegador.findElement(By.css('#aba-criar')).click();

  const caixa = await navegador.executeScript(`
    const campo = document.querySelector('#criar-campo-maioridade');
    if (!campo) return null;
    return {
      obrigatoria: campo.required,
      rotulo: document.querySelector('label[for="criar-campo-maioridade"]')?.textContent.trim() || ''
    };
  `);

  assert.ok(caixa, 'a caixa de maioridade não existe — RF12 e RN01');
  assert.equal(caixa.obrigatoria, true, 'a caixa de maioridade não é obrigatória');
  assert.match(caixa.rotulo, /18/, 'o rótulo precisa dizer a idade');
});
