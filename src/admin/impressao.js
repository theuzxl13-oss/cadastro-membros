// Impressão: ficha individual A4 no MESMO MODELO da "Ficha de Cadastro Setorial"
// em papel (nova_ficha_2025.pdf) e cartaz do QR Code.
// As larguras das colunas foram medidas no PDF original (tabela de 716 px ≈ 182 mm).
import { caminho } from '../ui/caminho.js';
import { el, dataHora } from './util.js';
import {
  CAMPOS, OPCOES, formatarValor, formatarData, rotulo,
} from '../shared/campos.js';
import { sb } from './supabase.js';

const LOGO = caminho('img/logo-setor46.jpg');
const BRASAO = caminho('img/brasao-ficha.png');

async function carregarImagens(raiz) {
  const imgs = [...raiz.querySelectorAll('img')];
  await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth ? Promise.resolve() : i.decode().catch(() => {}))));
}

async function imprimir(conteudo, classe) {
  const area = document.getElementById('impressao');
  area.replaceChildren(conteudo);
  await carregarImagens(area);
  document.body.classList.add('imprimindo');
  if (classe) document.body.classList.add(classe);
  const limpar = () => {
    document.body.classList.remove('imprimindo');
    if (classe) document.body.classList.remove(classe);
    area.replaceChildren();
    window.removeEventListener('afterprint', limpar);
  };
  window.addEventListener('afterprint', limpar);
  window.print();
}

async function configSede() {
  const { data } = await sb.from('configuracoes').select('endereco_sede,pastor_setorial').eq('id', 1).maybeSingle();
  return data || {};
}

const campo = (nome) => CAMPOS.find((c) => c.nome === nome);

// Largura em mm a partir da medida em pixels do PDF original (1 px = 0,254 mm)
const mm = (px) => `${(px * 0.254).toFixed(2)}mm`;

/** Célula de rótulo (negrito) */
const R = (texto, px, extra = '') => el('div', { class: `fc fc-r ${extra}`, style: `width:${mm(px)}` }, texto);
/** Célula de valor; px = null ocupa o restante da linha */
const V = (texto, px = null, extra = '') => el('div', { class: `fc fc-v ${extra}`, style: px ? `width:${mm(px)}` : 'flex:1' }, texto || '');
const linha = (...cels) => el('div', { class: 'fl' }, cels);
const caixa = (marcada) => el('span', { class: 'fx' }, marcada ? 'X' : '');

