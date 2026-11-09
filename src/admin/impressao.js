import { caminho } from '../ui/caminho.js';
// Impressão: ficha individual A4 (fiel ao layout da ficha em papel) e cartaz do QR Code.
import { el, dataHora } from './util.js';
import {
  CAMPOS, OPCOES, formatarValor, formatarData, rotulo,
} from '../shared/campos.js';
import { sb } from './supabase.js';

const LOGO = caminho('img/logo-setor46.jpg');

async function carregarImagens(raiz) {
  const imgs = [...raiz.querySelectorAll('img')];
  await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth ? Promise.resolve() : i.decode().catch(() => {}))));
}

async function imprimir(conteudo) {
  const area = document.getElementById('impressao');
  area.replaceChildren(conteudo);
  await carregarImagens(area);
  document.body.classList.add('imprimindo');
  const limpar = () => {
    document.body.classList.remove('imprimindo');
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

export async function imprimirFicha(c, congregacoes, fotoBlob) {
  const cfg = await configSede();
  const v = (nome) => formatarValor(campo(nome), c[nome], congregacoes);
  const cel = (rot, valor, flex = 1, extra = '') => el('div', { class: `pf-cel ${extra}`, style: `flex:${flex}` }, el('b', { text: `${rot}:` }), el('span', { text: valor || '' }));
  const lin = (...cels) => el('div', { class: 'pf-lin' }, cels);
  const marca = (on) => el('span', { class: 'pf-box', text: on ? 'X' : '' });
  const op = (on, texto) => el('span', { class: 'pf-op' }, marca(on), texto);

  const fotoUrl = fotoBlob ? URL.createObjectURL(fotoBlob) : null;
  const casado = c.estado_civil === 'CASADO' || c.estado_civil === 'UNIAO_ESTAVEL';

  const doc = el('div', { class: 'pf' },
    el('div', { class: 'pf-logo' }, el('img', { src: LOGO, alt: 'Assembleia de Deus – Ministério do Belém – Setor 46' })),
    el('div', { class: 'pf-cab' },
      el('div', { class: 'pf-cab-texto' },
        el('div', { class: 't1', text: 'Igreja Evangélica Assembleia de Deus - Ministério do Belém - Setor 46' }),
        cfg.endereco_sede ? el('div', { class: 't2', text: cfg.endereco_sede }) : null,
        cfg.pastor_setorial ? el('div', { class: 't3', text: `Pr. Setorial - ${cfg.pastor_setorial}` }) : null,
        el('h1', { text: 'FICHA DE CADASTRO SETORIAL' }),
        el('div', { class: 'prot', text: `Protocolo ${c.protocolo} · Situação: ${rotulo('status', c.status)}` })),
      el('div', { class: 'pf-foto' }, fotoUrl ? el('img', { src: fotoUrl, alt: '' }) : 'FOTO 3X4')),
    el('div', { class: 'pf-tab' },
      lin(cel('CONGREGAÇÃO', v('congregacao_id'))),
      lin(cel('Nome', c.nome)),
      lin(cel('Nome do Cônjuge', casado ? c.conjuge_nome : '', 3, 'destaque'), cel('Data de Casamento', casado ? formatarData(c.data_casamento) : '', 1.3, 'destaque')),
      lin(cel('Nome do Pai', c.pai_nome)),
      lin(cel('Nome da Mãe', c.mae_nome)),
      lin(cel('Data de Nasc.', formatarData(c.data_nascimento), 1), cel('Data de Nasc. Cônjuge', casado ? formatarData(c.conjuge_data_nascimento) : '', 1.3, 'destaque'), cel('Estado civil', v('estado_civil'), 1.1)),
      lin(el('div', { class: 'pf-cel', style: 'flex:1' }, el('b', { text: 'Origem:' }),
        ...OPCOES.origem_religiosa.map(([k, r]) => op(c.origem_religiosa === k, r)),
        c.origem_outros ? el('span', { text: `(${c.origem_outros})` }) : null)),
      lin(cel('Natural da Cidade', c.naturalidade_cidade, 2.2), cel('UF', c.naturalidade_uf, .6), cel('País', c.naturalidade_pais, 1.2)),
      lin(cel('RG', c.rg, 1.2), cel('Emissor', c.rg_emissor, .9), cel('Data de emissão', formatarData(c.rg_data_emissao), 1.1), cel('CPF', v('cpf'), 1.3)),
      lin(cel('Escolaridade', v('escolaridade'), 1), cel('Profissão', c.profissao, 1)),
      lin(cel('Endereço', [c.endereco, c.complemento].filter(Boolean).join(' – '), 3), cel('Número', c.numero, .8)),
      lin(cel('Bairro', c.bairro, 1.4), cel('Cidade', c.cidade, 1.4), cel('Estado', c.estado, .6)),
      lin(cel('CEP', v('cep'), 1), cel('Fone', v('telefone'), 1), cel('Cel.', v('celular'), 1)),
      lin(cel('E-mail', c.email)),
      lin(cel('Data de Batismo', formatarData(c.data_batismo), 1), cel('Igreja de Batismo', c.igreja_batismo, 1.6)),
      lin(cel('Cidade e Estado da Igreja onde foi batizado', [c.igreja_batismo_cidade, c.igreja_batismo_uf].filter(Boolean).join(' - '))),
      lin(el('div', { class: 'pf-cel', style: 'flex:3' }, el('b', { text: 'Admitido na igreja por:' }),
        ...OPCOES.admissao_forma.map(([k, r]) => op(c.admissao_forma === k, r))),
      cel('Data', formatarData(c.admissao_data), 1)),
      el('div', { class: 'pf-lin' }, el('div', { class: 'pf-cargos' }, OPCOES.cargo.map(([k, r]) => op(c.cargo === k, r)))),
      lin(el('div', { class: 'pf-cel pf-obreiro', style: 'flex:1' }, el('b', { text: 'Para obreiros. Local e data de apresentação ou consagração:' }),
        el('span', { text: [c.obreiro_local, formatarData(c.obreiro_data)].filter(Boolean).join(' – ') }))),
      lin(cel('Cargos', c.cargos)),
      el('div', { class: 'pf-lin alta' }, cel('Observações', c.observacoes))),
    el('div', { class: 'pf-assin' }, el('div', { text: 'Assinatura do membro' }), el('div', { text: 'Secretaria / Pastor' })),
    el('div', { class: 'pf-rodape' },
      el('span', { text: `Recebido em ${dataHora(c.created_at)}${c.aprovado_em ? ` · Aprovado em ${dataHora(c.aprovado_em)}` : ''} · Impresso em ${dataHora(new Date().toISOString())}` }),
      el('span', { text: 'Documento com dados pessoais (LGPD) – uso restrito.' })));

  await imprimir(doc);
  if (fotoUrl) setTimeout(() => URL.revokeObjectURL(fotoUrl), 60000);
}

export async function imprimirCartazQR(qrDataUrl, url) {
  const doc = el('div', { class: 'qr-cartaz' },
    el('div', { class: 'pf-logo' }, el('img', { src: LOGO, alt: 'Assembleia de Deus – Ministério do Belém – Setor 46' })),
    el('h1', { text: 'Ficha de Cadastro Setorial' }),
    el('p', { text: 'Aponte a câmera do celular para o código abaixo e preencha sua ficha.' }),
    el('img', { class: 'qr', src: qrDataUrl, alt: 'QR Code do formulário' }),
    el('div', { class: 'url', text: url }));
  await imprimir(doc);
}

export { rotulo };
