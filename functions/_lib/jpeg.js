// Validação de JPEG e remoção de metadados (EXIF/GPS, XMP, comentários)
// sem decodificar a imagem. Funciona no runtime da Cloudflare (Workers).

export class ErroImagem extends Error {}

export function limparJpeg(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new ErroImagem('O arquivo não é uma imagem JPEG válida.');
  }
  const partes = [bytes.subarray(0, 2)];
  let i = 2;
  let largura = 0;
  let altura = 0;
  let temScan = false;

  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new ErroImagem('Imagem JPEG corrompida.');
    const marcador = bytes[i + 1];
    if (marcador === 0xff) { i += 1; continue; }
    if (marcador === 0xd9) { partes.push(bytes.subarray(i, i + 2)); break; }
    if ((marcador >= 0xd0 && marcador <= 0xd7) || marcador === 0x01) {
      partes.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > bytes.length) throw new ErroImagem('Imagem JPEG corrompida.');
    const tam = (bytes[i + 2] << 8) | bytes[i + 3];
    if (tam < 2 || i + 2 + tam > bytes.length) throw new ErroImagem('Imagem JPEG corrompida.');

    const ehSOF = marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador);
    if (ehSOF) {
      altura = (bytes[i + 5] << 8) | bytes[i + 6];
      largura = (bytes[i + 7] << 8) | bytes[i + 8];
    }
    const descartar = (marcador >= 0xe1 && marcador <= 0xef) || marcador === 0xfe;
    if (!descartar) partes.push(bytes.subarray(i, i + 2 + tam));
    i += 2 + tam;

    if (marcador === 0xda) {
      temScan = true;
      // Dados comprimidos até o marcador de fim (EOI = FF D9). Nos dados
      // comprimidos todo 0xFF é seguido de 0x00 ou de um marcador RSTn/SOS/DHT,
      // então o primeiro FF D9 é o fim real da imagem. Bytes após o EOI
      // (ex.: arquivo "poliglota" com HTML/ZIP anexado) são descartados.
      let fim = -1;
      for (let j = i; j < bytes.length - 1; j++) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) { fim = j + 2; break; }
      }
      if (fim < 0) throw new ErroImagem('Imagem JPEG incompleta.');
      partes.push(bytes.subarray(i, fim));
      break;
    }
  }

  if (!temScan || !largura || !altura) throw new ErroImagem('Imagem JPEG incompleta.');

  const total = partes.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { saida.set(p, pos); pos += p.length; }
  return { bytes: saida, largura, altura };
}
