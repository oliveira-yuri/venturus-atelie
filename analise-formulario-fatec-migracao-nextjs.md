# Análise do `migracao-nextjs` contra o formulário da ONG

**Base:** formulário de levantamento enviado à FATEC × branch `migracao-nextjs` (commit `2e47c0d`, 03/09/2026)
**Data da análise:** 06/10/2026

**Resumo: o branch atende muito bem ao que a ONG pediu.** Pelo próprio levantamento do projeto
(`ferramentas/entrega/dados.mjs`), são **33 de 39 requisitos funcionais prontos**, nenhum por começar, e
os três indispensáveis do formulário funcionam. Os problemas que sobram estão em três lugares: o que ainda
impede o lançamento, os relatórios que não medem o que a ONG pediu e algumas partes do documento de
entrega que ficaram desatualizadas.

---

## 1. Fazemos bem feito o básico?

### Sim, e com folga

| Pedido do formulário | Situação no branch |
|---|---|
| Indispensáveis: *"cadastro de doadores, agenda de eventos, área de voluntariado"* | Cadastro funciona. A agenda tem criação de evento, inscrição sem conta e lista de presença (RF13–RF17). O voluntariado tem candidatura e gestão com filtro (RF25, RF26). |
| *"Já perdemos apoio no Caldeirão do Huck por falta de estrutura"* | O formulário de contato cai numa fila com andamento (nova → em contato → concluída), no RF07 + RF29. É a resposta direta a essa dor. |
| Comunicação interna (*"chat, mensagens, e-mail?"*) | Mural de avisos e e-mail para grupos via Resend, medido em produção (RF27, RF28). |
| Divulgação de notícias, campanhas e resultados | Notícias e galeria com página própria, capa e edição pelo painel. |
| A ONG não tem computador | Todo o painel funciona no celular. A lista de presença foi pensada para usar de pé no evento: sem paginação e sem dado sensível na tela. |
| Acessibilidade e contato | VLibras, controles de fonte e contraste, os cinco canais de contato e o botão de WhatsApp sem cobrir o VLibras. |
| Logotipo | Foi extraído do próprio PDF da ONG e já está no rodapé. |

### Onde dá para melhorar

1. **Relatórios não medem o que a ONG pediu.** Os "seis indicadores" do RF30
   (`servidor/dados/indicadores.ts`) são filas de trabalho: mensagens esperando, candidaturas esperando,
   notícias em rascunho, fotos fora do ar e coisas assim. A ONG pediu outra coisa: *"número de atendidos,
   valores, novos parceiros, atividades realizadas no mês, trimestre ou semestre"*. Não existe filtro por
   período, e não há contagem de crianças nem de doações recebidas. **É o ponto em que o "pronto" está
   mais exagerado.**
2. **O site novo nunca foi publicado na Netlify** (item 0 do `CLAUDE.md`). Pelas URLs de redirect
   cadastradas, parece haver um deploy na Vercel (`www.atelieafrocultural.site`), mas a `main` ainda é a
   versão antiga. O PR #3 resolve isso no lado do código.
3. **Antes do lançamento, ainda falta:**
   - tirar o `noindex`, que está em quatro lugares diferentes (item 0c);
   - apagar contas e registros de teste do banco de produção (itens 0m, 0o, 0q);
   - trocar a chave Pix de teste, `chaveteste-123` (item 0u, decisão D7);
   - rotacionar a chave do Supabase, que ficou no histórico do git (item 0b);
   - publicar os dois eventos, que estão como não publicados. Hoje `/agenda` aparece vazia, e é nela que
     fica o botão de inscrição, a funcionalidade mais vistosa do projeto.
4. **Segurança e LGPD:**
   - trocar a senha não pede a senha atual (item 0p);
   - a privacidade promete exclusão de dados a pedido, mas só dá para fazer isso direto no SQL (item 0n);
   - sem JavaScript, uma tela de erro ou de 404 em tempo de execução aparece em branco (item 0f).
5. **O documento de entrega se contradiz.** O `dados.mjs` diz que a migration 008 "NÃO foi aplicada" e que
   o acervo está "vazio". O `CLAUDE.md` e o último commit dizem que a 008 foi aplicada e que o acervo tem
   conteúdo real. Como é isso que a banca vai ler, vale corrigir.
6. **Treinamento presencial (RNF07):** o manual existe, mas ninguém da ONG usou o painel ainda. O próprio
   projeto registra três defeitos que passaram por mais de 1.200 testes verdes e só apareceram quando
   alguém usou o painel de verdade.

---

## 2. Deixamos passar algo? Atendemos os requisitos?

