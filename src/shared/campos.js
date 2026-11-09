// Definição única dos campos da Ficha de Cadastro Setorial.
// Usada pelo formulário público, pelo painel administrativo (edição, ficha,
// impressão, exportação) e pelo backend (validação no servidor).
// Este módulo não depende de DOM nem de bibliotecas externas.

export const VERSAO_CONSENTIMENTO = 'LGPD-2025-01';

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const OPCOES = {
  estado_civil: [
    ['SOLTEIRO', 'Solteiro(a)'],
    ['CASADO', 'Casado(a)'],
    ['UNIAO_ESTAVEL', 'União estável'],
    ['DIVORCIADO', 'Divorciado(a)'],
    ['SEPARADO', 'Separado(a)'],
    ['VIUVO', 'Viúvo(a)'],
  ],
  origem_religiosa: [
    ['CATOLICISMO', 'Catolicismo'],
    ['LAR_EVANGELICO', 'Lar evangélico'],
    ['ESPIRITISMO', 'Espiritismo'],
    ['OUTROS_CREDOS', 'Outros credos'],
  ],
  escolaridade: [
    ['NAO_ALFABETIZADO', 'Não alfabetizado'],
    ['FUNDAMENTAL_INCOMPLETO', 'Fundamental incompleto'],
    ['FUNDAMENTAL_COMPLETO', 'Fundamental completo'],
    ['MEDIO_INCOMPLETO', 'Médio incompleto'],
    ['MEDIO_COMPLETO', 'Médio completo'],
    ['SUPERIOR_INCOMPLETO', 'Superior incompleto'],
    ['SUPERIOR_COMPLETO', 'Superior completo'],
    ['POS_GRADUACAO', 'Pós-graduação'],
    ['MESTRADO', 'Mestrado'],
    ['DOUTORADO', 'Doutorado'],
  ],
  admissao_forma: [
    ['BATISMO', 'Batismo'],
    ['CARTA', 'Carta'],
    ['ACLAMACAO', 'Aclamação'],
  ],
  cargo: [
    ['MEMBRO', 'Membro'],
    ['DIACONO', 'Diácono'],
    ['EVANGELISTA', 'Evangelista'],
    ['COOPERADOR', 'Cooperador'],
    ['PRESBITERO', 'Presbítero'],
    ['PASTOR', 'Pastor'],
  ],
  uf: UFS.map((u) => [u, u]),
  status: [
    ['PENDENTE', 'Pendente'],
    ['APROVADO', 'Aprovado'],
  ],
};

export function rotulo(lista, valor) {
  const item = (OPCOES[lista] || []).find(([v]) => v === valor);
  return item ? item[1] : valor ?? '';
}

export const casado = (d) => d.estado_civil === 'CASADO' || d.estado_civil === 'UNIAO_ESTAVEL';
export const obreiro = (d) => !!d.cargo && d.cargo !== 'MEMBRO';

