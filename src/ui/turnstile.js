// Cloudflare Turnstile (anti-robô) reutilizável: formulário público, login,
// recuperação e troca de senha. O Supabase Auth valida o token no servidor
// quando o CAPTCHA está ativado no projeto.
import { caminho } from './caminho.js';

let script = null;
let chaveCache;

function carregarScript() {
  if (script) return script;
  script = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => { script = null; reject(new Error('Não foi possível carregar a verificação de segurança.')); };
    document.head.append(s);
  });
  return script;
}

/** Site key pública do Turnstile (vem do backend; null quando não configurado). */
export async function obterChaveTurnstile() {
  if (chaveCache !== undefined) return chaveCache;
  if (__DEMO__) { chaveCache = null; return null; }
  try {
    const r = await fetch(caminho('api/form-config'), { headers: { Accept: 'application/json' } });
    const j = await r.json();
    chaveCache = j?.turnstile_site_key || null;
  } catch {
    chaveCache = null;
  }
  return chaveCache;
}

/**
 * Renderiza o widget em `alvo`. Retorna { token(), reset() }.
 * Sem chave configurada, devolve um objeto inerte (token vazio).
 */
export async function criarVerificacao(alvo, chave) {
  const siteKey = chave === undefined ? await obterChaveTurnstile() : chave;
  if (!siteKey || !alvo) return { ativo: false, token: () => '', reset: () => {} };
  const ts = await carregarScript();
  const id = ts.render(alvo, { sitekey: siteKey, language: 'pt-br', theme: 'light' });
  return {
    ativo: true,
    token: () => ts.getResponse(id) || '',
    reset: () => ts.reset(id),
  };
}
