import '../styles/base.css';
import '../styles/formulario.css';
import {
  CAMPOS, ETAPAS, validarCadastro, formatarValor, soDigitos, menorDeIdade, UFS,
} from '../shared/campos.js';
import {
  el, criarCampo, lerValores, aplicarRegras, mostrarErros,
} from '../ui/campos-dom.js';
import { criarRecorte } from '../ui/foto3x4.js';
import { obterConfig, enviarFicha } from './api.js';

if (__DEMO__) import('../demo/faixa-demo.js').then((m) => m.ativarFaixaDemo());

const $ = (s) => document.querySelector(s);
const form = $('#ficha');
const TOTAL = ETAPAS.length;
let etapa = 1;
let config = null;
let recorte = null;
let fotoUrlRevisao = null;
let turnstileId = null;
let alterado = false;
const inicio = Date.now();

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
async function iniciar() {
  try {
    config = await obterConfig();
  } catch (e) {
    $('#estado-carregando').hidden = true;
    const box = $('#estado-erro');
    box.hidden = false;
    box.replaceChildren(
      el('p', { text: e.message || 'Falha de conexão.' }),
      el('button', { type: 'button', class: 'btn sec', text: 'Tentar novamente', onclick: () => location.reload() }),
    );
    return;
  }

  $('#estado-carregando').hidden = true;
  if (config.endereco_sede) {
    $('#sub-sede').textContent = `${config.endereco_sede}${config.pastor_setorial ? ` · ${config.pastor_setorial}` : ''}`;
    $('#priv-sede').textContent = config.endereco_sede;
  }
  if (config.encarregado_contato || config.encarregado_nome) {
    $('#priv-contato').textContent = `Para isso, fale com ${config.encarregado_nome || 'o encarregado de dados'}${config.encarregado_contato ? ` — ${config.encarregado_contato}` : ''}.`;
  }
  if (!config.aberto) { $('#estado-fechado').hidden = false; return; }
  if (!config.congregacoes.length) {
    const box = $('#estado-erro');
    box.hidden = false;
    box.textContent = 'Nenhuma congregação está disponível para cadastro no momento. Procure a secretaria do Setor.';
    return;
  }

  montarCampos();
  montarPassos();
  montarFoto();
  form.hidden = false;
  mostrarEtapa(1);
  if (config.turnstile_site_key) carregarTurnstile();
}

function montarCampos() {
  for (const c of CAMPOS) {
    const alvo = form.querySelector(`[data-campos="${c.etapa}"]`);
    alvo.append(criarCampo(c, { congregacoes: config.congregacoes, prefixo: 'f' }));
  }
  form.addEventListener('input', aoMudar);
  form.addEventListener('change', aoMudar);
  form.querySelector('[name="cep"]').addEventListener('input', buscarCEP);
  aoMudar();
}

function aoMudar(e) {
  if (e) alterado = true;
  const dados = lerValores(form);
  aplicarRegras(form, dados);
  $('#aviso-obreiro').hidden = !(dados.cargo && dados.cargo !== 'MEMBRO');
  // Limpa erro do campo assim que ele é corrigido
  if (e?.target?.name) {
    const w = e.target.closest('.campo.invalido');
    if (w) {
      const { erros } = validarCadastro(dados, { campos: [w.dataset.campo] });
      if (!erros[w.dataset.campo]) mostrarErros(form, {}, [w.dataset.campo]);
    }
  }
}

function montarPassos() {
  const ol = $('#prog-passos');
  ol.replaceChildren(...ETAPAS.map((e) => el('li', { dataset: { n: e.n }, text: e.titulo })));
}

// ---------------------------------------------------------------------------
// Navegação entre etapas
// ---------------------------------------------------------------------------
function mostrarEtapa(n) {
  etapa = n;
  form.querySelectorAll('.etapa').forEach((s) => { s.hidden = Number(s.dataset.etapa) !== n; });
  const info = ETAPAS[n - 1];
  $('#prog-etapa').textContent = `Etapa ${n} de ${TOTAL}`;
  $('#prog-titulo').textContent = info.titulo;
  $('#prog-barra').setAttribute('aria-valuenow', String(n));
  $('#prog-preench').style.width = `${(n / TOTAL) * 100}%`;
  $('#prog-passos').querySelectorAll('li').forEach((li) => {
    const k = Number(li.dataset.n);
    li.className = k === n ? 'atual' : k < n ? 'feito' : '';
  });
  $('#btn-voltar').hidden = n === 1;
  $('#btn-avancar').hidden = n === TOTAL;
  $('#btn-enviar').hidden = n !== TOTAL;
  $('#erro-envio').hidden = true;
  if (n === TOTAL) montarRevisao();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const titulo = form.querySelector(`.etapa[data-etapa="${n}"] h2`);
  titulo?.setAttribute('tabindex', '-1');
  titulo?.focus({ preventScroll: true });
}

