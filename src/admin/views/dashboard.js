import { el, preencher, carregandoEm, dataHora } from '../util.js';
import { rotulo, hojeISO } from '../../shared/campos.js';

export async function viewDashboard({ sb, view, atual }) {
  carregandoEm(view);
  const [{ data: r, error }, { data: recentes, error: e2 }] = await Promise.all([
    sb.rpc('dashboard_resumo'),
    sb.from('cadastros').select('id,protocolo,nome,cargo,created_at,congregacoes(nome)')
      .eq('status', 'PENDENTE').order('created_at', { ascending: false }).limit(6),
  ]);
  if (error) throw error;
  if (e2) throw e2;
  if (!atual()) return;

  const ind = (cls, num, rot, href) => el('a', { class: `indicador ${cls}`, href },
    el('div', { class: 'num', text: String(num) }), el('div', { class: 'rot', text: rot }));

  const linhas = r.por_congregacao.map((g) => {
    const total = g.total || 0;
    const pa = total ? (g.aprovados / total) * 100 : 0;
    const pp = total ? (g.pendentes / total) * 100 : 0;
    return el('tr', { class: 'clicavel', onclick: () => { location.hash = `#/cadastros?congregacao=${g.id}`; } },
      el('td', { 'data-rot': 'Congregação' }, g.nome, g.ativa ? null : el('span', { class: 'etiqueta inativa', text: ' inativa' })),
      el('td', { class: 'num', 'data-rot': 'Total' }, el('strong', { text: String(total) })),
      el('td', { class: 'num', 'data-rot': 'Pendentes', text: String(g.pendentes) }),
      el('td', { class: 'num', 'data-rot': 'Aprovados', text: String(g.aprovados) }),
      el('td', { 'data-rot': 'Distribuição' },
        el('div', { class: 'barra-dist', title: `${g.aprovados} aprovados, ${g.pendentes} pendentes` },
          el('span', { class: 'a', style: `width:${pa}%` }), el('span', { class: 'p', style: `width:${pp}%` }))));
  });

  preencher(view, 
    el('h1', { text: 'Dashboard' }),
    el('div', { class: 'indicadores' },
      ind('', r.total, 'Total de cadastros', '#/cadastros'),
      ind('pend', r.pendentes, 'Pendentes', '#/pendentes'),
      ind('apr', r.aprovados, 'Aprovados', '#/aprovados'),
      ind('mes', r.mes_atual, 'Recebidos neste mês', `#/cadastros?de=${hojeISO().slice(0, 8)}01`)),
    el('section', { class: 'secao' },
      el('h2', { text: 'Distribuição por congregação' }),
      linhas.length
        ? el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela responsiva' },
          el('thead', {}, el('tr', {}, el('th', { text: 'Congregação' }), el('th', { class: 'num', text: 'Total' }), el('th', { class: 'num', text: 'Pendentes' }), el('th', { class: 'num', text: 'Aprovados' }), el('th', { text: 'Aprovados / pendentes' }))),
          el('tbody', {}, linhas)))
        : el('div', { class: 'card vazio' }, 'Nenhuma congregação cadastrada. ', el('a', { href: '#/congregacoes', text: 'Cadastrar congregações' }))),
    el('section', { class: 'secao' },
      el('h2', { text: 'Últimas fichas pendentes' }),
      recentes.length
        ? el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela responsiva' },
          el('tbody', {}, recentes.map((c) => el('tr', { class: 'clicavel', onclick: () => { location.hash = `#/cadastro/${c.id}`; } },
            el('td', { 'data-rot': 'Protocolo', text: c.protocolo }),
            el('td', { 'data-rot': 'Nome' }, el('strong', { text: c.nome })),
            el('td', { 'data-rot': 'Congregação', text: c.congregacoes?.nome || '' }),
            el('td', { 'data-rot': 'Cargo', text: rotulo('cargo', c.cargo) }),
            el('td', { 'data-rot': 'Recebido', text: dataHora(c.created_at) }))))))
        : el('div', { class: 'card vazio', text: 'Nenhuma ficha pendente. 🎉' })),
  );
}
