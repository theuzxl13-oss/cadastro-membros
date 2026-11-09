// POST /api/submit  — recebimento público da ficha (sem conta).
//
// Camadas de proteção:
//  1. Somente POST multipart do mesmo domínio (verificação de Origin)
//  2. Tamanho máximo da requisição
//  3. Campo-armadilha (honeypot) e tempo mínimo de preenchimento
//  4. Cloudflare Turnstile (quando configurado)
//  5. Limite de envios por IP (hash) e limite global diário
//  6. Validação completa dos dados no servidor (mesmas regras do formulário)
//  7. Foto: somente JPEG real, proporção 3x4, metadados (EXIF/GPS) removidos
//  8. Gravação com chave secreta apenas aqui; o banco não aceita INSERT público
import { validarCadastro, VERSAO_CONSENTIMENTO, menorDeIdade } from '../../src/shared/campos.js';
import { configSupabase, rest, rpc, enviarArquivo, removerArquivo, ErroConfig } from '../_lib/supabase.js';
import { limparJpeg, ErroImagem } from '../_lib/jpeg.js';
import { json, erro } from '../_lib/resposta.js';

const BUCKET = 'fotos-cadastros';
const MAX_REQUISICAO = 4 * 1024 * 1024;
const MAX_FOTO = 3 * 1024 * 1024;
const TEMPO_MINIMO_MS = 5000;

async function sha256(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Lê o corpo com limite real de bytes (não confia no cabeçalho Content-Length)
async function lerCorpoLimitado(request, limite) {
  if (!request.body) return new Uint8Array();
  const leitor = request.body.getReader();
  const partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) { await leitor.cancel(); return null; }
    partes.push(value);
  }
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { saida.set(p, pos); pos += p.byteLength; }
  return saida;
}

async function verificarTurnstile(env, token, ip, hostEsperado) {
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  if (!resp.ok) return false;
  const r = await resp.json();
  // O token precisa ter sido emitido para ESTE site (evita reaproveitar tokens de outro domínio)
  return r.success === true && (!hostEsperado || r.hostname === hostEsperado);
}

