'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CampoFormulario } from './CampoFormulario';

/**
 * As duas abas de /entrar ("Entrar" e "Criar conta") — porta a troca de
 * aba de site/assets/js/paginas/entrar.js (trocarAba). Único pedaço
 * interativo desta página que a Tarefa A6 liga de verdade: alternar entre
 * os dois painéis é navegação de tela, não depende de autenticação nem de
 * Server Action nenhuma — diferente do ENVIO dos dois formulários, que
 * fica para o Bloco B (por isso os dois `<form>` abaixo têm todo campo e
 * botão desabilitado, e nenhum `onSubmit`).
 *
 * 'use client' só por causa do estado da aba: app/entrar/page.tsx continua
 * Server Component (export `metadata`), e importa este componente para o
 * pedaço que precisa de interação no navegador — mesma divisão que
 * MenuMovel.tsx já usa para o botão do menu de celular.
 *
 * NÃO PORTADO desta tarefa: validarCadastro/validarEntrada, formatarTelefone
 * (máscara de telefone), cadastrar/entrar/sessaoAtual (site/assets/js/dados/
 * auth.js) e o redirecionamento de quem já tem sessão — tudo isso depende
 * da autenticação real (Bloco B). Also FALTAM description e maioridade não
 * aceitam nenhum evento além de existir na marcação: sem eles no ar,
 * ligar a máscara ou a validação criaria uma sensação de formulário "quase
 * funcionando" pior do que um formulário claramente desligado.
 */
const AVISO_ENTRAR =
  'Criar conta e entrar ainda não estão ativos neste site. Para se candidatar ao voluntariado '
  + 'ou fazer uma doação, fale com a gente pelo WhatsApp (11) 95396-8344 ou pelo e-mail '
  + 'atelieafro@gmail.com.';

export default function AbasEntrar() {
  const [abaAtual, setAbaAtual] = useState<'entrar' | 'criar'>('entrar');

  return (
    <>
      <div className="abas" role="tablist" aria-label="Entrar ou criar conta">
        <button type="button" id="aba-entrar" role="tab" aria-selected={abaAtual === 'entrar'}
                aria-controls="painel-entrar" onClick={() => setAbaAtual('entrar')}>
          Entrar
        </button>{' '}
        <button type="button" id="aba-criar" role="tab" aria-selected={abaAtual === 'criar'}
                aria-controls="painel-criar" onClick={() => setAbaAtual('criar')}>
          Criar conta
        </button>
      </div>

      {/* Aviso permanente — decisão da Tarefa A6, aprovada em separado (ver
          o relatório da tarefa). Diferente do original (div#aviso escondida
          por padrão, mostrada só depois de um erro ou sucesso de envio):
          aqui não há envio nenhum para reagir a, então o aviso fica sempre
          visível, sem `hidden`. */}
      <div id="aviso" className="aviso">
        <p>{AVISO_ENTRAR}</p>
      </div>

      <section id="painel-entrar" role="tabpanel" aria-labelledby="aba-entrar" hidden={abaAtual !== 'entrar'}>
        <form id="form-entrar" className="formulario" noValidate>
          <CampoFormulario nome="email" rotulo="E-mail" tipo="email"
                            autoComplete="email" inputMode="email" obrigatorio desabilitado />

          <CampoFormulario nome="senha" rotulo="Senha" tipo="password"
                            autoComplete="current-password" obrigatorio desabilitado />

          <button type="submit" disabled>Entrar</button>

          <p><Link href="/recuperar-acesso">Esqueci minha senha</Link></p>
        </form>
      </section>

      <section id="painel-criar" role="tabpanel" aria-labelledby="aba-criar" hidden={abaAtual !== 'criar'}>
        <form id="form-criar" className="formulario" noValidate>
          <CampoFormulario nome="nome" rotulo="Nome completo" tipo="text"
                            autoComplete="name" obrigatorio desabilitado />

          <CampoFormulario nome="email" rotulo="E-mail" tipo="email"
                            autoComplete="email" inputMode="email" obrigatorio
                            ajuda="É por aqui que respondemos você." desabilitado />

          <CampoFormulario nome="telefone" rotulo="Telefone" tipo="tel"
                            autoComplete="tel" inputMode="numeric"
                            ajuda="Opcional. Com DDD, como (11) 95396-8344." desabilitado />

          <CampoFormulario nome="senha" rotulo="Senha" tipo="password"
                            autoComplete="new-password" obrigatorio
                            ajuda="Pelo menos 8 caracteres." desabilitado />

          <fieldset className="grupo-campos">
            <legend>Como você quer participar?</legend>
            <CampoFormulario nome="voluntario" rotulo="Quero ser voluntário ou voluntária"
                              tipo="checkbox" desabilitado />
            <CampoFormulario nome="doador" rotulo="Quero doar ou apoiar"
                              tipo="checkbox" desabilitado />
          </fieldset>

          <CampoFormulario nome="maioridade" tipo="checkbox" obrigatorio
                            rotulo="Confirmo que tenho 18 anos ou mais"
                            ajuda="Crianças e adolescentes participam das atividades por inscrição feita por um responsável, sem precisar de conta."
                            desabilitado />

          <CampoFormulario nome="consentimento" tipo="checkbox" obrigatorio
                            rotulo="Concordo com o uso dos meus dados"
                            ajuda="Usamos seu nome, e-mail e telefone apenas para falar com você sobre voluntariado e doações."
                            desabilitado />

          <button type="submit" disabled>Criar conta</button>
        </form>
      </section>
    </>
  );
}
