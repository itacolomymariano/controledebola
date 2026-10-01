/** Partes ja formatadas para exibicao (UF, cidade e bairro). */
export interface MuralFilterCaptionInput {
  state?: string | null;
  city?: string | null;
  neighborhood?: string | null;
}

/**
 * Frase unica do filtro de regiao do mural do app.
 * Sem estado: "Brasil".
 * Com estado: "Filtro: Estado: PE, Cidade: Recife, Bairro: Todos"
 * (cidade vazia = Todas, bairro vazio = Todos).
 */
export function muralFilterCaption(input: MuralFilterCaptionInput): string {
  const state = String(input.state ?? '').trim();
  if (!state) return 'Brasil';
  const city = String(input.city ?? '').trim() || 'Todas';
  const neighborhood = String(input.neighborhood ?? '').trim() || 'Todos';
  return `Filtro: Estado: ${state}, Cidade: ${city}, Bairro: ${neighborhood}`;
}
