// MODO DEMONSTRAÇÃO: faixa de aviso em todas as páginas e atalhos de login.
import { restaurarDemo, USUARIOS_DEMO } from './dados-demo.js';

const estilo = `
.faixa-demo{position:sticky;top:0;z-index:2000;background:#fff3cd;color:#4f3e10;border-bottom:2px solid #b08a2e;
  font:600 13px/1.35 system-ui,sans-serif;padding:7px 12px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;text-align:center}
.faixa-demo a,.faixa-demo button{font:inherit;color:#1f4e8c;background:none;border:0;text-decoration:underline;cursor:pointer;padding:0}
.demo-acesso{background:#fff8e1;border:1px dashed #b08a2e;border-radius:8px;padding:12px;margin-bottom:14px;font-size:.9rem}
.demo-acesso .botoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
@media print{.faixa-demo{display:none}}`;

export function ativarFaixaDemo() {
  const st = document.createElement('style');
  st.textContent = estilo;
  document.head.append(st);

  const faixa = document.createElement('div');
  faixa.className = 'faixa-demo';
  faixa.setAttribute('role', 'note');
  faixa.innerHTML = '<span>⚠ MODO DEMONSTRAÇÃO — dados fictícios, salvos só neste navegador. Nada é enviado à igreja.</span>';
  const links = document.createElement('span');
  const base = import.meta.env.BASE_URL;
  links.innerHTML = `<a href="${base}">Formulário</a> · <a href="${base}admin/">Painel</a> · `;
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Restaurar dados de exemplo';
  reset.addEventListener('click', () => {
    if (window.confirm('Apagar as alterações feitas nesta demonstração e voltar aos dados de exemplo?')) {
      restaurarDemo();
      location.reload();
    }
  });
  links.append(reset);
  faixa.append(links);
  document.body.prepend(faixa);

  // Atalhos na tela de login
  const form = document.getElementById('form-login');
  if (form) {
    const caixa = document.createElement('div');
    caixa.className = 'demo-acesso';
    caixa.innerHTML = '<strong>Acesso de demonstração</strong><br>Senha: <code>demo1234</code> · Administrador vê tudo (inclusive excluir); Secretaria não exclui.';
    const botoes = document.createElement('div');
    botoes.className = 'botoes';
    for (const u of USUARIOS_DEMO) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn sec peq';
      b.textContent = `Entrar como ${u.papel === 'admin' ? 'Administrador' : 'Secretaria'}`;
      b.addEventListener('click', () => {
        document.getElementById('email').value = u.email;
        document.getElementById('senha').value = u.senha;
        form.requestSubmit();
      });
      botoes.append(b);
    }
    caixa.append(botoes);
    form.prepend(caixa);
  }
}
