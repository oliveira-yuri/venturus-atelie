/**
 * Banco fora do ar não pode derrubar página pública.
 *
 * ESTE ARQUIVO É A PROVA QUE FALTAVA. `testes/origem-dos-dados.test.mjs`
 * também roda no modo degradado, mas só exercita /para-escolas — ou seja,
 * só `servidor/dados/conteudo.ts`, o ÚNICO módulo que já degradava. Os
 * outros três (`eventos.ts`, `acervo.ts`, `voluntariado.ts`) faziam
 * `if (error) throw error` e nenhuma rodada de teste, em nenhum dos três
 * modos, chegava perto desse caminho:
 *
 *   - `npm test` (offline) nem tem Supabase configurado: `temSupabase()`
 *     devolve false e as funções voltam lista vazia antes de consultar;
 *   - `npm run test:supabase` tem credencial VÁLIDA: a consulta funciona;
 *   - `npm run test:supabase-degradado` rodava só origem-dos-dados.
 *
 * MEDIDO na revisão final, com SUPABASE_URL apontando para host
 * inalcançável: /voluntariado, /agenda e /acervo respondiam 500 com
 * `<html id="__next_error__">` — a página de erro embutida do Next, sem
 * cabeçalho, sem rodapé, sem `<main id="conteudo">`, sem link de pular,
 * sem os controles A+/contraste, sem VLibras. O mesmo defeito que motivou
 * `app/not-found.tsx` para o 404; o 500 nunca teve dono.
 *
 * O que este arquivo exige, e por quê: não basta "responder 200". Uma
 * página 200 sem cabeçalho e sem rodapé é o mesmo prejuízo de
 * acessibilidade com outro código de status. Por isso cada rota é medida
 * pelos cinco elementos do layout raiz (app/layout.tsx).
 *
 * Roda SÓ no modo degradado (`npm run test:supabase-degradado`): é o único
 * em que o Supabase está configurado e a consulta falha de verdade.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const chaveErrada = process.env.COM_SUPABASE === 'chave-errada';

/**
 * As três rotas cujos módulos de dados lançavam em vez de degradar.
 * /para-escolas fica fora de propósito: quem cuida dela é
 * testes/origem-dos-dados.test.mjs, que além do 200 exige o carimbo de
 * procedência (coisa que só o módulo de fonte dupla tem).
 */
const ROTAS = ['/voluntariado', '/agenda', '/acervo'];

/**
 * Os cinco pedaços do layout raiz (app/layout.tsx) que a página de erro
 * embutida do Next NÃO entrega. Cada um é uma perda concreta de
 * acessibilidade, não decoração.
 */
const PEDACOS_DO_LAYOUT = [
  { nome: 'link de pular para o conteúdo', padrao: /class="pular-para-conteudo"/ },
  { nome: '<main id="conteudo">', padrao: /<main[^>]*id="conteudo"/ },
  { nome: 'cabeçalho com o menu principal', padrao: /id="menu-principal"/ },
  { nome: 'controles de acessibilidade (A+/contraste)', padrao: /class="acessibilidade"/ },
  { nome: 'rodapé', padrao: /<footer/ }
];

describe(
  'com o Supabase configurado e a consulta falhando, nenhuma rota pública cai',
  { skip: chaveErrada ? false : 'só com COM_SUPABASE=chave-errada' },
  () => {
    for (const rota of ROTAS) {
      test(`${rota} responde 200 com o layout inteiro, não a página de erro do Next`, async () => {
        const resposta = await fetch(`${BASE}${rota}`);
        assert.equal(
          resposta.status, 200,
          `${rota} respondeu ${resposta.status} com o banco falhando — `
          + 'a camada de dados lançou em vez de degradar'
        );

        const html = await resposta.text();

        assert.doesNotMatch(
          html, /__next_error__/,
          `${rota} entregou a página de erro embutida do Next`
        );

        for (const { nome, padrao } of PEDACOS_DO_LAYOUT) {
          assert.match(html, padrao, `${rota} veio sem ${nome}`);
        }
      });
    }

    test('a página degradada mostra o estado vazio escrito, não uma seção em branco', async () => {
      // Degradar para lista vazia só é aceitável porque as três páginas já
      // desenham um estado vazio com texto real (Tarefa A4) — ver
      // componentes/ListaEventos.ts, ListaMateriais.ts e ListaAreas.ts.
      // Sem isso, "200 com o layout" seria um <h2> seguido de nada.
      for (const rota of ROTAS) {
        const html = await fetch(`${BASE}${rota}`).then((r) => r.text());
        assert.match(
          html, /class="estado estado--vazio"/,
          `${rota} degradou para lista vazia sem desenhar o estado vazio`
        );
      }
    });
  }
);
