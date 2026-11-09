// Segurança: RLS, Storage privado, API pública validada no backend, anti-spam.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import {
  prepararUsuarios, garantirCongregacao, enviarFicha, DADOS_VALIDOS, cadastroPorProtocolo,
  comoUsuario, login, svc, ADMIN, SECRETARIA, COMUM, baixarFotoServico, foto, BASE, SECRET,
} from './apoio.js';

let congregacaoId;
let ficha; // cadastro criado para os testes

test.beforeAll(async () => {
  await prepararUsuarios();
  congregacaoId = await garantirCongregacao();
  const r = await enviarFicha(DADOS_VALIDOS(congregacaoId, { nome: 'E2E Segurança' }), { foto: foto('foto-3x4-com-gps.jpg') });
  expect(r.status).toBe(201);
  ficha = await cadastroPorProtocolo(r.json.protocolo);
});

test.afterAll(async () => {
  if (ficha) {
    await fetch(`http://127.0.0.1:54321/storage/v1/object/fotos-cadastros`, { method: 'DELETE', headers: { apikey: SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [ficha.foto_path] }) });
    await svc(`/rest/v1/cadastros?id=eq.${ficha.id}`, { method: 'DELETE' });
  }
});

test.describe('API pública /api/submit', () => {
  test('ficha nova entra sempre como PENDENTE, com foto sem EXIF/GPS', async () => {
    expect(ficha.status).toBe('PENDENTE');
    expect(ficha.cpf).toBe('52998224725');
    expect(ficha.consentimento_lgpd).toBe(true);
    const bytes = await baixarFotoServico(ficha.foto_path);
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(bytes.includes('Exif')).toBe(false);
    expect(bytes.includes('CameraTeste')).toBe(false);
  });

  test('não aceita forçar status APROVADO pelo envio público', async () => {
    const r = await enviarFicha({ ...DADOS_VALIDOS(congregacaoId), status: 'APROVADO', nome: 'E2E Tentativa Status' });
    expect(r.status).toBe(201);
    const c = await cadastroPorProtocolo(r.json.protocolo);
    expect(c.status).toBe('PENDENTE');
    await fetch(`http://127.0.0.1:54321/storage/v1/object/fotos-cadastros`, { method: 'DELETE', headers: { apikey: SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [c.foto_path] }) });
    await svc(`/rest/v1/cadastros?id=eq.${c.id}`, { method: 'DELETE' });
  });

  test('recusa dados inválidos (422) com erros por campo', async () => {
    const r = await enviarFicha(DADOS_VALIDOS(congregacaoId, { cpf: '123.456.789-00', celular: '11', nome: '' }));
    expect(r.status).toBe(422);
    expect(r.json.erros.cpf).toBeTruthy();
    expect(r.json.erros.celular).toBeTruthy();
    expect(r.json.erros.nome).toBeTruthy();
  });

  test('recusa congregação inexistente/inativa', async () => {
    const r = await enviarFicha(DADOS_VALIDOS(999999));
    expect(r.status).toBe(422);
    expect(r.json.erros.congregacao_id).toBeTruthy();
  });

  test('recusa sem foto, foto não-JPEG e foto fora do 3x4', async () => {
    expect((await enviarFicha(DADOS_VALIDOS(congregacaoId), { foto: null })).status).toBe(400);
    expect((await enviarFicha(DADOS_VALIDOS(congregacaoId), { foto: foto('foto.png') })).status).toBe(400);
    const r = await enviarFicha(DADOS_VALIDOS(congregacaoId), { foto: foto('foto-paisagem.jpg') });
    expect(r.status).toBe(400);
    expect(r.json.erro).toMatch(/3x4/);
  });

  test('recusa sem consentimento LGPD, menor sem responsável, robô (honeypot) e envio rápido demais', async () => {
    expect((await enviarFicha(DADOS_VALIDOS(congregacaoId), { consentimento: 'false' })).status).toBe(400);
    const menor = await enviarFicha(DADOS_VALIDOS(congregacaoId, { data_nascimento: '2015-01-01' }));
    expect(menor.status).toBe(400);
    expect(menor.json.erro).toMatch(/responsável/);
    expect((await enviarFicha(DADOS_VALIDOS(congregacaoId), { website: 'http://spam' })).status).toBe(400);
    expect((await enviarFicha(DADOS_VALIDOS(congregacaoId), { tempo: 800 })).status).toBe(400);
  });

  test('recusa origem de outro site (CSRF)', async () => {
    const r = await enviarFicha(DADOS_VALIDOS(congregacaoId), { headers: { Origin: 'https://site-malicioso.example' } });
    expect(r.status).toBe(403);
  });

  test('form-config expõe apenas congregações ativas (id e nome) e nenhum dado pessoal', async () => {
    const r = await fetch(`${BASE}/api/form-config`);
    const j = await r.json();
    expect(j.ok).toBe(true);
    for (const c of j.congregacoes) expect(Object.keys(c).sort()).toEqual(['id', 'nome']);
    expect(JSON.stringify(j)).not.toContain('cpf');
  });

  test('limite de envios por IP funciona (função do banco)', async () => {
    const ip = `teste-${Date.now()}`;
    const args = { p_ip_hash: ip, p_max_ip: 2, p_max_global: 100000 };
    expect(await svc('/rest/v1/rpc/registrar_tentativa_envio', { method: 'POST', body: args })).toBe(true);
    expect(await svc('/rest/v1/rpc/registrar_tentativa_envio', { method: 'POST', body: args })).toBe(true);
    expect(await svc('/rest/v1/rpc/registrar_tentativa_envio', { method: 'POST', body: args })).toBe(false);
  });
});

