import 'server-only';

/**
 * servidor/email.ts — a ponte do site para a Edge Function `enviar-email`.
 *
 * =====================================================================
 * POR QUE O SITE NÃO MANDA E-MAIL SOZINHO
 * =====================================================================
 *
 * Mandar e-mail exige a chave do provedor. Uma chave do Resend guardada
 * aqui poderia mandar qualquer coisa, para qualquer endereço, em nome do
 * domínio da ONG — e ela viveria na mesma variável de ambiente que todo o
 * resto do site. A Edge Function existe para que essa chave fique num
 * lugar só, com uma superfície de uso mínima: dois tipos, sem parâmetro de
 * destinatário, sem parâmetro de texto (spec §9).
 *
 * =====================================================================
 * ELA NUNCA DERRUBA O QUE VEIO ANTES
 * =====================================================================
 *
 * Esta é a regra mais importante deste arquivo, e ela vale para as duas
 * chamadas: a inscrição JÁ FOI GRAVADA quando o e-mail é pedido, e a
 * resposta da doação também. Se o envio falhar, o que aconteceu antes
 * continua tendo acontecido.
 *
 * Então nada aqui lança. `avisar()` devolve `boolean` e engole tudo: rede
 * fora, função não publicada, provedor recusando, chave errada. O que
 * sobra é uma linha no log — e, quando a função chegou a rodar, uma linha
 * em `public.envios` com `situacao = 'falhou'`, que é o que a equipe LÊ.
 *
 * O contrário — deixar a exceção subir — transformaria "a confirmação não
 * saiu" em "a inscrição não deu certo", e a pessoa se inscreveria de novo.
 *
 * =====================================================================
 * SEM `await` NO CAMINHO DE QUEM ESTÁ ESPERANDO? NÃO. COM.
 * =====================================================================
 *
 * A tentação é disparar sem esperar, para a pessoa não segurar a tela.
 * Não dá, e o motivo é a plataforma: numa função serverless (Vercel,
 * Netlify) o processo é CONGELADO assim que a resposta é devolvida — uma
 * promessa solta morre no meio, às vezes depois de o e-mail ter saído e
 * antes de `public.envios` ser gravado, que é o pior desfecho possível
 * (reenvio na próxima vez).
 *
 * Então é `await`, com PRAZO CURTO (`PRAZO_MS`). O custo é alguns
 * centésimos na resposta de quem se inscreveu; o ganho é que "enviado" e
 * "registrado" continuam sendo a mesma verdade.
 */

/**
 * O endereço da função e a chave compartilhada.
 *
 * `CHAVE_DE_ENVIO` é a MESMA string cadastrada como secret da Edge
 * Function. Sem prefixo `NEXT_PUBLIC_`, de propósito: ela é lida só no
 * servidor e não pode ser embutida no bundle do navegador — se fosse, a
 * trava da função valeria zero, porque qualquer pessoa leria a chave no
 * código-fonte da página.
 */
function configuracao(): { endereco: string; chave: string; anon: string } | null {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.CHAVE_DE_ENVIO;
  const anon = process.env.SUPABASE_CHAVE_PUBLICAVEL;

  if (!url || !chave || !anon) return null;

  return { endereco: `${url}/functions/v1/enviar-email`, chave, anon };
}

/**
 * Prazo total da chamada.
 *
 * 6 segundos: o suficiente para o Resend responder num dia normal, e curto
 * o bastante para não segurar a tela de quem acabou de se inscrever. É a
 * mesma disciplina de `compartilhado/prazo.ts` no middleware — lá o número
 * veio de uma medição de 50,9 s sem prazo nenhum.
 */
const PRAZO_MS = 6_000;

/** O que a Edge Function aceita. Duas formas, e nenhuma carrega texto. */
export type PedidoDeEmail =
  | { tipo: 'inscricao'; evento_id: string; email: string }
  | { tipo: 'doacao'; id: string };

/**
 * Pede o envio. Devolve `true` só quando a função confirmou.
 *
 * NUNCA LANÇA — ver o cabeçalho. Quem chama usa o resultado para escolher
 * a FRASE que a pessoa lê, nunca para decidir se a operação deu certo.
 */
export async function avisar(pedido: PedidoDeEmail): Promise<boolean> {
  const config = configuracao();

  if (!config) {
    console.warn('[email] SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL ou CHAVE_DE_ENVIO não estão '
      + 'no ambiente: nenhum e-mail foi pedido. Isto NÃO impede nada de ser gravado — o RF18 e '
      + 'a metade por e-mail do RF20 é que ficam de fora. Cadastrar CHAVE_DE_ENVIO no painel da '
      + 'hospedagem com o MESMO valor do secret da Edge Function.');
    return false;
  }

  const relogio = AbortSignal.timeout(PRAZO_MS);

  try {
    const resposta = await fetch(config.endereco, {
      method: 'POST',
      signal: relogio,
      headers: {
        // A anon key é o que a plataforma exige para a função ser
        // alcançada; ela é pública e não autoriza nada por si.
        authorization: `Bearer ${config.anon}`,
        'x-chave-do-site': config.chave,
        'content-type': 'application/json'
      },
      body: JSON.stringify(pedido)
    });

    if (resposta.ok) return true;

    // 404 da FUNÇÃO (e não do registro) é o caso de ela não ter sido
    // publicada ainda, que é o estado de hoje — merece uma frase própria,
    // porque é configuração, não defeito.
    if (resposta.status === 404) {
      console.warn(`[email] a função "enviar-email" respondeu 404 para ${pedido.tipo}. Se ela `
        + 'ainda não foi publicada, publique com `supabase functions deploy enviar-email` (ou '
        + 'pelo editor de Edge Functions no painel). Nada foi perdido: o registro está gravado.');
      return false;
    }

    console.error(`[email] a função recusou (${resposta.status}) para ${pedido.tipo}:`,
      (await resposta.text()).slice(0, 300));
    return false;
  } catch (erro) {
    // Inclui o prazo estourado (`TimeoutError`). Engolir aqui é o desenho:
    // ver o cabeçalho.
    console.error(`[email] não deu para pedir o envio de ${pedido.tipo}:`, erro);
    return false;
  }
}
