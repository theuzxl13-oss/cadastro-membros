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

export function criarRecorte({ canvas, quadro, zoom, aoMudar }) {
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
  const soltar = () => { arrastando = null; };
  quadro.addEventListener('pointerup', soltar);
  quadro.addEventListener('pointercancel', soltar);

  zoom?.addEventListener('input', () => {
    z = Number(zoom.value) || 1;
    desenhar();
  });

  return {
    carregar,
    limpar,
    temFoto: () => !!img,
    gerarBlob: () => new Promise((res, rej) => {
      if (!img) { rej(new Error('Sem foto')); return; }
      desenhar();
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar a foto'))), 'image/jpeg', 0.88);
    }),
  };
}
