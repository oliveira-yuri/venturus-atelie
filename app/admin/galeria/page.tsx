import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarTodasAsMidias, bucketAindaAberto } from '@/servidor/dados/galeria';
import { porNoAr } from '@/acoes/galeria';
import { avisoDaGaleria } from '@/compartilhado/avisos-do-painel';
import { AVISO_BUCKET_ABERTO, AVISO_SONDA_SEM_RESPOSTA } from '@/compartilhado/galeria-privada';
import { ListaMidia } from '@/componentes/ListaMidia';
import FormularioMidia from '@/componentes/FormularioMidia';

/**
 * `/admin/galeria` — subir foto e cuidar do que está no ar (RF05/RF33/RN07).
 *
 * A PRIMEIRA LINHA DE CADA FUNÇÃO É A GUARDA, nas duas: o componente e o
 * `generateMetadata`. Não é repetição do que `app/admin/layout.tsx` já faz —
 * MEDIDO na Tarefa P1, com a guarda só no layout o servidor respondeu 404 E
 * mandou a página inteira do painel no payload de hidratação; e com o corpo
 * protegido mas um `export const metadata`, o TÍTULO ainda viajava. O bloco
 * inteiro da medição está no comentário do layout, e
 * `testes/painel-guarda.test.mjs` varre `app/admin/**` exigindo as duas.
 *
 * As duas chamadas custam UMA consulta: `ehEquipe()` é `cache()` do React.
 *
 * O `notFound()` fica FORA de qualquer `try`.
 *
 * A GUARDA NÃO AUTORIZA NADA. Ela decide o que DESENHAR; quem decide o que
 * pode ser lido é a RLS — e nesta tela são DUAS políticas, de sistemas
 * diferentes: a de `public.midia` e a do Storage (006_storage.sql). Ver o
 * cabeçalho de acoes/galeria.ts.
 *
 * ===================================================================
 * O FORMULÁRIO FICA NESTA TELA, NÃO NUMA SEGUNDA
 * ===================================================================
 *
 * As notícias têm duas telas (a lista e `/admin/publicacoes/editar`) porque
 * escrever uma notícia é uma sessão longa: a pessoa senta, escreve, revisa.
 * Subir foto é o contrário — é um gesto de dez segundos, quase sempre com a
 * foto que a pessoa acabou de tirar, de pé, no meio de um evento (regra 4
 * do CLAUDE.md). Uma tela a mais é uma espera de rede a mais entre a
 * intenção e o gesto, num celular que pode estar em 3G. O formulário vem
 * ANTES da lista pelo mesmo motivo: é o que a pessoa veio fazer.
 *
 * E não há tela de EDITAR: trocar a foto de uma linha é o mesmo trabalho
 * que subir outra, e o texto sozinho quase nunca é o que está errado. A
 * frase que diz isso está em componentes/ListaMidia.ts, escrita, para que a
 * ausência não vire busca frustrada.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Galeria — painel da equipe',
    description: 'Subir fotos, escrever a descrição e cuidar do que está no ar.'
  };
}

/** O estado vazio e o de falha moram em componentes/ListaMidia.ts. */
export default async function PaginaDaGaleria(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const { valor: midias, degradou } = await listarTodasAsMidias();

  // A MIGRATION 008 JÁ FOI RODADA? Ninguém consegue aplicá-la pelo código
  // (não há service_role — spec §4.1), e enquanto ela não for rodada NADA
  // QUEBRA: URL assinada funciona em bucket público também. Seria mais uma
  // falha silenciosa, o padrão de defeito deste projeto. Por isso a sonda
  // pergunta, e o que ela responde vira aviso NA TELA de quem pode agir —
  // não só uma linha de log que ninguém abre.
  //
  // Custa uma requisição UMA VEZ POR PROCESSO (ver bucketAindaAberto), não
  // uma por render. E nunca derruba a página: dúvida vira 'nao-sei'.
  const estadoDoBucket = await bucketAindaAberto();

  // O resultado da última Action chega pela URL (as Actions terminam em
  // redirect, que é o que as faz funcionar sem JavaScript, e um redirect não
  // carrega estado). `?aviso=` é escrito por quem quiser, então passa por
  // LISTA FECHADA — o parâmetro escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDaGaleria((await searchParams).aviso);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin">← Painel</Link></p>

      <h1>Galeria</h1>

      {/*
        `role="alert"` e não `role="status"`, ao contrário da caixa de aviso
        logo abaixo, e a diferença é de conteúdo: aquela relata o que a
        pessoa acabou de fazer; esta relata que as fotos desta tela estão
        desprotegidas agora, sem que ninguém tenha feito nada. É o único
        lugar do painel onde interromper é o comportamento certo.
      */}
      {estadoDoBucket !== 'fechado'
        ? (
          <div className="aviso aviso--erro" role="alert">
            <p>{estadoDoBucket === 'aberto' ? AVISO_BUCKET_ABERTO : AVISO_SONDA_SEM_RESPOSTA}</p>
          </div>
        )
        : null}

      {/*
        `role="status"` e não `role="alert"`, pelo mesmo motivo escrito em
        app/admin/publicacoes/page.tsx: esta caixa chega junto com uma página
        NOVA (a Action redireciona), não aparece no meio de uma que já estava
        aberta. E o mesmo limite conhecido vale: sem JavaScript, região viva
        nenhuma "dispara" — o que faz esta mensagem ser encontrada é a
        posição dela, logo abaixo do título.
      */}
      {aviso
        ? (
          <div className={aviso.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'} role="status">
            <p>{aviso.texto}</p>
          </div>
        )
        : null}

      {/*
        RN07 DITA ANTES DO FORMULÁRIO, e não depois: é a regra que decide se
        a foto pode existir no site, e lê-la depois de já ter escolhido a
        foto é tarde. A frase é do escopo (RN07) e do CLAUDE.md (regra 9),
        não texto inventado sobre a ONG.
      */}
      <p className="destaque">
        Nenhuma foto vai ao ar sem autorização de uso de imagem registrada de quem aparece nela —
        e, no caso de crianças e adolescentes, de quem é responsável por elas. Subir não publica:
        a foto fica guardada até você apertar "Publicar".
      </p>

      {/*
        O FORMULÁRIO FICA RECOLHIDO ATRÁS DE UM BOTÃO (pedido V1: "ocultar
        formulário de postagem e trocar por um botão"). Ele ocupava a tela
        inteira do celular acima da lista, e quem entrava para publicar uma
        foto já enviada tinha de rolar por ele todo.

        `<details>` E NÃO JAVASCRIPT. O elemento é nativo: o `<summary>` já
        É o botão, abre e fecha sozinho, é alcançável por teclado e anuncia
        o estado a quem usa leitor de tela — tudo isso SEM SCRIPT. Uma
        solução com `useState` esconderia o formulário de quem está sem
        JavaScript, que é justamente quem não pode perder nada (o mesmo
        raciocínio da gaveta e da barra de acessibilidade).

        Sem `open`: chega fechado, que é o ponto. Quem está sem script abre
        do mesmo jeito, porque quem abre é o navegador.
      */}
      <details className="painel__envio">
        <summary className="painel__envio-botao">Subir uma foto</summary>
        <FormularioMidia />
      </details>

      <h2 className="painel__secao">Fotos já enviadas</h2>

      <ListaMidia
        midias={midias}
        degradou={degradou}
        acaoPorNoAr={porNoAr}
        caminhoApagar="/admin/galeria/apagar"
      />
    </main>
  );
}
