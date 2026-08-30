import Link from 'next/link';
import { usuarioAtual } from '@/servidor/sessao';
import { ehMotivoDeFalha, MOTIVOS_DE_FALHA, type MotivoDeFalha } from '@/compartilhado/links-de-email';
import FormularioNovaSenha from '@/componentes/FormularioNovaSenha';

/**
 * app/nova-senha/page.tsx — onde a pessoa escreve a senha nova, depois de
 * ter chegado pelo link do e-mail (RF10).
 *
 * NÃO É ITEM DE MENU, e nunca foi: não existe no site antigo, não tem link
 * apontando para ela em página nenhuma, e não faz sentido chegar aqui a não
 * ser vindo de `/auth/confirm` — que é quem verifica o token e grava a
 * sessão. Por isso ela entra em PAGINAS_PRONTAS_FORA_DO_MENU
 * (testes/apoio/rotas-migracao.mjs), ao lado de /privacidade e
 * /recuperar-acesso.
 *
 * DUAS TELAS NUM ARQUIVO SÓ, e a decisão de tratar TODA falha de link aqui:
 *
 * Esta página PRECISA, de qualquer forma, ter uma versão para quem chega sem
 * sessão — link velho, link já usado, ou o endereço colado direto na barra.
 * Mostrar o formulário nesse caso seria prometer uma troca de senha que a
 * Action vai recusar (ela confere a sessão de novo, ver acoes/
 * autenticacao.ts), e fazer a pessoa digitar duas senhas para só então
 * descobrir. Existindo essa tela, ela é também o lugar natural para onde
 * `/auth/confirm` manda quem chegou com link inválido: o texto é o mesmo
 * assunto, e a saída oferecida é a mesma. As alternativas eram uma terceira
 * página só para isso — repetindo o texto num segundo arquivo — ou
 * /recuperar-acesso com um parâmetro, que é arquivo da Tarefa 3.
 *
 * O `?erro=` só refina o TEXTO. Ele nunca decide se o formulário aparece:
 * isso é `usuarioAtual()`, que pergunta ao Supabase. Um `?erro=` inventado
 * na barra de endereço não muda nada além de cair na explicação genérica —
 * e uma sessão de verdade vence qualquer `?erro=` na URL, porque a pergunta
 * que importa é feita ao servidor de autenticação, não à query string.
 */

export const metadata = {
  title: 'Criar senha nova — Ateliê Afro Cultural',
  description: 'Escolha uma senha nova para sua conta do Ateliê Afro Cultural.'
};

/** Canais reais da ONG — os mesmos de /entrar, /contato e compartilhado/erros.ts. */
const WHATSAPP = '(11) 95396-8344';
const EMAIL_ATELIE = 'atelieafro@gmail.com';

type Explicacao = { titulo: string; paragrafos: string[] };

/**
 * O texto de cada motivo. Regra da seção 11 do escopo: dizer o que houve e
 * o que fazer. Nada de "erro" nem de "token" — quem lê clicou num link do
 * próprio e-mail, quase sempre no celular, e precisa saber qual é o próximo
 * passo, não o nome técnico do que falhou.
 */
function explicar(motivo: MotivoDeFalha | null): Explicacao {
  if (motivo === MOTIVOS_DE_FALHA.expirado) {
    return {
      titulo: 'Este link não vale mais',
      paragrafos: [
        'Os links de senha nova duram pouco tempo e funcionam uma vez só. Este já foi usado '
        + 'ou passou do prazo.',
        'Peça outro e abra o mais recente que chegar — se você pediu mais de um, só o último '
        + 'funciona.'
      ]
    };
  }

  if (motivo === MOTIVOS_DE_FALHA.confirmacao) {
    return {
      titulo: 'Não deu para confirmar seu cadastro',
      paragrafos: [
        'O link de confirmação que você abriu não vale mais: eles duram pouco tempo e '
        + 'funcionam uma vez só.',
        'Se você já tinha confirmado antes, é só entrar normalmente. Se não conseguir, fale '
        + `com a gente pelo WhatsApp ${WHATSAPP} ou pelo e-mail ${EMAIL_ATELIE}.`
      ]
    };
  }

  if (motivo === MOTIVOS_DE_FALHA.indisponivel) {
    return {
      titulo: 'As contas ainda não estão disponíveis neste endereço',
      paragrafos: [
        'Não é o seu link: este endereço do site ainda não consegue verificar links de e-mail.',
        `Fale com a gente pelo WhatsApp ${WHATSAPP} ou pelo e-mail ${EMAIL_ATELIE}.`
      ]
    };
  }

  // Sem motivo declarado (alguém abriu /nova-senha direto) ou motivo que não
  // reconhecemos: a explicação que serve para os dois é a mesma.
  return {
    titulo: 'Esta página abre pelo link do e-mail',
    paragrafos: [
      'Para criar uma senha nova é preciso abrir o link que enviamos por e-mail. Ele é o que '
      + 'confirma que a conta é sua.',
      'Se o link não funcionou mais, peça outro: os links duram pouco tempo e funcionam uma '
      + 'vez só.'
    ]
  };
}

export default async function NovaSenha({
  searchParams
}: {
  searchParams: Promise<{ erro?: string | string[] }>;
}) {
  const { erro } = await searchParams;
  // `?erro=a&erro=b` chega como array — pegar o primeiro em vez de deixar um
  // array virar string com vírgula (que não bateria com motivo nenhum e
  // ainda assim mudaria o comportamento do `ehMotivoDeFalha`).
  const bruto = Array.isArray(erro) ? erro[0] : erro;
  const motivo = ehMotivoDeFalha(bruto) ? bruto : null;

  const usuario = await usuarioAtual();

  if (!usuario) {
    const { titulo, paragrafos } = explicar(motivo);

    return (
      <main id="conteudo" className="conteudo">
        <h1>{titulo}</h1>

        <div className="aviso aviso--erro">
          {paragrafos.map((paragrafo) => <p key={paragrafo}>{paragrafo}</p>)}
        </div>

        <p><Link href="/recuperar-acesso">Pedir um link novo</Link></p>
        <p><Link href="/entrar">Voltar para entrar</Link></p>
      </main>
    );
  }

  return (
    <main id="conteudo" className="conteudo">
      <h1>Criar senha nova</h1>

      <p className="destaque">
        Escolha a senha que você vai usar para entrar. Depois de salvar, ela já vale.
      </p>

      <FormularioNovaSenha />
    </main>
  );
}
