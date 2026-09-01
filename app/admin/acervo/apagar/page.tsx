import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { buscarMaterial, enderecoDoArquivo } from '@/servidor/dados/acervo';
import { apagarMaterial } from '@/acoes/acervo';
import { ehIdentificador } from '@/compartilhado/validacao';

/**
 * `/admin/acervo/apagar?id=<uuid>` — a pergunta antes do gesto sem desfazer
 * (RF37).
 *
 * ===================================================================
 * POR QUE UMA TELA INTEIRA PARA CONFIRMAR
 * ===================================================================
 *
 * Mesma decisão de /admin/galeria/apagar, e o argumento é o mesmo: apagar é
 * o único gesto deste painel que não tem volta, e ele acontece num celular,
 * de pé, no meio de um evento (regra 4 do CLAUDE.md). O caminho curto seria
 * um `confirm()` do navegador — e ele NÃO EXISTE sem JavaScript: sem
 * script, o botão apagaria direto, ou seja, a proteção sumiria exatamente
 * para quem tem menos recurso. Uma tela é o único caminho que se comporta
 * igual nos dois casos.
 *
 * ELA TEM UMA COISA QUE A DA GALERIA NÃO PODE TER: um link para ABRIR o
 * arquivo antes de apagar. Lá a foto aparece inteira na tela e conferir é
 * olhar; um PDF não tem miniatura e não há como gerar uma sem biblioteca
 * nova (regra 7). Sem abrir, "apagar o material certo" seria confiar no
 * título — e o caso que esta tela existe para atender é justamente o do
 * arquivo ERRADO, em que o título costuma estar certo.
 *
 * A GUARDA ESTÁ NAS DUAS FUNÇÕES, como em toda tela do painel — o motivo
 * medido está em app/admin/layout.tsx.
 *
 * ===================================================================
 * ESTA TELA NÃO CONTA SE UM MATERIAL EXISTE
 * ===================================================================
 *
 * `?id=` com lixo dentro e `?id=` com uuid inexistente respondem os dois
 * 404, igual à tela de apagar da galeria — e igual ao que anônimo recebe.
 * Um "este material não existe" distinguível de um 404 transformaria esta
 * rota num verificador de identificadores.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Apagar material — painel da equipe',
    description: 'Confirmar a remoção de um material do acervo.'
  };
}

export default async function PaginaDeApagarMaterial(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const pedido = (await searchParams).id;
  const id = typeof pedido === 'string' ? pedido : '';

  // `?id=` com lixo dentro nunca foi um identificador: 404 antes de
  // perguntar ao Postgres, que devolveria erro de sintaxe (22P02).
  if (!ehIdentificador(id)) notFound();

  const { valor: material, degradou } = await buscarMaterial(id);

  // A distinção que esta tela precisa fazer, e por isso a camada de dados
  // devolve `Degradavel`: "este material não existe" e "o banco não
  // respondeu" chegariam os dois como `null`. Tratar a segunda como 404
  // diria à equipe, no meio de uma queda do Supabase, que o material já
  // sumiu — e a reação a isso é parar de procurar.
  if (degradou) {
    return (
      <Tela>
        <p className="estado estado--erro">
          Não deu para abrir este material agora — o banco de dados não respondeu. Ele não foi
          apagado: volte ao acervo e tente de novo em alguns instantes.
        </p>
      </Tela>
    );
  }

  if (!material) notFound();

  const url = await enderecoDoArquivo(material.arquivo_caminho);

  return (
    <Tela>
      <p className="destaque">
        Isto apaga o material de vez: a linha do banco e o arquivo. Não dá para desfazer e não há
        lixeira. Se você só quer que ele saia da página do acervo, volte e use "Tirar do ar" — mas
        atenção: o arquivo continua acessível para quem tiver o endereço, e só apagar o remove.
      </p>

      <div className="apagar__previa">
        <p className="material__titulo">{material.titulo}</p>

        <div className="apagar__ficha">
          {material.descricao ? <p><strong>Descrição:</strong> {material.descricao}</p> : null}
          {material.tema ? <p><strong>Tema:</strong> {material.tema}</p> : null}
          {material.faixa_etaria ? <p><strong>Para:</strong> {material.faixa_etaria}</p> : null}
          <p>
            <strong>Situação:</strong>{' '}
            {material.publicado
              ? 'está no ar, aparecendo na página do acervo'
              : 'guardado, fora da página do acervo'}
          </p>
        </div>

        {/* CONFERIR É ABRIR — ver o cabeçalho. O aviso de "outra aba" fica
            dentro do link, escrito, e não só na cor: mudança de contexto
            sem explicação é o tipo de coisa que a regra 8 recusa. */}
        <p className="apagar__conferir">
          <a className="material__botao" href={url} target="_blank" rel="noopener">
            Abrir o arquivo antes de apagar
            <span className="apenas-leitor-de-tela"> (abre em outra aba)</span>
          </a>
        </p>
      </div>

      {/*
        `<form>` com Server Action, e não um botão de JavaScript: é o mesmo
        mecanismo que faz o resto do painel funcionar sem script. O `id` vai
        num campo escondido — e ele NÃO AUTORIZA NADA: quem manda o corpo da
        requisição escolhe este valor, e o que impede alguém de apagar o que
        não pode é `ehEquipe()` na Action e a RLS no banco (regras 5 e 6 do
        CLAUDE.md).
      */}
      <form action={apagarMaterial} className="apagar__form">
        <input type="hidden" name="id" value={material.id} />
        <button type="submit" className="apagar__botao">Apagar este material para sempre</button>
      </form>

      {/* O caminho de recuo é um LINK, e fica depois do botão: quem chegou
          até aqui e mudou de ideia precisa de uma saída que não seja o botão
          do navegador. */}
      <p className="apagar__desistir">
        <Link href="/admin/acervo">Não apagar — voltar para o acervo</Link>
      </p>
    </Tela>
  );
}

/** O invólucro comum às três saídas — título, caminho de volta e conteúdo. */
function Tela({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin/acervo">← Acervo</Link></p>

      <h1>Apagar este material?</h1>

      {children}
    </main>
  );
}