function camposDaEtapa(n) {
  return CAMPOS.filter((c) => c.etapa === n).map((c) => c.nome);
}

function validarEtapa(n) {
  if (n === 5) {
    const ok = recorte?.temFoto();
    const msg = $('#foto-erro');
    msg.hidden = ok;
    msg.textContent = ok ? '' : 'Envie a foto 3x4 para continuar.';
    if (!ok) $('#foto-escolher').focus();
    return ok;
  }
  if (n > 4) return true;
  const campos = camposDaEtapa(n);
  const { erros } = validarCadastro(lerValores(form), { campos });
  const primeiro = mostrarErros(form, erros, campos);
  if (primeiro) {
    primeiro.focus();
    primeiro.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return false;
  }
  return true;
}

$('#btn-avancar').addEventListener('click', () => {
  if (validarEtapa(etapa)) mostrarEtapa(Math.min(TOTAL, etapa + 1));
});
$('#btn-voltar').addEventListener('click', () => mostrarEtapa(Math.max(1, etapa - 1)));

// ---------------------------------------------------------------------------
// CEP → endereço (ViaCEP). Preenche apenas campos vazios.
// ---------------------------------------------------------------------------
let ultimoCEP = '';
async function buscarCEP(e) {
  const cep = soDigitos(e.target.value);
  if (cep.length !== 8 || cep === ultimoCEP) return;
  ultimoCEP = cep;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!r.ok) return;
    const j = await r.json();
    if (j.erro) return;
    const preencher = (nome, valor) => {
      const i = form.querySelector(`[name="${nome}"]`);
      if (i && !i.value && valor) i.value = valor;
    };
    preencher('endereco', j.logradouro);
    preencher('bairro', j.bairro);
    preencher('cidade', j.localidade);
    if (UFS.includes(j.uf)) preencher('estado', j.uf);
    aoMudar();
  } catch { /* consulta de CEP é apenas uma ajuda; segue manual */ }
}

// ---------------------------------------------------------------------------
// Foto
// ---------------------------------------------------------------------------
function montarFoto() {
  const canvas = $('#foto-canvas');
  const quadro = $('#foto-quadro');
  recorte = criarRecorte({
    canvas,
    quadro,
    zoom: $('#foto-zoom'),
    aoMudar: () => {
      const tem = recorte?.temFoto();
      canvas.hidden = !tem;
      $('#foto-vazia').hidden = tem;
      $('#foto-ajuste').hidden = !tem;
      quadro.classList.toggle('com-foto', !!tem);
      $('#foto-escolher').textContent = tem ? 'Trocar foto' : 'Escolher ou tirar foto';
    },
  });
  $('#foto-arquivo').addEventListener('change', async (e) => {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    const msg = $('#foto-erro');
    try {
      await recorte.carregar(arq);
      msg.hidden = true;
      alterado = true;
    } catch (err) {
      msg.textContent = err.message;
      msg.hidden = false;
    }
  });
  $('#foto-remover').addEventListener('click', () => recorte.limpar());
}

// ---------------------------------------------------------------------------
// Revisão
// ---------------------------------------------------------------------------
async function montarRevisao() {
  const dados = lerValores(form);
  const { dados: limpos } = validarCadastro(dados);
  const raiz = $('#revisao');
  raiz.replaceChildren();
  for (const e of ETAPAS.slice(0, 4)) {
    const dl = el('dl');
    for (const c of CAMPOS.filter((x) => x.etapa === e.n)) {
      if (c.mostrar && !c.mostrar(limpos)) continue;
      const v = formatarValor(c, limpos[c.nome], config.congregacoes);
      dl.append(el('dt', { text: c.rotulo }), el('dd', { text: v || '—' }));
    }
    raiz.append(el('div', { class: 'rev-bloco' },
      el('header', {}, el('span', { text: e.titulo }), el('button', { type: 'button', class: 'btn link', text: 'Corrigir', onclick: () => mostrarEtapa(e.n) })),
      dl));
  }
  const blocoFoto = el('div', { class: 'rev-bloco' },
    el('header', {}, el('span', { text: 'Foto 3x4' }), el('button', { type: 'button', class: 'btn link', text: 'Corrigir', onclick: () => mostrarEtapa(5) })));
  if (recorte.temFoto()) {
    const blob = await recorte.gerarBlob();
    if (fotoUrlRevisao) URL.revokeObjectURL(fotoUrlRevisao);
    fotoUrlRevisao = URL.createObjectURL(blob);
    blocoFoto.append(el('div', { class: 'rev-foto' }, el('img', { src: fotoUrlRevisao, alt: 'Sua foto 3x4' }), el('span', { text: 'Foto pronta para envio.' })));
  }
  raiz.append(blocoFoto);
  $('#bloco-responsavel').hidden = !menorDeIdade(limpos.data_nascimento);
}

