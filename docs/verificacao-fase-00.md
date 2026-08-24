# Verificação — Fase 00 (Fundação)

Data: 24/08/2026
Comandos: `npm test` (suíte completa) · `npx @axe-core/cli <url> --browser firefox`

| Verificação | Resultado |
|---|---|
| `node --test` — suíte completa | **29 testes, 29 passando** |
| — lógica de preferências de acessibilidade | 11 passando |
| — mensagens de erro | 7 passando |
| — verificações de navegador (Firefox headless) | 11 passando |
| axe-core em `index.html` | **0 violações** |
| Primeiro Tab alcança "Pular para o conteúdo" | passou |
| Contorno de foco em todo elemento alcançado por Tab (desktop) | passou — 15+ elementos percorridos |
| Contorno de foco em todo elemento alcançado por Tab (celular) | passou |
| Esc fecha o menu e devolve o foco ao botão | passou |
| Escala de fonte de 87,5% a 137,5% | passou |
| Botão inerte no último degrau | passou |
| Preferência preservada ao recarregar, sem piscar | passou |
| Alto contraste inverte fundo e texto e marca o documento | passou |
| Sem rolagem horizontal em 375px | passou |
| Sem rolagem horizontal em 375px na escala máxima | passou |
| Alvos de toque ≥ 44px | passou |

## Achados durante a execução

**O VLibras introduzia três violações de acessibilidade.** O widget recomendado
pelo escopo (seção 3.5) injeta duas imagens sem `alt` e monta seu conteúdo fora
de qualquer landmark. As imagens ficam num shadow root aberto, então um
`querySelector` comum não as alcança. Corrigido por fora, atravessando
`shadowRoot`, em vez de remover o widget — ele tem valor real para pessoas
surdas. De 3 violações para 0.

**O VLibras é servido por CDN de terceiro.** `vlibras.gov.br/app/vlibras-plugin.js`
redireciona para `cdn.jsdelivr.net`. Vale registrar na política de privacidade:
o visitante faz requisição a um domínio que não é do governo nem da ONG.

**O markup `<div vw>` do VLibras é obsoleto.** A versão 7.6.0 do plugin se
monta sozinha; o markup legado apenas criava um landmark duplicado. Removido.

**Nenhum arquivo do material recebido é um logotipo.** As duas imagens com
"Ateliê Afro Cultural" no nome são fotos de Wil Oliveira — uma com fantoches e
uma criança, outra com atabaque e o estandarte da ONG. O logotipo aparece
apenas bordado na camiseta. O cabeçalho usa a marca em tipografia até o vetor
chegar; nenhum símbolo foi inventado.

**A paleta do escopo se confirma na matéria real da ONG.** O estandarte de juta
com franja azul, as cabaças e a camiseta amarela trazem exatamente as três
cores declaradas — amarelo, azul e marrom. A paleta proposta não é preferência
estética da equipe de desenvolvimento.

## Pendências

| Pendência | Decisão | Bloqueia |
|---|---|---|
| **Projeto Supabase na nuvem, região São Paulo** | — | **Fase 02, em 28/08.** Não há Docker nesta máquina, então não existe alternativa local |
| Conta Netlify e conta Brevo | — | Deploy de 03/09 e e-mails da Fase 03 |
| Logotipo em vetor, ou autorização para redesenho | D9 | Identidade visual definitiva |
| Validação da paleta com a ONG | D1 | Nada — os valores atuais seguem o escopo |
| Autorização de uso de imagem das fotos recebidas | RN07 / R10 | Publicar qualquer foto, sobretudo a que mostra uma criança |
| Validação dos textos institucionais e do clipping | seção 18.2 | Publicação do site na Fase 01 |
