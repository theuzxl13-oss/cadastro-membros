// Painel administrativo: login, rotas protegidas, dashboard, filtros, ficha,
// edição, foto, aprovação, impressão, exportação, congregações, QR Code,
// exclusão definitiva (registro + foto), auditoria, logout e recuperação de senha.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  prepararUsuarios, garantirCongregacao, enviarFicha, DADOS_VALIDOS, cadastroPorProtocolo,
  svc, existeFoto, baixarFotoServico, ADMIN, SECRETARIA, MAILPIT, SECRET,
} from './apoio.js';

const FOTO_NOVA = fileURLToPath(new URL('../fixtures/foto.png', import.meta.url));
let congregacaoId;
let fichaA; // será editada, aprovada, impressa e exportada
let fichaB; // será excluída
const sufixo = Date.now().toString().slice(-6);

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await prepararUsuarios();
  congregacaoId = await garantirCongregacao();
  const a = await enviarFicha(DADOS_VALIDOS(congregacaoId, { nome: `Painel Alfa ${sufixo}`, cpf: '111.444.777-35' }));
  const b = await enviarFicha(DADOS_VALIDOS(congregacaoId, { nome: `Painel Beta ${sufixo}`, cpf: '390.533.447-05', cargo: 'DIACONO', obreiro_local: 'Sede', obreiro_data: '2019-02-02' }));
  expect(a.status).toBe(201);
  expect(b.status).toBe(201);
  fichaA = await cadastroPorProtocolo(a.json.protocolo);
  fichaB = await cadastroPorProtocolo(b.json.protocolo);
});

test.afterAll(async () => {
  const c = fichaA && await cadastroPorProtocolo(fichaA.protocolo);
  if (c) {
    await fetch('http://127.0.0.1:54321/storage/v1/object/fotos-cadastros', { method: 'DELETE', headers: { apikey: SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [c.foto_path] }) });
    await svc(`/rest/v1/cadastros?id=eq.${c.id}`, { method: 'DELETE' });
  }
});

async function entrar(page, u = ADMIN) {
  await page.goto('/admin/');
  await page.fill('#email', u.email);
  await page.fill('#senha', u.senha);
  await page.click('#btn-entrar');
  await expect(page.locator('.indicadores')).toBeVisible();
}

test('rotas protegidas: painel sem login volta para a tela de acesso', async ({ page }) => {
  await page.goto('/admin/painel.html#/cadastros');
  await expect(page).toHaveURL(/\/admin\/(index\.html)?(\?.*)?$/);
  await expect(page.locator('#form-login')).toBeVisible();
  await expect(page.locator('img[src="/img/logo-setor46.jpg"]')).toBeVisible();
});

test('login: senha errada, mostrar senha e entrada correta', async ({ page }) => {
  await page.goto('/admin/');
  await page.fill('#email', ADMIN.email);
  await page.fill('#senha', 'senha-errada-123');
  await page.click('.ver-senha');
  await expect(page.locator('#senha')).toHaveAttribute('type', 'text');
  await page.click('.ver-senha');
  await expect(page.locator('#senha')).toHaveAttribute('type', 'password');
  await page.click('#btn-entrar');
  await expect(page.locator('#aviso')).toHaveText('E-mail ou senha incorretos.');
  await page.fill('#senha', ADMIN.senha);
  await page.click('#btn-entrar');
  await expect(page.locator('.indicadores')).toBeVisible();
  await expect(page.locator('#usuario')).toContainText(ADMIN.nome);
});

test('usuário sem papel de administrador é barrado no login', async ({ page }) => {
  await page.goto('/admin/');
  await page.fill('#email', 'e2e.comum@teste.dev');
  await page.fill('#senha', 'E2eComumSenha2025');
  await page.click('#btn-entrar');
  await expect(page.locator('#aviso')).toContainText('não tem acesso');
});

