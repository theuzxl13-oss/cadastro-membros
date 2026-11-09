// Utilitários dos testes E2E. Usam o Supabase LOCAL (supabase start).
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// As chaves do Supabase LOCAL são lidas de variáveis de ambiente ou, na falta
// delas, do comando `supabase status` (nada de chave fixa no código).
function statusLocal() {
  try {
    const saida = execSync('npx supabase status -o env', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return Object.fromEntries(saida.split('\n').map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  } catch {
    return {};
  }
}
const precisaStatus = !(process.env.TEST_SUPABASE_PUBLISHABLE_KEY && process.env.TEST_SUPABASE_SECRET_KEY);
const local = precisaStatus ? statusLocal() : {};

export const SUPA = process.env.TEST_SUPABASE_URL || local.API_URL || 'http://127.0.0.1:54321';
export const PUB = process.env.TEST_SUPABASE_PUBLISHABLE_KEY || local.PUBLISHABLE_KEY || local.ANON_KEY;
export const SECRET = process.env.TEST_SUPABASE_SECRET_KEY || local.SECRET_KEY || local.SERVICE_ROLE_KEY;
if (!PUB || !SECRET) throw new Error('Supabase local não encontrado: rode `npm run db:local` ou defina TEST_SUPABASE_*.');
if (!/127\.0\.0\.1|localhost/.test(SUPA)) throw new Error('Os testes E2E só podem rodar contra o Supabase LOCAL.');
export const BASE = 'http://127.0.0.1:8788';
export const MAILPIT = 'http://127.0.0.1:54324';

export const ADMIN = { email: 'e2e.admin@teste.dev', senha: 'E2eAdminSenha2025', nome: 'Admin E2E', papel: 'admin' };
export const SECRETARIA = { email: 'e2e.secretaria@teste.dev', senha: 'E2eSecretaria2025', nome: 'Secretaria E2E', papel: 'secretaria' };
export const COMUM = { email: 'e2e.comum@teste.dev', senha: 'E2eComumSenha2025' };

export const foto = (nome = 'foto-3x4.jpg') => readFileSync(new URL(`../fixtures/${nome}`, import.meta.url));

export async function svc(caminho, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(`${SUPA}${caminho}`, {
    method,
    headers: { apikey: SECRET, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${caminho}: ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}

async function garantirUsuario(u) {
  const lista = await svc('/auth/v1/admin/users?per_page=1000');
  let user = lista.users.find((x) => x.email === u.email);
  if (!user) user = await svc('/auth/v1/admin/users', { method: 'POST', body: { email: u.email, password: u.senha, email_confirm: true } });
  else await svc(`/auth/v1/admin/users/${user.id}`, { method: 'PUT', body: { password: u.senha } });
  return user;
}

export async function prepararUsuarios() {
  for (const u of [ADMIN, SECRETARIA]) {
    const user = await garantirUsuario(u);
    await svc('/rest/v1/admins?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: { user_id: user.id, email: u.email, nome: u.nome, papel: u.papel, ativo: true },
    });
  }
  await garantirUsuario(COMUM); // usuário autenticado SEM permissão de administrador
}

export async function garantirCongregacao(nome = 'E2E Congregação Teste') {
  const ex = await svc(`/rest/v1/congregacoes?select=id,nome,ativa&nome=eq.${encodeURIComponent(nome)}`);
  if (ex.length) {
    if (!ex[0].ativa) await svc(`/rest/v1/congregacoes?id=eq.${ex[0].id}`, { method: 'PATCH', body: { ativa: true } });
    return ex[0].id;
  }
  const [c] = await svc('/rest/v1/congregacoes?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { nome } });
  return c.id;
}

export async function login(u) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUB, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: u.senha }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j.access_token;
}

/** Chama a API do Supabase como anônimo (token = null) ou como usuário logado. */
export async function comoUsuario(token, caminho, { method = 'GET', body, headers = {} } = {}) {
  return fetch(`${SUPA}${caminho}`, {
    method,
    headers: { apikey: PUB, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : (body instanceof Uint8Array || Buffer.isBuffer(body) ? body : JSON.stringify(body)),
  });
}

export const DADOS_VALIDOS = (congregacaoId, extra = {}) => ({
  congregacao_id: String(congregacaoId),
  nome: 'E2E Pessoa de Teste',
  data_nascimento: '1985-04-20',
  estado_civil: 'SOLTEIRO',
  cpf: '529.982.247-25',
  cep: '06900-000',
  endereco: 'Rua dos Testes',
  numero: '100',
  bairro: 'Centro',
  cidade: 'Embu-Guaçu',
  estado: 'SP',
  celular: '(11) 98765-4321',
  cargo: 'MEMBRO',
  ...extra,
});

/** Envia uma ficha pela API pública (/api/submit), como faria o navegador. */
export async function enviarFicha(dados, opts = {}) {
  const fd = new FormData();
  fd.append('dados', JSON.stringify(dados));
  if (opts.foto !== null) fd.append('foto', new Blob([opts.foto || foto()], { type: 'image/jpeg' }), 'f.jpg');
  fd.append('consentimento', opts.consentimento ?? 'true');
  fd.append('consentimento_responsavel', opts.responsavel ?? 'false');
  fd.append('tempo_preenchimento', String(opts.tempo ?? 9000));
  fd.append('website', opts.website ?? '');
  const r = await fetch(`${BASE}/api/submit`, { method: 'POST', body: fd, headers: opts.headers || {} });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

export async function cadastroPorProtocolo(protocolo) {
  const r = await svc(`/rest/v1/cadastros?select=*&protocolo=eq.${protocolo}`);
  return r[0] || null;
}

export async function existeFoto(caminho) {
  const r = await fetch(`${SUPA}/storage/v1/object/fotos-cadastros/${caminho}`, { headers: { apikey: SECRET } });
  return r.status === 200;
}

export async function baixarFotoServico(caminho) {
  const r = await fetch(`${SUPA}/storage/v1/object/fotos-cadastros/${caminho}`, { headers: { apikey: SECRET } });
  return Buffer.from(await r.arrayBuffer());
}
