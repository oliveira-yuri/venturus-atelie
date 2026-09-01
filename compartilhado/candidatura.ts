/**
 * compartilhado/candidatura.ts — a regra de "esta pessoa já está
 * candidatada?", que a TELA e a SERVER ACTION precisam responder igual
 * (RF25).
 *
 * ===================================================================
 * POR QUE ISTO NÃO MORA EM compartilhado/validacao.ts
 * ===================================================================
 *
 * Aquele arquivo lê e valida FORMULÁRIO. Isto não é campo nenhum: é uma
 * decisão sobre o que já está gravado no banco, e ela governa DUAS coisas
 * que não podem divergir — o que `/voluntariado/candidatura` desenha (o
 * formulário, ou a candidatura que já existe) e o que
 * `acoes/voluntariado.ts` aceita gravar. Mesma disciplina de
 * compartilhado/triagem-de-contatos.ts, que também guarda uma lista fechada
 * consumida pelos dois lados.
 *
 * Se a tela e a Action respondessem com regras diferentes, a diferença
 * entre as duas seria o buraco: tela que esconde o formulário mas Action
 * que grava assim mesmo (duplicata a cada POST montado à mão), ou o
 * contrário, tela que oferece um botão que o servidor recusa.
 *
 * ===================================================================
 * POR QUE EXISTE UMA REGRA DE DUPLICATA, E POR QUE ELA IMPORTA MAIS AQUI
 * QUE EM /contato
 * ===================================================================
 *
 * MEDIDO em 01/09/2026 contra o Supabase real, com uma sessão de verdade:
 * `delete from voluntarios where perfil_id = <eu>` responde SUCESSO COM
 * ZERO LINHAS. Não é engano — `public.voluntarios` tem política de insert e
 * de select para a própria pessoa, e nenhuma de delete: apagar é só de quem
 * é equipe (`voluntarios: equipe gerencia`, 004_pessoas.sql). Ou seja,
 * CANDIDATAR-SE NÃO TEM DESFAZER, nem para quem se candidatou nem para este
 * código.
 *
 * Num formulário sem desfazer, dois toques no botão num celular com rede
 * ruim viram duas candidaturas na fila da ONG, para sempre. O
 * POST-redirect-GET da Action cobre o F5; esta regra cobre o resto.
 *
 * 'inativo' FICA DE FORA da lista de propósito: é a situação de quem já foi
 * voluntário e encerrou (componentes/MinhaConta.ts traduz por "Encerrada").
 * Quem encerrou e quer voltar precisa poder se candidatar de novo — tratar
 * 'inativo' como impedimento trancaria justamente quem já ajudou.
 *
 * ARQUIVO SEM NENHUM IMPORT, de propósito, como os outros de compartilhado/
 * que precisam ser medidos sem subir o Next: assim
 * testes/voluntariado.test.mjs o importa pelo runtime nativo do Node, que
 * não resolve o alias `@/...` do tsconfig.
 */

/**
 * As situações de `public.voluntarios` que significam "já existe uma
 * candidatura viva desta pessoa".
 *
 * Os valores são exatamente três dos quatro do
 * `check (situacao in ('novo','em_contato','ativo','inativo'))` de
 * supabase/migrations/004_pessoas.sql, e `testes/voluntariado.test.mjs` LÊ
 * AQUELE ARQUIVO e reconcilia — do jeito que testes/minha-conta.test.mjs
 * faz com as palavras da tela. Sem isso, uma quinta situação criada no
 * banco entraria em silêncio na categoria "não está em andamento", e a
 * pessoa poderia se candidatar de novo por cima de uma candidatura viva.
 */
export const SITUACOES_EM_ANDAMENTO = ['novo', 'em_contato', 'ativo'];

/** A forma mínima que esta regra precisa enxergar de uma candidatura. */
export type CandidaturaMinima = { situacao: string };

/**
 * A candidatura em andamento desta pessoa, se houver.
 *
 * Devolve a LINHA, e não um booleano, porque quem chama precisa dela: a
 * tela desenha a situação e a data, e a Action põe a situação na frase da
 * recusa. Um booleano obrigaria os dois a procurar de novo.
 */
export function candidaturaEmAndamento<T extends CandidaturaMinima>(
  candidaturas: T[]
): T | null {
  return candidaturas.find((c) => SITUACOES_EM_ANDAMENTO.includes(c.situacao)) ?? null;
}
