import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validarCadastro, cpfValido, mascaraCPF, mascaraCEP, mascaraTelefone, idade, menorDeIdade, formatarData,
} from '../../src/shared/campos.js';
import { limparJpeg, ErroImagem } from '../../functions/_lib/jpeg.js';

const base = {
  congregacao_id: '1', nome: 'Maria da Silva', data_nascimento: '1990-01-15', estado_civil: 'SOLTEIRO',
  cpf: '529.982.247-25', cep: '06900-000', endereco: 'Rua A', numero: '10', bairro: 'Centro',
  cidade: 'Embu-Guaçu', estado: 'SP', celular: '(11) 98765-4321', cargo: 'MEMBRO',
};

test('ficha mínima válida e normalizada', () => {
  const { dados, erros } = validarCadastro(base, { hoje: '2025-06-01', congregacoesValidas: [1] });
  assert.deepEqual(erros, {});
  assert.equal(dados.cpf, '52998224725');
  assert.equal(dados.cep, '06900000');
  assert.equal(dados.celular, '11987654321');
  assert.equal(dados.congregacao_id, 1);
  assert.equal(dados.email, null);
});

test('campos obrigatórios', () => {
  const { erros } = validarCadastro({}, { hoje: '2025-06-01' });
  for (const k of ['congregacao_id', 'nome', 'data_nascimento', 'estado_civil', 'cpf', 'cep', 'endereco', 'numero', 'bairro', 'cidade', 'estado', 'celular', 'cargo']) {
    assert.ok(erros[k], `deveria exigir ${k}`);
  }
  assert.equal(erros.email, undefined);
  assert.equal(erros.rg, undefined);
});

test('CPF inválido, data futura, e-mail, UF, telefone', () => {
  const { erros } = validarCadastro({
    ...base, cpf: '111.111.111-11', data_nascimento: '2030-01-01', email: 'x@', estado: 'XX', celular: '1198765432',
  }, { hoje: '2025-06-01' });
  assert.equal(erros.cpf, 'CPF inválido.');
  assert.match(erros.data_nascimento, /futura/);
  assert.ok(erros.email);
  assert.ok(erros.estado);
  assert.ok(erros.celular);
});

test('congregação inativa é recusada', () => {
  const { erros } = validarCadastro(base, { congregacoesValidas: [2, 3] });
  assert.ok(erros.congregacao_id);
});

test('campos condicionais: cônjuge some para solteiro; obreiro exige local e data', () => {
  const r1 = validarCadastro({ ...base, conjuge_nome: 'Fulano' }, { hoje: '2025-06-01' });
  assert.equal(r1.dados.conjuge_nome, null, 'cônjuge não se aplica a solteiro');
  const r2 = validarCadastro({ ...base, cargo: 'DIACONO' }, { hoje: '2025-06-01' });
  assert.ok(r2.erros.obreiro_local);
  assert.ok(r2.erros.obreiro_data);
  const r3 = validarCadastro({ ...base, estado_civil: 'CASADO', conjuge_nome: 'João', data_casamento: '1980-01-01' }, { hoje: '2025-06-01' });
  assert.match(r3.erros.data_casamento, /anterior/);
});

test('bloqueia HTML e opções inexistentes', () => {
  const { erros } = validarCadastro({ ...base, nome: '<script>x</script>', cargo: 'BISPO' }, { hoje: '2025-06-01' });
  assert.ok(erros.nome);
  assert.ok(erros.cargo);
});

test('máscaras e utilitários', () => {
  assert.equal(mascaraCPF('52998224725'), '529.982.247-25');
  assert.equal(mascaraCEP('06900000'), '06900-000');
  assert.equal(mascaraTelefone('11987654321'), '(11) 98765-4321');
  assert.equal(mascaraTelefone('1146661234'), '(11) 4666-1234');
  assert.equal(formatarData('2025-03-09'), '09/03/2025');
  assert.ok(cpfValido('529.982.247-25'));
  assert.ok(!cpfValido('529.982.247-24'));
  assert.equal(idade('2010-06-02', '2025-06-01'), 14);
  assert.equal(idade('2007-06-01', '2025-06-01'), 18);
  assert.ok(menorDeIdade('2015-01-01'));
});

test('JPEG: remove EXIF/GPS e mantém dimensões', () => {
  const orig = new Uint8Array(readFileSync(new URL('../fixtures/foto-3x4-com-gps.jpg', import.meta.url)));
  assert.ok(Buffer.from(orig).includes('Exif'));
  const r = limparJpeg(orig);
  assert.equal(r.largura, 600);
  assert.equal(r.altura, 800);
  assert.ok(!Buffer.from(r.bytes).includes('Exif'));
  assert.ok(!Buffer.from(r.bytes).includes('CameraTeste'));
  assert.ok(r.bytes.length < orig.length);
});

test('JPEG: recusa PNG e arquivo truncado', () => {
  const png = new Uint8Array(readFileSync(new URL('../fixtures/foto.png', import.meta.url)));
  assert.throws(() => limparJpeg(png), ErroImagem);
  const jpg = new Uint8Array(readFileSync(new URL('../fixtures/foto-3x4.jpg', import.meta.url)));
  assert.throws(() => limparJpeg(jpg.subarray(0, 300)), ErroImagem);
});

test('erros do Supabase NÃO levam dados pessoais para os logs', async () => {
  const { rest } = await import('../../functions/_lib/supabase.js');
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: '23514', details: 'Failing row contains (id, Fulano de Tal, 52998224725, Rua X 10)', message: 'violates check constraint',
  }), { status: 400 });
  try {
    await assert.rejects(rest({ url: 'https://x', chave: 'sb_secret_x' }, 'cadastros', { method: 'POST', body: {} }), (e) => {
      assert.ok(!e.message.includes('52998224725'));
      assert.ok(!e.message.includes('Fulano'));
      assert.match(e.message, /23514/);
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('nome só com emojis/símbolos é recusado (mesma contagem do banco)', () => {
  const { erros } = validarCadastro({ ...base, nome: '😀😀' }, { hoje: '2025-06-01' });
  assert.ok(erros.nome);
  const r2 = validarCadastro({ ...base, nome: '...' }, { hoje: '2025-06-01' });
  assert.ok(r2.erros.nome);
});

test('JPEG: descarta dados anexados após o fim da imagem', () => {
  const orig = new Uint8Array(readFileSync(new URL('../fixtures/foto-poliglota.jpg', import.meta.url)));
  const r = limparJpeg(orig);
  assert.ok(!Buffer.from(r.bytes).includes('<script>'));
  assert.deepEqual([...r.bytes.subarray(-2)], [0xff, 0xd9]);
});
