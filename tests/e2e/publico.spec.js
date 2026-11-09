// Formulário público no celular: etapas, máscaras, validações, foto, revisão e envio.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import {
  garantirCongregacao, cadastroPorProtocolo, svc, existeFoto, SECRET,
} from './apoio.js';

const FOTO = fileURLToPath(new URL('../fixtures/foto-3x4-com-gps.jpg', import.meta.url));
const PNG = fileURLToPath(new URL('../fixtures/foto.png', import.meta.url));
let congregacaoId;
const criados = [];

test.beforeAll(async () => { congregacaoId = await garantirCongregacao(); });
test.afterAll(async () => {
  for (const c of criados) {
    await fetch('http://127.0.0.1:54321/storage/v1/object/fotos-cadastros', { method: 'DELETE', headers: { apikey: SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [c.foto_path] }) });
    await svc(`/rest/v1/cadastros?id=eq.${c.id}`, { method: 'DELETE' });
  }
});

async function avancar(page) { await page.click('#btn-avancar'); }
// O backend recusa fichas preenchidas em menos de 5 s (anti-robô); o teste respeita isso.
async function aguardarTempoMinimo(page) {
  const decorrido = await page.evaluate(() => performance.now());
  if (decorrido < 5500) await page.waitForTimeout(5500 - decorrido);
}

test('logo oficial, título e etapas aparecem; sem rolagem horizontal', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header.topo img.logo')).toHaveAttribute('src', '/img/logo-setor46.jpg');
  const img = page.locator('header.topo img.logo');
  const proporcao = await img.evaluate((i) => (i.clientWidth / i.clientHeight) / (i.naturalWidth / i.naturalHeight));
  expect(Math.abs(proporcao - 1)).toBeLessThan(0.02); // logo não distorcida
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('#prog-etapa')).toHaveText('Etapa 1 de 6');
  await expect(page.locator(`select[name=congregacao_id] option[value="${congregacaoId}"]`)).toHaveCount(1);
  const larg = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(larg).toBeLessThanOrEqual(0);
});

test('validações, máscaras e campos condicionais', async ({ page }) => {
  await page.goto('/');
  await avancar(page);
  await expect(page.locator('.campo[data-campo=nome] .erro-msg')).toHaveText('Campo obrigatório.');
  await expect(page.locator('#prog-etapa')).toHaveText('Etapa 1 de 6');

  // Cônjuge só aparece para casado/união estável
  await expect(page.locator('.campo[data-campo=conjuge_nome]')).toBeHidden();
  await page.selectOption('[name=estado_civil]', 'CASADO');
  await expect(page.locator('.campo[data-campo=conjuge_nome]')).toBeVisible();
  await page.selectOption('[name=estado_civil]', 'SOLTEIRO');
  await expect(page.locator('.campo[data-campo=conjuge_nome]')).toBeHidden();

  await page.selectOption('[name=congregacao_id]', String(congregacaoId));
  await page.fill('[name=nome]', 'Maria Teste E2E');
  await page.fill('[name=data_nascimento]', '1992-02-29');
  await avancar(page);
  await expect(page.locator('#prog-etapa')).toHaveText('Etapa 2 de 6');

  await page.locator('[name=cpf]').pressSequentially('11111111111');
  await expect(page.locator('[name=cpf]')).toHaveValue('111.111.111-11');
  await avancar(page);
  await expect(page.locator('.campo[data-campo=cpf] .erro-msg')).toHaveText('CPF inválido.');
  await page.fill('[name=cpf]', '');
  await page.locator('[name=cpf]').pressSequentially('52998224725');
  await page.check('input[name=origem_religiosa][value=OUTROS_CREDOS]');
  await expect(page.locator('.campo[data-campo=origem_outros]')).toBeVisible();
  await avancar(page);
  await expect(page.locator('#prog-etapa')).toHaveText('Etapa 3 de 6');

  await page.locator('[name=celular]').pressSequentially('11987654321');
  await expect(page.locator('[name=celular]')).toHaveValue('(11) 98765-4321');
  await page.locator('[name=cep]').pressSequentially('06900000');
  await expect(page.locator('[name=cep]')).toHaveValue('06900-000');
  await page.fill('[name=email]', 'invalido@');
  await avancar(page);
  await expect(page.locator('.campo[data-campo=email] .erro-msg')).toHaveText('E-mail inválido.');

  // Voltar mantém os dados
  await page.click('#btn-voltar');
  await expect(page.locator('[name=cpf]')).toHaveValue('529.982.247-25');
});

