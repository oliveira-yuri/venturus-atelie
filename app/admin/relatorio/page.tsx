import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarIndicadores } from '@/servidor/dados/indicadores';
import { listarEventosDoPainel } from '@/servidor/dados/eventos';
import { resumoDeInscricoesPorEvento } from '@/servidor/dados/inscricoes';
import { FUSO_DA_ONG } from '@/compartilhado/validacao';
import { BotaoImprimir } from '@/componentes/BotaoImprimir';
import { Instrucoes } from '@/componentes/Instrucoes';
import { resumoDoPeriodo } from '@/servidor/dados/relatorio-periodo';
import {
  PERIODOS, ROTULO_DO_PERIODO, emReais, intervaloDoPeriodo, lerDeslocamento, lerPeriodo
} from '@/compartilhado/periodo';

/**
 * `/admin/relatorio` — o relatório em PDF (RF32).
 *
 * A PRIMEIRA LINHA DE CADA FUNÇÃO É A GUARDA, nas duas. Ver o cabeçalho de
 * `app/admin/eventos/page.tsx`.
 *
 * ===================================================================
 * O "PDF" É O NAVEGADOR, E A DECISÃO É DA SPEC
 * ===================================================================
 *
 * Não há biblioteca de geração de PDF neste projeto e não vai haver
 * (regra 7, e a spec §9 decidiu explicitamente por `window.print()` com
 * `impressao.css`). O que existe é: uma página desenhada para caber numa
 * folha, uma folha de estilo `@media print` que tira o cabeçalho, a
 * gaveta, o rodapé e os botões, e um botão que chama `window.print()`.
 *
 * NO ANDROID isso abre "Salvar como PDF" no seletor de impressora — que é
 * literalmente o requisito, sem uma linha de dependência, sem um kB baixado
 * no plano de dados de quem opera do celular.
 *
 * SEM JAVASCRIPT o botão não aparece e o caminho continua existindo, pelo
 * menu do próprio navegador. O documento é o mesmo: quem o produz é o CSS.
 *
 * ===================================================================
 * O QUE ENTRA NO RELATÓRIO, E POR QUÊ
 * ===================================================================
 *
 * Duas coisas, e as duas servem à mesma pergunta — a que um edital faz:
 *
 *  · OS SEIS INDICADORES (RF30), que são o retrato de hoje;
 *  · A AGENDA COM OS NÚMEROS DE CADA EVENTO: quantas pessoas se
 *    inscreveram, quantas vieram, quantas ninguém conferiu. É o que uma
 *    prestação de contas pede, e é a razão de a lista de presença (RF17)
 *    existir.
 *
 * "NINGUÉM CONFERIU" APARECE COMO COLUNA PRÓPRIA, e não somado às faltas.
 * Um relatório que dissesse "12 presentes de 20" quando 8 nunca foram
 * conferidos estaria afirmando oito faltas que ninguém verificou — e esse
 * número iria para dentro de um documento oficial. Ver acoes/presencas.ts.
 *
 * ===================================================================
 * CONTAGEM QUE FALHOU É UM TRAÇO, NUNCA UM ZERO
 * ===================================================================
 *
 * A mesma regra da home do painel (RF30), e aqui ela pesa mais: um zero
 * inventado num relatório impresso sobrevive à causa. A folha vira anexo de
 * e-mail e continua afirmando aquilo semanas depois.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Relatório — painel da equipe',
    description: 'Os números do site, numa folha que dá para salvar em PDF.'
  };
}

/** A data por extenso, no fuso da ONG. */
function hojePorExtenso(): string {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: FUSO_DA_ONG
  });
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO_DA_ONG
  });
}

