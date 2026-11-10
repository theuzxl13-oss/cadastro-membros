import {
  el, preencher, carregandoEm, dataHora, toast, confirmar,
} from '../util.js';
import {
  CAMPOS, ETAPAS, formatarValor, rotulo, validarCadastro, mascaraCPF,
} from '../../shared/campos.js';
import {
  criarCampo, lerValores, aplicarRegras, mostrarErros,
} from '../../ui/campos-dom.js';
import { criarRecorte } from '../../ui/foto3x4.js';
import { listarCongregacoes, blobFoto } from '../dados.js';
import { BUCKET, mensagemErro } from '../supabase.js';
import { imprimirFicha } from '../impressao.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let urlsAtivas = [];
function liberarUrls() { urlsAtivas.forEach((u) => URL.revokeObjectURL(u)); urlsAtivas = []; }

export async function viewFicha(ctx) {
  const { sb, view, params, query, atual } = ctx;
  const id = params[0];
  if (!UUID.test(id || '')) { preencher(view, el('div', { class: 'alerta erro', text: 'Cadastro inválido.' })); return; }
  carregandoEm(view);
  liberarUrls();

  const [{ data: c, error }, congregacoes] = await Promise.all([
    sb.from('cadastros').select('*').eq('id', id).maybeSingle(),
    listarCongregacoes(),
  ]);
  if (error) throw error;
  if (!atual()) return;
  if (!c) {
    preencher(view, el('h1', { text: 'Cadastro não encontrado' }),
      el('p', { text: 'Ele pode ter sido excluído.' }), el('a', { class: 'btn sec', href: '#/cadastros', text: 'Voltar à lista' }));
    return;
  }
  const fotoBlob = await blobFoto(c.foto_path);
  if (!atual()) return;
  const fotoUrl = fotoBlob ? URL.createObjectURL(fotoBlob) : null;
  if (fotoUrl) urlsAtivas.push(fotoUrl);

  if (query.get('editar') === '1') return editar(ctx, c, congregacoes, fotoUrl);
  return mostrar(ctx, c, congregacoes, fotoUrl, fotoBlob);
}

// ---------------------------------------------------------------------------
async function mostrar(ctx, c, congregacoes, fotoUrl, fotoBlob) {
  const { sb, view, admin } = ctx;
  const { data: mesmos } = await sb.from('cadastros').select('id,protocolo,nome').eq('cpf', c.cpf).neq('id', c.id).limit(5);

  const secoes = ETAPAS.slice(0, 4).map((e) => {
    const itens = CAMPOS.filter((x) => x.etapa === e.n && (!x.mostrar || x.mostrar(c) || c[x.nome]))
      .map((x) => el('div', {}, el('dt', { text: x.rotulo }), el('dd', { text: formatarValor(x, c[x.nome], congregacoes) || '—' })));
    return el('section', { class: 'card secao' }, el('h2', { text: e.titulo }), el('dl', { class: 'dados' }, itens));
  });

  const aprovado = c.status === 'APROVADO';
  const btnStatus = el('button', {
    type: 'button',
    class: aprovado ? 'btn sec' : 'btn ok',
    text: aprovado ? 'Voltar para pendente' : 'Aprovar cadastro',
    onclick: async () => {
      const novo = aprovado ? 'PENDENTE' : 'APROVADO';
      btnStatus.disabled = true;
      const { error } = await sb.from('cadastros').update({ status: novo }).eq('id', c.id);
      if (error) { toast(mensagemErro(error), 'erro'); btnStatus.disabled = false; return; }
      toast(novo === 'APROVADO' ? 'Cadastro aprovado.' : 'Cadastro marcado como pendente.');
      ctx.atualizarPendentes().catch(() => {});
      ctx.navegar(`#/cadastro/${c.id}`);
    },
  });

  const acoes = [
    btnStatus,
    el('a', { class: 'btn sec', href: `#/cadastro/${c.id}?editar=1`, text: 'Editar dados' }),
    el('button', {
      type: 'button',
      class: 'btn sec',
      text: 'Imprimir ficha / Salvar PDF',
      title: 'Abre a impressão no modelo da Ficha de Cadastro Setorial. Para PDF, escolha "Salvar como PDF" no destino.',
      onclick: async () => {
        await imprimirFicha(c, congregacoes, fotoBlob);
        sb.rpc('admin_registrar_acao', { p_acao: 'impressao_ficha', p_entidade_id: c.id, p_detalhes: { protocolo: c.protocolo } }).then(() => {});
      },
    }),
  ];
  if (admin.papel === 'admin') {
    acoes.push(el('button', { type: 'button', class: 'btn perigo', text: 'Excluir cadastro', onclick: () => excluir(ctx, c) }));
  }

  const fotoEl = fotoUrl
    ? el('img', {
      src: fotoUrl,
      alt: `Foto 3x4 de ${c.nome}`,
      onclick: () => confirmar({ titulo: 'Foto 3x4', corpo: el('div', { class: 'foto-grande' }, el('img', { src: fotoUrl, alt: `Foto 3x4 de ${c.nome}` })), botao: 'Fechar' }),
    })
    : el('span', { text: c.foto_path ? 'Foto indisponível' : 'Sem foto' });

  preencher(view, 
    el('p', {}, el('a', { href: '#/cadastros', text: '← Voltar à lista' })),
    el('div', { class: 'ficha-topo' },
      el('div', { class: 'ficha-foto' }, fotoEl),
      el('div', { class: 'ficha-info' },
        el('h1', { text: c.nome }),
        el('p', {}, el('span', { class: `etiqueta ${c.status}`, text: rotulo('status', c.status) })),
        el('div', { class: 'ficha-meta' },
          el('span', { text: `Protocolo: ${c.protocolo}` }),
          el('span', { text: `CPF: ${mascaraCPF(c.cpf)}` }),
          el('span', { text: `Recebido em: ${dataHora(c.created_at)}` }),
          c.aprovado_em ? el('span', { text: `Aprovado em: ${dataHora(c.aprovado_em)}` }) : null,
          c.updated_by ? el('span', { text: `Última alteração: ${dataHora(c.updated_at)}` }) : null,
          el('span', { text: `Consentimento LGPD: ${dataHora(c.consentimento_em)} (versão ${c.consentimento_versao})${c.consentimento_responsavel ? ' — dado pelo responsável legal' : ''}` })))),
    mesmos?.length
      ? el('div', { class: 'alerta info' }, 'Atenção: existe(m) outra(s) ficha(s) com o mesmo CPF: ',
        ...mesmos.map((m, i) => [i ? ', ' : '', el('a', { href: `#/cadastro/${m.id}`, text: `${m.protocolo} (${m.nome})` })]).flat())
      : null,
    el('div', { class: 'ficha-acoes' }, acoes),
    ...secoes,
  );
}

