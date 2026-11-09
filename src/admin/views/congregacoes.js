import {
  el, preencher, carregandoEm, toast, confirmar, dataCurta,
} from '../util.js';
import { listarCongregacoes, limparCacheCongregacoes } from '../dados.js';
import { mensagemErro } from '../supabase.js';

function campoTexto(id, rot, valor, attrs = {}) {
  return el('div', { class: 'campo' }, el('label', { for: id, text: rot }), el('input', { type: 'text', id, value: valor || '', ...attrs }));
}

async function editarCongregacao(ctx, g) {
  const nome = campoTexto('cg-nome', 'Nome da congregação *', g?.nome, { maxlength: 120, required: true });
  const cidade = campoTexto('cg-cidade', 'Cidade', g?.cidade, { maxlength: 80 });
  const endereco = campoTexto('cg-end', 'Endereço', g?.endereco, { maxlength: 200 });
  const dirigente = campoTexto('cg-dir', 'Dirigente', g?.dirigente, { maxlength: 120 });
  const valor = (w) => w.querySelector('input').value.trim();
  const ok = await confirmar({
    titulo: g ? 'Editar congregação' : 'Nova congregação',
    corpo: el('div', {}, nome, cidade, endereco, dirigente),
    botao: 'Salvar',
    validar: () => valor(nome).length >= 2,
  });
  if (!ok) return;
  const dados = {
    nome: valor(nome), cidade: valor(cidade) || null, endereco: valor(endereco) || null, dirigente: valor(dirigente) || null,
  };
  if (/[<>]/.test(Object.values(dados).join(''))) { toast('Não use os caracteres < ou >.', 'erro'); return; }
  const { error } = g
    ? await ctx.sb.from('congregacoes').update(dados).eq('id', g.id)
    : await ctx.sb.from('congregacoes').insert(dados);
  if (error) { toast(mensagemErro(error), 'erro'); return; }
  toast('Congregação salva.');
  limparCacheCongregacoes();
  ctx.navegar('#/congregacoes');
}

async function alternar(ctx, g) {
  const desativar = g.ativa;
  const ok = await confirmar({
    titulo: desativar ? 'Desativar congregação?' : 'Reativar congregação?',
    corpo: el('p', {
      text: desativar
        ? `"${g.nome}" deixará de aparecer no formulário público. Os cadastros já existentes continuam preservados.`
        : `"${g.nome}" voltará a aparecer no formulário público.`,
    }),
    botao: desativar ? 'Desativar' : 'Reativar',
    tipo: desativar ? 'perigo' : 'ok',
  });
  if (!ok) return;
  const { error } = await ctx.sb.from('congregacoes').update({ ativa: !g.ativa }).eq('id', g.id);
  if (error) { toast(mensagemErro(error), 'erro'); return; }
  toast(desativar ? 'Congregação desativada.' : 'Congregação reativada.');
  limparCacheCongregacoes();
  ctx.navegar('#/congregacoes');
}

export async function viewCongregacoes(ctx) {
  const { sb, view, atual } = ctx;
  carregandoEm(view);
  const [lista, { data: resumo, error }] = await Promise.all([listarCongregacoes(true), sb.rpc('dashboard_resumo')]);
  if (error) throw error;
  if (!atual()) return;
  const totais = Object.fromEntries((resumo.por_congregacao || []).map((g) => [g.id, g.total]));
  const ativas = lista.filter((g) => g.ativa).length;

  preencher(view, 
    el('h1', {}, 'Congregações', el('button', { type: 'button', class: 'btn ouro', text: '+ Nova congregação', onclick: () => editarCongregacao(ctx, null) })),
    el('p', { class: 'dica', text: `${ativas} ativa(s) de ${lista.length}. Somente as ativas aparecem no formulário público.` }),
    lista.length
      ? el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela responsiva' },
        el('thead', {}, el('tr', {}, ['Nome', 'Cidade', 'Dirigente', 'Cadastros', 'Situação', 'Ações'].map((t) => el('th', { text: t })))),
        el('tbody', {}, lista.map((g) => el('tr', {},
          el('td', { 'data-rot': 'Nome' }, el('strong', { text: g.nome }), g.endereco ? el('div', { class: 'dica', text: g.endereco }) : null),
          el('td', { 'data-rot': 'Cidade', text: g.cidade || '—' }),
          el('td', { 'data-rot': 'Dirigente', text: g.dirigente || '—' }),
          el('td', { 'data-rot': 'Cadastros' }, el('a', { href: `#/cadastros?congregacao=${g.id}`, text: String(totais[g.id] || 0) })),
          el('td', { 'data-rot': 'Situação' }, el('span', { class: `etiqueta ${g.ativa ? 'APROVADO' : 'inativa'}`, text: g.ativa ? 'Ativa' : 'Inativa' }), el('div', { class: 'dica', text: `desde ${dataCurta(g.created_at)}` })),
          el('td', { 'data-rot': 'Ações' }, el('div', { class: 'botoes' },
            el('button', { type: 'button', class: 'btn sec peq', text: 'Editar', onclick: () => editarCongregacao(ctx, g) }),
            el('button', { type: 'button', class: `btn peq ${g.ativa ? 'perigo' : 'ok'}`, text: g.ativa ? 'Desativar' : 'Reativar', onclick: () => alternar(ctx, g) }))))))))
      : el('div', { class: 'card vazio', text: 'Nenhuma congregação cadastrada. Cadastre a primeira para liberar o formulário público.' }),
  );
}
