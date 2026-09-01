import { createHash } from 'node:crypto';

/**
 * compartilhado/origem-do-visitante.ts — quem enviou este formulário, para
 * efeito de limite de envio. Nunca para efeito de identificar a pessoa.
 *
 * ===================================================================
 * POR QUE ISTO EXISTE
 * ===================================================================
 *
 * `supabase/migrations/005_contencao.sql` limitava os envios por origem, e
 * descobria a origem lendo o `x-forwarded-for` que o PostgREST expõe ao
 * Postgres. Aquilo funcionava quando o NAVEGADOR de cada pessoa falava
 * direto com o Supabase.
 *
 * Neste desenho quem fala com o Supabase é sempre o servidor (spec §4.1),
 * então aquele cabeçalho é o mesmo para todo mundo e o limite vira um balde
 * global de 10/hora para o site inteiro — negação de serviço contra quem
 * usa, não contenção (spec §4.6). O conserto tem duas metades: a do banco é
 * `supabase/migrations/007_limite_por_visitante.sql`; esta é a do site.
 *
 * ===================================================================
 * O QUE SAI DAQUI, E O QUE NUNCA SAI
 * ===================================================================
 *
 * Sai um hash SHA-256 em hexadecimal. NÃO sai o endereço de IP, e ele não
 * é gravado em lugar nenhum — é coleta mínima (RNF09), é o que
 * `supabase/migrations/005_contencao.sql` já dizia no comentário da coluna,
 * e é o que a política de privacidade promete a quem lê:
 *
 *   "Ao enviar um formulário, guardamos um código embaralhado derivado do
 *    seu endereço de internet, apenas para impedir envio automatizado em
 *    massa. O endereço em si não é guardado, e o código não permite chegar
 *    de volta até você."
 *
 * O HASH NÃO É ANONIMATO FORTE, e isso precisa estar escrito: o espaço de
 * endereços IPv4 é pequeno o bastante para ser varrido inteiro por quem
 * tiver a tabela e vontade. O que ele dá é (a) o endereço não fica legível
 * em texto para quem abrir a tabela, e (b) o registro é apagado em até um
 * dia (`limpar_envios_antigos()`, 005). Quem quiser mais que isso precisa
 * de um segredo por site misturado ao hash — que este projeto não tem onde
 * guardar hoje.
 *
 * ===================================================================
 * A ORDEM DOS CABEÇALHOS É UMA DECISÃO DE SEGURANÇA
 * ===================================================================
 *
 * `x-forwarded-for` PODE SER FORJADO por quem faz a requisição: é só mandar
 * o cabeçalho. Se ele viesse primeiro, qualquer pessoa trocaria de balde a
 * cada envio e o limite não existiria.
 *
 * `x-nf-client-connection-ip` é escrito pela Netlify com o IP da conexão
 * TCP e sobrescreve o que vier de fora — por isso ele vem primeiro. Em
 * produção ele existe sempre; fora dela ele nunca existe, e aí o
 * `x-forwarded-for` é o que resta (é o que o `next dev` atrás de um proxy
 * local oferece).
 *
 * Ou seja: em produção o valor é confiável, e fora dela é uma conveniência
 * de desenvolvimento. Não há terceira opção — `request.socket.remoteAddress`
 * não é alcançável de dentro de uma Server Action.
 *
 * ===================================================================
 * O CABEÇALHO DA VERCEL, E POR QUE ELE ENTRA ANTES DO x-forwarded-for
 * ===================================================================
 *
 * Desde que o projeto passou a poder rodar nas duas plataformas, a lista
 * tem DOIS cabeçalhos de plataforma. Só um existe por vez — nenhuma das
 * duas escreve o da outra —, então a ordem entre eles não decide nada; o
 * que a ordem decide é que os dois vêm ANTES do `x-forwarded-for`, e essa
 * é a propriedade que precisa sobreviver a qualquer edição aqui.
 *
 * O nome NÃO foi escrito de memória. `x-vercel-forwarded-for` está em
 * https://vercel.com/docs/headers/request-headers (consultada em
 * 01/09/2026), e a doc diz o seguinte, palavra por palavra:
 *
 *  · sobre `x-forwarded-for`: "If you are trying to use Vercel behind a
 *    proxy, we currently overwrite the X-Forwarded-For header and do not
 *    forward external IPs. This restriction is in place to prevent IP
 *    spoofing";
 *  · sobre `x-vercel-forwarded-for`: "This header is identical to the
 *    x-forwarded-for header. However, x-forwarded-for could be overwritten
 *    if you're using a proxy on top of Vercel";
 *  · sobre `x-real-ip`: "This header is identical to the x-forwarded-for
 *    header" — ou seja, na Vercel ele NÃO é o último recurso que o nome
 *    sugere; é o mesmo valor. Ele fica em último lugar assim mesmo, porque
 *    fora da Vercel continua sendo o que alguns proxies põem sozinhos.
 *
 * A leitura disso: na Vercel o `x-forwarded-for` já é escrito pela
 * plataforma e não seria forjável, mas `x-vercel-forwarded-for` é o que
 * sobrevive a um proxy na frente — é ele o análogo de
 * `x-nf-client-connection-ip`, e é por isso que vem antes.
 *
 * NÃO MEDIDO CONTRA A VERCEL: o projeto nunca foi importado lá (CLAUDE.md,
 * "O que trava hoje", item 0). Se este nome estiver errado, NADA QUEBRA —
 * a leitura cai no `x-forwarded-for`, que ali também é confiável, e o
 * limite continua funcionando. O sintoma seria só a perda da resistência a
 * proxy, invisível de fora. Conferir na primeira publicação.
 *
 * ===================================================================
 * VIVE EM compartilhado/, NÃO EM servidor/
 * ===================================================================
 *
 * Mesmo motivo de compartilhado/validacao.ts: `servidor/` obriga
 * `import 'server-only'`, e isso impediria `node --test` de importar este
 * arquivo — que é justamente onde a decisão testável mora
 * (testes/contato.test.mjs compara o hash daqui com o que o Postgres
 * calcula, em testes/rls.test.mjs).
 *
 * Ele importa `node:crypto` e nada mais. Não é importável por um Client
 * Component, e não precisa ser: quem lê cabeçalho é o servidor.
 */

