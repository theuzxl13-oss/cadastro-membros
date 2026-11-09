import { el } from '../ui/campos-dom.js';

export { el };

export function toast(msg, tipo = '') {
  const t = el('div', { class: `toast ${tipo}`, role: 'status', text: msg });
  document.body.append(t);
  setTimeout(() => t.remove(), 4000);
}

export function dataHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}

export function dataCurta(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/** Abre um diálogo modal e resolve com true (confirmar) ou false. */
export function confirmar({ titulo, corpo, botao = 'Confirmar', tipo = '', validar }) {
  return new Promise((resolve) => {
    const btnOk = el('button', { type: 'button', class: `btn ${tipo}`, text: botao });
    const btnNao = el('button', { type: 'button', class: 'btn sec', text: 'Cancelar' });
    const dlg = el('dialog', { class: 'modal', 'aria-labelledby': 'dlg-titulo' },
      el('div', { class: 'modal-corpo' }, el('h2', { id: 'dlg-titulo', text: titulo }), corpo),
      el('div', { class: 'modal-acoes' }, btnNao, btnOk));
    document.body.append(dlg);
    const fechar = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    if (validar) {
      const atualizar = () => { btnOk.disabled = !validar(); };
      dlg.addEventListener('input', atualizar);
      dlg.addEventListener('change', atualizar);
      atualizar();
    }
    btnOk.addEventListener('click', () => fechar(true));
    btnNao.addEventListener('click', () => fechar(false));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); fechar(false); });
    dlg.showModal();
  });
}

export function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function normalizarBusca(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 \-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function carregandoEm(alvo, texto = 'Carregando…') {
  alvo.replaceChildren(el('div', { class: 'card centro' }, el('span', { class: 'carregando' }), ` ${texto}`));
}

export function erroEm(alvo, msg, tentar) {
  alvo.replaceChildren(el('div', { class: 'alerta erro', role: 'alert' },
    el('p', { text: msg }),
    tentar ? el('button', { type: 'button', class: 'btn sec peq', text: 'Tentar novamente', onclick: tentar }) : null));
}

/** Substitui o conteúdo ignorando itens nulos/falsos (evita textos "null"). */
export function preencher(alvo, ...filhos) {
  alvo.replaceChildren(...filhos.flat().filter((f) => f !== null && f !== undefined && f !== false));
}
