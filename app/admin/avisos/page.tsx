import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarAvisosDoPainel } from '@/servidor/dados/avisos';
import { listarProximos } from '@/servidor/dados/eventos';
import { alternarAviso, enviarAviso } from '@/acoes/avisos';
import { avisoDoMural } from '@/compartilhado/avisos-do-painel';
import { ListaAvisosPainel } from '@/componentes/ListaAvisosPainel';
import { Instrucoes } from '@/componentes/Instrucoes';

/**
 * `/admin/avisos` — o mural interno (RF27) e o envio para grupo (RF28).
 *
 * A GUARDA EM CADA FUNÇÃO, nas duas. Ver o cabeçalho de
 * `app/admin/eventos/page.tsx` para a medição que obriga as duas.
 *
 * ===================================================================
 * ESTA TELA TEM O ÚNICO GESTO DO PAINEL QUE NÃO TEM DESFAZER
 * ===================================================================
 *
 * Todo o resto do painel é reversível: tirar do ar devolve, editar
 * regrava, e até apagar uma foto tem uma tela de confirmação antes.
 * **E-mail enviado não volta.** Por isso os três gestos são separados
 * (escrever, publicar, enviar), o de enviar só aparece em aviso já
 * publicado, e a confirmação dele diz isso com todas as letras.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Avisos — painel da equipe',
    description: 'Escrever avisos para quem é voluntário, e mandar por e-mail.'
  };
}

export default async function PaginaDeAvisos(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  // Os eventos alimentam o grupo "inscritos em um evento". Só os PRÓXIMOS:
  // mandar aviso para quem se inscreveu num evento de março é quase sempre
  // engano, e a lista curta é o que impede o toque errado num celular.
  const [{ valor: avisos, degradou }, eventos] = await Promise.all([
    listarAvisosDoPainel(),
    listarProximos()
  ]);

  const aviso = avisoDoMural((await searchParams).aviso);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin">← Painel</Link></p>

      <h1>Avisos</h1>

      <Instrucoes
        resumo="Recados para quem é voluntário. Eles aparecem no mural do site e podem ir por e-mail."
        itens={[
          <><strong>Quem vê o mural</strong> são as pessoas com candidatura marcada como
            <strong> ativa</strong> em Voluntários. Quem está como "nova" não vê.</>,
          <><strong>Escrever não publica, e publicar não envia.</strong> São três botões
            diferentes, de propósito.</>,
          <><strong>E-mail enviado não volta.</strong> É a única coisa no painel inteiro que não
            tem como desfazer.</>,
          <>Apertar "enviar" duas vezes <strong>não manda duas vezes</strong> para a mesma
            pessoa — alcança só quem faltou.</>
        ]}
      />

      {aviso ? (
        <div className={aviso.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'} role="status">
          <p>{aviso.texto}</p>
        </div>
      ) : null}

      <p className="painel__acoes">
        <Link className="painel__acao-principal" href="/admin/avisos/editar">
          Escrever aviso
        </Link>
      </p>

      <ListaAvisosPainel
        avisos={avisos}
        eventos={eventos}
        degradou={degradou}
        acaoAlternar={alternarAviso}
        acaoEnviar={enviarAviso}
      />
    </main>
  );
}
