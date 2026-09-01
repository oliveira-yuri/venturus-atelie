import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { buscarDoacaoDoPainel } from '@/servidor/dados/doacoes';
import { ehIdentificador } from '@/compartilhado/validacao';
import { rotuloDaSituacaoDeDoacao, rotuloDoTipo } from '@/compartilhado/doacoes';
import FormularioAnalise from '@/componentes/FormularioAnalise';

/**
 * `/admin/doacoes/responder?id=<uuid>` — a análise de UMA doação
 * (RF20/RF21).
 *
 * ===================================================================
 * SEMPRE COM `?id=`, E É UMA TELA SÓ PARA AS DUAS COISAS
 * ===================================================================
 *
 * Mesma forma de /admin/atividades/editar: não existe "responder nova"
 * — quem cria doação é quem oferta (/doar/ofertar) ou a tela de registro
 * (/admin/doacoes/registrar). Sem `id`, então, não há tela: é 404, como
 * qualquer endereço que não existe.
 *
 * E É UMA TELA SÓ para responder (RF20) e para registrar o recebido
 * (RF21), porque são o mesmo gesto em momentos diferentes da mesma
 * conversa: "aceitamos" hoje, "chegou" na semana que vem, e as duas vezes
 * a equipe escreve para a mesma pessoa. Duas telas fariam dois formulários
 * competindo pelo mesmo campo de resposta — e quem corrigisse a resposta
 * numa não veria a outra.
 *
 * ===================================================================
 * POR QUE UMA ROTA PRÓPRIA, E NÃO BOTÕES NO CARTÃO DA LISTA
 * ===================================================================
 *
 * /admin/contatos resolve a triagem com botões dentro de cada cartão, e
 * funciona: lá a mudança é UM valor de coluna, e um botão por destino cabe
 * num cartão. Aqui a resposta é TEXTO — e um `<textarea>` por cartão, numa
 * lista de dez doações, num celular de 375px, é uma tela que não se usa
 * (regra 4 do CLAUDE.md). A lista mostra o que espera resposta; esta tela
 * é onde se responde uma.
 *
 * A GUARDA É A MESMA DE TODA TELA DO PAINEL, nas duas funções (componente e
 * `generateMetadata`), pelo motivo medido na Tarefa P1 e escrito em
 * app/admin/layout.tsx. `testes/painel-guarda.test.mjs` varre `app/admin/**`
 * e falha se uma delas faltar. Aqui o que vazaria é o nome, o e-mail e o
 * texto de uma pessoa — e quanto ela doou.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  // O TÍTULO NÃO LEVA O NOME DE NINGUÉM, mesma decisão de
  // app/minha-conta/page.tsx: um "Doação de Fulana" apareceria na aba do
  // navegador, no histórico e em qualquer print — e o cenário é o celular
  // pessoal de alguém da equipe, compartilhado (regra 4).
  return {
    title: 'Responder doação — painel da equipe',
    description: 'Responder uma doação oferecida pelo site e registrar o que o Ateliê recebeu.'
  };
}

/**
 * O valor guardado, pronto para VOLTAR ao campo de texto.
 *
 * `numeric(12,2)` chega do PostgREST como STRING com ponto ("150.00"), e o
 * campo espera a forma brasileira ("150,00") — é o que `numeroDoValor`
 * (compartilhado/validacao.ts) sabe ler. Sem esta conversão, abrir uma
 * doação com valor já registrado e apenas corrigir a resposta faria o
 * formulário reenviar "150.00", que a validação RECUSA de propósito (o
 * ponto como decimal é ambíguo — ver o comentário de `FORMATO_VALOR`). A
 * equipe leria "escreva o valor com vírgula" sobre um número que ela nem
 * digitou.
 *
 * Sem separador de milhar: `Intl` poria "1.234,56", que o campo aceita, mas
 * a forma mais simples é a que menos surpreende quem vai editar.
 */
function valorParaOCampo(valor: string | number | null): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace('.', ',');
}

