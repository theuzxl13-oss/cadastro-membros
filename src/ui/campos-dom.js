// Renderização dos campos da ficha no navegador (formulário público e edição no painel).
import {
  CAMPOS, OPCOES, UFS, mascaraCPF, mascaraCEP, mascaraTelefone, hojeISO,
} from '../shared/campos.js';

export function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) {
    if (f === null || f === undefined || f === false) continue;
    e.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return e;
}

const MASCARAS = { cpf: mascaraCPF, cep: mascaraCEP, telefone: mascaraTelefone };

function aplicarMascara(input, fn) {
  input.addEventListener('input', () => {
    const antes = input.value;
    const novo = fn(antes);
    if (novo !== antes) {
      input.value = novo;
      try { input.setSelectionRange(novo.length, novo.length); } catch { /* campos sem seleção */ }
    }
  });
}

function opcaoSelect(lista, valor, vazio = 'Selecione…') {
  return [el('option', { value: '', text: vazio }), ...lista.map(([v, r]) => el('option', { value: v, text: r, selected: String(valor) === String(v) }))];
}

/**
 * Cria o elemento visual de um campo.
 * @param {object} campo definição em CAMPOS
 * @param {object} ctx { valor, congregacoes, prefixo }
 */
export function criarCampo(campo, ctx = {}) {
  const id = `${ctx.prefixo || 'f'}-${campo.nome}`;
  const valor = ctx.valor ?? campo.padrao ?? '';
  const obrigFixo = campo.obrig === true;
  const classes = ['campo'];
  if (campo.destaque) classes.push('destaque');
  if (campo.tipo === 'longo' || campo.radio || ['nome', 'endereco', 'congregacao_id', 'cargos', 'pai_nome', 'mae_nome', 'conjuge_nome', 'igreja_batismo', 'obreiro_local', 'email'].includes(campo.nome)) classes.push('cheio');

  const wrap = el('div', { class: classes.join(' '), dataset: { campo: campo.nome } });
  const marcaObr = el('span', { class: 'obr', 'aria-hidden': 'true', text: ' *', hidden: !obrigFixo });
  const erroId = `${id}-erro`;
  const dicaId = `${id}-dica`;
  const descr = [campo.dica ? dicaId : null, erroId].filter(Boolean).join(' ');

  let controle;
  if (campo.radio && campo.tipo === 'opcao') {
    const grupo = el('div', { class: 'opcoes', role: 'radiogroup', 'aria-labelledby': `${id}-rot`, 'aria-describedby': descr });
    for (const [v, r] of OPCOES[campo.opcoes]) {
      grupo.append(el('label', {}, el('input', { type: 'radio', name: campo.nome, value: v, checked: String(valor) === v }), r));
    }
    if (!obrigFixo && typeof campo.obrig !== 'function') {
      grupo.append(el('label', {}, el('input', { type: 'radio', name: campo.nome, value: '', checked: !valor }), 'Não se aplica'));
    }
    wrap.append(el('span', { class: 'rot', id: `${id}-rot` }, campo.rotulo, marcaObr), grupo);
    controle = grupo;
  } else {
    const comum = { id, name: campo.nome, 'aria-describedby': descr };
    switch (campo.tipo) {
      case 'congregacao':
        controle = el('select', comum, opcaoSelect((ctx.congregacoes || []).map((c) => [String(c.id), c.ativa === false ? `${c.nome} (inativa)` : c.nome]), valor, 'Selecione a congregação…'));
        break;
      case 'opcao':
        controle = el('select', comum, opcaoSelect(OPCOES[campo.opcoes], valor));
        break;
      case 'uf':
        controle = el('select', comum, opcaoSelect(UFS.map((u) => [u, u]), valor, 'UF'));
        break;
      case 'data':
        controle = el('input', { ...comum, type: 'date', min: '1900-01-01', max: hojeISO(), value: valor, autocomplete: campo.autocomplete || 'off' });
        break;
      case 'cpf':
        controle = el('input', { ...comum, type: 'text', inputmode: 'numeric', placeholder: '000.000.000-00', maxlength: 14, value: mascaraCPF(valor), autocomplete: 'off' });
        break;
      case 'cep':
        controle = el('input', { ...comum, type: 'text', inputmode: 'numeric', placeholder: '00000-000', maxlength: 9, value: mascaraCEP(valor), autocomplete: 'postal-code' });
        break;
      case 'telefone':
        controle = el('input', { ...comum, type: 'tel', inputmode: 'tel', placeholder: campo.nome === 'celular' ? '(11) 90000-0000' : '(11) 0000-0000', maxlength: 15, value: mascaraTelefone(valor), autocomplete: campo.autocomplete || 'off' });
        break;
      case 'email':
        controle = el('input', { ...comum, type: 'email', inputmode: 'email', maxlength: campo.max, value: valor, autocomplete: 'email', placeholder: 'nome@exemplo.com' });
        break;
      case 'longo':
        controle = el('textarea', { ...comum, maxlength: campo.max, rows: 4 });
        controle.value = valor;
        break;
      default:
        controle = el('input', { ...comum, type: 'text', maxlength: campo.max, value: valor, autocomplete: campo.autocomplete || 'off', autocapitalize: ['email'].includes(campo.nome) ? 'off' : 'words' });
    }
    if (MASCARAS[campo.tipo]) aplicarMascara(controle, MASCARAS[campo.tipo]);
    wrap.append(el('label', { for: id }, campo.rotulo, marcaObr), controle);
  }
  if (campo.dica) wrap.append(el('span', { class: 'dica', id: dicaId, text: campo.dica }));
  wrap.append(el('span', { class: 'erro-msg', id: erroId, role: 'alert', hidden: true }));
  return wrap;
}

export function lerValores(raiz) {
  const d = {};
  for (const c of CAMPOS) {
    if (c.radio) {
      const marcado = raiz.querySelector(`input[name="${c.nome}"]:checked`);
      d[c.nome] = marcado ? marcado.value : '';
    } else {
      const e = raiz.querySelector(`[name="${c.nome}"]`);
      d[c.nome] = e ? e.value : '';
    }
  }
  return d;
}

/** Mostra/oculta campos dependentes e ajusta o asterisco dos condicionais. */
export function aplicarRegras(raiz, dados) {
  for (const c of CAMPOS) {
    const w = raiz.querySelector(`.campo[data-campo="${c.nome}"]`);
    if (!w) continue;
    const visivel = c.mostrar ? c.mostrar(dados) : true;
    w.hidden = !visivel;
    if (typeof c.obrig === 'function') {
      const obr = w.querySelector('.obr');
      if (obr) obr.hidden = !c.obrig(dados);
    }
  }
}

export function mostrarErros(raiz, erros, campos = null) {
  let primeiro = null;
  for (const w of raiz.querySelectorAll('.campo[data-campo]')) {
    const nome = w.dataset.campo;
    if (campos && !campos.includes(nome)) continue;
    const msg = erros[nome];
    const span = w.querySelector('.erro-msg');
    w.classList.toggle('invalido', !!msg);
    const ctrl = w.querySelector('input, select, textarea');
    w.querySelectorAll('input, select, textarea').forEach((i) => i.setAttribute('aria-invalid', msg ? 'true' : 'false'));
    if (span) { span.textContent = msg || ''; span.hidden = !msg; }
    if (msg && !primeiro && !w.hidden) primeiro = ctrl;
  }
  return primeiro;
}