export default async function PaginaDeRelatorio(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const consulta = await searchParams;
  // Entrada de usuário: só passa o que está na lista fechada (compartilhado/periodo.ts).
  const periodo = lerPeriodo(consulta.periodo) ?? 'mes';
  const deslocamento = lerDeslocamento(consulta.deslocar);
  const intervalo = intervaloDoPeriodo(periodo, deslocamento);

  const [indicadores, eventos, resumo, doPeriodo] = await Promise.all([
    listarIndicadores(),
    listarEventosDoPainel(),
    resumoDeInscricoesPorEvento(),
    resumoDoPeriodo(intervalo)
  ]);
  const quadro = doPeriodo.resumo;
  // Uma metade que falhou vira traço, nunca zero.
  const agendaOk = !doPeriodo.agenda.degradou;
  const doacoesOk = !doPeriodo.doacoes.degradou;
  const numero = (ok: boolean, valor: number) => (ok ? valor : '—');

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin">← Painel</Link></p>

      <Instrucoes
        resumo="Os números do site numa folha só, para anexar a uma prestação de contas."
        itens={[
          <><strong>"Salvar em PDF" usa o próprio celular.</strong> No Android ele abre a tela de
            impressão, e a primeira opção é "Salvar como PDF".</>,
          <>Se o botão não aparecer, use o <strong>menu do navegador → Imprimir</strong>: o
            documento sai igual.</>,
          <><strong>Um traço no lugar de um número</strong> quer dizer que aquela contagem não
            respondeu — não que ela seja zero.</>
        ]}
      />

      <p className="painel__acoes nao-imprimir"><BotaoImprimir /></p>

      {/* Daqui para baixo é o DOCUMENTO. Tudo acima sai na impressão. */}

      <h1>Ateliê Afro Cultural — relatório do site</h1>
      <p className="destaque">Gerado em {hojePorExtenso()}.</p>

      <section aria-labelledby="titulo-indicadores">
        <h2 id="titulo-indicadores">Situação de hoje</h2>

        <table className="relatorio__tabela">
          <thead>
            <tr>
              <th scope="col">O que</th>
              <th scope="col" className="relatorio__numero">Quantos</th>
            </tr>
          </thead>
          <tbody>
            {indicadores.map((indicador) => (
              <tr className="relatorio__linha" key={indicador.chave}>
                <th scope="row">{indicador.rotulo}</th>
                <td className="relatorio__numero">
                  {/* Zero É um número e é escrito; contagem que falhou é um
                      traço. Ver o cabeçalho. */}
                  {indicador.quantidade === null ? '—' : indicador.quantidade}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="titulo-periodo">
        <h2 id="titulo-periodo">Por período: {intervalo.rotulo}</h2>

        <p className="painel__acoes nao-imprimir">
          {PERIODOS.map((opcao) => (
            <Link
              key={opcao}
              className={opcao === periodo ? 'botao' : 'botao botao--secundario'}
              aria-current={opcao === periodo ? 'true' : undefined}
              href={`/admin/relatorio?periodo=${opcao}`}
            >
              {ROTULO_DO_PERIODO[opcao]}
            </Link>
          ))}
        </p>
        <p className="painel__acoes nao-imprimir">
          <Link className="botao botao--secundario"
            href={`/admin/relatorio?periodo=${periodo}&deslocar=${deslocamento - 1}`}>← Anterior</Link>
          {deslocamento < 0 ? (
            <Link className="botao botao--secundario"
              href={`/admin/relatorio?periodo=${periodo}&deslocar=${deslocamento + 1}`}>Seguinte →</Link>
          ) : null}
        </p>

        <table className="relatorio__tabela">
          <thead>
            <tr>
              <th scope="col">O que</th>
              <th scope="col" className="relatorio__numero">Quantos</th>
            </tr>
          </thead>
          <tbody>
            <tr className="relatorio__linha"><th scope="row">Atividades realizadas</th>
              <td className="relatorio__numero">{numero(agendaOk, quadro.atividades)}</td></tr>
            <tr className="relatorio__linha"><th scope="row">Pessoas inscritas</th>
              <td className="relatorio__numero">{numero(agendaOk, quadro.inscritos)}</td></tr>
            <tr className="relatorio__linha"><th scope="row">Crianças e adolescentes inscritos (por responsável)</th>
              <td className="relatorio__numero">{numero(agendaOk, quadro.criancasInscritas)}</td></tr>
            <tr className="relatorio__linha"><th scope="row">Presenças conferidas</th>
              <td className="relatorio__numero">{numero(agendaOk, quadro.presentes)}</td></tr>
            <tr className="relatorio__linha"><th scope="row">Crianças e adolescentes presentes</th>
              <td className="relatorio__numero">{numero(agendaOk, quadro.criancasPresentes)}</td></tr>
            <tr className="relatorio__linha"><th scope="row">Inscrições sem presença conferida</th>
              <td className="relatorio__numero">{numero(agendaOk, quadro.semConferir)}</td></tr>
            <tr className="relatorio__linha"><th scope="row">Novas candidaturas de voluntariado</th>
              <td className="relatorio__numero">{doPeriodo.novosVoluntarios ?? '—'}</td></tr>
            <tr className="relatorio__linha"><th scope="row">Doações recebidas (itens e dinheiro)</th>
              <td className="relatorio__numero">{numero(doacoesOk, quadro.doacoesRecebidas)}</td></tr>
            <tr className="relatorio__linha"><th scope="row">Valor em dinheiro recebido</th>
              <td className="relatorio__numero">{doacoesOk ? emReais(quadro.valorRecebidoEmCentavos) : '—'}</td></tr>
          </tbody>
        </table>

        <p className="relatorio__rodape">
          Conta as atividades publicadas na agenda e as doações marcadas como recebidas dentro do
          período. Os números de crianças contam inscrições de menores (feitas por um responsável),
          não pessoas únicas: quem se inscreve em duas atividades aparece duas vezes. "Sem presença
          conferida" não é falta — é lista que ninguém marcou.
          {!agendaOk || !doacoesOk || doPeriodo.novosVoluntarios === null
            ? ' Um traço quer dizer que aquela contagem não respondeu; não é zero.'
            : ''}
        </p>
      </section>

      <section aria-labelledby="titulo-agenda">
        <h2 id="titulo-agenda">Atividades da agenda</h2>

        {eventos.degradou ? (
          <p className="estado estado--erro">
            Não deu para carregar a agenda — o banco de dados não respondeu. Esta seção do
            relatório está incompleta, e por isso ela NÃO deve ser anexada a uma prestação de
            contas assim.
          </p>
        ) : eventos.valor.length === 0 ? (
          <p className="estado estado--vazio">Nenhum evento cadastrado ainda.</p>
        ) : (
          <table className="relatorio__tabela">
            <thead>
              <tr>
                <th scope="col">Atividade</th>
                <th scope="col">Quando</th>
                <th scope="col" className="relatorio__numero">Inscritos</th>
                <th scope="col" className="relatorio__numero">Vieram</th>
                <th scope="col" className="relatorio__numero">Sem conferir</th>
              </tr>
            </thead>
            <tbody>
              {eventos.valor.map((evento) => {
                const numeros = resumo.valor[evento.id];
                // Sem linha no resumo E sem falha de consulta = evento sem
                // ninguém inscrito, que é um zero de verdade. Com falha, é
                // traço — a mesma regra dos indicadores.
                const traco = resumo.degradou;

                return (
                  <tr className="relatorio__linha" key={evento.id}>
                    <th scope="row">
                      {evento.titulo}
                      {!evento.publicado ? ' (rascunho)' : ''}
                    </th>
                    <td>{dataCurta(evento.comeca_em)}</td>
                    <td className="relatorio__numero">
                      {traco ? '—' : numeros?.inscritos ?? 0}
                    </td>
                    <td className="relatorio__numero">
                      {traco ? '—' : numeros?.presentes ?? 0}
                    </td>
                    <td className="relatorio__numero">
                      {traco ? '—' : numeros?.semConferir ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {resumo.degradou ? (
          <p className="estado estado--erro">
            As contagens de inscritos não responderam. Os traços acima NÃO são zeros.
          </p>
        ) : null}
      </section>

      <p className="relatorio__rodape">
        Ateliê Afro Cultural · Casa Verde, São Paulo · atelieafrocultural.site ·
        Relatório gerado pelo próprio site em {hojePorExtenso()}. Os números descrevem o que
        estava registrado no sistema nesta data.
      </p>
    </main>
  );
}
