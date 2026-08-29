import '@/estilos/fontes.css';
import '@/estilos/tokens.css';
import '@/estilos/base.css';
import '@/estilos/componentes.css';
import Cabecalho from '@/componentes/Cabecalho';

export const metadata = {
  title: 'Ateliê Afro Cultural',
  description: 'Espaço educativo de criação, reflexão e valorização da cultura e memória afro brasileira, na Casa Verde, zona norte de São Paulo.'
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning aplicado só no <html>: a Tarefa 3 acrescenta o
    // script anti-piscada, que altera atributos deste elemento antes da
    // hidratação. Sem isto, o React acusaria divergência.
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        {/*
          Script classico e sincrono de proposito: um modulo seria adiado e a
          pagina piscaria no tamanho/contraste errado a cada navegacao.
          Duplica a leitura minima do armazenamento pelo mesmo motivo — nao
          pode depender de import. Unico script inline do projeto; a Tarefa 6
          da nonce a ele.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
      var g=localStorage.getItem('aac-preferencias'); if(!g)return;
      var p=JSON.parse(g), e=[87.5,100,112.5,125,137.5];
      if(e.indexOf(p.escala)!==-1)document.documentElement.style.setProperty('--escala-fonte',p.escala+'%');
      if(p.contraste==='alto')document.documentElement.setAttribute('data-contraste','alto');
    }catch(x){}})();`
          }}
        />
        <a className="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>
        <Cabecalho />
        {children}
      </body>
    </html>
  );
}