export async function imprimirFicha(c, congregacoes, fotoBlob) {
  const cfg = await configSede();
  const v = (nome) => formatarValor(campo(nome), c[nome], congregacoes);
  const casado = c.estado_civil === 'CASADO' || c.estado_civil === 'UNIAO_ESTAVEL';
  const dataOuTracos = (iso) => (iso ? formatarData(iso) : '___/___/___');
  const fotoUrl = fotoBlob ? URL.createObjectURL(fotoBlob) : null;

  // Origem religiosa: 4 caixas, como no papel
  const origem = OPCOES.origem_religiosa.flatMap(([k, r], i) => {
    const larguras = [[20, 130], [20, 150], [20, 129], [21, 163]][i];
    const texto = k === 'OUTROS_CREDOS' && c.origem_outros ? `${r}: ${c.origem_outros}` : r;
    return [
      el('div', { class: 'fc fc-caixa', style: `width:${mm(larguras[0])}` }, c.origem_religiosa === k ? 'X' : ''),
      el('div', { class: 'fc fc-r', style: `width:${mm(larguras[1])}` }, texto),
    ];
  });

  // Admitido na igreja por: ( ) Batismo ( ) Carta ( ) Aclamação
  const admissao = OPCOES.admissao_forma.map(([k, r]) => `(${c.admissao_forma === k ? ' X ' : '  '}) ${r}`).join(' ');

  // Cargos: grade 3x2 com caixas grandes
  const ordemCargos = ['MEMBRO', 'DIACONO', 'EVANGELISTA', 'COOPERADOR', 'PRESBITERO', 'PASTOR'];
  const cargos = el('div', { class: 'f-cargos' }, ordemCargos.map((k) => el('div', { class: 'f-cargo' },
    caixa(c.cargo === k), el('span', {}, rotulo('cargo', k)))));
  const obreiro = [c.obreiro_local, formatarData(c.obreiro_data)].filter(Boolean).join(' – ');

  const doc = el('div', { class: 'ficha-papel' },
    el('div', { class: 'f-borda' },
      // Cabeçalho
      el('div', { class: 'f-cab' },
        el('img', { class: 'f-brasao', src: BRASAO, alt: 'Brasão – Assembleia de Deus Ministério do Belém' }),
        el('div', { class: 'f-cab-texto' },
          el('div', { class: 'f-t1', text: 'Igreja Evangélica Assembléia de Deus - Minst. Belém - Setor 46' }),
          el('div', { class: 'f-t2', text: cfg.endereco_sede || 'Rua Independência, 179 -Centro - Embu Guaçu - SP' }),
          el('div', { class: 'f-t3', text: `Pr. Setorial - ${cfg.pastor_setorial || 'Pr. Luiz Amaral'}` }),
          el('div', { class: 'f-titulo', text: 'FICHA DE CADASTRO SETORIAL' })),
        el('div', { class: 'f-foto' }, fotoUrl
          ? el('img', { src: fotoUrl, alt: '' })
          : el('span', { class: 'f-foto-txt' }, '02', el('br'), 'FOTOS', el('br'), '3X4'))),

      linha(R('CONGREGAÇÃO:', 150, 'f-congr'), V(v('congregacao_id'), null, 'f-congr-v')),
      linha(R('Nome:', 63), V(c.nome)),
      linha(R('Nome do Conjugue:', 149, 'f-bege'), V(casado ? c.conjuge_nome : '', 319, 'f-bege'),
        R('Data de Casamento:', 149, 'f-bege'), V(casado ? dataOuTracos(c.data_casamento) : '___/___/___', null, 'f-bege f-centro')),
      linha(R('Nome do Pai:', 128), V(c.pai_nome)),
      linha(R('Nome da Mãe:', 128), V(c.mae_nome)),
      linha(R('Data de Nasc.', 105), V(formatarData(c.data_nascimento), 105, 'f-centro'),
        R('Data de Nasc. Conjugue:', 172, 'f-bege'), V(casado ? dataOuTracos(c.conjuge_data_nascimento) : '___/___/___', 106, 'f-bege f-centro'),
        R('Estado civil', 88), V(v('estado_civil'))),
      linha(R('Origem:', 63), ...origem),
      linha(R('Natural da Cidade:', 149), V(c.naturalidade_cidade, 276), R('UF.', 44), V(c.naturalidade_uf, 63, 'f-centro'),
        R('País:', 44), V(c.naturalidade_pais)),
      linha(R('RG.', 43), V(c.rg, 148), R('Emissor', 64), V(c.rg_emissor, 42, 'f-mini'), R('Data de emissão', 129),
        V(formatarData(c.rg_data_emissao), 85, 'f-centro'), R('CPF', 42), V(v('cpf'))),
      linha(R('Escolaridade:', 105), V(v('escolaridade'), 235), R('Profissão:', 86), V(c.profissao)),
      linha(R('Endereço:', 85), V([c.endereco, c.complemento].filter(Boolean).join(' – '), 448), R('Número:', 63), V(c.numero)),
      linha(R('Bairro:', 63), V(c.bairro, 256), R('Cidade:', 86), V(c.cidade, 191), R('Estado:', 65), V(c.estado, null, 'f-centro')),
      linha(R('CEP.', 63), V(v('cep'), 192), R('Fone:', 64), V(v('telefone'), 192), R('Cel.', 43), V(v('celular'))),
      linha(R('E-mail:', 63), V(c.email)),
      linha(R('Data de Batismo:', 128), V(formatarData(c.data_batismo), 148, 'f-centro'), R('Igreja de Batismo:', 150), V(c.igreja_batismo)),
      linha(R('Cidade e Estado da Igreja onde foi batizado:', 319),
        V([c.igreja_batismo_cidade, c.igreja_batismo_uf].filter(Boolean).join(' - '))),
      linha(el('div', { class: 'fc f-admissao', style: `width:${mm(490)}` }, el('b', { text: 'Admitido na igreja por:' }), ` ${admissao}`),
        el('div', { class: 'fc f-normal', style: `width:${mm(63)}` }, 'Data:'), V(formatarData(c.admissao_data), null, 'f-centro')),
      el('div', { class: 'fl f-bloco-cargos' },
        cargos,
        el('div', { class: 'f-obreiro' },
          el('span', { class: 'f-obreiro-txt', text: 'Para obreiros. Informar local e data de apresentação ou consagração:' }),
          el('span', { class: 'f-obreiro-linha', text: obreiro }))),
      linha(el('div', { class: 'fc f-normal', style: `width:${mm(63)}` }, 'Cargos:'), V(c.cargos)),
      el('div', { class: 'fl f-obs' }, el('div', { class: 'fc f-normal f-obs-txt' }, 'Observações: ', el('span', { class: 'f-obs-v', text: c.observacoes || '' }))),
      el('div', { class: 'fl f-obs2' }, el('div', { class: 'fc' }))),
    el('div', { class: 'f-rodape' },
      el('span', { text: `Protocolo ${c.protocolo} · ${rotulo('status', c.status)} · Recebido em ${dataHora(c.created_at)}${c.aprovado_em ? ` · Aprovado em ${dataHora(c.aprovado_em)}` : ''}` }),
      el('span', { text: `Impresso em ${dataHora(new Date().toISOString())} · Dados pessoais (LGPD) – uso restrito` })));

  await imprimir(doc, 'imprimindo-ficha');
  if (fotoUrl) setTimeout(() => URL.revokeObjectURL(fotoUrl), 60000);
}

export async function imprimirCartazQR(qrDataUrl, url) {
  const doc = el('div', { class: 'qr-cartaz' },
    el('div', { class: 'pf-logo' }, el('img', { src: LOGO, alt: 'Assembleia de Deus – Ministério do Belém – Setor 46' })),
    el('h1', { text: 'Ficha de Cadastro Setorial' }),
    el('p', { text: 'Aponte a câmera do celular para o código abaixo e preencha sua ficha.' }),
    el('img', { class: 'qr', src: qrDataUrl, alt: 'QR Code do formulário' }),
    el('div', { class: 'url', text: url }));
  await imprimir(doc, 'imprimindo-qr');
}

export { rotulo };
