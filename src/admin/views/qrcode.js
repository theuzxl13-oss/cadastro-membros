import { caminho } from '../../ui/caminho.js';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import {
  el, preencher, carregandoEm, toast, baixarBlob,
} from '../util.js';
import { imprimirCartazQR } from '../impressao.js';

const LOGO = caminho('img/logo-setor46.jpg');

function carregarImagem(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

async function gerarCartazPNG(url) {
  const W = 1240;
  const H = 1754; // A4 em 150 dpi
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  const logo = await carregarImagem(LOGO);
  const lh = Math.round((logo.height / logo.width) * W); // mantém a proporção
  g.drawImage(logo, 0, 0, W, lh);
  g.fillStyle = '#b08a2e'; g.fillRect(0, lh, W, 8);
  g.fillStyle = '#141414';
  g.textAlign = 'center';
  g.font = 'bold 64px Arial, sans-serif';
  g.fillText('Ficha de Cadastro Setorial', W / 2, lh + 130);
  g.font = '34px Arial, sans-serif';
  g.fillText('Aponte a câmera do celular e preencha sua ficha', W / 2, lh + 190);
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, { width: 900, margin: 2, errorCorrectionLevel: 'H' });
  g.drawImage(qr, (W - 900) / 2, lh + 240, 900, 900);
  g.font = '30px monospace';
  g.fillText(url, W / 2, lh + 240 + 900 + 70);
  return new Promise((res) => cv.toBlob(res, 'image/png'));
}

async function gerarPDF(url) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const logo = await carregarImagem(LOGO);
  const larg = 190;
  const alt = (logo.height / logo.width) * larg;
  pdf.addImage(logo, 'JPEG', 10, 10, larg, alt);
  pdf.setFillColor(176, 138, 46);
  pdf.rect(10, 10 + alt, larg, 1.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.text('Ficha de Cadastro Setorial', 105, 30 + alt, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  pdf.text('Aponte a câmera do celular para o código e preencha sua ficha.', 105, 40 + alt, { align: 'center' });
  const qrData = await QRCode.toDataURL(url, { width: 1200, margin: 1, errorCorrectionLevel: 'H' });
  pdf.addImage(qrData, 'PNG', 45, 50 + alt, 120, 120);
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(12);
  pdf.text(url, 105, 180 + alt, { align: 'center', maxWidth: 190 });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Igreja Evangélica Assembleia de Deus – Ministério do Belém – Setor 46 – Embu-Guaçu/SP', 105, 287, { align: 'center' });
  return pdf.output('blob');
}

export async function viewQRCode({ sb, view, atual }) {
  carregandoEm(view);
  const { data } = await sb.from('configuracoes').select('url_publica').eq('id', 1).maybeSingle();
  if (!atual()) return;
  const url = data?.url_publica || `${location.origin}${caminho()}`;
  const canvas = el('canvas', { 'aria-label': `QR Code para ${url}` });
  await QRCode.toCanvas(canvas, url, { width: 600, margin: 2, errorCorrectionLevel: 'H' });
  const nomeBase = 'qrcode-ficha-setor46';

  const executar = (fn) => async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try { await fn(); } catch (err) { toast(`Falha: ${err.message || err}`, 'erro'); } finally { b.disabled = false; }
  };

  preencher(view, 
    el('h1', { text: 'QR Code do formulário' }),
    data?.url_publica ? null : el('div', { class: 'alerta info' },
      'Usando o endereço atual do site. Para fixar o link de produção, defina a "URL pública" em ',
      el('a', { href: '#/configuracoes', text: 'Configurações' }), '.'),
    el('div', { class: 'qr-layout' },
      el('div', { class: 'qr-caixa' }, canvas),
      el('div', { class: 'card' },
        el('h2', { text: 'Link do formulário público' }),
        el('div', { class: 'qr-link', text: url }),
        el('div', { class: 'botoes' },
          el('button', {
            type: 'button',
            class: 'btn',
            text: 'Copiar link',
            onclick: executar(async () => {
              try { await navigator.clipboard.writeText(url); } catch {
                const t = el('textarea', { style: 'position:fixed;opacity:0' });
                t.value = url; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
              }
              toast('Link copiado.');
            }),
          }),
          el('a', { class: 'btn sec', href: url, target: '_blank', rel: 'noopener', text: 'Abrir formulário' })),
        el('h2', { text: 'Baixar e imprimir', style: 'margin-top:18px' }),
        el('div', { class: 'botoes' },
          el('button', { type: 'button', class: 'btn ouro', text: 'Baixar PNG', onclick: executar(async () => baixarBlob(await gerarCartazPNG(url), `${nomeBase}.png`)) }),
          el('button', { type: 'button', class: 'btn ouro', text: 'Gerar PDF', onclick: executar(async () => baixarBlob(await gerarPDF(url), `${nomeBase}.pdf`)) }),
          el('button', { type: 'button', class: 'btn sec', text: 'Imprimir', onclick: executar(async () => imprimirCartazQR(await QRCode.toDataURL(url, { width: 1000, margin: 2, errorCorrectionLevel: 'H' }), url)) })),
        el('p', { class: 'dica', style: 'margin-top:12px', text: 'O PNG e o PDF incluem a logo do Setor 46, o QR Code e o link por extenso.' }))),
  );
}