// ---------------------------------------------------------------------------
async function excluir(ctx, c) {
  const { sb } = ctx;
  const entrada = el('input', { type: 'text', autocomplete: 'off', 'aria-label': 'Digite o protocolo para confirmar' });
  const ok = await confirmar({
    titulo: 'Excluir cadastro definitivamente?',
    corpo: el('div', {},
      el('p', {}, 'Esta ação ', el('strong', { text: 'não pode ser desfeita' }), '. Serão apagados permanentemente:'),
      el('ul', {}, el('li', { text: `a ficha de ${c.nome} do banco de dados;` }), el('li', { text: 'a fotografia 3x4 do armazenamento.' })),
      el('p', {}, 'Para confirmar, digite o protocolo ', el('strong', { text: c.protocolo }), ':'),
      entrada),
    botao: 'Excluir definitivamente',
    tipo: 'perigo',
    validar: () => entrada.value.trim().toUpperCase() === c.protocolo,
  });
  if (!ok) return;

  try {
    // 1) remove a foto do Storage (se falhar, nada é apagado)
    if (c.foto_path) {
      const { error: eFoto } = await sb.storage.from(BUCKET).remove([c.foto_path]);
      if (eFoto) throw eFoto;
    }
    // 2) apaga o registro e grava a auditoria (somente protocolo)
    const { error } = await sb.rpc('admin_excluir_cadastro', { p_id: c.id });
    if (error) throw error;
    toast(`Cadastro ${c.protocolo} excluído definitivamente.`);
    ctx.atualizarPendentes().catch(() => {});
    ctx.navegar('#/cadastros');
  } catch (e) {
    toast(`Falha na exclusão: ${mensagemErro(e)}`, 'erro');
  }
}

