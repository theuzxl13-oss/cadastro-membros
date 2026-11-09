// Comunicação do formulário público com o backend (/api do Cloudflare Pages).
import { caminho } from '../ui/caminho.js';

export async function obterConfig() {
  if (__DEMO__) return (await import('../demo/backend-publico-demo.js')).obterConfigDemo();
  const r = await fetch(caminho('api/form-config'), { headers: { Accept: 'application/json' } });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.erro || 'Não foi possível carregar o formulário.');
  return j;
}

/** @returns {Promise<{status:number, json:object}>} */
export async function enviarFicha(fd) {
  if (__DEMO__) return (await import('../demo/backend-publico-demo.js')).enviarFichaDemo(fd);
  const r = await fetch(caminho('api/submit'), { method: 'POST', body: fd });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