test('dashboard, menu completo e filtros por nome, CPF, congregação, cargo, status e período', async ({ page }) => {
  await entrar(page);
  for (const item of ['Dashboard', 'Todos os cadastros', 'Pendentes', 'Aprovados', 'Congregações', 'QR Code', 'Exportação', 'Configurações', 'Sair']) {
    await expect(page.locator('.menu')).toContainText(item);
  }
  const total = await svc('/rest/v1/cadastros?select=id');
  await expect(page.locator('.indicador').first().locator('.num')).toHaveText(String(total.length));

  await page.click('a[data-rota=cadastros]');
  await page.fill('#fl-q', `painel alfa ${sufixo}`);
  await page.click('form.filtros button[type=submit]');
  await expect(page.locator('table.tabela tbody tr')).toHaveCount(1);
  await expect(page.locator('table.tabela tbody')).toContainText(fichaA.protocolo);

  await page.fill('#fl-q', '390.533');
  await page.click('form.filtros button[type=submit]');
  await expect(page.locator('table.tabela tbody tr')).toHaveCount(1);
  await expect(page.locator('table.tabela tbody')).toContainText(`Painel Beta ${sufixo}`);

  await page.fill('#fl-q', '');
  await page.selectOption('#fl-cargo', 'DIACONO');
  await page.selectOption('#fl-congregacao', String(congregacaoId));
  await page.fill('#fl-de', '2020-01-01');
  await page.click('form.filtros button[type=submit]');
  await expect(page.locator('table.tabela tbody')).toContainText(`Painel Beta ${sufixo}`);
  await expect(page.locator('table.tabela tbody')).not.toContainText(`Painel Alfa ${sufixo}`);

  await page.fill('#fl-de', '2000-01-01');
  await page.fill('#fl-ate', '2000-12-31');
  await page.click('form.filtros button[type=submit]');
  await expect(page.locator('.vazio')).toContainText('Nenhum cadastro');

  await page.click('a[data-rota=aprovados]');
  await expect(page.locator('h1')).toHaveText('Cadastros aprovados');
  await expect(page.locator('#fl-status')).toHaveCount(0);
});

test('ficha completa com foto, edição de dados e substituição da foto', async ({ page }) => {
  await entrar(page);
  await page.goto(`/admin/painel.html#/cadastro/${fichaA.id}`);
  await expect(page.locator('.ficha-info h1')).toHaveText(`Painel Alfa ${sufixo}`);
  await expect(page.locator('.ficha-info .etiqueta')).toHaveText('Pendente');
  const img = page.locator('.ficha-foto img');
  await expect(img).toBeVisible();
  expect(await img.evaluate((i) => i.naturalWidth)).toBe(600);
  expect(await img.getAttribute('src')).toMatch(/^blob:/); // nunca uma URL pública

  const fotoAntes = await baixarFotoServico(fichaA.foto_path);
  await page.click('text=Editar dados');
  await page.fill('#ed-profissao', 'Professora');
  await page.fill('#ed-cpf', '000.000.000-00');
  await page.click('button:has-text("Salvar alterações")');
  await expect(page.locator('.campo[data-campo=cpf] .erro-msg')).toHaveText('CPF inválido.');
  await page.fill('#ed-cpf', '111.444.777-35');
  await page.setInputFiles('#ed-foto', FOTO_NOVA);
  await page.click('button:has-text("Salvar alterações")');
  await expect(page.locator('.toast')).toContainText('Alterações salvas');
  await expect(page.locator('#view')).toContainText('Professora');

  const depois = await cadastroPorProtocolo(fichaA.protocolo);
  expect(depois.profissao).toBe('Professora');
  expect(depois.status).toBe('PENDENTE');
  const fotoDepois = await baixarFotoServico(depois.foto_path);
  expect(Buffer.compare(fotoAntes, fotoDepois)).not.toBe(0);

  const aud = await svc(`/rest/v1/auditoria?select=acao,detalhes&entidade_id=eq.${fichaA.id}&acao=eq.cadastro_editado`);
  expect(aud.length).toBeGreaterThan(0);
  expect(JSON.stringify(aud)).not.toContain('Professora'); // auditoria sem valores pessoais
});