// ---------------------------------------------------------------------------
function editar(ctx, c, congregacoes, fotoUrl) {
  const { sb, view } = ctx;
  const form = el('form', { class: 'edicao', novalidate: true });

  for (const e of ETAPAS.slice(0, 4)) {
    const grade = el('div', { class: 'grade g2' });
    for (const campo of CAMPOS.filter((x) => x.etapa === e.n)) {
      grade.append(criarCampo(campo, { valor: c[campo.nome] ?? '', congregacoes, prefixo: 'ed' }));
    }
    form.append(el('section', { class: 'card secao' }, el('h2', { text: e.titulo }), grade));
  }

  // Status
  form.append(el('section', { class: 'card secao' }, el('h2', { text: 'Situação do cadastro' }),
    el('div', { class: 'opcoes' }, ...[['PENDENTE', 'Manter pendente'], ['APROVADO', 'Aprovado']].map(([v, r]) => el('label', {},
      el('input', { type: 'radio', name: 'status', value: v, checked: c.status === v }), r)))));

  // Foto
  const canvas = el('canvas', { width: 600, height: 800, hidden: !fotoUrl });
  const atualImg = fotoUrl ? el('img', { src: fotoUrl, alt: 'Foto atual', style: 'width:100%;height:100%;object-fit:cover' }) : el('span', { class: 'centro', text: 'Sem foto' });
  const quadro = el('div', { class: `foto-quadro ${fotoUrl ? 'com-foto' : ''}` }, atualImg, canvas);
  canvas.hidden = true;
  const zoom = el('input', { type: 'range', min: 1, max: 3, step: 0.01, value: 1, hidden: true, 'aria-label': 'Aproximar foto' });
  const arquivo = el('input', { type: 'file', accept: 'image/*', id: 'ed-foto', class: 'sr-only' });
  const msgFoto = el('p', { class: 'erro-msg', hidden: true });
  const recorte = criarRecorte({
    canvas,
    quadro,
    zoom,
    aoMudar: () => {
      const tem = recorte?.temFoto();
      canvas.hidden = !tem;
      atualImg.hidden = !!tem;
      zoom.hidden = !tem;
      quadro.classList.toggle('com-foto', !!tem || !!fotoUrl);
    },
  });
  arquivo.addEventListener('change', async () => {
    const f = arquivo.files?.[0];
    arquivo.value = '';
    if (!f) return;
    try { await recorte.carregar(f); msgFoto.hidden = true; } catch (err) { msgFoto.textContent = err.message; msgFoto.hidden = false; }
  });
  form.append(el('section', { class: 'card secao' }, el('h2', { text: 'Foto 3x4' }),
    el('div', { class: 'foto-area' }, quadro,
      el('div', { class: 'foto-controles' },
        el('label', { class: 'btn ouro', for: 'ed-foto', text: fotoUrl ? 'Substituir foto' : 'Enviar foto' }), arquivo,
        zoom, el('p', { class: 'dica', text: 'A nova foto só é gravada ao salvar. Arraste para centralizar.' }), msgFoto))));

  const erroBox = el('div', { class: 'alerta erro', role: 'alert', hidden: true });
  const btnSalvar = el('button', { type: 'submit', class: 'btn ok', text: 'Salvar alterações' });
  form.append(erroBox, el('div', { class: 'barra-salvar' },
    el('a', { class: 'btn sec', href: `#/cadastro/${c.id}`, text: 'Cancelar' }), btnSalvar));

  const atualizarRegras = () => aplicarRegras(form, lerValores(form));
  form.addEventListener('input', atualizarRegras);
  form.addEventListener('change', atualizarRegras);
  atualizarRegras();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    erroBox.hidden = true;
    const { dados, erros } = validarCadastro(lerValores(form), { congregacoesValidas: congregacoes.map((x) => x.id) });
    if (Object.keys(erros).length) {
      const primeiro = mostrarErros(form, erros);
      erroBox.textContent = 'Corrija os campos destacados.';
      erroBox.hidden = false;
      primeiro?.focus();
      primeiro?.scrollIntoView({ block: 'center' });
      return;
    }
    mostrarErros(form, {});
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando…';
    try {
      const atualizacao = { ...dados, status: form.querySelector('input[name="status"]:checked')?.value || c.status };
      if (recorte.temFoto()) {
        const caminho = `cadastros/${c.id}.jpg`;
        const blob = await recorte.gerarBlob();
        const { error: eUp } = await sb.storage.from(BUCKET).upload(caminho, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: 'no-store' });
        if (eUp) throw eUp;
        atualizacao.foto_path = caminho;
      }
      const { error } = await sb.from('cadastros').update(atualizacao).eq('id', c.id);
      if (error) throw error;
      toast('Alterações salvas.');
      ctx.atualizarPendentes().catch(() => {});
      ctx.navegar(`#/cadastro/${c.id}`);
    } catch (e) {
      erroBox.textContent = mensagemErro(e);
      erroBox.hidden = false;
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Salvar alterações';
    }
  });

  preencher(view, 
    el('p', {}, el('a', { href: `#/cadastro/${c.id}`, text: '← Voltar à ficha' })),
    el('h1', { text: `Editar: ${c.nome}` }),
    el('p', { class: 'dica', text: `Protocolo ${c.protocolo}` }),
    form,
  );
}