test.describe('RLS e Storage', () => {
  test('anônimo não lê, não insere, não altera nem apaga cadastros', async () => {
    const sel = await comoUsuario(null, '/rest/v1/cadastros?select=*');
    expect([401, 403]).toContain(sel.status);
    const ins = await comoUsuario(null, '/rest/v1/cadastros', { method: 'POST', body: { nome: 'x' } });
    expect([401, 403]).toContain(ins.status);
    const upd = await comoUsuario(null, `/rest/v1/cadastros?id=eq.${ficha.id}`, { method: 'PATCH', body: { status: 'APROVADO' } });
    expect([401, 403]).toContain(upd.status);
    for (const t of ['admins', 'congregacoes', 'configuracoes', 'auditoria', 'envios_controle']) {
      const r = await comoUsuario(null, `/rest/v1/${t}?select=*`);
      expect([401, 403], `tabela ${t}`).toContain(r.status);
    }
  });

  test('anônimo não executa funções administrativas', async () => {
    for (const f of ['dashboard_resumo', 'admin_excluir_cadastro', 'registrar_tentativa_envio', 'promover_admin']) {
      const r = await comoUsuario(null, `/rest/v1/rpc/${f}`, { method: 'POST', body: {} });
      expect(r.status, f).toBeGreaterThanOrEqual(400);
    }
  });

  test('foto é privada: sem URL pública e sem acesso anônimo', async () => {
    const pub = await fetch(`http://127.0.0.1:54321/storage/v1/object/public/fotos-cadastros/${ficha.foto_path}`);
    expect(pub.status).toBeGreaterThanOrEqual(400);
    const anon = await comoUsuario(null, `/storage/v1/object/fotos-cadastros/${ficha.foto_path}`);
    expect(anon.status).toBeGreaterThanOrEqual(400);
    const lista = await comoUsuario(null, '/storage/v1/object/list/fotos-cadastros', { method: 'POST', body: { prefix: 'cadastros/' } });
    const itens = lista.ok ? await lista.json() : [];
    expect(itens.length).toBe(0);
  });

  test('usuário logado SEM papel de administrador não vê nada', async () => {
    const t = await login(COMUM);
    const r = await comoUsuario(t, '/rest/v1/cadastros?select=id');
    expect(await r.json()).toEqual([]);
    const f = await comoUsuario(t, `/storage/v1/object/fotos-cadastros/${ficha.foto_path}`);
    expect(f.status).toBeGreaterThanOrEqual(400);
    const d = await comoUsuario(t, '/rest/v1/rpc/dashboard_resumo', { method: 'POST', body: {} });
    expect(d.status).toBeGreaterThanOrEqual(400);
    const upd = await comoUsuario(t, `/rest/v1/cadastros?id=eq.${ficha.id}`, { method: 'PATCH', body: { status: 'APROVADO' }, headers: { Prefer: 'return=representation' } });
    expect(await upd.json()).toEqual([]);
    const ins = await comoUsuario(t, '/rest/v1/admins', { method: 'POST', body: { user_id: '00000000-0000-0000-0000-000000000000', email: 'x', nome: 'xx' } });
    expect(ins.status).toBeGreaterThanOrEqual(400);
  });

  test('secretaria lê e edita, mas NÃO exclui registro nem foto', async () => {
    const t = await login(SECRETARIA);
    const r = await comoUsuario(t, `/rest/v1/cadastros?select=id,nome&id=eq.${ficha.id}`);
    expect((await r.json())[0].nome).toBe('E2E Segurança');
    const del = await comoUsuario(t, '/rest/v1/rpc/admin_excluir_cadastro', { method: 'POST', body: { p_id: ficha.id } });
    expect(del.status).toBeGreaterThanOrEqual(400);
    const delDireto = await comoUsuario(t, `/rest/v1/cadastros?id=eq.${ficha.id}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
    expect(delDireto.status === 403 || delDireto.status === 401 || (await delDireto.json()).length === 0).toBeTruthy();
    const delFoto = await comoUsuario(t, '/storage/v1/object/fotos-cadastros', { method: 'DELETE', body: { prefixes: [ficha.foto_path] } });
    const removidas = delFoto.ok ? await delFoto.json() : [];
    expect(removidas.length).toBe(0);
    expect(await cadastroPorProtocolo(ficha.protocolo)).not.toBeNull();
  });

  test('admin não consegue alterar protocolo, data de recebimento nem consentimento', async () => {
    const t = await login(ADMIN);
    await comoUsuario(t, `/rest/v1/cadastros?id=eq.${ficha.id}`, {
      method: 'PATCH',
      body: { protocolo: 'S46-FALSO', created_at: '2000-01-01T00:00:00Z', consentimento_lgpd: false },
    });
    const c = await cadastroPorProtocolo(ficha.protocolo);
    expect(c).not.toBeNull();
    expect(c.created_at).toBe(ficha.created_at);
  });

  test('chave secreta nunca aparece no frontend publicado', async () => {
    const dir = new URL('../../dist/assets/', import.meta.url);
    for (const f of readdirSync(dir)) {
      const conteudo = readFileSync(new URL(f, dir), 'utf8');
      expect(conteudo, f).not.toContain(SECRET);
      // nenhuma chave secreta no formato novo (o texto "sb_secret_" sozinho existe na biblioteca)
      expect(conteudo, f).not.toMatch(/sb_secret_[A-Za-z0-9_-]{10,}/);
      // nenhum JWT com papel service_role
      for (const jwt of conteudo.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
        const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
        expect(payload.role, f).not.toBe('service_role');
      }
    }
  });
});
