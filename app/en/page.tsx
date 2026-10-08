// "About us" in English — one static page, a FAITHFUL TRANSLATION of
// /quem-somos (plus the contact channels that already appear on /contato).
//
// REGRA 2: nothing here is new information about the NGO. If /quem-somos
// changes, this page must change with it. The translation was NOT reviewed by
// the NGO yet — flagged in CLAUDE.md. `lang="en"` on <main> so screen readers
// and VLibras-like tools don't read English with Portuguese pronunciation.
import Link from 'next/link';

export const metadata = {
  title: 'About us — Ateliê Afro Cultural',
  description: 'Ateliê Afro Cultural is an educational space for reflection, creation and appreciation of Afro-Brazilian culture and memory, in Casa Verde, north São Paulo.'
};

export default function SobreEmIngles() {
  return (
    <main id="conteudo" className="conteudo" lang="en">
      <h1>About us</h1>

      <p className="destaque">
        Ateliê Afro Cultural is an educational space for reflection, creation and appreciation of
        Afro-Brazilian culture and memory.
      </p>

      <div className="af-stripe" aria-hidden="true" />

      <section aria-labelledby="titulo-sankofa">
        <h2 id="titulo-sankofa">Sankofa</h2>
        <p>
          Sankofa is an African symbol, from the philosophy of the Akan people of Ghana,
          represented by a bird that turns its head back toward its tail. It shows that it is
          never too late to go back and retrieve what was left behind. This is the idea that gave
          rise to Ateliê Afro Cultural.
        </p>
      </section>

      <section aria-labelledby="titulo-onde">
        <h2 id="titulo-onde">Where we are</h2>
        <p>
          We are in the Casa Verde neighborhood, in the north of São Paulo, a place of great and
          very important history and Black presence. The atelier offers activities that bring
          children closer to the richness of Afro-Brazilian culture, deepening the study of
          African cultural roots, in order to raise respect and self-esteem in the child, in how
          they see and act on themselves and their place in the world.
        </p>
        <p>
          We know there is a need to work with children and raise awareness about the practices
          and representations that make up racism.
        </p>
      </section>

      <section aria-labelledby="titulo-idealizadores">
        <h2 id="titulo-idealizadores">Who created it</h2>
        <p>
          <strong>Wil Oliveira</strong> and <strong>Nathália (Nathy) Monteiro</strong> are a
          couple of artists and the founders of the institution. Together they bring artistic
          skills such as research on Afro-Brazilian culture, storytelling, popular-culture
          performance, dance, music, acting and writing, always centered on Afro-Brazilian themes
          and popular culture.
        </p>
        <p>
          The atelier opened its headquarters in Casa Verde in January 2020. The couple became
          known nationwide by appearing on the program Caldeirão do Huck, on Rede Globo, on the
          eve of the International Day for the Elimination of Racial Discrimination.
        </p>
      </section>

      <section aria-labelledby="titulo-setores">
        <h2 id="titulo-setores">Our three areas</h2>
        <article className="setor">
          <h3>Literary</h3>
          <p>
            With books on Black themes, it covers readings, research, analysis, reflection and
            activities such as storytelling, exercises and theater techniques. All content is
            centered on Black themes.
          </p>
        </article>
        <article className="setor">
          <h3>Music</h3>
          <p>
            Where children have direct contact with Afro-Brazilian musicality, through songs,
            instruments and Black body expression, such as the movements of capoeira. Music of
            African roots has given Brazil some of the most beautiful elements of its culture of
            resistance, from jongo, maculelê, maracatu, forró, samba, rap, hip hop, funk and many
            other styles marked by ancient elements of Afro identity.
          </p>
        </article>
        <article className="setor">
          <h3>Creative arts</h3>
          <p>
            Where children explore their imagination through canvas painting, working with
            recycled materials to create costumes and sets, drawing, sculpture, collage and many
            other techniques, so that they develop creative artistic skills.
          </p>
        </article>
      </section>

      <section aria-labelledby="titulo-publico">
        <h2 id="titulo-publico">Who it is for</h2>
        <p>Children, young people and adults, of all ethnicities, descents and ages.</p>
      </section>

      <section aria-labelledby="titulo-contato">
        <h2 id="titulo-contato">Get in touch</h2>
        <p>
          Rua Dr. Paulo Gatti, 135 — Vila Romero, São Paulo/SP, Brazil — ZIP 02468-030.
        </p>
        <p className="abertura__acoes">
          <a className="botao" href="https://wa.me/5511953968344" rel="noopener">WhatsApp</a>{' '}
          <a className="botao botao--secundario" href="mailto:atelieafro@gmail.com">atelieafro@gmail.com</a>
        </p>
      </section>

      <p lang="pt-BR" className="chamada-final">
        <Link href="/quem-somos">Ver esta página em português</Link>
      </p>
    </main>
  );
}
