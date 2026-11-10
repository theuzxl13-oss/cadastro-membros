import {
  el, preencher, carregandoEm, toast, dataHora,
} from '../util.js';
import { mensagemErro } from '../supabase.js';
import { ligarVerSenha, senhaForte } from '../senha.js';
import { criarVerificacao } from '../../ui/turnstile.js';

const ACOES = {
  cadastro_recebido: 'Ficha recebida',
  cadastro_editado: 'Ficha editada',
  cadastro_aprovado: 'Ficha aprovada',
  cadastro_marcado_pendente: 'Ficha voltou a pendente',
  cadastro_excluido: 'Ficha EXCLUÍDA',
  exportacao_csv: 'Exportação CSV',
  exportacao_excel: 'Exportação Excel',
  impressao_ficha: 'Impressão de ficha',
  download_foto: 'Download de foto',
  login: 'Login',
  logout: 'Logout',
  admin_promovido: 'Administrador ativado',
  admin_revogado: 'Administrador revogado',
};

function campo(id, rot, input, dica) {
  return el('div', { class: 'campo' }, el('label', { for: id, text: rot }), input, dica ? el('span', { class: 'dica', text: dica }) : null);
}

export async function viewConfiguracoes(ctx) {
  const { sb, view, admin, atual } = ctx;
  carregandoEm(view);
  const total = admin.papel === 'admin';
  const [{ data: cfg, error }, { data: admins }, aud] = await Promise.all([
    sb.from('configuracoes').select('*').eq('id', 1).maybeSingle(),
    sb.from('admins').select('email,nome,papel,ativo,created_at').order('nome'),
    total ? sb.from('auditoria').select('*').order('created_at', { ascending: false }).limit(100) : Promise.resolve({ data: null }),
  ]);
  if (error) throw error;
  if (!atual()) return;

  // ---- Configurações gerais
  const inp = (id, valor, attrs = {}) => el('input', { type: 'text', id, value: valor || '', disabled: !total, ...attrs });
  const fAberto = el('input', { type: 'checkbox', id: 'cf-aberto', checked: cfg.formulario_aberto, disabled: !total });
  const fUrl = inp('cf-url', cfg.url_publica, { type: 'url', placeholder: 'https://cadastro.seudominio.org.br/' });
  const fSede = inp('cf-sede', cfg.endereco_sede, { maxlength: 200 });
  const fPastor = inp('cf-pastor', cfg.pastor_setorial, { maxlength: 120 });
  const fEncNome = inp('cf-enc-nome', cfg.encarregado_lgpd_nome, { maxlength: 120 });
  const fEncCont = inp('cf-enc-cont', cfg.encarregado_lgpd_contato, { maxlength: 200 });
  const formCfg = el('form', { class: 'card', novalidate: true },
    el('h2', { text: 'Formulário público' }),
    el('label', { class: 'chk' }, fAberto, 'Receber novas fichas pelo formulário'),
    campo('cf-url', 'URL pública de produção (usada no QR Code)', fUrl, 'Ex.: https://cadastro-setor46.pages.dev/'),
    campo('cf-sede', 'Endereço da sede (cabeçalho e impressão)', fSede),
    campo('cf-pastor', 'Pastor setorial', fPastor),
    el('h2', { text: 'Proteção de dados (LGPD)' }),
    campo('cf-enc-nome', 'Encarregado pelo tratamento de dados', fEncNome),
    campo('cf-enc-cont', 'Contato do encarregado (e-mail ou telefone)', fEncCont, 'Aparece no aviso de privacidade do formulário.'),
    total ? el('button', { type: 'submit', class: 'btn', text: 'Salvar configurações' })
      : el('p', { class: 'dica', text: 'Somente administradores podem alterar estas configurações.' }));
  formCfg.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = fUrl.value.trim();
    if (url && !/^https?:\/\/[^\s]+$/.test(url)) { toast('URL inválida. Use o formato https://…', 'erro'); return; }
    const textos = [fSede, fPastor, fEncNome, fEncCont].map((i) => i.value.trim());
    if (/[<>]/.test(textos.join(''))) { toast('Não use os caracteres < ou >.', 'erro'); return; }
    const { error: err } = await sb.from('configuracoes').update({
      formulario_aberto: fAberto.checked,
      url_publica: url || null,
      endereco_sede: textos[0] || null,
      pastor_setorial: textos[1] || null,
      encarregado_lgpd_nome: textos[2] || null,
      encarregado_lgpd_contato: textos[3] || null,
    }).eq('id', 1);
    if (err) toast(mensagemErro(err), 'erro'); else toast('Configurações salvas.');
  });

  // ---- Troca de senha
  const sAtual = el('input', { type: 'password', id: 'pw-atual', autocomplete: 'current-password' });
  const sNova = el('input', { type: 'password', id: 'pw-nova', autocomplete: 'new-password' });
  const sConf = el('input', { type: 'password', id: 'pw-conf', autocomplete: 'new-password' });
  const formSenha = el('form', { class: 'card', novalidate: true },
    el('h2', { text: 'Minha senha' }),
    campo('pw-atual', 'Senha atual', el('div', { class: 'senha-wrap' }, sAtual, el('button', { type: 'button', class: 'btn sec peq ver-senha', 'data-alvo': 'pw-atual', text: 'Mostrar' }))),
    campo('pw-nova', 'Nova senha', el('div', { class: 'senha-wrap' }, sNova, el('button', { type: 'button', class: 'btn sec peq ver-senha', 'data-alvo': 'pw-nova', text: 'Mostrar' })), 'Mínimo de 10 caracteres, com letras e números.'),
    campo('pw-conf', 'Repita a nova senha', sConf),
    el('div', { id: 'ts-senha', class: 'turnstile' }),
    el('button', { type: 'submit', class: 'btn', text: 'Alterar senha' }));
  let tsSenha = { ativo: false, token: () => '', reset: () => {} };
  formSenha.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fraca = senhaForte(sNova.value);
    if (fraca) { toast(fraca, 'erro'); return; }
    if (sNova.value !== sConf.value) { toast('As senhas não conferem.', 'erro'); return; }
    // Confirma a senha atual antes de alterar
    const captchaToken = tsSenha.token();
    if (tsSenha.ativo && !captchaToken) { toast('Conclua a verificação de segurança.', 'erro'); return; }
    const { error: e1 } = await sb.auth.signInWithPassword({ email: admin.email, password: sAtual.value, options: captchaToken ? { captchaToken } : undefined });
    tsSenha.reset();
    if (e1) { toast(/captcha/i.test(e1.message) ? 'Refaça a verificação de segurança.' : 'Senha atual incorreta.', 'erro'); return; }
    const { error: e2 } = await sb.auth.updateUser({ password: sNova.value });
    if (e2) { toast(mensagemErro(e2), 'erro'); return; }
    formSenha.reset();
    toast('Senha alterada com sucesso.');
  });

  // ---- Administradores
  const cardAdmins = el('div', { class: 'card' },
    el('h2', { text: 'Administradores' }),
    el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela responsiva' },
      el('tbody', {}, (admins || []).map((a) => el('tr', {},
        el('td', { 'data-rot': 'Nome' }, el('strong', { text: a.nome }), el('div', { class: 'dica', text: a.email })),
        el('td', { 'data-rot': 'Papel', text: a.papel === 'admin' ? 'Administrador' : 'Secretaria' }),
        el('td', { 'data-rot': 'Situação' }, el('span', { class: `etiqueta ${a.ativo ? 'APROVADO' : 'inativa'}`, text: a.ativo ? 'Ativo' : 'Revogado' }))))))),
    el('p', { class: 'dica', style: 'margin-top:10px', text: 'Por segurança, novos administradores só podem ser criados pelo responsável técnico no Supabase (veja o README, seção "Administradores").' }));

  // ---- Sessão
  const exp = admin.session?.expires_at ? dataHora(new Date(admin.session.expires_at * 1000).toISOString()) : '';
  const cardSessao = el('div', { class: 'card' },
    el('h2', { text: 'Sessão' }),
    el('p', {}, 'Conectado como ', el('strong', { text: admin.email }), '.'),
    el('p', { class: 'dica', text: `O token de acesso é renovado automaticamente${exp ? ` (atual válido até ${exp})` : ''}. O painel encerra a sessão após 30 minutos sem uso e ao fechar o navegador.` }),
    el('button', { type: 'button', class: 'btn perigo', text: 'Sair do painel', onclick: () => document.getElementById('btn-sair').click() }));

  // ---- Auditoria
  const cardAud = total ? el('div', { class: 'card', style: 'grid-column:1/-1' },
    el('h2', { text: 'Auditoria (últimos 100 eventos)' }),
    el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela responsiva' },
      el('thead', {}, el('tr', {}, ['Data', 'Ação', 'Quem', 'Detalhes'].map((t) => el('th', { text: t })))),
      el('tbody', {}, (aud.data || []).map((a) => el('tr', {},
        el('td', { 'data-rot': 'Data', text: dataHora(a.created_at) }),
        el('td', { 'data-rot': 'Ação', text: ACOES[a.acao] || a.acao }),
        el('td', { 'data-rot': 'Quem', text: a.ator_email || (a.acao === 'cadastro_recebido' ? 'Formulário público' : '—') }),
        el('td', { 'data-rot': 'Detalhes', text: [a.detalhes?.protocolo, a.detalhes?.campos ? `campos: ${a.detalhes.campos.join(', ')}` : '', a.detalhes?.registros ? `${a.detalhes.registros} registros` : ''].filter(Boolean).join(' · ') })))))),
    el('p', { class: 'dica', style: 'margin-top:8px', text: 'A auditoria não guarda dados pessoais: apenas a ação, o autor, o protocolo e os nomes dos campos alterados.' })) : null;

  preencher(view, 
    el('h1', { text: 'Configurações' }),
    el('div', { class: 'grade-config' }, formCfg, el('div', { style: 'display:flex;flex-direction:column;gap:16px' }, formSenha, cardSessao), cardAdmins, cardAud),
  );
  ligarVerSenha(view);
  criarVerificacao(view.querySelector('#ts-senha')).then((v) => { tsSenha = v; }).catch(() => {});
}
