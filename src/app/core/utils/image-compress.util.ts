const DEFAULT_MAX_EDGE = 1024;
const DEFAULT_JPEG_QUALITY = 0.82;

export async function compressImageForUpload(
  file: File,
  maxEdge = DEFAULT_MAX_EDGE,
  quality = DEFAULT_JPEG_QUALITY
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const bitmap = await loadImageBitmap(file);
  const largestEdge = Math.max(bitmap.width, bitmap.height);
  if (largestEdge <= maxEdge && file.size <= 350_000 && file.type === 'image/jpeg') {
    bitmap.close?.();
    return file;
  }

  const scale = largestEdge > maxEdge ? maxEdge / largestEdge : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', quality);
  });
  if (!blob) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  if ('createImageBitmap' in window) {
    return await createImageBitmap(file);
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadHtmlImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Nao foi possivel processar a imagem.');
  }
  ctx.drawImage(image, 0, 0);
  return await createImageBitmap(canvas);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Nao foi possivel processar a imagem.'));
    image.src = src;
  });
}
