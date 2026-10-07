/**
 * Perguntas frequentes — SÓ respostas que já estão escritas em outras
 * páginas do site (regra 2: nunca inventar). Cada item diz de onde veio, e
 * `testes/diferenciais-baratos.test.mjs` exige que a origem exista.
 *
 * Cada resposta é uma lista de trechos (texto puro ou link interno), para a
 * página poder desenhar links sem `dangerouslySetInnerHTML`.
 */
export type Trecho = string | { texto: string; href: string };

export type Pergunta = {
  id: string;
  pergunta: string;
  resposta: Trecho[];
  /** Onde o texto original está, para quem for conferir com a ONG. */
  origem: string;
};

export const PERGUNTAS: Pergunta[] = [
  {
    id: 'conta-para-inscrever',
    pergunta: 'Preciso criar conta para me inscrever numa atividade?',
    resposta: [
      'Não. Para se inscrever não é preciso criar conta — basta preencher o formulário do evento. As atividades abertas estão na ',
      { texto: 'agenda', href: '/agenda' }, '.'
    ],
    origem: 'app/agenda/page.tsx'
  },
  {
    id: 'imagem',
    pergunta: 'Preciso autorizar o uso da minha imagem para participar?',
    resposta: [
      'Não. Nas oficinas e apresentações a gente às vezes fotografa, mas nenhuma foto vai para o site sem autorização registrada, e você pode participar sem autorizar — é só deixar a caixa de autorização desmarcada na inscrição.'
    ],
    origem: 'componentes/FormularioInscricao.tsx'
  },
  {
    id: 'menores',
    pergunta: 'Quem tem menos de 18 anos pode se inscrever?',
    resposta: [
      'Pode. Na inscrição há um campo para marcar que quem vai participar tem menos de 18 anos, e então o nome e o telefone de um responsável são obrigatórios.'
    ],
    origem: 'componentes/FormularioInscricao.tsx'
  },
  {
    id: 'para-quem',
    pergunta: 'Para quem são as atividades?',
    resposta: ['Crianças, jovens e adultos, de todas as etnias, descendências e faixas etárias.'],
    origem: 'app/quem-somos/page.tsx'
  },
  {
    id: 'onde-fica',
    pergunta: 'Onde fica o Ateliê?',
    resposta: [
      'No bairro da Casa Verde, zona norte de São Paulo: Rua Dr. Paulo Gatti, 135 — Vila Romero, São Paulo/SP — CEP 02468-030. Veja o mapa em ',
      { texto: 'contato', href: '/contato' }, '.'
    ],
    origem: 'app/quem-somos/page.tsx e app/privacidade/page.tsx'
  },
  {
    id: 'escola-duracao',
    pergunta: 'Quanto dura uma atividade para escola e qual é a classificação?',
    resposta: ['A classificação é livre. A duração é de 50 minutos na maioria das atividades; algumas são a combinar.'],
    origem: 'app/para-escolas/page.tsx'
  },
  {
    id: 'escola-providenciar',
    pergunta: 'O que a escola precisa providenciar?',
    resposta: [
      'Um espaço para a apresentação (adaptamos ao que a escola tiver), 1 caixa de som e 1 microfone, com ou sem fio, conforme a atividade. A ficha técnica de cada atividade traz o que ela pede em detalhe, em ',
      { texto: 'projetos', href: '/projetos' }, '.'
    ],
    origem: 'app/para-escolas/page.tsx'
  },
  {
    id: 'voluntario',
    pergunta: 'Como faço para ser voluntário ou voluntária?',
    resposta: [
      'Você cria uma conta e escolhe suas áreas de interesse. A gente lê a candidatura, entra em contato para conversar e combina junto o que faz sentido para você e para o ateliê. Comece pela página de ',
      { texto: 'voluntariado', href: '/voluntariado' }, '.'
    ],
    origem: 'app/voluntariado/page.tsx'
  },
  {
    id: 'apoiar',
    pergunta: 'Como posso apoiar o Ateliê?',
    resposta: [
      'O que mais nos fortalece são materiais que viram atividade com as crianças — e recursos que sustentam o trabalho. Veja as formas de contribuir em ',
      { texto: 'apoiar', href: '/doar' }, '.'
    ],
    origem: 'app/doar/page.tsx'
  },
  {
    id: 'apagar-dados',
    pergunta: 'Como peço para ver, corrigir ou apagar os meus dados?',
    resposta: [
      'É só escrever para atelieafro@gmail.com. Você pode pedir para ver quais dados seus temos, corrigir informação errada, pedir a exclusão ou retirar uma autorização de uso de imagem que já tenha dado. Mais em ',
      { texto: 'privacidade', href: '/privacidade' }, '.'
    ],
    origem: 'app/privacidade/page.tsx'
  },
  {
    id: 'falar',
    pergunta: 'Como falo com o Ateliê?',
    resposta: [
      'Pelo WhatsApp (11) 95396-8344, pelo e-mail atelieafro@gmail.com ou pelo formulário da página de ',
      { texto: 'contato', href: '/contato' }, '.'
    ],
    origem: 'app/contato/page.tsx'
  }
];

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const textoDe = (resposta: Trecho[]) => resposta.map((t) => (typeof t === 'string' ? t : t.texto)).join('');

/** Busca por palavras (todas precisam aparecer), sem acento e sem diferenciar maiúscula. */
export function filtrarPerguntas(termo: unknown, lista: Pergunta[] = PERGUNTAS): Pergunta[] {
  if (typeof termo !== 'string') return lista;
  const palavras = semAcento(termo).split(/\s+/).filter((p) => p.length > 1).slice(0, 8);
  if (palavras.length === 0) return lista;
  return lista.filter((item) => {
    const palheiro = semAcento(`${item.pergunta} ${textoDe(item.resposta)}`);
    return palavras.every((p) => palheiro.includes(p));
  });
}