test('preenchimento completo no celular com foto, revisão e envio', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('[name=congregacao_id]', String(congregacaoId));
  await page.fill('[name=nome]', 'João Completo E2E');
  await page.fill('[name=data_nascimento]', '1980-07-15');
  await page.selectOption('[name=estado_civil]', 'CASADO');
  await page.fill('[name=conjuge_nome]', 'Ana Completo');
  await page.fill('[name=data_casamento]', '2005-12-10');
  await page.fill('[name=conjuge_data_nascimento]', '1982-03-01');
  await page.fill('[name=pai_nome]', 'Pedro Completo');
  await page.fill('[name=mae_nome]', 'Maria Completo');
  await avancar(page);
  await page.fill('[name=cpf]', '529.982.247-25');
  await page.fill('[name=rg]', '12.345.678-9');
  await page.fill('[name=rg_emissor]', 'SSP-SP');
  await page.fill('[name=rg_data_emissao]', '2010-01-01');
  await page.fill('[name=naturalidade_cidade]', 'São Paulo');
  await page.selectOption('[name=naturalidade_uf]', 'SP');
  await page.selectOption('[name=escolaridade]', 'MEDIO_COMPLETO');
  await page.fill('[name=profissao]', 'Pedreiro');
  await page.check('input[name=origem_religiosa][value=CATOLICISMO]');
  await avancar(page);
  await page.fill('[name=cep]', '06900-000');
  await page.fill('[name=endereco]', 'Rua Independência');
  await page.fill('[name=numero]', '179');
  await page.fill('[name=bairro]', 'Centro');
  await page.fill('[name=cidade]', 'Embu-Guaçu');
  await page.selectOption('[name=estado]', 'SP');
  await page.fill('[name=celular]', '(11) 91234-5678');
  await page.fill('[name=telefone]', '(11) 4661-0000');
  await page.fill('[name=email]', 'joao.e2e@teste.dev');
  await avancar(page);
  await page.fill('[name=data_batismo]', '1999-08-01');
  await page.fill('[name=igreja_batismo]', 'AD Belém');
  await page.fill('[name=igreja_batismo_cidade]', 'São Paulo');
  await page.selectOption('[name=igreja_batismo_uf]', 'SP');
  await page.check('input[name=admissao_forma][value=CARTA]');
  await page.fill('[name=admissao_data]', '2010-05-05');
  await page.check('input[name=cargo][value=PRESBITERO]');
  await expect(page.locator('#aviso-obreiro')).toBeVisible();
  await avancar(page);
  await expect(page.locator('.campo[data-campo=obreiro_local] .erro-msg')).toBeVisible();
  await page.fill('[name=obreiro_local]', 'Templo Sede');
  await page.fill('[name=obreiro_data]', '2018-11-20');
  await page.fill('[name=cargos]', 'Professor de EBD');
  await page.fill('[name=observacoes]', 'Ficha de teste automatizado');
  await avancar(page);

  // Foto: obrigatória, aceita PNG (convertida), permite substituir e remover
  await expect(page.locator('#prog-etapa')).toHaveText('Etapa 5 de 6');
  await avancar(page);
  await expect(page.locator('#foto-erro')).toHaveText('Envie a foto 3x4 para continuar.');
  await page.setInputFiles('#foto-arquivo', PNG);
  await expect(page.locator('#foto-canvas')).toBeVisible();
  await page.click('#foto-remover');
  await expect(page.locator('#foto-canvas')).toBeHidden();
  await page.setInputFiles('#foto-arquivo', FOTO);
  await expect(page.locator('#foto-escolher')).toHaveText('Trocar foto');
  await page.locator('#foto-zoom').fill('1.4');
  await avancar(page);

  // Revisão
  await expect(page.locator('#prog-etapa')).toHaveText('Etapa 6 de 6');
  await expect(page.locator('#revisao')).toContainText('João Completo E2E');
  await expect(page.locator('#revisao')).toContainText('529.982.247-25');
  await expect(page.locator('#revisao')).toContainText('Presbítero');
  await expect(page.locator('#revisao .rev-foto img')).toBeVisible();
  await expect(page.locator('#privacidade')).toContainText('LGPD');
  await expect(page.locator('#bloco-responsavel')).toBeHidden();

  await page.click('#btn-enviar');
  await expect(page.locator('#consentimento-erro')).toBeVisible();
  await page.check('#consentimento');
  await aguardarTempoMinimo(page);
  await page.click('#btn-enviar');
  await expect(page.locator('#sucesso')).toBeVisible({ timeout: 15000 });
  const protocolo = (await page.textContent('#protocolo')).trim();
  expect(protocolo).toMatch(/^S46-\d{4}-\d{6}$/);

  const c = await cadastroPorProtocolo(protocolo);
  criados.push(c);
  expect(c.status).toBe('PENDENTE');
  expect(c.nome).toBe('João Completo E2E');
  expect(c.cargo).toBe('PRESBITERO');
  expect(c.admissao_forma).toBe('CARTA');
  expect(c.obreiro_local).toBe('Templo Sede');
  expect(c.telefone).toBe('1146610000');
  expect(c.origem_religiosa).toBe('CATOLICISMO');
  expect(await existeFoto(c.foto_path)).toBe(true);
});

