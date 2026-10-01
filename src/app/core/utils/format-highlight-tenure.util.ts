/** Texto "Há: N dia(s)" / semana(s) / mês(es) / ano(s) para destaques do mural. */
export function formatHighlightTenure(sinceAt: Date | string): string {
  const start = sinceAt instanceof Date ? sinceAt : new Date(sinceAt);
  if (Number.isNaN(start.getTime())) {
    return '';
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - start.getTime());
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (days < 7) {
    const n = Math.max(1, days);
    return n === 1 ? 'Há: 1 dia' : `Há: ${n} dia(s)`;
  }

  if (days < 28) {
    const weeks = Math.max(1, Math.floor(days / 7));
    return weeks === 1 ? 'Há: 1 semana' : `Há: ${weeks} semana(s)`;
  }

  if (days < 365) {
    const months = Math.max(1, Math.floor(days / 30));
    return months === 1 ? 'Há: 1 mês' : `Há: ${months} mês(es)`;
  }

  const years = Math.max(1, Math.floor(days / 365));
  return years === 1 ? 'Há: 1 ano' : `Há: ${years} ano(s)`;
}
