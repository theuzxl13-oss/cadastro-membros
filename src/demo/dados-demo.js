// MODO DEMONSTRAÇÃO (somente na prévia do GitHub Pages).
// Dados fictícios guardados apenas no navegador de quem está visualizando.
// Este módulo NÃO entra no build de produção.

const CHAVE = 'demo-setor46-v2';

// Equivalente ao gatilho do banco: nome em minúsculas e sem acentos para a busca
export const nomeBusca = (n) => String(n ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const USUARIOS_DEMO = [
  { user_id: 'demo-admin', email: 'admin@demo.local', senha: 'demo1234', nome: 'Administrador (demo)', papel: 'admin', ativo: true },
  { user_id: 'demo-secretaria', email: 'secretaria@demo.local', senha: 'demo1234', nome: 'Secretaria (demo)', papel: 'secretaria', ativo: true },
];

function cpfFicticio(base9) {
  const d = String(base9).padStart(9, '0').split('').map(Number);
  const dv = (arr) => {
    const s = arr.reduce((acc, n, i) => acc + n * (arr.length + 1 - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(d));
  d.push(dv(d));
  return d.join('');
}

const diasAtras = (n, h = 10) => {
  const d = new Date(Date.now() - n * 86400000);
  d.setHours(h, 15, 0, 0);
  return d.toISOString();
};

function semente() {
  const congregacoes = [
    { id: 1, nome: 'Sede Setorial (exemplo)', cidade: 'Embu-Guaçu', endereco: 'Rua Independência, 179 - Centro', dirigente: 'Pr. Exemplo', ativa: true },
    { id: 2, nome: 'Congregação Jardim Exemplo', cidade: 'Embu-Guaçu', endereco: '', dirigente: 'Pb. Demonstração', ativa: true },
    { id: 3, nome: 'Congregação Vila Demonstração', cidade: 'Embu-Guaçu', endereco: '', dirigente: '', ativa: true },
    { id: 4, nome: 'Congregação Antiga (inativa – exemplo)', cidade: 'Embu-Guaçu', endereco: '', dirigente: '', ativa: false },
  ].map((c) => ({ ...c, created_at: diasAtras(200), updated_at: diasAtras(200) }));

  const pessoas = [
    ['Ana Exemplo da Silva', 1, 'MEMBRO', 'APROVADO', 'CASADO', 120, '1985-03-12'],
    ['Bruno Demonstração Souza', 1, 'DIACONO', 'APROVADO', 'CASADO', 95, '1979-07-30'],
    ['Carla Fictícia Oliveira', 2, 'MEMBRO', 'PENDENTE', 'SOLTEIRO', 3, '1998-11-02'],
    ['Daniel Teste Pereira', 2, 'PRESBITERO', 'APROVADO', 'CASADO', 60, '1970-01-25'],
    ['Elisa Modelo Santos', 3, 'MEMBRO', 'PENDENTE', 'VIUVO', 1, '1956-05-17'],
    ['Fábio Amostra Lima', 3, 'COOPERADOR', 'PENDENTE', 'SOLTEIRO', 0, '2001-09-09'],
    ['Gabriela Exemplo Costa', 1, 'MEMBRO', 'APROVADO', 'UNIAO_ESTAVEL', 40, '1992-12-01'],
    ['Henrique Demonstração Alves', 2, 'EVANGELISTA', 'PENDENTE', 'CASADO', 8, '1983-04-04'],
  ];

  const cadastros = pessoas.map(([nome, cong, cargo, status, civil, dias, nasc], i) => {
    const casado = civil === 'CASADO' || civil === 'UNIAO_ESTAVEL';
    const obreiro = cargo !== 'MEMBRO';
    const id = `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const criado = diasAtras(dias, 9 + i);
    return {
      id,
      protocolo: `S46-DEMO-${String(i + 1).padStart(6, '0')}`,
      status,
      congregacao_id: cong,
      nome,
      nome_busca: nomeBusca(nome),
      conjuge_nome: casado ? 'Cônjuge Fictício (exemplo)' : null,
      data_casamento: casado ? '2010-06-19' : null,
      pai_nome: 'Pai Fictício (exemplo)',
      mae_nome: 'Mãe Fictícia (exemplo)',
      data_nascimento: nasc,
      conjuge_data_nascimento: casado ? '1987-02-14' : null,
      estado_civil: civil,
      origem_religiosa: ['LAR_EVANGELICO', 'CATOLICISMO', 'ESPIRITISMO', 'OUTROS_CREDOS'][i % 4],
      origem_outros: i % 4 === 3 ? 'Exemplo' : null,
      naturalidade_cidade: 'São Paulo',
      naturalidade_uf: 'SP',
      naturalidade_pais: 'Brasil',
      rg: `00.000.00${i}-X`,
      rg_emissor: 'SSP-SP',
      rg_data_emissao: '2012-03-10',
      cpf: cpfFicticio(100000000 + i * 1111111),
      escolaridade: ['MEDIO_COMPLETO', 'SUPERIOR_COMPLETO', 'FUNDAMENTAL_COMPLETO', 'POS_GRADUACAO'][i % 4],
      profissao: ['Professora', 'Motorista', 'Estudante', 'Comerciante', 'Aposentada', 'Técnico', 'Enfermeira', 'Pedreiro'][i],
      endereco: 'Rua Exemplo',
      numero: String(100 + i),
      complemento: null,
      bairro: 'Centro',
      cidade: 'Embu-Guaçu',
      estado: 'SP',
      cep: '06900000',
      telefone: null,
      celular: `1190000000${i}`,
      email: `pessoa${i + 1}@exemplo.invalid`,
      data_batismo: '2005-08-14',
      igreja_batismo: 'AD Belém – Setor 46',
      igreja_batismo_cidade: 'Embu-Guaçu',
      igreja_batismo_uf: 'SP',
      admissao_forma: ['BATISMO', 'CARTA', 'ACLAMACAO'][i % 3],
      admissao_data: '2005-08-14',
      cargo,
      obreiro_local: obreiro ? 'Templo Sede (exemplo)' : null,
      obreiro_data: obreiro ? '2015-11-20' : null,
      cargos: i % 2 ? 'Professor(a) de EBD' : null,
      observacoes: null,
      foto_path: `cadastros/${id}.jpg`,
      consentimento_lgpd: true,
      consentimento_em: criado,
      consentimento_versao: 'LGPD-2025-01',
      consentimento_responsavel: false,
      aprovado_em: status === 'APROVADO' ? diasAtras(Math.max(0, dias - 2)) : null,
      aprovado_por: status === 'APROVADO' ? 'demo-admin' : null,
      created_at: criado,
      updated_at: criado,
      updated_by: null,
    };
  });

  return {
    congregacoes,
    cadastros,
    configuracoes: [{
      id: 1,
      formulario_aberto: true,
      url_publica: null,
      endereco_sede: 'Rua Independência, 179 - Centro - Embu-Guaçu - SP',
      pastor_setorial: 'Pr. Luiz Amaral',
      encarregado_lgpd_nome: null,
      encarregado_lgpd_contato: null,
      updated_at: diasAtras(200),
    }],
    admins: USUARIOS_DEMO.map(({ senha, ...a }) => ({ ...a, created_at: diasAtras(300) })),
    auditoria: cadastros.map((c, i) => ({
      id: i + 1, created_at: c.created_at, ator_id: null, ator_email: null, acao: 'cadastro_recebido', entidade: 'cadastro', entidade_id: c.id, detalhes: { protocolo: c.protocolo },
    })),
    fotos: {}, // caminho -> dataURL (fotos enviadas na demonstração)
    proximo: { congregacao: 5, auditoria: cadastros.length + 1, protocolo: cadastros.length + 1 },
  };
}

let cache = null;

export function banco() {
  if (cache) return cache;
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo) cache = JSON.parse(salvo);
  } catch { /* armazenamento indisponível: usa memória */ }
  if (!cache) { cache = semente(); salvar(); }
  return cache;
}

export function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(cache)); } catch { /* sem espaço/indisponível */ }
}

export function restaurarDemo() {
  cache = semente();
  salvar();
}

export function auditar(acao, entidadeId, detalhes = {}, atorEmail = null) {
  const db = banco();
  db.auditoria.push({
    id: db.proximo.auditoria++, created_at: new Date().toISOString(), ator_id: null, ator_email: atorEmail, acao, entidade: 'cadastro', entidade_id: entidadeId, detalhes,
  });
}

// Foto ilustrativa (silhueta) para os cadastros de exemplo
const fotosGeradas = new Map();
export async function fotoIlustrativa(caminho) {
  if (fotosGeradas.has(caminho)) return fotosGeradas.get(caminho);
  const cv = document.createElement('canvas');
  cv.width = 600; cv.height = 800;
  const g = cv.getContext('2d');
  const n = [...caminho].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const tons = ['#d9d2c3', '#cfd8dc', '#d7ccc8', '#dcedc8', '#e1d5e7', '#f0e2c4'];
  g.fillStyle = tons[n % tons.length]; g.fillRect(0, 0, 600, 800);
  g.fillStyle = '#6d6a63';
  g.beginPath(); g.arc(300, 300, 130, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(300, 760, 250, 280, 0, Math.PI, 0); g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = 'bold 54px Arial'; g.textAlign = 'center';
  g.fillText('EXEMPLO', 300, 560);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.85));
  fotosGeradas.set(caminho, blob);
  return blob;
}

export function dataUrlParaBlob(url) {
  const [cab, b64] = url.split(',');
  const tipo = (cab.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

export function blobParaDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}