test('aprovar e voltar para pendente', async ({ page }) => {
  await entrar(page);
  await page.goto(`/admin/painel.html#/cadastro/${fichaA.id}`);
  await page.click('button:has-text("Aprovar cadastro")');
  await expect(page.locator('.ficha-info .etiqueta')).toHaveText('Aprovado');
  let c = await cadastroPorProtocolo(fichaA.protocolo);
  expect(c.status).toBe('APROVADO');
  expect(c.aprovado_em).toBeTruthy();
  await page.click('button:has-text("Voltar para pendente")');
  await expect(page.locator('.ficha-info .etiqueta')).toHaveText('Pendente');
  c = await cadastroPorProtocolo(fichaA.protocolo);
  expect(c.status).toBe('PENDENTE');
  await page.click('button:has-text("Aprovar cadastro")');
  await expect(page.locator('.ficha-info .etiqueta')).toHaveText('Aprovado');
});

test('impressão A4 com logo, campos e foto', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {
      const area = document.getElementById('impressao');
      window.__impressao = {
        texto: area.innerText,
        imgs: [...area.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src'), w: i.naturalWidth })),
        classe: document.body.className,
      };
    };
  });
  await entrar(page);
  await page.goto(`/admin/painel.html#/cadastro/${fichaA.id}`);
  await page.click('button:has-text("Imprimir ficha")');
  await page.waitForFunction(() => window.__impressao);
  const r = await page.evaluate(() => window.__impressao);
  expect(r.classe).toContain('imprimindo');
  expect(r.texto).toContain('FICHA DE CADASTRO SETORIAL');
  expect(r.texto).toContain(`Painel Alfa ${sufixo}`);
  expect(r.texto).toContain('111.444.777-35');
  expect(r.imgs[0].src).toBe('/img/logo-setor46.jpg');
  expect(r.imgs[0].w).toBeGreaterThan(0);
  expect(r.imgs[1].src).toMatch(/^blob:/);
  expect(r.imgs[1].w).toBe(600);
});

test('exportação CSV e Excel respeitando filtros', async ({ page }) => {
  await entrar(page);
  await page.goto(`/admin/painel.html#/exportacao?q=${encodeURIComponent(`Painel Alfa ${sufixo}`)}`);
  await expect(page.locator('.card h2')).toHaveText('1 cadastro(s) serão exportados');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Baixar CSV")')]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  const texto = readFileSync(await csv.path(), 'utf8');
  expect(texto.charCodeAt(0)).toBe(0xfeff);
  const linhas = texto.trim().split('\r\n');
  expect(linhas.length).toBe(2);
  expect(linhas[0]).toContain('"Protocolo";"Status"');
  expect(linhas[1]).toContain(`Painel Alfa ${sufixo}`);
  expect(linhas[1]).toContain('111.444.777-35');

  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Baixar Excel")')]);
  expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
  const bin = readFileSync(await xlsx.path());
  expect(bin.subarray(0, 2).toString()).toBe('PK'); // arquivo .xlsx (zip)
  const aud = await svc('/rest/v1/auditoria?select=acao&acao=in.(exportacao_csv,exportacao_excel)');
  expect(aud.length).toBeGreaterThanOrEqual(2);
});

test('congregações: adicionar, editar, desativar e reativar (reflete no formulário público)', async ({ page }) => {
  const nome = `E2E Nova Congregação ${sufixo}`;
  await entrar(page);
  await page.click('a[data-rota=congregacoes]');
  await page.click('button:has-text("Nova congregação")');
  await page.fill('#cg-nome', nome);
  await page.fill('#cg-cidade', 'Embu-Guaçu');
  await page.click('dialog .btn:has-text("Salvar")');
  await expect(page.locator('table.tabela')).toContainText(nome);

  let cfg = await (await fetch('http://127.0.0.1:8788/api/form-config')).json();
  expect(cfg.congregacoes.map((c) => c.nome)).toContain(nome);

  const linha = page.locator('tr', { hasText: nome });
  await linha.locator('button:has-text("Editar")').click();
  await page.fill('#cg-dir', 'Pr. Dirigente Teste');
  await page.click('dialog .btn:has-text("Salvar")');
  await expect(page.locator('tr', { hasText: nome })).toContainText('Pr. Dirigente Teste');

  await page.locator('tr', { hasText: nome }).locator('button:has-text("Desativar")').click();
  await page.click('dialog .btn:has-text("Desativar")');
  await expect(page.locator('tr', { hasText: nome })).toContainText('Inativa');
  cfg = await (await fetch('http://127.0.0.1:8788/api/form-config')).json();
  expect(cfg.congregacoes.map((c) => c.nome)).not.toContain(nome);

  await page.locator('tr', { hasText: nome }).locator('button:has-text("Reativar")').click();
  await page.click('dialog .btn:has-text("Reativar")');
  await expect(page.locator('tr', { hasText: nome })).toContainText('Ativa');

  // limpeza (sem cadastros vinculados)
  await svc(`/rest/v1/congregacoes?nome=eq.${encodeURIComponent(nome)}`, { method: 'DELETE' });
});