// ---------------------------------------------------------------------------
// Turnstile (anti-robô da Cloudflare)
// ---------------------------------------------------------------------------
function carregarTurnstile() {
  window.onTurnstileLoad = () => {
    turnstileId = window.turnstile.render('#turnstile', {
      sitekey: config.turnstile_site_key,
      language: 'pt-br',
      theme: 'light',
    });
  };
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
  s.async = true;
  s.defer = true;
  document.head.append(s);
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (etapa !== TOTAL) return;
  const erroBox = $('#erro-envio');
  const erroCons = $('#consentimento-erro');
  erroBox.hidden = true;

  const dados = lerValores(form);
  const { erros } = validarCadastro(dados);
  if (Object.keys(erros).length) {
    const primeiraEtapa = Math.min(...Object.keys(erros).map((k) => CAMPOS.find((c) => c.nome === k)?.etapa || 1));
    mostrarEtapa(primeiraEtapa);
    validarEtapa(primeiraEtapa);
    return;
  }
  if (!recorte.temFoto()) { mostrarEtapa(5); validarEtapa(5); return; }

  const menor = menorDeIdade(dados.data_nascimento);
  if (!$('#consentimento').checked || (menor && !$('#consentimento-responsavel').checked)) {
    erroCons.textContent = menor
      ? 'Marque as duas autorizações para enviar a ficha.'
      : 'Para enviar, é necessário autorizar o tratamento dos dados.';
    erroCons.hidden = false;
    $('#consentimento').focus();
    return;
  }
  erroCons.hidden = true;

  let token = '';
  if (config.turnstile_site_key) {
    token = window.turnstile?.getResponse(turnstileId) || '';
    if (!token) {
      erroBox.textContent = 'Aguarde a verificação de segurança ser concluída e tente novamente.';
      erroBox.hidden = false;
      return;
    }
  }

  const botao = $('#btn-enviar');
  botao.disabled = true;
  $('#btn-voltar').disabled = true;
  botao.replaceChildren(el('span', { class: 'carregando' }), ' Enviando…');

  try {
    const fd = new FormData();
    fd.append('dados', JSON.stringify(dados));
    fd.append('foto', await recorte.gerarBlob(), 'foto-3x4.jpg');
    fd.append('consentimento', 'true');
    fd.append('consentimento_responsavel', menor && $('#consentimento-responsavel').checked ? 'true' : 'false');
    fd.append('tempo_preenchimento', String(Date.now() - inicio));
    fd.append('website', $('#website').value);
    if (token) fd.append('cf-turnstile-response', token);

    const { status, json: j } = await enviarFicha(fd);
    if (status >= 300 || !j.ok) {
      if (j.erros && Object.keys(j.erros).length) {
        const nomes = Object.keys(j.erros);
        if (nomes.includes('foto')) { mostrarEtapa(5); $('#foto-erro').textContent = j.erros.foto; $('#foto-erro').hidden = false; }
        else {
          const alvo = Math.min(...nomes.map((k) => CAMPOS.find((c) => c.nome === k)?.etapa || 1));
          mostrarEtapa(alvo);
          mostrarErros(form, j.erros);
        }
      }
      throw new Error(j.erro || 'Não foi possível enviar a ficha. Tente novamente.');
    }
    alterado = false;
    form.hidden = true;
    $('#protocolo').textContent = j.protocolo || '';
    $('#sucesso').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    const box = $('#erro-envio');
    box.textContent = e.message === 'Failed to fetch' ? 'Sem conexão com a internet. Verifique e tente novamente — seus dados continuam preenchidos.' : e.message;
    box.hidden = false;
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (turnstileId !== null) window.turnstile?.reset(turnstileId);
  } finally {
    botao.disabled = false;
    $('#btn-voltar').disabled = false;
    botao.textContent = 'Enviar ficha';
  }
});

$('#btn-nova').addEventListener('click', () => { location.reload(); });

window.addEventListener('beforeunload', (e) => {
  if (alterado) { e.preventDefault(); e.returnValue = ''; }
});

iniciar();
