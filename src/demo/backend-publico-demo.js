// MODO DEMONSTRAÇÃO: substitui /api/form-config e /api/submit no navegador,
// usando as MESMAS regras de validação do servidor. Não entra em produção.
import { validarCadastro, VERSAO_CONSENTIMENTO, menorDeIdade } from '../shared/campos.js';
import { banco, salvar, auditar, blobParaDataUrl, nomeBusca } from './dados-demo.js';

export async function obterConfigDemo() {
  const db = banco();
  const c = db.configuracoes[0];
  return {
    ok: true,
    aberto: c.formulario_aberto !== false,
    congregacoes: db.congregacoes.filter((g) => g.ativa).map(({ id, nome }) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
    endereco_sede: c.endereco_sede || '',
    pastor_setorial: c.pastor_setorial || '',
    encarregado_nome: c.encarregado_lgpd_nome || '',
    encarregado_contato: c.encarregado_lgpd_contato || '',
    turnstile_site_key: null,
  };
}

const falha = (status, erro, extra = {}) => ({ status, json: { ok: false, erro, ...extra } });

export async function enviarFichaDemo(fd) {
  const db = banco();
  if (db.configuracoes[0].formulario_aberto === false) return falha(403, 'O recebimento de fichas está temporariamente fechado.');
  if (fd.get('consentimento') !== 'true') return falha(400, 'É necessário aceitar o aviso de privacidade para enviar a ficha.');
  let bruto;
  try { bruto = JSON.parse(fd.get('dados')); } catch { return falha(400, 'Dados do formulário inválidos.'); }
  const ativas = db.congregacoes.filter((g) => g.ativa).map((g) => g.id);
  const { dados, erros } = validarCadastro(bruto, { congregacoesValidas: ativas });
  if (Object.keys(erros).length) return falha(422, 'Há campos com problemas. Revise e envie novamente.', { erros });
  const responsavel = fd.get('consentimento_responsavel') === 'true';
  if (menorDeIdade(dados.data_nascimento) && !responsavel) return falha(400, 'Para menores de 18 anos, o consentimento deve ser dado pelo pai, mãe ou responsável legal.');
  const foto = fd.get('foto');
  if (!foto || typeof foto === 'string') return falha(400, 'Envie a foto 3x4.', { erros: { foto: 'Envie a foto 3x4.' } });

  const id = crypto.randomUUID();
  const agora = new Date().toISOString();
  const protocolo = `S46-DEMO-${String(db.proximo.protocolo++).padStart(6, '0')}`;
  const caminho = `cadastros/${id}.jpg`;
  db.fotos[caminho] = await blobParaDataUrl(foto);
  db.cadastros.push({
    ...dados,
    id,
    protocolo,
    nome_busca: nomeBusca(dados.nome),
    status: 'PENDENTE',
    foto_path: caminho,
    consentimento_lgpd: true,
    consentimento_em: agora,
    consentimento_versao: VERSAO_CONSENTIMENTO,
    consentimento_responsavel: responsavel,
    aprovado_em: null,
    aprovado_por: null,
    created_at: agora,
    updated_at: agora,
    updated_by: null,
  });
  auditar('cadastro_recebido', id, { protocolo });
  salvar();
  return { status: 201, json: { ok: true, protocolo } };
}