test('QR Code: visualizar, copiar link, baixar PNG, gerar PDF e imprimir', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => { window.print = () => { window.__qr = document.getElementById('impressao').innerText; }; });
  await entrar(page);
  await page.click('a[data-rota=qrcode]');
  await expect(page.locator('.qr-caixa canvas')).toBeVisible();
  await expect(page.locator('.qr-link')).toHaveText('http://127.0.0.1:8788/');
  await page.click('button:has-text("Copiar link")');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://127.0.0.1:8788/');

  const [png] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Baixar PNG")')]);
  const pngBytes = readFileSync(await png.path());
  expect(pngBytes.subarray(1, 4).toString()).toBe('PNG');

  const [pdf] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Gerar PDF")')]);
  expect(readFileSync(await pdf.path()).subarray(0, 5).toString()).toBe('%PDF-');

  await page.click('button:has-text("Imprimir")');
  await page.waitForFunction(() => window.__qr);
  expect(await page.evaluate(() => window.__qr)).toContain('Ficha de Cadastro Setorial');
});

test('URL pública nas configurações alimenta o QR Code', async ({ page }) => {
  await entrar(page);
  await page.click('a[data-rota=configuracoes]');
  await page.fill('#cf-url', 'https://cadastro.exemplo-setor46.org/');
  await page.click('button:has-text("Salvar configurações")');
  await expect(page.locator('.toast')).toContainText('Configurações salvas');
  await page.click('a[data-rota=qrcode]');
  await expect(page.locator('.qr-link')).toHaveText('https://cadastro.exemplo-setor46.org/');
  await svc('/rest/v1/configuracoes?id=eq.1', { method: 'PATCH', body: { url_publica: null } });
});

test('secretaria não vê o botão de exclusão', async ({ page }) => {
  await entrar(page, SECRETARIA);
  await page.goto(`/admin/painel.html#/cadastro/${fichaB.id}`);
  await expect(page.locator('.ficha-info h1')).toBeVisible();
  await expect(page.locator('button:has-text("Excluir cadastro")')).toHaveCount(0);
  await expect(page.locator('button:has-text("Aprovar cadastro")')).toBeVisible();
});

