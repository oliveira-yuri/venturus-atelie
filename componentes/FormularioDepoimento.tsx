'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { enviarDepoimento } from '@/acoes/depoimento';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { CampoFormulario } from './CampoFormulario';

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

/**
 * Formulário de depoimento. Funciona sem JavaScript (POST de Server Action),
 * como o de contato. Duas declarações obrigatórias — adulto/responsável e
 * autorização de publicar — vêm ANTES do botão, em caixas separadas: juntar
 * as duas numa só faria um "marcar tudo" valer como duas decisões.
 */
export default function FormularioDepoimento() {
  const [estado, enviar, enviando] = useActionState(enviarDepoimento, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  useEffect(() => {
    if (!jaRenderizou.current) { jaRenderizou.current = true; return; }
    if (estado.ok || !estado.mensagem) return;
    const alvo = formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? document.getElementById('aviso-formulario');
    alvo?.focus();
  }, [estado]);

  const valor = (nome: string) => estado.valores?.[nome] ?? '';

  return (
    <>
      <div id="aviso-formulario" className={estado.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'}
           role="alert" tabIndex={-1} hidden={!estado.mensagem}>
        <p>{estado.mensagem}</p>
      </div>

      <form ref={formulario} id="form-depoimento" className="formulario" action={enviar}
            noValidate aria-describedby="aviso-formulario">
        <CampoFormulario nome="nome" rotulo="Seu nome" tipo="text" obrigatorio
                         autoComplete="name"
                         ajuda="É o nome que aparece junto do depoimento. Pode ser só o primeiro."
                         erro={estado.erros?.nome} valorInicial={valor('nome')} />

        <CampoFormulario nome="atividade" rotulo="Atividade de que participou" tipo="text"
                         ajuda="Opcional. Por exemplo: a oficina, a contação, a vivência."
                         erro={estado.erros?.atividade} valorInicial={valor('atividade')} />

        <CampoFormulario nome="texto" rotulo="Seu depoimento" tipo="textarea" obrigatorio
                         ajuda="Conte como foi. Não tem forma certa."
                         erro={estado.erros?.texto} valorInicial={valor('texto')} />

        <CampoFormulario nome="declara_adulto"
                         rotulo="Tenho 18 anos ou mais, ou escrevo como responsável por quem participou."
                         tipo="checkbox" obrigatorio
                         erro={estado.erros?.declara_adulto} valorInicial={valor('declara_adulto')} />

        <p className="campo__ajuda">
          Depoimentos de crianças e adolescentes só entram escritos por um responsável. Não
          escrevemos o nome completo nem a escola de ninguém menor de 18 anos.
        </p>

        <CampoFormulario nome="autoriza_publicacao"
                         rotulo="Autorizo o Ateliê a publicar este texto e o nome acima no site."
                         tipo="checkbox" obrigatorio
                         erro={estado.erros?.autoriza_publicacao} valorInicial={valor('autoriza_publicacao')} />

        <p className="campo__ajuda">
          Nada vai ao ar sem a equipe ler e aprovar. Para retirar um depoimento depois, escreva
          para <a href="mailto:atelieafro@gmail.com">atelieafro@gmail.com</a>. Mais em{' '}
          <Link href="/privacidade">política de privacidade</Link>.
        </p>

        <button type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar depoimento'}</button>
      </form>
    </>
  );
}
