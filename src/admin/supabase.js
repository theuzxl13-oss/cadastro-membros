// Cliente Supabase do painel. Usa apenas a chave PÚBLICA (anon/publishable):
// todo acesso a dados é autorizado pelo Postgres (RLS) com base no usuário logado.
import { createClient } from '@supabase/supabase-js';
import { criarClienteDemo } from '../demo/cliente-demo.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configurado = __DEMO__ || !!(url && chave);
export const BUCKET = 'fotos-cadastros';

// Sessão guardada no sessionStorage: fechar o navegador encerra o acesso.
// Na prévia de demonstração (GitHub Pages) usa dados fictícios no navegador.
export const sb = __DEMO__ ? criarClienteDemo() : (url && chave)
  ? createClient(url, chave, {
    auth: {
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  })
  : null;

export async function adminAtual() {
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb
    .from('admins')
    .select('user_id,email,nome,papel,ativo')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error || !data || !data.ativo) return null;
  return { ...data, session };
}

export function mensagemErro(e) {
  const m = String(e?.message || e || '');
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'E-mail ainda não confirmado.';
  if (/captcha/i.test(m)) return 'A verificação de segurança falhou ou expirou. Refaça a verificação e tente novamente.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet.';
  if (/JWT expired|invalid JWT|session/i.test(m)) return 'Sua sessão expirou. Entre novamente.';
  if (/Permissão negada|permission denied|row-level security/i.test(m)) return 'Você não tem permissão para esta operação.';
  if (/Password should be|weak password/i.test(m)) return 'Senha fraca: use pelo menos 10 caracteres, misturando letras e números.';
  if (/same password|different from the old/i.test(m)) return 'A nova senha deve ser diferente da atual.';
  if (/duplicate key|congregacoes_nome_unico/i.test(m)) return 'Já existe um registro com esse nome.';
  return m || 'Ocorreu um erro inesperado.';
}
