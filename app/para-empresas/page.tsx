// "Para empresas e apoiadores" — no molde de /para-escolas.
//
// REGRA 2: nada aqui é texto novo sobre a ONG. As frases vêm de outras páginas
// (quem somos, para escolas, apoiar) e "Na mídia" / "Onde já estivemos" são os
// MESMOS registros reais do banco/JSON. O que esta página acrescenta é só o
// caminho: quem quer apoiar encontra, num lugar, o que já foi feito e como
// falar com a ONG. O que a ONG OFERECE a um patrocinador (contrapartidas,
// cotas, recibo) NÃO existe em nenhuma fonte e por isso NÃO está escrito —
// pergunta pendente para a ONG, registrada no CLAUDE.md.
import Link from 'next/link';
import { listarClippingComOrigem } from '@/servidor/dados/conteudo';
import { SecaoNaMidia } from '@/componentes/SecaoNaMidia';
import { SecaoOndeEstivemos } from '@/componentes/SecaoOndeEstivemos';

export const metadata = {
  title: 'Para empresas e apoiadores — Ateliê Afro Cultural',
  description: 'O que o Ateliê Afro Cultural já fez, onde esteve e como empresas e apoiadores podem somar ao trabalho.'
};

export default async function ParaEmpresas() {
  const { registros: clipping, origem } = await listarClippingComOrigem();

  return (
    <main id="conteudo" className="conteudo" data-origem-clipping={origem}>
      <h1>Para empresas e apoiadores</h1>

      <p className="destaque">
        O Ateliê Afro Cultural é um espaço educativo de reflexão, criação e valorização da
        cultura e memória afro brasileira, na Casa Verde, zona norte de São Paulo.
      </p>

      <div className="af-stripe" aria-hidden="true" />

      <section aria-labelledby="titulo-trabalho">
        <h2 id="titulo-trabalho">O que fazemos</h2>
        <p>
          Nosso catálogo reúne contações de história performáticas, apresentações com fantoches e
          música ao vivo, e vivências de brincadeiras da cultura popular, em três setores:
          literário, musical e artístico criativo.
        </p>
        <p>
          <Link className="botao botao--secundario" href="/quem-somos">Quem somos</Link>{' '}
          <Link className="botao botao--secundario" href="/projetos">Ver os projetos</Link>
        </p>
      </section>

      <SecaoNaMidia registros={clipping} />
      <SecaoOndeEstivemos registros={clipping} />

      <section aria-labelledby="titulo-apoiar">
        <h2 id="titulo-apoiar">Como apoiar</h2>
        <p>
          O que mais nos fortalece são materiais que viram atividade com as crianças — e recursos
          que sustentam o trabalho. Livros, instrumentos musicais, materiais de arte, itens de
          acervo e recursos financeiros estão descritos na página de apoio.
        </p>
        <p><Link className="botao" href="/doar">Ver como apoiar</Link></p>
      </section>

      <section aria-labelledby="titulo-conversar">
        <h2 id="titulo-conversar">Conversar com a gente</h2>
        <p>
          Conte quem você é e o que tem em mente. Respondemos pelo mesmo canal que você escolher.
        </p>
        <p className="abertura__acoes">
          <a className="botao" href="https://wa.me/5511953968344" rel="noopener">Falar pelo WhatsApp</a>{' '}
          <a className="botao botao--secundario" href="mailto:atelieafro@gmail.com">Enviar e-mail</a>
        </p>
      </section>
    </main>
  );
}