**Nos requisitos, atendemos.** O que ficou de fora:

- **O sonho (biblioteca digital):** a estrutura está entregue, com catálogo, busca, visualização, download
  e publicação pelo celular (RF35–RF37). Falta encher a prateleira. O acervo tratado (27 MB) está no
  repositório, então subir esse material é trabalho de horas e transforma o sonho em algo que dá para
  mostrar na apresentação.
- **Critérios de sucesso que o formulário cita e o sistema não mede (§9):**
  - *"crescimento no número de crianças inscritas"*: o campo `eh_menor` existe em toda inscrição, mas
    nenhum indicador o usa;
  - *"depoimentos e avaliações de crianças, responsáveis e educadores"*: não há nada para coletar
    depoimentos;
  - *"acesso ao site"*: não há nenhuma medição de visitas;
  - *"aumento de escolas"*: as solicitações de escolas chegam como contato genérico, sem identificação.
- **Parcerias com empresas, a dor nº 2 da ONG:** "Para escolas" tem página própria, mas empresas e
  patrocinadores não têm. O assistente com IA que a ONG pediu servia justamente para *"orientar
  patrocinadores sobre como apoiar"*, e nada no site cumpre esse papel hoje.
- **Fora de escopo, com justificativa:** assistente com IA, versão em inglês, vídeo na galeria, gateway de
  pagamento e painel com gráficos. Tudo bem, desde que isso seja dito à ONG na entrega e não fique só no
  plano.

---

## 3. Diferenciais baratos (custo de operação perto de zero)

O que o branch já tem deixa cada item abaixo pequeno:

| # | Diferencial | Para que serve | Custo |
|---|---|---|---|
| 1 | **Relatório por período** (mês, trimestre, semestre) com atividades, inscritos, **crianças atendidas** (`eh_menor`), presentes, novos voluntários, doações e valores | Atende ao pedido literal da ONG e serve para editais e prestação de contas | Só consultas no banco, que já existe |
| 2 | **Prévia no WhatsApp:** Open Graph via `metadata` do Next, `sitemap.ts` e JSON-LD de Event | Hoje nenhum link compartilhado mostra imagem nem título, e o WhatsApp é o canal principal da ONG | Zero; é recurso nativo do Next |
| 3 | **Botão "Compartilhar"** (`navigator.share`, com `wa.me` como reserva) em evento, notícia e material do acervo | Cada participante passa a divulgar | Zero |
| 4 | **"Adicionar à agenda" (`.ics`)** nos eventos | Mais gente comparece, e o indicador de presença melhora | Uma rota simples |
| 5 | **Botão "Ouvir esta página"** com a voz do próprio navegador (Web Speech API) | O formulário pede *"áudio"* com essa palavra. Ajuda crianças em alfabetização e pessoas com baixa visão | Zero, sem servidor |
| 6 | **QR Code Pix de verdade** (padrão BR Code, gerado no código) quando a chave real existir | Troca o QR falso por um que funciona, sem gateway e sem taxa | Zero |
| 7 | **Depoimentos com moderação:** formulário após o evento, só para adultos e responsáveis, publicado depois de a equipe aprovar | Cobre um critério de sucesso que a própria ONG escreveu | Uma tabela com RLS |
| 8 | **Página "Para empresas e apoiadores"**, no molde de "Para escolas": o que já fizemos, mídia e como apoiar | Ataca a dor nº 2 | Só conteúdo |
| 9 | **Contagem de visitas sem cookies** (Vercel ou Netlify Analytics, Cloudflare ou GoatCounter) | Responde ao "acesso ao site" sem precisar de aviso de cookies pela LGPD | Gratuito |
| 10 | **Perguntas frequentes com busca** | Faz 80% do papel do assistente com IA, sem custo recorrente e sem risco com o público infantil. Se um dia vier a IA, esse conteúdo vira a base dela | Só conteúdo |
| 11 | **Painel instalável no celular** (manifest do Next) | Para a equipe, o painel passa a parecer um aplicativo | Zero |
| 12 | **Uma página "About us" em inglês** | Atende o "inglês se possível" sem dobrar a manutenção | Uma página |

### Ordem sugerida

1. **Para o lançamento (horas):** limpar os dados de teste, publicar os eventos, subir o acervo, corrigir o
   `dados.mjs` e decidir o `noindex`.
2. **Para a banca (1–2 dias):** itens 1, 2, 3 e 5. São os que mais ligam o site ao que a ONG escreveu no
   formulário.
3. **Depois:** itens 6 (quando houver chave Pix), 7, 8 e 10.
