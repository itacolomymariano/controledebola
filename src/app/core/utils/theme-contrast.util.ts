/** Contraste WCAG — luminancia relativa e razao entre duas cores hex (#rrggbb). */

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '').trim();
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized.slice(0, 6);
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channelLuminance(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function contrastRatio(backgroundHex: string, foregroundHex: string): number {
  const l1 = relativeLuminance(backgroundHex);
  const l2 = relativeLuminance(foregroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const TEXT_DARK = '#111827';
const TEXT_LIGHT = '#f9fafb';

/** Escolhe preto ou branco com melhor contraste sobre o fundo (minimo ~4.5:1 se possivel). */
export function pickReadableTextOn(backgroundHex: string): string {
  const darkRatio = contrastRatio(backgroundHex, TEXT_DARK);
  const lightRatio = contrastRatio(backgroundHex, TEXT_LIGHT);
  return darkRatio >= lightRatio ? TEXT_DARK : TEXT_LIGHT;
}

export function pickReadableMutedOn(backgroundHex: string): string {
  const base = pickReadableTextOn(backgroundHex);
  return base === TEXT_DARK ? '#374151' : '#e5e7eb';
}
