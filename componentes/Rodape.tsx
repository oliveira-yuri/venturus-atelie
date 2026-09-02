import Link from 'next/link';
import { Icone } from '@/componentes/Icone';

/**
 * Rodape compartilhado. Traz os cinco contatos nomeados pela ONG (RF06) —
 * portado de `site/assets/js/componentes/aac-rodape.js`.
 *
 * Os blocos usam <div>, nao <section>: <section> criava colisao de landmark
 * no site antigo, corrigida antes — mantida a mesma escolha aqui.
 *
 * =====================================================================
 * DESIGN SYSTEM v1: TRES COLUNAS, FAIXA LISTRADA E A COLUNA DE APOIO
 * =====================================================================
 *
 * O sistema (variacao 1a aprovada) desenha o rodape marrom em tres
 * colunas: contato, endereco e apoio com um CTA. As duas primeiras ja
 * existiam; a terceira e' nova.
 *
 * A FAIXA LISTRADA ACIMA DO RODAPE E' UMA DAS DUAS PERMITIDAS POR PAGINA
 * (regra do handoff: no maximo duas, uma antes do primeiro bloco de
 * conteudo e outra antes do rodape). Ela mora AQUI, e nao em app/layout.tsx,
 * para que rodape e faixa andem sempre juntos — separa-los faria a segunda
 * faixa aparecer em pagina onde a primeira nao aparece, e a conta de "no
 * maximo duas" viraria adivinhacao. E' decoracao pura, entao `aria-hidden`.
 *
 * O TEXTO DA COLUNA NOVA NAO FOI INVENTADO (regra 2 do CLAUDE.md): a frase
 * sobre livros, instrumentos, materiais de arte e recursos e' a mesma que
 * ja esta' na home, no cartao "Apoiar" (app/page.tsx), e o titulo repete o
 * verbo que o botao ja usa. O handoff escreve /apoiar no href; a rota real
 * deste site e' /doar, e e' ela que vai aqui.
 */
export default function Rodape() {
  return (
    <>
      <div className="af-stripe" aria-hidden="true"></div>

      <footer className="af-footer rodape">
        <div className="af-footer__cols">
          <div className="rodape__bloco">
            <h2>Fale com a gente</h2>
            {/*
              ÍCONES NOS CANAIS (pedido V1). Cada um acompanha o rótulo
              escrito e é `aria-hidden` — quem usa leitor de tela continua
              ouvindo "WhatsApp", uma vez só. Ver componentes/Icone.ts.
            */}
            <ul className="af-footer__links rodape__lista">
              <li><a href="tel:+5511953968344"><Icone nome="telefone" />(11) 95396-8344</a></li>
              <li><a href="https://wa.me/5511953968344" rel="noopener"><Icone nome="whatsapp" />WhatsApp</a></li>
              <li><a href="mailto:atelieafro@gmail.com"><Icone nome="email" />atelieafro@gmail.com</a></li>
              <li><a href="https://instagram.com/atelie_afrocultural" rel="noopener"><Icone nome="instagram" />Instagram</a></li>
              <li><a href="https://tiktok.com/@ateli.afro.cultur" rel="noopener"><Icone nome="tiktok" />TikTok</a></li>
            </ul>
          </div>

          <div className="rodape__bloco">
            <h2>Onde estamos</h2>
            <address className="af-footer__endereco rodape__endereco">
              Rua Dr. Paulo Gatti, 135 — Vila Romero<br />
              São Paulo/SP — CEP 02468-030
            </address>
          </div>

          <div className="rodape__bloco">
            <h2>Apoie o ateliê</h2>
            <p className="af-footer__endereco">
              Recebemos livros, instrumentos musicais, materiais de arte, itens de acervo e
              recursos financeiros.
            </p>
            <p className="rodape__acao">
              <Link className="af-btn af-btn--ochre" href="/doar">Doar agora</Link>
            </p>
          </div>
        </div>

        <p className="af-footer__legal rodape__aviso">
          <Link href="/privacidade">Política de privacidade</Link>
        </p>
      </footer>
    </>
  );
}
