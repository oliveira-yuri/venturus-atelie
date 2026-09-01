import { createElement } from 'react';
// SÓ O TIPO — mesmo motivo de componentes/PainelNumeros.ts e irmãos: um
// import de VALOR com o alias `@/...` mata o teste do Node em
// ERR_MODULE_NOT_FOUND. A lista de verdade chega como PROP, vinda de
// app/admin/page.tsx, e o teste passa a MESMA lista real (importada por
// caminho relativo, que o Node resolve) — então o que se mede é o
// componente desenhando os conjuntos que existem, não uma imitação.
import type { DescricaoDeConjunto } from '@/compartilhado/exportacao';

/**
 * Os downloads em CSV na home do painel (RF31).
 *
 * ===================================================================
 * DOIS LINKS, E NENHUM BOTÃO — É O QUE FAZ ISTO FUNCIONAR SEM JAVASCRIPT
 * ===================================================================
 *
 * Cada item é um `<a href>` para `/admin/exportar/<conjunto>`, que é um
 * Route Handler devolvendo o arquivo com `Content-Disposition: attachment`.
 * Nenhum `fetch`, nenhum Blob, nenhum `URL.createObjectURL` — que é como um
 * export costuma ser feito e é exatamente o que não funciona no celular de
 * quem está com script desligado, ou na página que ainda não hidratou.
 *
 * ===================================================================
 * E NÃO TEM O ATRIBUTO `download`, DE PROPÓSITO
 * ===================================================================
 *
 * A primeira versão tinha. Ele parece só uma declaração de intenção — e
 * seria, se o caminho feliz fosse o único. Com `download`, o navegador SALVA
 * o que voltar daquele endereço, seguindo redirecionamentos: quando a rota
 * recusa gerar o arquivo (a consulta falhou) e responde 303 para
 * `/admin?aviso=exportacao-erro`, o que a pessoa recebe é o HTML do PAINEL
 * salvo como arquivo — e nenhuma explicação na tela, porque a tela não
 * mudou. O aviso que existe para esse caso nunca seria lido.
 *
 * Sem o atributo, os dois caminhos funcionam: no sucesso, quem manda salvar
 * é o `Content-Disposition: attachment` do servidor — que é autoritativo, ao
 * contrário do atributo, que é uma dica; na falha, o navegador NAVEGA para o
 * painel e a frase aparece.
 *
 * ===================================================================
 * O QUE ESTA SEÇÃO PRECISA DIZER ANTES DE ALGUÉM TOCAR
 * ===================================================================
 *
 * Três avisos, e nenhum deles é enfeite legal — cada um evita um engano
 * concreto que já é previsível hoje:
 *
 *  1. O ARQUIVO CARREGA DADO PESSOAL DE TERCEIRO. Nome, e-mail, telefone e o
 *     texto que alguém escreveu para a ONG. Baixar é fácil; reenviar por
 *     grupo de mensagem também, e aí o dado saiu do controle de quem o
 *     recebeu. /privacidade promete cuidado com isso, e a promessa não
 *     termina no download;
 *  2. O APÓSTROFO NÃO É DEFEITO. Campos que começam com `=`, `+`, `-` ou `@`
 *     saem com um apóstrofo na frente — inclusive telefone escrito como
 *     "+55 11 ...". Sem essa marca, um texto escrito por qualquer visitante
 *     do site viraria FÓRMULA ao abrir a planilha (ver o cabeçalho de
 *     compartilhado/exportacao.ts). Dito aqui porque, sem explicação, a
 *     primeira reação é apagar a proteção;
 *  3. PLANILHA NO CELULAR É RUIM, e a regra 4 do CLAUDE.md manda dizer em
 *     voz alta em vez de fingir que não. A ONG não tem computador: este
 *     arquivo vai ser aberto no celular, e sem um aplicativo de planilha ele
 *     não abre. É a única coisa do painel inteiro que funciona melhor fora
 *     do celular, e esconder isso faria a equipe achar que o download
 *     quebrou.
 */

export type PropsPainelExportacoes = {
  /** A lista fechada de compartilhado/exportacao.ts, passada pela página. */
  conjuntos: DescricaoDeConjunto[];
};

/**
 * O prefixo das rotas de download. Mora aqui porque é endereço de tela, e
 * `testes/exportacao.test.mjs` confere que existe um `route.ts` sob
 * `app/admin/exportar/` — sem essa reconciliação, uma renomeação da pasta
 * deixaria dois links apontando para 404 dentro do painel, que é o defeito
 * que a home do site antigo cometeu seis vezes.
 */
export const CAMINHO_DA_EXPORTACAO = '/admin/exportar';

export const TITULO_DAS_EXPORTACOES = 'Levar para fora';

export const AVISO_DE_DADO_PESSOAL = 'Estes arquivos levam dado pessoal de quem procurou a '
  + 'ONG: nome, e-mail, telefone e o que a pessoa escreveu. Baixe quando for usar e não '
  + 'repasse o arquivo em grupo de mensagem — depois de encaminhado, não há como recolher.';

export const AVISO_DO_APOSTROFO = 'Alguns campos saem com um apóstrofo na frente (por exemplo '
  + 'um telefone escrito como +55 11...). Não é defeito: é o que impede um texto escrito por '
  + 'um visitante do site de virar fórmula quando a planilha abrir. Pode apagar o apóstrofo '
  + 'depois de conferir o que está escrito.';

export const AVISO_DE_PLANILHA = 'O arquivo abre numa planilha — Excel, LibreOffice ou Google '
  + 'Planilhas. No celular é preciso ter um aplicativo de planilha instalado; num computador '
  + 'abre direto.';

export function PainelExportacoes({ conjuntos }: PropsPainelExportacoes) {
  if (conjuntos.length === 0) return null;

  return createElement(
    'section',
    { className: 'painel__exportacoes', 'aria-labelledby': 'exportacoes-do-painel' },
    createElement(
      'h2',
      { className: 'painel__secao', id: 'exportacoes-do-painel' },
      TITULO_DAS_EXPORTACOES
    ),
    createElement('p', { className: 'painel__aviso painel__aviso--pessoal' }, AVISO_DE_DADO_PESSOAL),
    createElement(
      'ul',
      { className: 'exportacoes' },
      conjuntos.map((conjunto) => createElement(
        'li',
        { className: 'exportacoes__item', key: conjunto.chave },
        // O cartão inteiro é o alvo, como nos outros da home: rótulo e
        // descrição dentro do mesmo <a> para o dedo não precisar acertar a
        // palavra (regra 4).
        createElement(
          'a',
          // Sem `download` — ver o bloco no cabeçalho. Quem manda salvar é
          // o `Content-Disposition` do servidor; o atributo estragaria o
          // caminho da FALHA, salvando a página de aviso como arquivo.
          { className: 'exportacoes__alvo', href: `${CAMINHO_DA_EXPORTACAO}/${conjunto.chave}` },
          createElement('strong', { className: 'exportacoes__rotulo' }, conjunto.rotulo),
          createElement('span', { className: 'exportacoes__descricao' }, conjunto.descricao)
        )
      ))
    ),
    // Os dois avisos "de como o arquivo se comporta" ficam DEPOIS da lista, e
    // uma vez só: antes dela, empurrariam os dois downloads para baixo da
    // dobra num celular; repetidos em cada item, seriam duas leituras a mais
    // por item para quem usa leitor de tela.
    createElement('p', { className: 'painel__aviso' }, AVISO_DO_APOSTROFO),
    createElement('p', { className: 'painel__aviso' }, AVISO_DE_PLANILHA)
  );
}
