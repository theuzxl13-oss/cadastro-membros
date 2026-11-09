// Cliente mínimo para a API do Supabase usado SOMENTE no backend
// (Cloudflare Pages Functions). A chave secreta/service_role vem de variável
// de ambiente criptografada da Cloudflare e nunca é enviada ao navegador.

export class ErroConfig extends Error {}

export function configSupabase(env) {
  const url = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const chave = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '';
  if (!url || !chave) {
    throw new ErroConfig('Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configuradas.');
  }
  return { url, chave };
}

function cabecalhos({ chave }, extra = {}) {
  const h = { apikey: chave, ...extra };
  // Chaves no formato novo (sb_secret_...) não são JWT e vão apenas em `apikey`.
  if (!chave.startsWith('sb_')) h.Authorization = `Bearer ${chave}`;
  return h;
}

// Nunca repassa o corpo da resposta de erro: mensagens do PostgreSQL podem
// conter a linha inteira ("Failing row contains ...") com CPF, RG, endereço.
// Registra apenas o status HTTP e o código técnico do erro.
async function lerErro(resp) {
  const texto = await resp.text().catch(() => '');
  let codigo = '';
  try { codigo = String(JSON.parse(texto).code || JSON.parse(texto).error || '').replace(/[^\w.-]/g, '').slice(0, 20); } catch { /* corpo não-JSON */ }
  return `${resp.status}${codigo ? ` código=${codigo}` : ''}`;
}

export async function rest(cfg, caminho, { method = 'GET', body, prefer } = {}) {
  const extra = { 'Content-Type': 'application/json' };
  if (prefer) extra.Prefer = prefer;
  const resp = await fetch(`${cfg.url}/rest/v1/${caminho}`, {
    method,
    headers: cabecalhos(cfg, extra),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!resp.ok) {
    const e = new Error(`Supabase REST ${method} ${caminho.split('?')[0]}: ${await lerErro(resp)}`);
    e.status = resp.status;
    throw e;
  }
  if (resp.status === 204) return null;
  const t = await resp.text();
  return t ? JSON.parse(t) : null;
}

export async function rpc(cfg, funcao, args) {
  return rest(cfg, `rpc/${funcao}`, { method: 'POST', body: args });
}

export async function enviarArquivo(cfg, bucket, caminho, bytes, tipo) {
  const resp = await fetch(`${cfg.url}/storage/v1/object/${bucket}/${caminho}`, {
    method: 'POST',
    headers: cabecalhos(cfg, { 'Content-Type': tipo, 'x-upsert': 'false', 'cache-control': 'no-store' }),
    body: bytes,
  });
  if (!resp.ok) throw new Error(`Storage upload: ${await lerErro(resp)}`);
}

export async function removerArquivo(cfg, bucket, caminho) {
  const resp = await fetch(`${cfg.url}/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers: cabecalhos(cfg, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: [caminho] }),
  });
  if (!resp.ok) throw new Error(`Storage delete: ${await lerErro(resp)}`);
}
