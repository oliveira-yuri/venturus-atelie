import Link from 'next/link';
import { Icone } from '@/componentes/Icone';

/**
 * Rodapé compartilhado. Traz os cinco contatos nomeados pela ONG (RF06) —
 * portado de `site/assets/js/componentes/aac-rodape.js`.
 *
 * =====================================================================
 * NOVO LAYOUT (08/10/2026): COMPACTO, CREME, EM UMA LINHA NO DESKTOP
 * =====================================================================
 *
 * Era um bloco marrom de três colunas — contato, endereço e "Apoie o
 * ateliê" com outro botão de doar — depois de TODA página, inclusive de
 * /contato, que acabou de listar os mesmos canais. Na Análise UX-UI (2a,
 * 6a) ele vira o pé da página e não mais uma seção: endereço, os canais
 * numa fileira e os links legais. No desktop, uma linha só.
 *
 * O "Apoiar" saiu daqui porque passou a estar sempre à mão — no cabeçalho
 * do desktop e no pé da folha do menu no celular. Repetido no rodapé, era o
 * terceiro botão de doar na mesma tela.
 *
 * OS CINCO CANAIS FICAM, com o rótulo escrito. Ícone `aria-hidden`: quem usa
 * leitor de tela ouve "WhatsApp" uma vez só.
 *
 * A FAIXA LISTRADA acima do rodapé é a única por página na regra nova
 * ("faixa listrada: uma por página, acima do rodapé"). Ela mora AQUI para
 * andar sempre junto do rodapé. Decoração pura, `aria-hidden`.
 *
 * O logotipo leva `alt` VAZIO: o nome da ONG já está no logotipo do
 * cabeçalho (com alt) e no endereço logo ao lado — um alt aqui faria quem
 * usa leitor de tela ouvir o nome mais uma vez sem ganhar nada.
 */
export default function Rodape() {
  return (
    <>
      <div className="af-stripe" aria-hidden="true"></div>

      <footer className="af-footer rodape">
        <div className="af-footer__linha">
          <img className="af-footer__marca" src="/imagens/logo-atelie.png" alt="" width={260} height={106}
            loading="lazy" decoding="async" />

          <address className="af-footer__endereco rodape__endereco">
            Rua Dr. Paulo Gatti, 135 — Vila Romero, São Paulo/SP — CEP 02468-030
          </address>

          <ul className="af-footer__links rodape__lista" aria-label="Fale com a gente">
            <li><a href="tel:+5511953968344"><Icone nome="telefone" />(11) 95396-8344</a></li>
            <li><a href="https://wa.me/5511953968344" rel="noopener"><Icone nome="whatsapp" />WhatsApp</a></li>
            <li><a href="mailto:atelieafro@gmail.com"><Icone nome="email" />atelieafro@gmail.com</a></li>
            <li><a href="https://instagram.com/atelie_afrocultural" rel="noopener"><Icone nome="instagram" />Instagram</a></li>
            <li><a href="https://tiktok.com/@ateli.afro.cultur" rel="noopener"><Icone nome="tiktok" />TikTok</a></li>
          </ul>
        </div>

        <p className="af-footer__legal rodape__aviso">
          <Link href="/privacidade">Política de privacidade</Link>
          <Link href="/perguntas-frequentes">Perguntas frequentes</Link>
          <Link href="/depoimentos">Depoimentos</Link>
          <Link href="/para-empresas">Para empresas e apoiadores</Link>
          <Link href="/en" lang="en" hrefLang="en">About us (English)</Link>
        </p>
      </footer>
    </>
  );
}
