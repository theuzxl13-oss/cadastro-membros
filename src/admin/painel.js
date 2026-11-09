import { caminho } from '../ui/caminho.js';
import '../styles/base.css';
import '../styles/admin.css';
import '../styles/impressao.css';
import { sb, configurado, adminAtual } from './supabase.js';
import { el, erroEm } from './util.js';
import { viewDashboard } from './views/dashboard.js';
import { viewLista } from './views/lista.js';
import { viewFicha } from './views/ficha.js';
import { viewCongregacoes } from './views/congregacoes.js';
import { viewQRCode } from './views/qrcode.js';
import { viewExportacao } from './views/exportacao.js';
import { viewConfiguracoes } from './views/configuracoes.js';

if (__DEMO__) import('../demo/faixa-demo.js').then((m) => m.ativarFaixaDemo());

const INATIVIDADE_MS = 30 * 60 * 1000;
const $ = (s) => document.querySelector(s);
const view = $('#view');
let admin = null;
let renderId = 0;

const ROTAS = {
  dashboard: (c) => viewDashboard(c),
  cadastros: (c) => viewLista(c, null),
  pendentes: (c) => viewLista(c, 'PENDENTE'),
  aprovados: (c) => viewLista(c, 'APROVADO'),
  cadastro: (c) => viewFicha(c),
  congregacoes: (c) => viewCongregacoes(c),
  qrcode: (c) => viewQRCode(c),
  exportacao: (c) => viewExportacao(c),
  configuracoes: (c) => viewConfiguracoes(c),
};

async function sair(motivo = 'saiu') {
  try {
    if (motivo === 'saiu') await sb.rpc('admin_registrar_acao', { p_acao: 'logout' });
  } catch { /* segue com o logout */ }
  await sb.auth.signOut().catch(() => {});
  sessionStorage.clear();
  location.replace(caminho(`admin/?motivo=${motivo}`));
}

function lerRota() {
  const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [caminho, qs] = h.split('?');
  const partes = caminho.split('/').filter(Boolean);
  return { nome: partes[0] || 'dashboard', params: partes.slice(1), query: new URLSearchParams(qs || '') };
}

export function navegar(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

export async function atualizarContadorPendentes() {
  const { count } = await sb.from('cadastros').select('id', { count: 'exact', head: true }).eq('status', 'PENDENTE');
  const c = $('#cont-pendentes');
  c.hidden = !count;
  c.textContent = count ? String(count) : '';
}

async function render() {
  const id = ++renderId;
  const rota = lerRota();
  const fn = ROTAS[rota.nome];
  document.querySelectorAll('.menu a').forEach((a) => {
    const ativa = a.dataset.rota === rota.nome || (rota.nome === 'cadastro' && a.dataset.rota === 'cadastros');
    a.classList.toggle('ativo', ativa);
    if (ativa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  fecharMenu();
  if (!fn) { navegar('#/dashboard'); return; }
  // Revalida a sessão a cada navegação
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { sair('sessao-expirada'); return; }
  try {
    await fn({
      sb, admin, view, params: rota.params, query: rota.query, navegar, atualizarPendentes: atualizarContadorPendentes, atual: () => id === renderId,
    });
    view.focus({ preventScroll: true });
  } catch (e) {
    console.error(e);
    if (id === renderId) erroEm(view, `Não foi possível carregar esta tela: ${e.message || e}`, render);
  }
}

// Menu móvel
function fecharMenu() {
  $('#lateral').classList.remove('aberta');
  $('#veu').hidden = true;
  $('#btn-menu').setAttribute('aria-expanded', 'false');
}
$('#btn-menu').addEventListener('click', () => {
  $('#lateral').classList.add('aberta');
  $('#veu').hidden = false;
  $('#btn-menu').setAttribute('aria-expanded', 'true');
});
$('#veu').addEventListener('click', fecharMenu);
$('#btn-sair').addEventListener('click', () => sair('saiu'));

// Encerramento por inatividade
let timer;
function reiniciarTimer() {
  clearTimeout(timer);
  timer = setTimeout(() => sair('sessao-expirada'), INATIVIDADE_MS);
}
['click', 'keydown', 'pointermove', 'scroll', 'touchstart'].forEach((ev) => window.addEventListener(ev, reiniciarTimer, { passive: true }));

async function iniciar() {
  if (!configurado) {
    $('#verificando').textContent = 'Painel não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).';
    return;
  }
  admin = await adminAtual();
  if (!admin) {
    const { data: { session } } = await sb.auth.getSession();
    if (session) { await sb.auth.signOut(); location.replace(caminho('admin/?motivo=sem-permissao')); } else location.replace(caminho('admin/'));
    return;
  }
  sb.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT') location.replace(caminho('admin/?motivo=sessao-expirada'));
  });
  $('#usuario').replaceChildren(
    el('strong', { text: admin.nome }),
    el('span', { text: admin.email }),
    el('br'),
    el('span', { text: admin.papel === 'admin' ? 'Administrador' : 'Secretaria' }),
  );
  $('#verificando').hidden = true;
  $('#app').hidden = false;
  reiniciarTimer();
  window.addEventListener('hashchange', render);
  atualizarContadorPendentes().catch(() => {});
  render();
}

iniciar();
