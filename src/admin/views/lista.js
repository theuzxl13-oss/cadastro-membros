import { el, preencher, carregandoEm, dataHora } from '../util.js';
import { rotulo, mascaraCPF } from '../../shared/campos.js';
import {
  listarCongregacoes, lerFiltros, filtrosParaQuery, aplicarFiltros, controlesFiltro,
} from '../dados.js';

const POR_PAGINA = 25;
const TITULOS = { PENDENTE: 'Cadastros pendentes', APROVADO: 'Cadastros aprovados' };
const ROTA = { PENDENTE: 'pendentes', APROVADO: 'aprovados' };

export async function viewLista({ sb, view, query, atual }, statusFixo) {
  const rota = statusFixo ? ROTA[statusFixo] : 'cadastros';
  const f = lerFiltros(query, statusFixo);
  const pagina = Math.max(1, Number(query.get('p') || 1));
  carregandoEm(view);

  const congregacoes = await listarCongregacoes();
  let consulta = sb.from('cadastros')
    .select('id,protocolo,nome,cpf,cargo,status,created_at,congregacao_id,congregacoes(nome)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  consulta = aplicarFiltros(consulta, f);
  const { data, count, error } = await consulta;
  if (error) throw error;
  if (!atual()) return;

  const irPara = (novos, p = 1) => {
    const filtros = { ...novos };
    if (statusFixo) delete filtros.status;
    location.hash = `#/${rota}${filtrosParaQuery(filtros, p > 1 ? { p: String(p) } : {})}`;
  };

  const filtrosExport = { ...f, status: statusFixo || f.status };
  const filtrosEl = controlesFiltro(f, congregacoes, {
    statusFixo: !!statusFixo,
    aoAplicar: (n) => irPara(n),
    extraAcoes: [el('a', { class: 'btn sec', href: `#/exportacao${filtrosParaQuery(filtrosExport)}`, text: 'Exportar resultado' })],
  });

  const totalPaginas = Math.max(1, Math.ceil((count || 0) / POR_PAGINA));
  const corpo = data.length
    ? el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela responsiva' },
      el('thead', {}, el('tr', {},
        ['Protocolo', 'Nome', 'CPF', 'Congregação', 'Cargo', 'Status', 'Recebido em'].map((t) => el('th', { text: t })))),
      el('tbody', {}, data.map((c) => el('tr', {
        class: 'clicavel',
        tabindex: '0',
        onclick: () => { location.hash = `#/cadastro/${c.id}`; },
        onkeydown: (e) => { if (e.key === 'Enter') location.hash = `#/cadastro/${c.id}`; },
      },
      el('td', { 'data-rot': 'Protocolo', text: c.protocolo }),
      el('td', { 'data-rot': 'Nome' }, el('a', { href: `#/cadastro/${c.id}`, text: c.nome })),
      el('td', { 'data-rot': 'CPF', text: mascaraCPF(c.cpf) }),
      el('td', { 'data-rot': 'Congregação', text: c.congregacoes?.nome || '' }),
      el('td', { 'data-rot': 'Cargo', text: rotulo('cargo', c.cargo) }),
      el('td', { 'data-rot': 'Status' }, el('span', { class: `etiqueta ${c.status}`, text: rotulo('status', c.status) })),
      el('td', { 'data-rot': 'Recebido em', text: dataHora(c.created_at) }))))))
    : el('div', { class: 'card vazio', text: 'Nenhum cadastro encontrado com estes filtros.' });

  preencher(view, 
    el('h1', { text: TITULOS[statusFixo] || 'Todos os cadastros' }),
    filtrosEl,
    corpo,
    el('div', { class: 'paginacao' },
      el('span', { text: `${count || 0} cadastro(s) · página ${pagina} de ${totalPaginas}` }),
      el('div', { class: 'botoes' },
        pagina > 1 ? el('button', { type: 'button', class: 'btn sec peq', text: '← Anterior', onclick: () => irPara(f, pagina - 1) }) : null,
        pagina < totalPaginas ? el('button', { type: 'button', class: 'btn sec peq', text: 'Próxima →', onclick: () => irPara(f, pagina + 1) }) : null)),
  );
}