test('exclusão definitiva: confirmação explícita, remove registro e foto, registra auditoria sem dados pessoais', async ({ page }) => {
  expect(await existeFoto(fichaB.foto_path)).toBe(true);
  await entrar(page);
  await page.goto(`/admin/painel.html#/cadastro/${fichaB.id}`);
  await page.click('button:has-text("Excluir cadastro")');
  const confirmar = page.locator('dialog .btn.perigo');
  await expect(confirmar).toBeDisabled();
  await page.fill('dialog input', 'S46-ERRADO');
  await expect(confirmar).toBeDisabled();
  await page.click('dialog .btn:has-text("Cancelar")');
  expect(await cadastroPorProtocolo(fichaB.protocolo)).not.toBeNull();

  await page.click('button:has-text("Excluir cadastro")');
  await page.fill('dialog input', fichaB.protocolo);
  await confirmar.click();
  await expect(page.locator('.toast')).toContainText('excluído definitivamente');
  await expect(page).toHaveURL(/#\/cadastros$/);
  await expect(page.locator('main')).not.toContainText(`Painel Beta ${sufixo}`);

  expect(await cadastroPorProtocolo(fichaB.protocolo)).toBeNull();
  expect(await existeFoto(fichaB.foto_path)).toBe(false);
  const aud = await svc(`/rest/v1/auditoria?select=*&entidade_id=eq.${fichaB.id}&acao=eq.cadastro_excluido`);
  expect(aud.length).toBe(1);
  expect(aud[0].ator_email).toBe(ADMIN.email);
  expect(aud[0].detalhes.protocolo).toBe(fichaB.protocolo);
  const todo = JSON.stringify(await svc('/rest/v1/auditoria?select=*'));
  expect(todo).not.toContain(`Painel Beta ${sufixo}`);
  expect(todo).not.toContain('39053344705');

  await page.goto(`/admin/painel.html#/cadastro/${fichaB.id}`);
  await expect(page.locator('h1')).toHaveText('Cadastro não encontrado');
});

test('logout encerra a sessão e bloqueia o painel', async ({ page }) => {
  await entrar(page);
  await page.click('#btn-sair');
  await expect(page.locator('#aviso')).toContainText('saiu');
  await page.goto('/admin/painel.html#/dashboard');
  await expect(page.locator('#form-login')).toBeVisible();
});

test('recuperação de senha por e-mail', async ({ page }) => {
  const caixa = `${MAILPIT}/api/v1`;
  await fetch(`${caixa}/messages`, { method: 'DELETE' });
  await page.goto('/admin/');
  await page.click('#btn-esqueci');
  await page.fill('#email-rec', SECRETARIA.email);
  await page.click('#btn-enviar-rec');
  await expect(page.locator('#aviso')).toContainText('Se o e-mail estiver cadastrado');

  let msg;
  for (let i = 0; i < 20 && !msg; i++) {
    const lista = await (await fetch(`${caixa}/messages`)).json();
    msg = lista.messages?.find((m) => m.To?.some((t) => t.Address === SECRETARIA.email));
    if (!msg) await page.waitForTimeout(500);
  }
  expect(msg).toBeTruthy();
  const corpo = await (await fetch(`${caixa}/message/${msg.ID}`)).json();
  const link = (corpo.Text.match(/https?:\/\/\S+verify\S+/) || [])[0].replace(/&amp;/g, '&').replace(/[)\]]+$/, '');
  await page.goto(link);
  await expect(page.locator('#form-nova')).toBeVisible({ timeout: 10000 });
  const nova = 'NovaSenhaSecretaria2026';
  await page.fill('#senha1', nova);
  await page.fill('#senha2', nova);
  await page.click('#btn-salvar');
  await expect(page.locator('#aviso')).toContainText('Senha alterada');
  await page.fill('#email', SECRETARIA.email);
  await page.fill('#senha', nova);
  await page.click('#btn-entrar');
  await expect(page.locator('.indicadores')).toBeVisible();
});

test('XSS armazenado: conteúdo malicioso gravado no banco aparece como texto e não executa', async ({ page }) => {
  const payload = '<img src=x onerror="window.__xss=1">"><script>window.__xss=1</script>';
  const [g] = await svc('/rest/v1/congregacoes?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { nome: `XSS ${sufixo} ${payload}` } });
  await svc(`/rest/v1/cadastros?id=eq.${fichaA.id}`, { method: 'PATCH', body: { observacoes: payload, profissao: '<b>negrito</b>' } });
  let dialogo = false;
  page.on('dialog', async (d) => { dialogo = true; await d.dismiss(); });
  await entrar(page);
  await page.goto(`/admin/painel.html#/cadastro/${fichaA.id}`);
  await expect(page.locator('#view')).toContainText('<b>negrito</b>');
  await expect(page.locator('#view')).toContainText('onerror');
  await page.click('a[data-rota=congregacoes]');
  await expect(page.locator('#view')).toContainText(`XSS ${sufixo}`);
  await page.click('a[data-rota=dashboard]');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(dialogo).toBe(false);
  await svc(`/rest/v1/congregacoes?id=eq.${g.id}`, { method: 'DELETE' });
});

test('sessão fica só no sessionStorage (não persiste no localStorage) e é limpa no logout', async ({ page }) => {
  await entrar(page);
  const local = await page.evaluate(() => JSON.stringify(localStorage));
  expect(local).not.toContain('access_token');
  const sess = await page.evaluate(() => JSON.stringify(sessionStorage));
  expect(sess).toContain('access_token');
  await page.click('#btn-sair');
  await expect(page.locator('#aviso')).toContainText('saiu');
  const depois = await page.evaluate(() => JSON.stringify(sessionStorage));
  expect(depois).not.toContain('access_token');
});
