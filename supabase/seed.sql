-- =====================================================================
-- Seed — conteudo real do Ateliê Afro Cultural
--
-- GERADO por ferramentas/gerar-seed.mjs a partir de
-- dados-iniciais/*.json. Nao editar a mao: edite o JSON e
-- rode o gerador de novo, para as duas fontes nao divergirem.
-- =====================================================================

insert into public.areas_voluntariado (id, nome, descricao, ordem) values
  ('apoio-pedagogico', 'Apoio pedagógico e oficinas', 'Reforço escolar, contação de histórias, oficinas de percussão, dança, turbantes e artes manuais.', 1),
  ('comunicacao', 'Comunicação e mídias', 'Fotos, vídeos, textos para redes sociais, divulgação de projetos e editais.', 2),
  ('producao-eventos', 'Produção de eventos', 'Montagem de exposições, recepção de público, feiras culturais, apresentações.', 3),
  ('acervo', 'Organização de acervo', 'Catalogação de livros, roupas, instrumentos musicais, fantasias e peças de memória ancestral.', 4),
  ('administrativo', 'Apoio administrativo', 'Captação de recursos, planejamento de projetos, atendimento à comunidade.', 5)
on conflict (id) do nothing;

insert into public.atividades (id, titulo, resumo, descricao, genero, duracao, elenco, classificacao, local, rider, publicado) values
  ('banzo', 'Banzo', 'Contação de história performática sobre o banzo — a saudade da pátria e da liberdade sentida pelos africanos escravizados.', 'Contação de história performática que, através da legitimação, valorização e conscientização da história dos negros no Brasil, propõe diálogos e interações com o público, buscando difundir uma arte negra contemporânea, com raízes e práticas afetivas e ancestrais através de fragmentos de imaginários negros, tendo como ponto de partida o BANZO — nome dado ao sentimento de nostalgia, tristeza e saudade de sua pátria, costumes familiares e principalmente de sua liberdade, que os negros africanos escravizados sentiam ao serem tirados de seu país de origem.

A presença performática do artista negro Wil Oliveira em cena, com suas marcas, elementos e experiências diaspóricas, onde suas histórias e corpo são discursos e memórias de extrema potência, tanto estética quanto social.', 'Contação de história performática', '50 minutos', 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', '1 caixa de som · 1 microfone com ou sem fio', true),
  ('catirina-e-nego-dito', 'Catirina e Nego Dito', 'Contação performática com fantoches e música ao vivo, a partir da história do auto do boi.', 'Apresentação artística com fantoches e música ao vivo, que conta a lendária história de dois personagens da cultura popular brasileira, Catirina e Francisco, figuras presentes nas manifestações artísticas conhecidas como auto do boi. A história ganha vida e é conduzida através de cantigas dos "boiadeiros", seres e divindades de luz pertencentes às religiões de matrizes africanas.

Catirina e Nego Dito são um casal de escravizados que vivem em uma fazenda no sertão. Grávida, Catirina sente o desejo de comer a língua do boi mais bonito do dono da fazenda. Para satisfazer o desejo de sua mulher, Nego Dito rouba o boi preferido, mata o animal e retira a língua para que sua esposa possa comê-la. O coronel fica sabendo do roubo e parte em busca do casal, jurando vingança. No fim, os personagens conseguem ressuscitar o boi e, como agradecimento, o dono da fazenda promove uma festa.

A apresentação retrata diferentes visões sobre o boi e ressalta sua importância: para os escravizados e trabalhadores rurais, companheiro de trabalho e sinônimo de força; para os proprietários de fazendas, investimento e fonte de renda; nas religiões de matrizes africanas, divindade de luz que representa esperança, proteção, justiça e prosperidade; e na cultura popular brasileira, símbolo de resistência.

Conta com fantoches de personagens negros, tecidos de chita, tambores, cantigas, figurinos e cenário, de modo a contribuir para a valorização e expansão da cultura e ancestralidade negra.', 'Contação performática de histórias (fantoches)', '50 minutos', 'Wil Oliveira (narrador, cantor e músico) · Davi Santos (bonequeiro)', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('cafu-e-o-cafe', 'Cafú e o Café', 'Contação de história que leva o público às fazendas de café do Vale do Paraíba do século XIX.', 'Ao entrar em contato com a contação de histórias "Cafú e o Café", o público encontrará, através de uma linguagem acessível e simples, algumas memórias da cultura afro-brasileira, em especial a contribuição que a cultura africana forneceu ao Brasil.

A história convida a uma viagem ao tempo, de maneira descontraída e dinâmica. As narrativas conduzem até as fazendas de café do Vale do Paraíba do século XIX. A história central gira em torno de situações de preconceito racial, através de bullying no ambiente escolar.

"Cafú e o Café" foi escrita e ilustrada pelo artista, ator, arte-educador e escritor Wil Oliveira.', 'Contação de história', '50 minutos', 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', '1 caixa de som · 1 microfone headset', true),
  ('brincadeiras-encantadas-na-mata', 'Brincadeiras Encantadas na Mata', 'História-brincante em que crianças e adultos entram numa aventura de faz de conta pela mata.', 'Você já brincou na mata? Já desvendou os segredos e encantamentos que vivem sob as copas e galhos, atravessando rios e trilhas?

Nesta história-brincante, crianças e pessoas adultas são convidadas a uma aventura de faz de conta, interagindo com os elementos dispersos no espaço e despertando a imaginação. O Ateliê Afro Cultural conduz o percurso por meio de uma história com ações para as crianças seguirem, mesclando comandos, música, sons da mata e natureza, elementos sensoriais e brincadeiras.

Uma vivência destinada a (re)descobrir os brincares coletivos de imaginação ligados à natureza e aos quintais, explorando as sensações e o ambiente ao redor.

A ambientação e o cenário são construídos com chitas e elementos naturais como cabaças, palha sisal, pinhos, troncos de árvores e outros materiais, gerando uma ambientação colorida, lúdica, acolhedora e ancestral.', 'História-brincante interativa', 'A combinar', 'Wil Oliveira · Nathália (Nathy) Monteiro', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('projeto-brincantes', 'Projeto Brincantes', 'Vivência de resgate das brincadeiras da cultura popular afro-brasileira.', 'Pensando sobre a importância de resgatar brincadeiras populares, o "Projeto Brincantes" surge com o intuito de aproximar e espalhar arte e cultura afro-brasileira através de brincadeiras da nossa cultura popular. O projeto promove as atividades já enraizadas e as leva para outros espaços e lugares, com o objetivo de transformar relações e ambientes e, principalmente, propagar a cultura afro-brasileira através da arte brincante.

Nathy Monteiro e Wil Oliveira são um casal de artistas que juntos idealizaram o Projeto Brincantes. Somam habilidades artísticas como pesquisa acerca da cultura afro-brasileira, contação de histórias, brincantes de cultura popular, dança, música, atuação e escrita, sempre envolvendo a temática afro brasileira e a cultura popular.', 'Vivência de brincadeiras populares', null, 'Wil Oliveira · Nathália (Nathy) Monteiro', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('brasil-negreiro', 'Brasil Negreiro: Imaginário em Liberdade', null, null, 'Peça / contação', null, 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('a-cabaca-e-o-canto-ancestral', 'A Cabaça e o Canto Ancestral', null, null, 'Contação de história', null, 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('eu-griot', 'Eu Griot', null, null, 'Contação de história', null, 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('memoria-negra', 'Memória Negra', null, null, 'Contação de história', null, 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('batuque-na-cozinha', 'Batuque na Cozinha', null, null, 'Contação / vivência', null, 'Wil Oliveira', 'Livre', 'Adaptável a qualquer espaço', null, true),
  ('atelie-itinerante', 'Ateliê Afro Cultural Itinerante', 'Projeto de circulação que leva parte do acervo e do conhecimento produzido a outros espaços.', null, 'Projeto de circulação', null, null, 'Livre', 'Adaptável a qualquer espaço', null, true)
on conflict (id) do nothing;

insert into public.clipping (id, tipo, titulo, detalhe, ano, publicado) values
  ('folha-materia', 'midia', 'Folha de S.Paulo', 'Como o menino que era caixa de supermercado criou um ateliê para valorizar a cultura negra', null, true),
  ('globo-caldeirao', 'midia', 'Rede Globo — Caldeirão do Huck', 'Participação em rede nacional', 2021, true),
  ('globo-the-wall', 'midia', 'Rede Globo — The Wall', 'Participação no programa', 2021, true),
  ('sesc-interlagos', 'instituicao', 'SESC Interlagos', null, null, true),
  ('sesc-santo-amaro', 'instituicao', 'SESC Santo Amaro', null, null, true),
  ('fabricas-de-cultura', 'instituicao', 'Fábricas de Cultura', 'Jaçanã', null, true),
  ('casas-de-cultura', 'instituicao', 'Casas de Cultura de São Paulo', 'Inclui a Casa de Cultura São Rafael', null, true),
  ('teatro-adelia-lorenzetti', 'instituicao', 'Teatro Municipal Adélia Lorenzetti', null, null, true),
  ('pracas-da-cultura', 'instituicao', 'Praças da Cultura', 'Subprefeitura Pirituba/Jaraguá', null, true),
  ('espaco-malungo', 'instituicao', 'Espaço Malungo', null, null, true),
  ('ambev-campinas', 'instituicao', 'Ambev', 'Ação de Dia das Crianças, Campinas', 2021, true),
  ('igualdade-racial', 'instituicao', 'Subsecretaria de Igualdade Racial', 'II Festa Preta, Parque Bosque Maia', null, true),
  ('consciencia-negra', 'programacao', 'Mês da Consciência Negra', 'Programação recorrente', null, true),
  ('reexistencia', 'programacao', '(Re)Existência do Povo Negro', 'SESC', null, true)
on conflict (id) do nothing;
