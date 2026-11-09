#!/usr/bin/env node
// Cria (ou reativa) um administrador do painel de forma segura.
// Executar SOMENTE no computador do responsável técnico — nunca no navegador.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=chave-secreta \
//   node scripts/criar-admin.mjs email@exemplo.com "Nome Completo" [admin|secretaria]
//
// A senha é digitada de forma oculta (não fica no histórico do terminal).
import { createInterface } from 'node:readline';

const [email, nome, papel = 'admin'] = process.argv.slice(2);
const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

function sair(msg) { console.error(`\n✗ ${msg}`); process.exit(1); }

if (!url || !chave) sair('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) sair('Informe um e-mail válido.');
if (!nome || nome.trim().length < 2) sair('Informe o nome entre aspas.');
if (!['admin', 'secretaria'].includes(papel)) sair('Papel deve ser "admin" ou "secretaria".');

const cab = { apikey: chave, 'Content-Type': 'application/json' };
if (!chave.startsWith('sb_')) cab.Authorization = `Bearer ${chave}`;

function perguntarOculto(pergunta) {
  if (process.env.ADMIN_SENHA) return Promise.resolve(process.env.ADMIN_SENHA);
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(pergunta)) rl.output.write(s); };
    rl.question(pergunta, (r) => { rl.close(); process.stdout.write('\n'); resolve(r); });
  });
}

async function api(caminho, opts = {}) {
  const r = await fetch(`${url}${caminho}`, { ...opts, headers: { ...cab, ...(opts.headers || {}) } });
  const t = await r.text();
  const j = t ? JSON.parse(t) : null;
  if (!r.ok) throw new Error(`${r.status} ${j?.msg || j?.message || t}`);
  return j;
}

async function buscarUsuario(e) {
  for (let pagina = 1; pagina < 50; pagina++) {
    const j = await api(`/auth/v1/admin/users?page=${pagina}&per_page=200`);
    const u = (j.users || []).find((x) => x.email?.toLowerCase() === e.toLowerCase());
    if (u) return u;
    if (!j.users || j.users.length < 200) return null;
  }
  return null;
}

const emailN = email.trim().toLowerCase();
let usuario = await buscarUsuario(emailN);

if (!usuario) {
  const senha = await perguntarOculto('Defina a senha inicial (mín. 10 caracteres, letras e números): ');
  if (senha.length < 10 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) sair('Senha fraca.');
  usuario = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email: emailN, password: senha, email_confirm: true }),
  });
  console.log(`✓ Usuário criado no Supabase Auth: ${emailN}`);
} else {
  console.log(`• Usuário já existe no Supabase Auth: ${emailN}`);
}

await api('/rest/v1/admins?on_conflict=user_id', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ user_id: usuario.id, email: emailN, nome: nome.trim(), papel, ativo: true }),
});
await api('/rest/v1/auditoria', {
  method: 'POST',
  headers: { Prefer: 'return=minimal' },
  body: JSON.stringify({ ator_email: 'script-criar-admin', acao: 'admin_promovido', entidade: 'admin', entidade_id: usuario.id, detalhes: { papel } }),
});
console.log(`✓ Acesso ao painel liberado (${papel}). Entre em /admin/ com este e-mail.`);
