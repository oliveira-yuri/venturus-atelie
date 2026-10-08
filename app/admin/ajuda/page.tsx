import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { TELAS_DO_PAINEL } from '@/componentes/PainelInicio';

/**
 * /admin/ajuda — o que a equipe precisa saber antes de tocar em qualquer coisa.
 *
 * Nasceu da revisão de UX de 06/10/2026: o manual da equipe existe
 * (`docs/manual-da-equipe.md`), mas mora no repositório, e quem usa o painel
 * no celular, de pé, nunca o abriria. Esta página tem só o que NÃO PODE ser
 * descoberto errando — as regras que mudam o que vai ao ar e o que não tem
 * volta — e a lista das telas, que sai de `TELAS_DO_PAINEL` e por isso nunca
 * fica desatualizada.
 *
 * NÃO REPETE O MANUAL INTEIRO, e não deve: duas cópias do mesmo texto
 * divergem na primeira tela nova (o `guia-rapido-da-equipe.md` já divergiu).
 * Cada frase aqui vem de uma regra que o código aplica e um teste vigia.
 *
 * A guarda fica na PÁGINA e no `generateMetadata`, como em toda tela de
 * `app/admin/` (ver a Tarefa P1 em CLAUDE.md).
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Ajuda — painel da equipe',
    description: 'As regras do painel, como subir foto e o que fazer quando algo dá errado.'
  };
}

export default async function PaginaDeAjuda() {
  if (!await ehEquipe()) notFound();

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin">← Painel</Link></p>

      <h1>Ajuda</h1>

      <p className="destaque">
        O que vale saber antes de mexer, e o que fazer se algo der errado.
      </p>

      <section aria-labelledby="titulo-regras">
        <h2 id="titulo-regras">As três regras</h2>
        <ol>
          <li>
            <strong>Guardar não é publicar.</strong> O que você escreve ou envia fica guardado e
            só aparece no site quando você toca em <strong>Publicar</strong>.
          </li>
          <li>
            <strong>Tirar do ar se desfaz; apagar não.</strong> Tirar do ar e pôr de volta é só
            outro toque. Apagar uma foto ou um material some com o arquivo, e não há lixeira.
            E um e-mail enviado para um grupo também não volta.
          </li>
          <li>
            <strong>Nenhuma foto vai ao ar sem autorização de uso de imagem</strong> de quem
            aparece nela — e de quem é responsável, se for criança ou adolescente. Sem a caixa
            marcada, a foto sobe e fica guardada: o botão de publicar nem aparece. Se a
            autorização foi retirada, <strong>apague</strong> a foto: tirar do ar demora até uma
            hora para fechar o arquivo.
          </li>
        </ol>
      </section>

      <section aria-labelledby="titulo-foto">
        <h2 id="titulo-foto">Subir foto</h2>
        <ul>
          <li>
            Formatos JPG, PNG, GIF e WebP, até <strong>4 MB</strong>. Foto grande de celular em
            JPG, PNG ou WebP é reduzida na própria tela antes de enviar, e o aviso diz quanto
            ela tinha.
          </li>
          <li>
            <strong>Álbum:</strong> fotos com o mesmo nome de álbum aparecem juntas no site.
            Escreva sempre igual.
          </li>
          <li>
            <strong>Descrição da foto:</strong> para quem não pode ver a imagem. Diga o que
            aparece.
          </li>
          <li>Enquanto sobe, não feche a tela e não toque de novo.</li>
        </ul>
      </section>

      <section aria-labelledby="titulo-telas">
        <h2 id="titulo-telas">As telas</h2>
        <ul>
          {TELAS_DO_PAINEL.filter((tela) => tela.pronta && tela.caminho !== '/admin/ajuda').map((tela) => (
            <li key={tela.caminho}>
              <Link href={tela.caminho}><strong>{tela.titulo}</strong></Link> — {tela.descricao}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-componentes">
        <h2 id="titulo-componentes">Para quem mexe no site</h2>
        <p>
          As peças do novo layout, desenhadas uma a uma:{' '}
          <Link href="/admin/ajuda/componentes">componentes do novo layout</Link>.
        </p>
      </section>

      <section aria-labelledby="titulo-problemas">
        <h2 id="titulo-problemas">Deu problema?</h2>
        <ul>
          <li>
            <strong>"Página não encontrada" ao abrir o painel:</strong> você não entrou, ou a
            sua conta não é da equipe. Entre de novo; se continuar, fale com quem cuida do site.
          </li>
          <li>
            <strong>"O banco de dados não respondeu":</strong> falha passageira, e nada foi
            perdido. Espere um pouco e atualize a tela.
          </li>
          <li>
            <strong>Tela cinza com "Internal Server Error" ao enviar foto:</strong> a foto era
            grande demais. Envie num tamanho menor (no celular, escolha "médio" ao selecionar).
          </li>
          <li>
            <strong>O texto antigo de uma atividade voltou:</strong> o banco caiu e o site
            mostrou a cópia guardada. Não corrija tudo de novo — avise quem cuida do site.
          </li>
        </ul>
        <p>
          Para qualquer outra coisa: WhatsApp <a href="https://wa.me/5511953968344" rel="noopener">(11) 95396-8344</a>{' '}
          ou <a href="mailto:atelieafro@gmail.com">atelieafro@gmail.com</a>.
        </p>
      </section>
    </main>
  );
}
