// Recorte de foto 3x4 no navegador: carrega a imagem, permite arrastar e
// aproximar, e gera um JPEG 600x800 sem metadados (o canvas descarta EXIF/GPS).
export const LARGURA = 600;
export const ALTURA = 800;

async function decodificar(arquivo) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    } catch { /* tenta com <img> */ }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function criarRecorte({ canvas, quadro, zoom, aoMudar, aoAjustar }) {
  const ctx = canvas.getContext('2d');
  let img = null;
  let escalaBase = 1;
  let z = 1;
  let cx = 0; // centro da imagem no canvas
  let cy = 0;

  function limitar() {
    const w = img.width * escalaBase * z;
    const h = img.height * escalaBase * z;
    cx = Math.min(w / 2, Math.max(LARGURA - w / 2, cx));
    cy = Math.min(h / 2, Math.max(ALTURA - h / 2, cy));
  }

  function desenhar() {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, LARGURA, ALTURA);
    if (!img) return;
    limitar();
    const w = img.width * escalaBase * z;
    const h = img.height * escalaBase * z;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  }

  async function carregar(arquivo) {
    if (!arquivo) return;
    if (!/^image\//.test(arquivo.type || 'image/')) throw new Error('Escolha um arquivo de imagem.');
    if (arquivo.size > 25 * 1024 * 1024) throw new Error('Imagem muito grande (máximo 25 MB).');
    let nova;
    try {
      nova = await decodificar(arquivo);
    } catch {
      throw new Error('Não foi possível abrir esta imagem. Tente uma foto em JPG ou PNG.');
    }
    if (nova.width < 150 || nova.height < 200) throw new Error('A imagem é muito pequena. Use uma foto com mais resolução.');
    img = nova;
    escalaBase = Math.max(LARGURA / img.width, ALTURA / img.height);
    z = 1;
    if (zoom) zoom.value = '1';
    cx = LARGURA / 2;
    cy = ALTURA / 2;
    desenhar();
    aoMudar?.();
  }

  function limpar() {
    img = null;
    desenhar();
    aoMudar?.();
  }

  // Arrastar
  let arrastando = null;
  quadro.addEventListener('pointerdown', (e) => {
    if (!img) return;
    arrastando = { x: e.clientX, y: e.clientY, cx, cy };
    quadro.setPointerCapture(e.pointerId);
  });
  quadro.addEventListener('pointermove', (e) => {
    if (!arrastando) return;
    const fator = LARGURA / quadro.getBoundingClientRect().width;
    cx = arrastando.cx + (e.clientX - arrastando.x) * fator;
    cy = arrastando.cy + (e.clientY - arrastando.y) * fator;
    desenhar();
  });
  // Avisa (com pequena espera) quando a pessoa termina de ajustar o enquadramento
  let espera;
  const ajustou = () => { clearTimeout(espera); espera = setTimeout(() => aoAjustar?.(), 250); };
  const soltar = () => { if (arrastando) ajustou(); arrastando = null; };
  quadro.addEventListener('pointerup', soltar);
  quadro.addEventListener('pointercancel', soltar);

  zoom?.addEventListener('input', () => {
    z = Number(zoom.value) || 1;
    desenhar();
    ajustou();
  });

  return {
    carregar,
    limpar,
    temFoto: () => !!img,
    dimensoes: () => (img ? { largura: img.width, altura: img.height } : null),
    gerarBlob: () => new Promise((res, rej) => {
      if (!img) { rej(new Error('Sem foto')); return; }
      desenhar();
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar a foto'))), 'image/jpeg', 0.88);
    }),
  };
}

// ---------------------------------------------------------------------------
// Conferência automática da foto (roda só no aparelho; nada é enviado).
// São AVISOS, não bloqueios: a conferência final é da secretaria.
// ---------------------------------------------------------------------------
function estatisticas(dados, W, regioes, passo = 4) {
  let n = 0; let soma = 0; let soma2 = 0; let cor = 0;
  for (const [x0, y0, w, h] of regioes) {
    for (let y = y0; y < y0 + h; y += passo) {
      for (let x = x0; x < x0 + w; x += passo) {
        const i = (y * W + x) * 4;
        const r = dados[i]; const g = dados[i + 1]; const b = dados[i + 2];
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        soma += l; soma2 += l * l; cor += Math.max(r, g, b) - Math.min(r, g, b); n += 1;
      }
    }
  }
  const media = soma / n;
  return { media, desvio: Math.sqrt(Math.max(0, soma2 / n - media * media)), cor: cor / n };
}

/** Analisa o recorte 3x4 atual e devolve a lista de avisos (vazia = parece ok). */
export function avisosDaFoto(canvas, dimensoes) {
  const W = canvas.width; const H = canvas.height;
  const dados = canvas.getContext('2d').getImageData(0, 0, W, H).data;
  // Fundo: faixa do topo e laterais acima dos ombros
  const lado = Math.round(W * 0.13);
  const fundo = estatisticas(dados, W, [
    [0, 0, W, Math.round(H * 0.07)],
    [0, 0, lado, Math.round(H * 0.5)],
    [W - lado, 0, lado, Math.round(H * 0.5)],
  ]);
  // Rosto / centro da foto
  const centro = estatisticas(dados, W, [[Math.round(W * 0.3), Math.round(H * 0.15), Math.round(W * 0.4), Math.round(H * 0.4)]]);

  const avisos = [];
  if (fundo.media < 160) avisos.push('O fundo parece escuro. A foto deve ter fundo branco ou bem claro.');
  else if (fundo.desvio > 40) avisos.push('O fundo não parece liso (objetos, estampas, móveis ou sombras). Use uma parede lisa e clara.');
  else if (fundo.cor > 50) avisos.push('O fundo parece colorido. O ideal é fundo branco.');
  if (centro.media < 65) avisos.push('A foto está escura. Procure um lugar com mais luz, de frente para a claridade.');
  else if (centro.media > 240) avisos.push('A foto está clara demais. Evite flash ou luz forte direto no rosto.');
  if (dimensoes && (dimensoes.largura < 300 || dimensoes.altura < 400)) avisos.push('A foto tem baixa resolução e pode sair borrada na impressão.');
  return avisos;
}
