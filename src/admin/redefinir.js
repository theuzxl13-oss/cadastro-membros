import '../styles/base.css';
import '../styles/admin.css';
import { sb, configurado, mensagemErro } from './supabase.js';
import { ligarVerSenha, senhaForte } from './senha.js';

const $ = (s) => document.querySelector(s);
const aviso = $('#aviso');
function mostrar(msg, tipo = 'erro') {
  aviso.className = `alerta ${tipo}`;
  aviso.textContent = msg;
  aviso.hidden = false;
}
ligarVerSenha();

let liberado = false;
function liberar() {
  if (liberado) return;
  liberado = true;
  $('#aguardando').hidden = true;
  $('#form-nova').hidden = false;
  $('#senha1').focus();
}

if (!configurado) {
  $('#aguardando').hidden = true;
  mostrar('Painel não configurado.');
} else {
  const hash = new URLSearchParams(location.hash.slice(1));
  const erroLink = hash.get('error_description') || new URLSearchParams(location.search).get('error_description');
  if (erroLink) {
    $('#aguardando').hidden = true;
    mostrar('Link inválido ou expirado. Solicite uma nova recuperação de senha na tela de login.');
  } else {
    sb.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'PASSWORD_RECOVERY' || (sessao && hash.get('type') === 'recovery')) liberar();
    });
    setTimeout(async () => {
      if (liberado) return;
      const { data: { session } } = await sb.auth.getSession();
      if (session && hash.get('type') === 'recovery') { liberar(); return; }
      $('#aguardando').hidden = true;
      mostrar('Link inválido ou expirado. Solicite uma nova recuperação de senha na tela de login.');
    }, 2500);
  }
}

$('#form-nova').addEventListener('submit', async (e) => {
  e.preventDefault();
  const s1 = $('#senha1').value;
  const s2 = $('#senha2').value;
  const fraca = senhaForte(s1);
  if (fraca) { mostrar(fraca); return; }
  if (s1 !== s2) { mostrar('As senhas não conferem.'); return; }
  const btn = $('#btn-salvar');
  btn.disabled = true;
  try {
    const { error } = await sb.auth.updateUser({ password: s1 });
    if (error) throw error;
    await sb.auth.signOut();
    location.replace('/admin/?motivo=senha-alterada');
  } catch (err) {
    mostrar(mensagemErro(err));
    btn.disabled = false;
  }
});
