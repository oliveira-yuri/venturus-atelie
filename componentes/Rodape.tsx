import Link from 'next/link';

/**
 * Rodape compartilhado. Traz os cinco contatos nomeados pela ONG (RF06) —
 * portado de `site/assets/js/componentes/aac-rodape.js`.
 *
 * Os blocos usam <div>, nao <section>: <section> criava colisao de landmark
 * no site antigo, corrigida antes — mantida a mesma escolha aqui.
 */
export default function Rodape() {
  return (
    <footer className="rodape">
      <div className="rodape__conteudo">
        <div className="rodape__bloco">
          <h2>Fale com a gente</h2>
          <ul className="rodape__lista">
            <li><a href="tel:+5511953968344">(11) 95396-8344</a></li>
            <li><a href="https://wa.me/5511953968344" rel="noopener">WhatsApp</a></li>
            <li><a href="mailto:atelieafro@gmail.com">atelieafro@gmail.com</a></li>
            <li><a href="https://instagram.com/atelie_afrocultural" rel="noopener">Instagram</a></li>
            <li><a href="https://tiktok.com/@ateli.afro.cultur" rel="noopener">TikTok</a></li>
          </ul>
        </div>
        <div className="rodape__bloco">
          <h2>Onde estamos</h2>
          <address className="rodape__endereco">
            Rua Dr. Paulo Gatti, 135 — Vila Romero<br />
            São Paulo/SP — CEP 02468-030
          </address>
        </div>
      </div>
      <p className="rodape__aviso">
        <Link href="/privacidade">Política de privacidade</Link>
      </p>
    </footer>
  );
}