/**
 * Os cabeçalhos consultados, NA ORDEM. Ver o bloco acima antes de mexer:
 * a ordem é a defesa contra forjar o balde.
 *
 * A REGRA, para quem acrescentar uma plataforma: cabeçalho escrito pela
 * plataforma vem ANTES de `x-forwarded-for`, sempre. `testes/contato.test.mjs`
 * afirma isso por índice e falha se a ordem se inverter.
 */
export const CABECALHOS_DE_IP = [
  // Netlify. Escrito pela plataforma, sobrescreve o que vier de fora.
  'x-nf-client-connection-ip',
  // Vercel. Mesmo papel do de cima, e sobrevive a um proxy na frente da
  // plataforma — que é a única situação em que o `x-forwarded-for` da
  // Vercel deixaria de ser dela. NOME CONFERIDO NA DOCUMENTAÇÃO, NÃO
  // CONTRA A PLATAFORMA (ver o bloco acima).
  'x-vercel-forwarded-for',
  // `next dev` atrás de um proxy local, e qualquer outra hospedagem.
  'x-forwarded-for',
  // Último recurso; alguns proxies só põem este.
  'x-real-ip'
];

/**
 * O que se usa quando nenhum cabeçalho identifica o visitante.
 *
 * TODOS OS ENVIOS SEM IP IDENTIFICÁVEL COMPARTILHAM ESTE BALDE, e isso é
 * deliberado (spec §4.6): degrada para o limite global de antes, em vez de
 * desligar o limite. O valor precisa ser o mesmo string dos dois lados —
 * `007_limite_por_visitante.sql` usa exatamente 'desconhecida'.
 */
export const SEM_IP = 'desconhecida';

/**
 * O IP do visitante a partir dos cabeçalhos, ou `SEM_IP`.
 *
 * Recebe uma função de leitura, e não o objeto de cabeçalhos do Next, de
 * propósito: assim a decisão é pura e cabe num teste do Node, sem subir
 * servidor. `acoes/contato.ts` passa `(nome) => (await headers()).get(nome)`.
 *
 * `x-forwarded-for` é uma LISTA ("cliente, proxy1, proxy2") — o primeiro
 * item é quem originou. Pegar a lista inteira daria um balde por caminho de
 * rede, não por pessoa.
 */
export function ipDoVisitante(ler: (nome: string) => string | null | undefined): string {
  for (const nome of CABECALHOS_DE_IP) {
    const bruto = ler(nome);
    if (typeof bruto !== 'string') continue;

    const primeiro = bruto.split(',')[0].trim();
    if (primeiro.length > 0) return primeiro;
  }

  return SEM_IP;
}

/**
 * O hash que vai para o banco. Precisa bater byte a byte com o que o
 * Postgres calcula em `encode(sha256(convert_to(v_ip, 'UTF8')), 'hex')` —
 * hexadecimal minúsculo, UTF-8, sem sal e sem nada em volta.
 *
 * Se um dos dois lados mudar sozinho, nada quebra visivelmente: o limite
 * simplesmente para de contar a mesma pessoa duas vezes, e ninguém percebe
 * até chegar o envio em massa. É por isso que existe um teste que compara
 * os dois cálculos contra um Postgres de verdade (testes/rls.test.mjs).
 */
export function hashDaOrigem(ip: string): string {
  return createHash('sha256').update(ip, 'utf8').digest('hex');
}

/** As duas coisas juntas, que é como a Server Action usa. */
export function origemDoVisitante(ler: (nome: string) => string | null | undefined): string {
  return hashDaOrigem(ipDoVisitante(ler));
}