export default async function PaginaDeResposta(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const pedido = (await searchParams).id;
  const id = typeof pedido === 'string' ? pedido : '';

  // `id` é uuid (`gen_random_uuid()`, 004_pessoas.sql) — ao contrário do id
  // de atividade, que é `text`. Um valor malformado daria erro de sintaxe no
  // Postgres (22P02) em vez de "não achei"; recusar antes é o que impede
  // uma requisição montada à mão de virar erro de banco no log.
  if (!ehIdentificador(id)) notFound();

  const { valor: doacao, degradou } = await buscarDoacaoDoPainel(id);

  // OS DOIS "NÃO TEM" SÃO SEPARADOS, e o do meio é o que costuma faltar:
  // "esta doação não existe" e "não deu para perguntar" são frases muito
  // diferentes para quem está com o celular na mão. Tratar as duas como 404
  // faria a equipe concluir que alguém apagou a doação quando o que houve
  // foi o banco não responder.
  if (degradou) {
    return (
      <main id="conteudo" className="conteudo painel__conteudo">
        <p className="painel__voltar"><Link href="/admin/doacoes">← Doações</Link></p>
        <h1>Responder doação</h1>
        <p className="estado estado--erro">
          Não deu para carregar esta doação agora — o banco de dados não respondeu. Nada foi
          perdido e nada foi alterado: volte para a lista e tente de novo em alguns instantes.
        </p>
      </main>
    );
  }

  if (!doacao) notFound();

  const quem = doacao.doador_nome ?? doacao.perfil_nome;
  const email = doacao.doador_email ?? doacao.perfil_email;

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin/doacoes">← Doações</Link></p>

      <h1>Responder doação</h1>

      {/*
        O QUE FOI OFERECIDO VEM ANTES DO FORMULÁRIO, e é só leitura. Esta
        tela não edita o texto de quem doou: o que a pessoa escreveu é
        registro, e `lerAnalise` (compartilhado/validacao.ts) nem lê o campo
        `descricao` — então não há caminho por onde ele volte ao banco
        alterado. O porquê inteiro está em acoes/doacoes.ts.
      */}
      <section aria-labelledby="titulo-oferta">
        <h2 id="titulo-oferta">O que foi oferecido</h2>

        {/*
          `doacao__ficha` AO LADO de `ficha`, e não `ficha` sozinha —
          DEFEITO VISTO ABRINDO A TELA (regra 10 do CLAUDE.md), não pelos
          testes, que estavam verdes. MEDIDO no Firefox, a 375px e a
          1280px: com `ficha` sozinha o link do e-mail saía com **20px de
          altura**, contra os 44px que a RNF08 pede — o mesmo defeito que a
          RF11 mediu no "Trocar minha senha" de /minha-conta. Quem responde
          uma doação toca nesse link para abrir o app de e-mail; um alvo de
          20px, num celular, de pé, é o que faz a pessoa errar.

          Quem dá a altura é `.doacao__ficha dd a` (estilos/admin.css), a
          mesma regra que a fila usa nos cartões. `ficha` continua porque é
          ela que dá o desenho base do <dl>, em estilos/base.css.
        */}
        <dl className="ficha doacao__ficha">
          <div>
            <dt>Quem</dt>
            <dd>
              {quem ?? (doacao.perfil_id
                ? 'Ofertada pelo site (o nome não carregou)'
                : 'Doação sem identificação')}
            </dd>
          </div>

          {email ? (
            <div>
              <dt>E-mail</dt>
              <dd><a href={`mailto:${email}`}>{email}</a></dd>
            </div>
          ) : null}

          <div>
            <dt>Tipo</dt>
            <dd>{rotuloDoTipo(doacao.tipo)}</dd>
          </div>

          <div>
            <dt>Situação agora</dt>
            <dd>{rotuloDaSituacaoDeDoacao(doacao.situacao)}</dd>
          </div>

          <div>
            <dt>Como chegou</dt>
            <dd>
              {doacao.perfil_id
                ? 'Ofertada pelo site, por quem tem conta'
                : 'Registrada pela equipe (chegou por fora do site)'}
            </dd>
          </div>
        </dl>

        {/* `white-space: pre-wrap` no CSS: as quebras de linha que a pessoa
            escreveu ficam como ela escreveu. */}
        <p className="doacao__descricao">{doacao.descricao}</p>
      </section>

      <section aria-labelledby="titulo-resposta">
        <h2 id="titulo-resposta">Sua resposta</h2>

        <FormularioAnalise
          id={doacao.id}
          situacaoAtual={doacao.situacao}
          respostaAtual={doacao.resposta ?? ''}
          valorAtual={valorParaOCampo(doacao.valor)}
          tipoDaDoacao={doacao.tipo}
        />
      </section>
    </main>
  );
}
