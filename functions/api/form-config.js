// GET /api/form-config
// Dados mínimos e públicos para montar o formulário: congregações ATIVAS
// (somente id e nome), se o formulário está aberto e os dados do encarregado
// de proteção de dados. Nenhum dado de cadastro é exposto.
import { configSupabase, rest, ErroConfig } from '../_lib/supabase.js';
import { json, erro } from '../_lib/resposta.js';

export async function onRequestGet({ env }) {
  try {
    const cfg = configSupabase(env);
    const [congregacoes, configs] = await Promise.all([
      rest(cfg, 'congregacoes?select=id,nome&ativa=eq.true&order=nome.asc'),
      rest(cfg, 'configuracoes?select=formulario_aberto,endereco_sede,pastor_setorial,encarregado_lgpd_nome,encarregado_lgpd_contato&id=eq.1'),
    ]);
    const c = configs?.[0] || {};
    const turnstileAtivo = !!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
    return json({
      ok: true,
      aberto: c.formulario_aberto !== false,
      congregacoes,
      endereco_sede: c.endereco_sede || '',
      pastor_setorial: c.pastor_setorial || '',
      encarregado_nome: c.encarregado_lgpd_nome || '',
      encarregado_contato: c.encarregado_lgpd_contato || '',
      turnstile_site_key: turnstileAtivo ? env.TURNSTILE_SITE_KEY : null,
    });
  } catch (e) {
    console.error('form-config', e);
    if (e instanceof ErroConfig) return erro(503, 'Sistema ainda não configurado. Procure a secretaria.');
    return erro(502, 'Não foi possível carregar o formulário. Tente novamente em instantes.');
  }
}