export async function onRequestPost({ request, env }) {
  // 1. Origem
  const origem = request.headers.get('Origin');
  const url = new URL(request.url);
  if (origem && origem !== url.origin) return erro(403, 'Origem não permitida.');

  // 2. Tamanho
  const tamanho = Number(request.headers.get('Content-Length') || 0);
  if (tamanho > MAX_REQUISICAO) return erro(413, 'Envio muito grande. A foto deve ter no máximo 3 MB.');
  const tipo = request.headers.get('Content-Type') || '';
  if (!tipo.startsWith('multipart/form-data')) return erro(415, 'Formato de envio inválido.');

  let cfg;
  try {
    cfg = configSupabase(env);
  } catch (e) {
    console.error(e?.message);
    return erro(503, 'Sistema ainda não configurado. Procure a secretaria.');
  }

  let form;
  try {
    const corpo = await lerCorpoLimitado(request, MAX_REQUISICAO);
    if (corpo === null) return erro(413, 'Envio muito grande. A foto deve ter no máximo 3 MB.');
    form = await new Response(corpo, { headers: { 'Content-Type': tipo } }).formData();
  } catch {
    return erro(400, 'Não foi possível ler o envio.');
  }

  // 3. Honeypot e tempo mínimo
  if (String(form.get('website') || '') !== '') return erro(400, 'Envio recusado.');
  const tempo = Number(form.get('tempo_preenchimento') || 0);
  if (!Number.isFinite(tempo) || tempo < TEMPO_MINIMO_MS) {
    return erro(400, 'Envio muito rápido. Confira os dados e tente novamente.');
  }

  const ip = request.headers.get('CF-Connecting-IP') || '';

  // 4. Turnstile
  if (env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY) {
    const token = String(form.get('cf-turnstile-response') || '');
    if (!token) return erro(400, 'Confirme a verificação de segurança antes de enviar.');
    let okTs = false;
    try { okTs = await verificarTurnstile(env, token, ip, url.hostname); } catch (e) { console.error('turnstile', e?.message); }
    if (!okTs) return erro(400, 'A verificação de segurança falhou. Atualize a verificação e envie novamente.');
  }

  // Consentimento
  if (String(form.get('consentimento') || '') !== 'true') {
    return erro(400, 'É necessário aceitar o aviso de privacidade para enviar a ficha.');
  }

  // Dados
  let bruto;
  try {
    const texto = String(form.get('dados') || '');
    if (texto.length > 20000) return erro(400, 'Dados muito grandes.');
    bruto = JSON.parse(texto);
  } catch {
    return erro(400, 'Dados do formulário inválidos.');
  }

  // Foto
  const foto = form.get('foto');
  if (!foto || typeof foto === 'string') return erro(400, 'Envie a foto 3x4.', { erros: { foto: 'Envie a foto 3x4.' } });
  if (foto.size > MAX_FOTO) return erro(400, 'A foto deve ter no máximo 3 MB.', { erros: { foto: 'Foto muito grande.' } });

  try {
    // Estado do formulário e congregações ativas
    const [configs, congregacoes] = await Promise.all([
      rest(cfg, 'configuracoes?select=formulario_aberto&id=eq.1'),
      rest(cfg, 'congregacoes?select=id&ativa=eq.true'),
    ]);
    if (configs?.[0] && configs[0].formulario_aberto === false) {
      return erro(403, 'O recebimento de fichas está temporariamente fechado.');
    }

    // 6. Validação
    const { dados, erros } = validarCadastro(bruto, { congregacoesValidas: congregacoes.map((c) => c.id) });
    if (Object.keys(erros).length) {
      return erro(422, 'Há campos com problemas. Revise e envie novamente.', { erros });
    }

    const responsavel = String(form.get('consentimento_responsavel') || '') === 'true';
    if (menorDeIdade(dados.data_nascimento) && !responsavel) {
      return erro(400, 'Para menores de 18 anos, o consentimento deve ser dado pelo pai, mãe ou responsável legal.');
    }

    // 7. Foto
    let imagem;
    try {
      imagem = limparJpeg(new Uint8Array(await foto.arrayBuffer()));
    } catch (e) {
      if (e instanceof ErroImagem) return erro(400, e.message, { erros: { foto: e.message } });
      throw e;
    }
    const proporcao = imagem.largura / imagem.altura;
    if (imagem.largura > 2400 || imagem.altura > 3200) {
      return erro(400, 'A foto tem resolução excessiva.', { erros: { foto: 'Resolução muito alta.' } });
    }
    if (imagem.largura < 150 || imagem.altura < 200 || proporcao < 0.7 || proporcao > 0.8) {
      return erro(400, 'A foto precisa estar no formato 3x4 (retrato).', { erros: { foto: 'Formato 3x4 obrigatório.' } });
    }

    // 5. Limite de envios (contabiliza apenas tentativas válidas)
    const ipHash = await sha256(`${env.IP_HASH_SALT || 'setor46'}|${ip || 'sem-ip'}`);
    const permitido = await rpc(cfg, 'registrar_tentativa_envio', {
      p_ip_hash: ipHash,
      p_max_ip: Number(env.LIMITE_ENVIOS_POR_HORA || 5),
      p_max_global: Number(env.LIMITE_ENVIOS_POR_DIA || 400),
    });
    if (permitido !== true) {
      return erro(429, 'Muitos envios em sequência. Aguarde uma hora e tente novamente, ou procure a secretaria.');
    }

    // 8. Gravação: foto primeiro, depois o registro (desfaz a foto se falhar)
    const id = crypto.randomUUID();
    const caminho = `cadastros/${id}.jpg`;
    await enviarArquivo(cfg, BUCKET, caminho, imagem.bytes, 'image/jpeg');

    let linha;
    try {
      const r = await rest(cfg, 'cadastros?select=protocolo', {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          ...dados,
          id,
          foto_path: caminho,
          consentimento_lgpd: true,
          consentimento_versao: VERSAO_CONSENTIMENTO,
          consentimento_responsavel: responsavel,
        },
      });
      linha = r?.[0];
    } catch (e) {
      await removerArquivo(cfg, BUCKET, caminho).catch((x) => console.error('rollback foto', x?.message));
      throw e;
    }

    return json({ ok: true, protocolo: linha?.protocolo }, 201);
  } catch (e) {
    console.error('submit', e?.message); // mensagem já sanitizada (sem dados pessoais)
    if (e instanceof ErroConfig) return erro(503, 'Sistema ainda não configurado.');
    return erro(500, 'Não foi possível registrar a ficha agora. Tente novamente em alguns minutos.');
  }
}