test('menor de idade exige consentimento do responsável', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('[name=congregacao_id]', String(congregacaoId));
  await page.fill('[name=nome]', 'Criança Teste E2E');
  await page.fill('[name=data_nascimento]', '2014-03-03');
  await page.selectOption('[name=estado_civil]', 'SOLTEIRO');
  await avancar(page);
  await page.fill('[name=cpf]', '529.982.247-25');
  await avancar(page);
  await page.fill('[name=cep]', '06900-000');
  await page.fill('[name=endereco]', 'Rua A');
  await page.fill('[name=numero]', '1');
  await page.fill('[name=bairro]', 'Centro');
  await page.fill('[name=cidade]', 'Embu-Guaçu');
  await page.selectOption('[name=estado]', 'SP');
  await page.fill('[name=celular]', '(11) 91234-5678');
  await avancar(page);
  await avancar(page);
  await page.setInputFiles('#foto-arquivo', FOTO);
  await avancar(page);
  await expect(page.locator('#bloco-responsavel')).toBeVisible();
  await page.check('#consentimento');
  await page.click('#btn-enviar');
  await expect(page.locator('#consentimento-erro')).toContainText('duas autorizações');
  await page.check('#consentimento-responsavel');
  await aguardarTempoMinimo(page);
  await page.click('#btn-enviar');
  await expect(page.locator('#sucesso')).toBeVisible({ timeout: 15000 });
  const c = await cadastroPorProtocolo((await page.textContent('#protocolo')).trim());
  criados.push(c);
  expect(c.consentimento_responsavel).toBe(true);
});

test('formulário fechado nas configurações bloqueia novos envios', async ({ page }) => {
  await svc('/rest/v1/configuracoes?id=eq.1', { method: 'PATCH', body: { formulario_aberto: false } });
  try {
    await page.goto('/');
    await expect(page.locator('#estado-fechado')).toBeVisible();
    await expect(page.locator('#ficha')).toBeHidden();
  } finally {
    await svc('/rest/v1/configuracoes?id=eq.1', { method: 'PATCH', body: { formulario_aberto: true } });
  }
});
