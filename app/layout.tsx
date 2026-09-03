import { headers } from 'next/headers';
import '@/estilos/fontes.css';
import '@/estilos/tokens.css';
import '@/estilos/sistema.css';
import '@/estilos/base.css';
import '@/estilos/componentes.css';
// A pele v1 sobre os nomes de classe antigos — carrega por último, de
// propósito (ver o topo do arquivo).
import '@/estilos/sistema-aplicado.css';
import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';
import VLibras from '@/componentes/VLibras';
import { BotaoWhatsApp } from '@/componentes/BotaoWhatsApp';
import FocoNaNavegacao from '@/componentes/FocoNaNavegacao';
import { sessaoParaOCabecalho, type SessaoNoCabecalho } from '@/servidor/sessao';
import { ehEquipe, ehVoluntarioAtivo } from '@/servidor/permissao';

export const metadata = {
  title: 'Ateliê Afro Cultural',
  description: 'Espaço educativo de criação, reflexão e valorização da cultura e memória afro brasileira, na Casa Verde, zona norte de São Paulo.'
};

export default async function LayoutRaiz({ children }: { children: React.ReactNode }) {
  // headers() e assincrono a partir do Next 15 — o await nao e opcional. O
  // nonce vem do middleware (middleware.ts), que o grava em x-nonce a cada
  // requisicao; sem ele, tanto o script anti-piscada quanto o <script> do
  // VLibras seriam recusados pela politica de conteudo.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // QUEM ESTÁ AUTENTICADO — lido aqui porque este é o único lugar do
  // cabeçalho que roda no servidor: `componentes/Cabecalho.tsx` é Client
  // Component (usePathname) e, neste projeto, o navegador não fala com o
  // Supabase (spec §4.1).
  //
  // NÃO TORNA NENHUMA ROTA DINÂMICA QUE JÁ NÃO FOSSE. `sessaoParaOCabecalho`
  // lê `cookies()`, que é API dinâmica — mas a linha do `nonce` logo acima
  // já lê `headers()` desde a fase 1, e este layout envolve TODAS as rotas.
  // MEDIDO com `npx next build` antes e depois desta tarefa: as 18 rotas de
  // `app/` já eram `ƒ (Dynamic)`, e continuam; a única `○ (Static)` é
  // `/robots.txt`, que não passa por este layout, e continua estática. Ou
  // seja, o custo de renderização desta tarefa é zero — o que NÃO é o mesmo
  // que dizer que a leitura é grátis (ver a guarda de cookie em
  // servidor/sessao.ts, que evita perguntar ao Supabase por quem não tem
  // sessão).
  //
  // PORTA DE DIAGNÓSTICO, fechada por padrão — no espírito de
  // `/diagnostico/origem-dos-dados`. Com `DIAGNOSTICO_CABECALHO_COM_SESSAO`
  // definida, o cabeçalho é desenhado como se houvesse sessão com aquele
  // nome. Existe porque a alternativa era não ter medição nenhuma do
  // cabeçalho autenticado: hoje não há conta utilizável neste projeto
  // Supabase (a confirmação de e-mail está ligada e o envio nativo estoura a
  // cota — itens 1 e 2 de "O que trava hoje"), então nem a suíte nem uma
  // pessoa conseguem chegar a essa tela pelo caminho normal.
  //
  // O QUE ELA PODE E O QUE NÃO PODE: ela só muda o que o cabeçalho DESENHA.
  // Não cria sessão, não grava cookie, não passa por `usuarioAtual()` — que
  // continua sendo o que responde a `/nova-senha` e a `definirNovaSenha`,
  // e o único que autoriza qualquer coisa. Ligá-la em produção por engano
  // faria o cabeçalho mentir para quem visita e o botão "Sair" não ter
  // sessão nenhuma para encerrar; não daria acesso a dado de ninguém,
  // porque quem decide isso é a RLS (regra 6 do CLAUDE.md). É variável de
  // ambiente do servidor: ninguém liga isso pelo navegador.
  const nomeForcado = process.env.DIAGNOSTICO_CABECALHO_COM_SESSAO;
  const sessao: SessaoNoCabecalho | null = nomeForcado
    ? { nome: nomeForcado }
    : await sessaoParaOCabecalho();

  // "PAINEL" NO MENU, PARA QUEM É EQUIPE (pedido V1).
  //
  // A pergunta custa uma consulta a `perfis` — e por isso ela só acontece
  // QUANDO HÁ SESSÃO. Visita anônima, que é a esmagadora maioria, não paga
  // nada: sem sessão o menu não teria o item de qualquer jeito.
  // `ehEquipe()` é memoizada por requisição (`cache()`), então a mesma
  // pergunta feita de novo dentro de /admin não custa uma segunda ida ao
  // banco.
  //
  // ISTO NÃO AUTORIZA COISA ALGUMA, e a distinção importa. O booleano
  // decide se um LINK é desenhado. Quem decide o que pode ser lido ou
  // gravado é `ehEquipe()` na página do painel e a RLS no banco (regras 5
  // e 6). Um `true` forjado no HTML daria à pessoa um link para uma tela
  // que responde 404 para ela.
  //
  // E ele NÃO vaza a existência do painel: quem não é equipe nunca recebe o
  // item, exatamente como `/admin` nunca admite existir para quem não é.
  //
  // "MURAL DE AVISOS" NO MENU, PARA QUEM É VOLUNTÁRIO ATIVO (RF27).
  //
  // Custa uma SEGUNDA consulta, e por isso as duas vão juntas num
  // `Promise.all`: em série seriam duas idas ao Postgres uma depois da
  // outra em toda página de quem está autenticado; em paralelo o custo é o
  // da mais lenta. As duas são memoizadas por requisição (`cache()`), então
  // perguntar de novo dentro da página não paga rede de novo.
  //
  // O recorte é `situacao = 'ativo'`, e ele não é escolha deste arquivo:
  // `ehVoluntarioAtivo()` chama a MESMA função do banco que a política de
  // `public.avisos` chama. Comparar `situacao` aqui criaria uma segunda
  // definição de "voluntário", que divergiria em silêncio no dia em que a
  // ONG decidisse incluir 'em_contato'.
  const [ehDaEquipe, ehVoluntario] = sessao !== null && !nomeForcado
    ? await Promise.all([ehEquipe(), ehVoluntarioAtivo()])
    : [false, false];

  return (
    // suppressHydrationWarning aplicado só no <html>: a Tarefa 3 acrescenta o
    // script anti-piscada, que altera atributos deste elemento antes da
    // hidratação. Sem isto, o React acusaria divergência.
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        {/*
          Script classico e sincrono de proposito: um modulo seria adiado e a
          pagina piscaria no tamanho/contraste errado a cada navegacao.
          Duplica a leitura minima do armazenamento pelo mesmo motivo — nao
          pode depender de import. Unico script inline do projeto; leva o
          nonce da requisicao porque a politica de conteudo bloqueia script
          inline sem ele.
        */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
      var g=localStorage.getItem('aac-preferencias'); if(!g)return;
      var p=JSON.parse(g), e=[87.5,100,112.5,125,137.5];
      if(e.indexOf(p.escala)!==-1)document.documentElement.style.setProperty('--escala-fonte',p.escala+'%');
      if(p.contraste==='alto')document.documentElement.setAttribute('data-contraste','alto');
    }catch(x){}})();`
          }}
        />
        <a className="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>
        <FocoNaNavegacao />
        <Cabecalho sessao={sessao} ehEquipe={ehDaEquipe} ehVoluntario={ehVoluntario} />
        {children}
        <Rodape />
        {/*
          O botão de WhatsApp vem ANTES do VLibras na ordem do documento, e
          é decisão: quem navega por teclado alcança primeiro o que fala
          com a ONG, e o widget de tradução — que é de terceiro e monta
          sozinho — fica por último, onde não atropela a ordem de foco.
        */}
        <BotaoWhatsApp />
        <VLibras nonce={nonce} />
      </body>
    </html>
  );
}
