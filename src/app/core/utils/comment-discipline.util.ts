/** Disciplina de comentarios (cliente) — espelha a regra do Cloud Code. */

const COMMENT_DISCIPLINE_BLOCKED_TERMS = [
  'porra',
  'caralho',
  'merda',
  'bosta',
  'puta',
  'puto',
  'putinha',
  'putaria',
  'foda',
  'foder',
  'fodase',
  'foda-se',
  'fudido',
  'fudeu',
  'cuzao',
  'cusao',
  'buceta',
  'boceta',
  'xoxota',
  'piroca',
  'pica',
  'rola',
  'punheta',
  'siririca',
  'viado',
  'viadinho',
  'bicha',
  'bichinha',
  'arrombado',
  'arrombada',
  'otario',
  'otaria',
  'filho da puta',
  'filha da puta',
  'vai se foder',
  'vai tomar no cu',
  'tomar no cu',
  'vsf',
  'vtnc',
  'pqp',
  'krl',
  'crl',
  'pnc',
  'cacete',
  'desgraca',
  'desgracado',
  'desgracada',
  'corno',
  'cornudo',
  'vagabunda',
  'vagabundo',
  'safado',
  'safada',
  'escroto',
  'escrota',
  'imbecil',
  'idiota',
  'retardado',
  'retardada',
];

function normalizeCommentDisciplineText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0@]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Retorna mensagem de erro se o texto violar a disciplina; senao null. */
export function commentDisciplineViolation(text: string): string | null {
  const normalized = normalizeCommentDisciplineText(text);
  if (!normalized) return null;

  const compact = normalized.replace(/\s+/g, '');
  for (const term of COMMENT_DISCIPLINE_BLOCKED_TERMS) {
    const normalizedTerm = normalizeCommentDisciplineText(term);
    if (!normalizedTerm) continue;
    if (normalizedTerm.includes(' ')) {
      if (normalized.includes(normalizedTerm)) {
        return 'Comentario fora da disciplina do app. Remova palavroes ou palavras de baixo calao.';
      }
      continue;
    }
    const wordRe = new RegExp(`(?:^|\\s)${normalizedTerm}(?:$|\\s)`, 'i');
    if (wordRe.test(normalized) || compact.includes(normalizedTerm)) {
      if (normalizedTerm.length <= 3 && !wordRe.test(normalized)) {
        continue;
      }
      return 'Comentario fora da disciplina do app. Remova palavroes ou palavras de baixo calao.';
    }
  }
  return null;
}
