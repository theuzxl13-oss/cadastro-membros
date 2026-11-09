export function json(dados, status = 200, extra = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      // Respostas da API: sem CORS aberto, sem conteúdo executável, sem cache
      'Access-Control-Allow-Origin': 'null',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
      ...extra,
    },
  });
}

export const erro = (status, mensagem, extra = {}) => json({ ok: false, erro: mensagem, ...extra }, status);
