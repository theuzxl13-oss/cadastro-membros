import writeExcelFile from 'write-excel-file/browser';
import {
  el, preencher, carregandoEm, toast, baixarBlob, dataHora,
} from '../util.js';
import { CAMPOS, formatarValor, rotulo } from '../../shared/campos.js';
import {
  listarCongregacoes, lerFiltros, filtrosParaQuery, aplicarFiltros, controlesFiltro,
} from '../dados.js';

const LOTE = 1000;

function colunas(congregacoes) {
  return [
    ['Protocolo', (c) => c.protocolo],
    ['Status', (c) => rotulo('status', c.status)],
    ['Recebido em', (c) => dataHora(c.created_at)],
    ['Aprovado em', (c) => dataHora(c.aprovado_em)],
    ...CAMPOS.map((campo) => [campo.rotulo, (c) => formatarValor(campo, c[campo.nome], congregacoes)]),
    ['Consentimento LGPD em', (c) => dataHora(c.consentimento_em)],
    ['Consentimento pelo responsável', (c) => (c.consentimento_responsavel ? 'Sim' : 'Não')],
  ];
}

// Evita injeção de fórmulas ao abrir o CSV no Excel
function seguro(v) {
  const s = String(v ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function gerarCSV(linhas, cols) {
  const q = (s) => `"${seguro(s).replace(/"/g, '""')}"`;
  const cab = cols.map(([t]) => q(t)).join(';');
  const corpo = linhas.map((c) => cols.map(([, f]) => q(f(c))).join(';'));
  return new Blob([`﻿${[cab, ...corpo].join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
}

async function buscarTodos(sb, f) {
  const todos = [];
  for (let de = 0; ; de += LOTE) {
    let q = sb.from('cadastros').select('*').order('created_at', { ascending: true }).range(de, de + LOTE - 1);
    q = aplicarFiltros(q, f);
    const { data, error } = await q;
    if (error) throw error;
    todos.push(...data);
    if (data.length < LOTE) break;
  }
  return todos;
}

export async function viewExportacao({ sb, view, query, atual }) {
  carregandoEm(view);
  const f = lerFiltros(query);
  const congregacoes = await listarCongregacoes();
  const { count, error } = await aplicarFiltros(sb.from('cadastros').select('id', { count: 'exact', head: true }), f);
  if (error) throw error;
  if (!atual()) return;

  const status = el('p', { class: 'dica', 'aria-live': 'polite' });
  const exportar = (formato) => async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    status.textContent = 'Preparando arquivo…';
    try {
      const linhas = await buscarTodos(sb, f);
      if (!linhas.length) { toast('Nenhum cadastro para exportar com estes filtros.', 'erro'); status.textContent = ''; return; }
      const cols = colunas(congregacoes);
      const data = new Date().toISOString().slice(0, 10);
      const nome = `cadastros-setor46-${data}`;
      if (formato === 'csv') {
        baixarBlob(gerarCSV(linhas, cols), `${nome}.csv`);
      } else {
        const planilha = [
          cols.map(([t]) => ({ value: t, fontWeight: 'bold', backgroundColor: '#E4DCB9' })),
          ...linhas.map((c) => cols.map(([, fn]) => ({ value: String(fn(c) ?? ''), type: String }))),
        ];
        const blob = await writeExcelFile(planilha, { columns: cols.map(() => ({ width: 22 })), stickyRowsCount: 1 }).toBlob();
        baixarBlob(blob, `${nome}.xlsx`);
      }
      await sb.rpc('admin_registrar_acao', {
        p_acao: formato === 'csv' ? 'exportacao_csv' : 'exportacao_excel',
        p_detalhes: { registros: linhas.length, filtros: { ...f, q: f.q ? '(busca)' : '' } },
      });
      status.textContent = `${linhas.length} cadastro(s) exportado(s).`;
    } catch (err) {
      status.textContent = '';
      toast(`Falha na exportação: ${err.message || err}`, 'erro');
    } finally {
      b.disabled = false;
    }
  };

  preencher(view, 
    el('h1', { text: 'Exportação' }),
    el('p', { text: 'Escolha os filtros e o formato. A exportação respeita exatamente os filtros aplicados.' }),
    controlesFiltro(f, congregacoes, { aoAplicar: (n) => { location.hash = `#/exportacao${filtrosParaQuery(n)}`; } }),
    el('div', { class: 'card' },
      el('h2', {}, `${count || 0} cadastro(s) serão exportados`),
      el('div', { class: 'botoes' },
        el('button', { type: 'button', class: 'btn', text: 'Baixar CSV', onclick: exportar('csv') }),
        el('button', { type: 'button', class: 'btn ouro', text: 'Baixar Excel (.xlsx)', onclick: exportar('xlsx') })),
      status,
      el('div', { class: 'alerta info', style: 'margin-top:12px' },
        'Os arquivos contêm dados pessoais e sensíveis (LGPD). Guarde-os em local seguro, não os envie por grupos de mensagens e apague as cópias quando não forem mais necessárias. Toda exportação fica registrada na auditoria.')),
  );
}
