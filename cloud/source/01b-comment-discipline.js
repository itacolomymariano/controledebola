/** Disciplina de comentarios — bloqueia palavroes / baixo calao (PT-BR). */

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

function normalizeCommentDisciplineText(value) {
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

function assertCommentDiscipline(text) {
  const normalized = normalizeCommentDisciplineText(text);
  if (!normalized) return;

  const compact = normalized.replace(/\s+/g, '');
  for (const term of COMMENT_DISCIPLINE_BLOCKED_TERMS) {
    const normalizedTerm = normalizeCommentDisciplineText(term);
    if (!normalizedTerm) continue;
    if (normalizedTerm.includes(' ')) {
      if (normalized.includes(normalizedTerm)) {
        throw new Parse.Error(
          Parse.Error.VALIDATION_ERROR,
          'Comentario fora da disciplina do app. Remova palavroes ou palavras de baixo calao.'
        );
      }
      continue;
    }
    const wordRe = new RegExp(`(?:^|\\s)${normalizedTerm}(?:$|\\s)`, 'i');
    if (wordRe.test(normalized) || compact.includes(normalizedTerm)) {
      // Evita falso positivo em palavras curtas embutidas demais (ex.: "pica" em "tropical").
      if (normalizedTerm.length <= 3 && !wordRe.test(normalized)) {
        continue;
      }
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Comentario fora da disciplina do app. Remova palavroes ou palavras de baixo calao.'
      );
    }
  }
}