// tipo: texto | data | opcao | cpf | cep | telefone | email | uf | longo | congregacao
// obrig: true | função(dados) => boolean
// mostrar: função(dados) => boolean (campo não aplicável fica oculto e é limpo)
export const CAMPOS = [
  // --- Etapa 1: dados pessoais
  { nome: 'congregacao_id', rotulo: 'Congregação', tipo: 'congregacao', obrig: true, etapa: 1 },
  { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto', max: 150, min: 3, obrig: true, etapa: 1, autocomplete: 'name' },
  { nome: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'data', obrig: true, etapa: 1, autocomplete: 'bday' },
  { nome: 'estado_civil', rotulo: 'Estado civil', tipo: 'opcao', opcoes: 'estado_civil', obrig: true, etapa: 1 },
  { nome: 'conjuge_nome', rotulo: 'Nome do cônjuge', tipo: 'texto', max: 150, etapa: 1, mostrar: casado, destaque: true },
  { nome: 'conjuge_data_nascimento', rotulo: 'Data de nascimento do cônjuge', tipo: 'data', etapa: 1, mostrar: casado, destaque: true },
  { nome: 'data_casamento', rotulo: 'Data de casamento', tipo: 'data', etapa: 1, mostrar: casado, destaque: true },
  { nome: 'pai_nome', rotulo: 'Nome do pai', tipo: 'texto', max: 150, etapa: 1 },
  { nome: 'mae_nome', rotulo: 'Nome da mãe', tipo: 'texto', max: 150, etapa: 1 },

  // --- Etapa 2: documentos e origem
  { nome: 'cpf', rotulo: 'CPF', tipo: 'cpf', obrig: true, etapa: 2 },
  { nome: 'rg', rotulo: 'RG', tipo: 'texto', max: 20, etapa: 2 },
  { nome: 'rg_emissor', rotulo: 'Órgão emissor', tipo: 'texto', max: 20, etapa: 2, dica: 'Ex.: SSP-SP' },
  { nome: 'rg_data_emissao', rotulo: 'Data de emissão do RG', tipo: 'data', etapa: 2 },
  { nome: 'naturalidade_cidade', rotulo: 'Natural da cidade', tipo: 'texto', max: 80, etapa: 2 },
  { nome: 'naturalidade_uf', rotulo: 'UF de nascimento', tipo: 'uf', etapa: 2, dica: 'Deixe em branco se nasceu fora do Brasil' },
  { nome: 'naturalidade_pais', rotulo: 'País', tipo: 'texto', max: 60, etapa: 2, padrao: 'Brasil' },
  { nome: 'escolaridade', rotulo: 'Escolaridade', tipo: 'opcao', opcoes: 'escolaridade', etapa: 2 },
  { nome: 'profissao', rotulo: 'Profissão', tipo: 'texto', max: 80, etapa: 2 },
  { nome: 'origem_religiosa', rotulo: 'Origem religiosa', tipo: 'opcao', opcoes: 'origem_religiosa', etapa: 2, radio: true },
  { nome: 'origem_outros', rotulo: 'Qual outro credo?', tipo: 'texto', max: 80, etapa: 2, mostrar: (d) => d.origem_religiosa === 'OUTROS_CREDOS' },

  // --- Etapa 3: endereço e contato
  { nome: 'cep', rotulo: 'CEP', tipo: 'cep', obrig: true, etapa: 3 },
  { nome: 'endereco', rotulo: 'Endereço (rua/avenida)', tipo: 'texto', max: 150, min: 3, obrig: true, etapa: 3, autocomplete: 'address-line1' },
  { nome: 'numero', rotulo: 'Número', tipo: 'texto', max: 10, obrig: true, etapa: 3, dica: 'Use S/N se não houver' },
  { nome: 'complemento', rotulo: 'Complemento', tipo: 'texto', max: 60, etapa: 3, autocomplete: 'address-line2' },
  { nome: 'bairro', rotulo: 'Bairro', tipo: 'texto', max: 80, min: 2, obrig: true, etapa: 3 },
  { nome: 'cidade', rotulo: 'Cidade', tipo: 'texto', max: 80, min: 2, obrig: true, etapa: 3, autocomplete: 'address-level2' },
  { nome: 'estado', rotulo: 'Estado', tipo: 'uf', obrig: true, etapa: 3 },
  { nome: 'celular', rotulo: 'Celular', tipo: 'telefone', obrig: true, etapa: 3, autocomplete: 'tel' },
  { nome: 'telefone', rotulo: 'Telefone fixo', tipo: 'telefone', etapa: 3 },
  { nome: 'email', rotulo: 'E-mail', tipo: 'email', max: 150, etapa: 3, autocomplete: 'email' },

  // --- Etapa 4: vida eclesiástica
  { nome: 'data_batismo', rotulo: 'Data de batismo', tipo: 'data', etapa: 4 },
  { nome: 'igreja_batismo', rotulo: 'Igreja de batismo', tipo: 'texto', max: 150, etapa: 4 },
  { nome: 'igreja_batismo_cidade', rotulo: 'Cidade da igreja onde foi batizado', tipo: 'texto', max: 80, etapa: 4 },
  { nome: 'igreja_batismo_uf', rotulo: 'Estado da igreja onde foi batizado', tipo: 'uf', etapa: 4 },
  { nome: 'admissao_forma', rotulo: 'Admitido na igreja por', tipo: 'opcao', opcoes: 'admissao_forma', etapa: 4, radio: true },
  { nome: 'admissao_data', rotulo: 'Data de admissão', tipo: 'data', etapa: 4, mostrar: (d) => !!d.admissao_forma },
  { nome: 'cargo', rotulo: 'Cargo', tipo: 'opcao', opcoes: 'cargo', obrig: true, etapa: 4, radio: true, padrao: 'MEMBRO' },
  { nome: 'obreiro_local', rotulo: 'Local de apresentação ou consagração', tipo: 'texto', max: 150, etapa: 4, mostrar: obreiro, obrig: obreiro, destaqueObreiro: true },
  { nome: 'obreiro_data', rotulo: 'Data de apresentação ou consagração', tipo: 'data', etapa: 4, mostrar: obreiro, obrig: obreiro, destaqueObreiro: true },
  { nome: 'cargos', rotulo: 'Cargos (funções que exerce)', tipo: 'texto', max: 300, etapa: 4, dica: 'Ex.: professor de EBD, músico, secretário' },
  { nome: 'observacoes', rotulo: 'Observações', tipo: 'longo', max: 1000, etapa: 4 },
];

export const ETAPAS = [
  { n: 1, titulo: 'Dados pessoais' },
  { n: 2, titulo: 'Documentos e origem' },
  { n: 3, titulo: 'Endereço e contato' },
  { n: 4, titulo: 'Vida eclesiástica' },
  { n: 5, titulo: 'Foto 3x4' },
  { n: 6, titulo: 'Revisão e envio' },
];

export const NOMES_CAMPOS = CAMPOS.map((c) => c.nome);

// ----------------------------------------------------------------------------
// Utilitários de formatação / máscara
// ----------------------------------------------------------------------------
export const soDigitos = (v) => String(v ?? '').replace(/\D+/g, '');

export function mascaraCPF(v) {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

export function mascaraCEP(v) {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function mascaraTelefone(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatarData(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}

export function formatarValor(campo, valor, congregacoes) {
  if (valor === null || valor === undefined || valor === '') return '';
  switch (campo.tipo) {
    case 'data': return formatarData(valor);
    case 'cpf': return mascaraCPF(valor);
    case 'cep': return mascaraCEP(valor);
    case 'telefone': return mascaraTelefone(valor);
    case 'opcao': return rotulo(campo.opcoes, valor);
    case 'congregacao': {
      const c = (congregacoes || []).find((x) => String(x.id) === String(valor));
      return c ? c.nome : String(valor);
    }
    default: return String(valor);
  }
}

export function cpfValido(v) {
  const c = soDigitos(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(c.slice(0, 9)) === Number(c[9]) && dv(c.slice(0, 10)) === Number(c[10]);
}

function dataValida(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function hojeISO(agora = new Date()) {
  // data local de São Paulo (UTC-3, sem horário de verão desde 2019)
  const sp = new Date(agora.getTime() - 3 * 3600 * 1000);
  return sp.toISOString().slice(0, 10);
}

export function idade(nascISO, hoje = hojeISO()) {
  if (!nascISO) return null;
  const [a, m, d] = nascISO.split('-').map(Number);
  const [ha, hm, hd] = hoje.split('-').map(Number);
  let i = ha - a;
  if (hm < m || (hm === m && hd < d)) i -= 1;
  return i;
}

export const menorDeIdade = (nascISO) => {
  const i = idade(nascISO);
  return i !== null && i < 18;
};

const ehObrigatorio = (campo, d) => (typeof campo.obrig === 'function' ? campo.obrig(d) : !!campo.obrig);
const ehVisivel = (campo, d) => (campo.mostrar ? campo.mostrar(d) : true);

// Remove caracteres de controle e espaços repetidos
function limparTexto(v) {
  return String(v ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Valida e normaliza os dados de uma ficha.
 * @param {object} entrada dados brutos
 * @param {object} opts { congregacoesValidas?: (string|number)[], hoje?: string, campos?: string[] }
 * @returns {{ dados: object, erros: Record<string,string> }}
 */
export function validarCadastro(entrada, opts = {}) {
  const hoje = opts.hoje || hojeISO();
  const somente = opts.campos ? new Set(opts.campos) : null;
  const bruto = entrada && typeof entrada === 'object' ? entrada : {};
  const d = {};
  const erros = {};

  // 1ª passada: normalização
  for (const c of CAMPOS) {
    let v = bruto[c.nome];
    if (v === undefined || v === null) v = '';
    if (typeof v !== 'string' && typeof v !== 'number') v = '';
    v = c.tipo === 'longo'
      ? String(v).replace(/\r\n/g, '\n').replace(/[^\S\n]+/g, ' ').trim()
      : limparTexto(v);
    switch (c.tipo) {
      case 'cpf': case 'cep': case 'telefone': v = soDigitos(v); break;
      case 'uf': v = v.toUpperCase(); break;
      case 'email': v = v.toLowerCase(); break;
      case 'congregacao': v = soDigitos(v); break;
      default: break;
    }
    d[c.nome] = v;
  }

  // 2ª passada: regras
  for (const c of CAMPOS) {
    if (somente && !somente.has(c.nome)) continue;
    if (!ehVisivel(c, d)) { d[c.nome] = ''; continue; }
    const v = d[c.nome];
    if (v === '') {
      if (ehObrigatorio(c, d)) erros[c.nome] = c.tipo === 'congregacao' || c.tipo === 'opcao' || c.tipo === 'uf'
        ? 'Selecione uma opção.' : 'Campo obrigatório.';
      continue;
    }
    if (c.max && v.length > c.max) { erros[c.nome] = `Máximo de ${c.max} caracteres.`; continue; }
    if (c.min && v.length < c.min) { erros[c.nome] = `Mínimo de ${c.min} caracteres.`; continue; }
    switch (c.tipo) {
      case 'texto':
      case 'longo':
        if (/[<>]/.test(v)) erros[c.nome] = 'Não use os caracteres < ou >.';
        break;
      case 'data':
        if (!dataValida(v)) erros[c.nome] = 'Data inválida.';
        else if (v < '1900-01-01') erros[c.nome] = 'Data muito antiga.';
        else if (v > hoje) erros[c.nome] = 'A data não pode ser futura.';
        break;
      case 'opcao':
        if (!OPCOES[c.opcoes].some(([k]) => k === v)) erros[c.nome] = 'Opção inválida.';
        break;
      case 'uf':
        if (!UFS.includes(v)) erros[c.nome] = 'UF inválida.';
        break;
      case 'cpf':
        if (!cpfValido(v)) erros[c.nome] = 'CPF inválido.';
        break;
      case 'cep':
        if (v.length !== 8) erros[c.nome] = 'CEP deve ter 8 dígitos.';
        break;
      case 'telefone':
        if (v.length < 10 || v.length > 11) erros[c.nome] = 'Informe DDD + número.';
        else if (c.nome === 'celular' && v.length !== 11) erros[c.nome] = 'Celular deve ter 11 dígitos (DDD + 9 dígitos).';
        break;
      case 'email':
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) erros[c.nome] = 'E-mail inválido.';
        break;
      case 'congregacao':
        if (opts.congregacoesValidas && !opts.congregacoesValidas.map(String).includes(v)) {
          erros[c.nome] = 'Congregação inválida ou inativa.';
        }
        break;
      default: break;
    }
  }

  // Regras entre campos
  const nasc = d.data_nascimento;
  if (!erros.data_nascimento && nasc) {
    for (const k of ['data_casamento', 'data_batismo', 'admissao_data', 'obreiro_data', 'rg_data_emissao']) {
      if (d[k] && !erros[k] && d[k] < nasc) erros[k] = 'Não pode ser anterior à data de nascimento.';
    }
  }

  // Campos vazios viram null (para o banco)
  const dados = {};
  for (const c of CAMPOS) {
    const v = d[c.nome];
    if (c.tipo === 'congregacao') dados[c.nome] = v === '' ? null : Number(v);
    else dados[c.nome] = v === '' ? null : v;
  }
  return { dados, erros };
}
