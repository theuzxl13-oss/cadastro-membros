import '../styles/base.css';
import '../styles/formulario.css';
import { obterConfig } from './api.js';
import { VERSAO_CONSENTIMENTO } from '../shared/campos.js';

if (__DEMO__) import('../demo/faixa-demo.js').then((m) => m.ativarFaixaDemo());

document.getElementById('versao').textContent = VERSAO_CONSENTIMENTO;

// Preenche com as informações cadastradas pela instituição (nunca inventa dados)
obterConfig().then((c) => {
  const definir = (chave, texto) => {
    if (!texto) return;
    document.querySelectorAll(`[data-cfg="${chave}"]`).forEach((e) => { e.textContent = texto; });
  };
  definir('endereco_sede', c.endereco_sede);
  if (c.encarregado_nome || c.encarregado_contato) {
    const t = [c.encarregado_nome, c.encarregado_contato].filter(Boolean).join(' — ');
    definir('encarregado', t);
    definir('contato-direitos', `fale com o encarregado: ${t}, ou procure a secretaria do Setor 46 na sede`);
  }
}).catch(() => { /* mantém os textos padrão */ });
