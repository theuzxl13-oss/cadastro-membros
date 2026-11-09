import { caminho } from '../ui/caminho.js';
import '../styles/base.css';
import '../styles/admin.css';
import { sb, configurado, adminAtual, mensagemErro } from './supabase.js';
import { ligarVerSenha } from './senha.js';
import { criarVerificacao } from '../ui/turnstile.js';

if (__DEMO__) import('../demo/faixa-demo.js').then((m) => m.ativarFaixaDemo());

const $ = (s) => document.querySelector(s);
const aviso = $('#aviso');

function mostrar(msg, tipo = 'erro') {
  aviso.className = `alerta ${tipo}`;
  aviso.textContent = msg;
  aviso.hidden = false;
}

ligarVerSenha();

// Verificação anti-robô (obrigatória quando o CAPTCHA está ativo no Supabase Auth)
let tsLogin = { token: () => '', reset: () => {}, ativo: false };
let tsRec = tsLogin;
const tsPronto = criarVerificacao(document.getElementById('ts-login'))
  .then((v) => { tsLogin = v; })
  .catch((e) => mostrar(e.message));

const motivos = {
  'sessao-expirada': ['Sua sessão foi encerrada por inatividade. Entre novamente.', 'info'],
  'sem-permissao': ['Este usuário não tem acesso ao painel administrativo.', 'erro'],
  saiu: ['Você saiu do painel com segurança.', 'ok'],
  'senha-alterada': ['Senha alterada. Entre com a nova senha.', 'ok'],
};
const motivo = new URLSearchParams(location.search).get('motivo');
if (motivos[motivo]) mostrar(...motivos[motivo]);

if (!configurado) {
  mostrar('Painel ainda não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY e publique novamente.');
  $('#form-login').hidden = true;
} else {
  // Já logado como administrador? Vai direto ao painel.
  adminAtual().then((a) => { if (a) location.replace(caminho('admin/painel.html')); });
}

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const senha = $('#senha').value;
  if (!email || !senha) { mostrar('Informe e-mail e senha.'); return; }
  const btn = $('#btn-entrar');
  btn.disabled = true;
  btn.textContent = 'Entrando…';
  try {
    await tsPronto;
    const captchaToken = tsLogin.token();
    if (tsLogin.ativo && !captchaToken) throw new Error('Conclua a verificação de segurança antes de entrar.');
    const { error } = await sb.auth.signInWithPassword({ email, password: senha, options: captchaToken ? { captchaToken } : undefined });
    if (error) throw error;
    const admin = await adminAtual();
    if (!admin) {
      await sb.auth.signOut();
      mostrar(motivos['sem-permissao'][0]);
      return;
    }
    await sb.rpc('admin_registrar_acao', { p_acao: 'login' });
    location.replace(caminho('admin/painel.html'));
  } catch (err) {
    // pequena espera para dificultar tentativas em sequência
    await new Promise((r) => setTimeout(r, 800));
    tsLogin.reset();
    mostrar(mensagemErro(err));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

$('#btn-esqueci').addEventListener('click', async () => {
  if (!tsRec.ativo) tsRec = await criarVerificacao(document.getElementById('ts-rec')).catch(() => tsRec);
  $('#form-login').hidden = true;
  $('#form-recuperar').hidden = false;
  $('#email-rec').value = $('#email').value;
  aviso.hidden = true;
  $('#email-rec').focus();
});
$('#btn-voltar-login').addEventListener('click', () => {
  $('#form-recuperar').hidden = true;
  $('#form-login').hidden = false;
  aviso.hidden = true;
});

$('#form-recuperar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email-rec').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { mostrar('Informe um e-mail válido.'); return; }
  const btn = $('#btn-enviar-rec');
  btn.disabled = true;
  try {
    const captchaToken = tsRec.token();
    if (tsRec.ativo && !captchaToken) { mostrar('Conclua a verificação de segurança.'); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}${caminho('admin/redefinir-senha.html')}`,
      captchaToken: captchaToken || undefined,
    });
    tsRec.reset();
    if (error && /rate limit|too many/i.test(error.message)) throw error;
    // Mensagem neutra: não revela se o e-mail existe
    mostrar('Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Verifique sua caixa de entrada e o spam.', 'ok');
  } catch (err) {
    mostrar(mensagemErro(err));
  } finally {
    btn.disabled = false;
  }
});
