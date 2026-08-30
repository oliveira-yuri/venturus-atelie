/**
 * Verificações do painel administrativo.
 *
 * O RNF08 é bloqueante: a ONG não possui computador, e publicar evento,
 * marcar presença e responder doação precisam funcionar inteiramente pelo
 * celular. "Mobile-first" só vale como afirmação se alguém medir.
 *
 * Marcados como `test.todo` na Tarefa A1 da fase 2: o painel é RF33/Bloco B,
 * e as telas serão inteiramente reescritas no app Next — a implementação
 * abaixo falava com `site/admin/*.html` por um servidor estático próprio e
 * com `testes/apoio/painel-layout.html`, os dois do site antigo que a
 * migração aposenta (Tarefa A8). Não haveria o que "reapontar": a página que
 * este arquivo mediu nunca existiu no Next, e o HTML que vier no Bloco B pode
 * ter marcação, classes e fluxo de autenticação diferentes dos que os
 * seletores abaixo assumiam (`.nav-admin`, `#form-entrar`, `#aba-criar`...).
 *
 * `test.todo` em vez de apagar ou comentar o código: os 12 casos descrevem
 * requisitos do RF33/RNF08/RN01/RN05 que continuam valendo — só a forma de
 * verificar é que muda. Um `test.todo` conta em toda rodada de `npm test`;
 * código comentado não aparece em relatório nenhum. Reativar (com a
 * implementação nova) faz parte do plano do Bloco B, ainda não escrito.
 */
import { test } from 'node:test';

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

test.todo('o painel recusa quem não está autenticado '
  + '(RN05 + RF34: dados pessoais só para a equipe; reativar contra a tela nova do Bloco B, '
  + 'com o fluxo de autenticação real que a Tarefa A6 traz para /entrar)');

test.todo('o painel pede noindex na página real '
  + '(RF33; reativar contra a tela nova do Bloco B)');

test.todo('entrar.html: os campos têm rótulo vinculado '
  + '(acessibilidade, regra 8 do CLAUDE.md; reativar contra /entrar quando o Bloco B '
  + 'implementar o envio — a Tarefa A6 só porta a tela, sem autenticação)');

test.todo('entrar.html: as duas abas funcionam pelo teclado '
  + '(RF10: papéis acumuláveis, entrar/criar conta; reativar contra /entrar no Bloco B)');

test.todo('RF12: a caixa de maioridade existe e é obrigatória '
  + '(RF12 + RN01: conta é só para quem tem 18 anos ou mais; reativar contra /entrar no Bloco B)');
