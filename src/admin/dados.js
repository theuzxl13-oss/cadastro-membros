// Acesso a dados do painel (sempre sob RLS do usuário logado).
import { sb, BUCKET } from './supabase.js';
import { OPCOES, soDigitos } from '../shared/campos.js';
import { normalizarBusca, el } from './util.js';

let cacheCongregacoes = null;

export async function listarCongregacoes(forcar = false) {
  if (cacheCongregacoes && !forcar) return cacheCongregacoes;
  const { data, error } = await sb.from('congregacoes').select('id,nome,endereco,cidade,dirigente,ativa,created_at,updated_at').order('nome');
  if (error) throw error;
  cacheCongregacoes = data;
  return data;
}
export function limparCacheCongregacoes() { cacheCongregacoes = null; }

/** Filtros aceitos: q, congregacao, cargo, status, de, ate */
export function lerFiltros(query, statusFixo = null) {
  return {
    q: query.get('q') || '',
    congregacao: query.get('congregacao') || '',
    cargo: query.get('cargo') || '',
    status: statusFixo || query.get('status') || '',
    de: query.get('de') || '',
    ate: query.get('ate') || '',
  };
}

export function filtrosParaQuery(f, extra = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

function proximoDia(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function aplicarFiltros(consulta, f) {
  let c = consulta;
  const q = (f.q || '').trim();
  if (q) {
    const digitos = soDigitos(q);
    if (/^S46-/i.test(q)) {
      c = c.ilike('protocolo', `%${q.toUpperCase().replace(/[^A-Z0-9-]/g, '')}%`);
    } else if (digitos.length >= 3 && digitos.length === q.replace(/[.\-\s]/g, '').length) {
      c = c.like('cpf', `%${digitos}%`);
    } else {
      const n = normalizarBusca(q);
      if (n) c = c.ilike('nome_busca', `%${n.replace(/ /g, '%')}%`);
    }
  }
  if (f.congregacao) c = c.eq('congregacao_id', Number(f.congregacao));
  if (f.cargo && OPCOES.cargo.some(([v]) => v === f.cargo)) c = c.eq('cargo', f.cargo);
  if (f.status === 'PENDENTE' || f.status === 'APROVADO') c = c.eq('status', f.status);
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.de)) c = c.gte('created_at', `${f.de}T00:00:00-03:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.ate)) c = c.lt('created_at', `${proximoDia(f.ate)}T00:00:00-03:00`);
  return c;
}

export async function urlFoto(caminho, segundos = 300) {
  if (!caminho) return null;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(caminho, segundos);
  if (error) return null;
  return data.signedUrl;
}

/** Baixa a foto como blob local (útil para impressão e para não reutilizar URL). */
export async function blobFoto(caminho) {
  if (!caminho) return null;
  const { data, error } = await sb.storage.from(BUCKET).download(caminho);
  if (error) return null;
  return data;
}

/** Monta os controles de filtro (busca, congregação, cargo, status, período). */
export function controlesFiltro(f, congregacoes, { statusFixo = false, aoAplicar, extraAcoes = [] }) {
  const sel = (nome, rot, opcoes, valor) => el('div', { class: 'campo' },
    el('label', { for: `fl-${nome}`, text: rot }),
    el('select', { id: `fl-${nome}`, name: nome },
      el('option', { value: '', text: 'Todos' }),
      ...opcoes.map(([v, r]) => el('option', { value: v, text: r, selected: String(valor) === String(v) }))));
  const form = el('form', { class: 'filtros card', role: 'search' },
    el('div', { class: 'campo' },
      el('label', { for: 'fl-q', text: 'Buscar por nome, CPF ou protocolo' }),
      el('input', { type: 'search', id: 'fl-q', name: 'q', value: f.q, placeholder: 'Ex.: Maria ou 123.456', autocomplete: 'off' })),
    sel('congregacao', 'Congregação', congregacoes.map((c) => [String(c.id), c.ativa ? c.nome : `${c.nome} (inativa)`]), f.congregacao),
    sel('cargo', 'Cargo', OPCOES.cargo, f.cargo),
    statusFixo ? null : sel('status', 'Status', OPCOES.status, f.status),
    el('div', { class: 'campo' }, el('label', { for: 'fl-de', text: 'Recebidos de' }), el('input', { type: 'date', id: 'fl-de', name: 'de', value: f.de })),
    el('div', { class: 'campo' }, el('label', { for: 'fl-ate', text: 'até' }), el('input', { type: 'date', id: 'fl-ate', name: 'ate', value: f.ate })),
    el('div', { class: 'acoes' },
      el('button', { type: 'submit', class: 'btn', text: 'Filtrar' }),
      el('button', { type: 'button', class: 'btn sec', text: 'Limpar', onclick: () => aoAplicar({ q: '', congregacao: '', cargo: '', status: '', de: '', ate: '' }) }),
      ...extraAcoes));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    aoAplicar({
      q: String(fd.get('q') || ''),
      congregacao: String(fd.get('congregacao') || ''),
      cargo: String(fd.get('cargo') || ''),
      status: statusFixo ? '' : String(fd.get('status') || ''),
      de: String(fd.get('de') || ''),
      ate: String(fd.get('ate') || ''),
    });
  });
  return form;
}
