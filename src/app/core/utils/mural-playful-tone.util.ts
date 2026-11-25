import { PlayfulCardTone } from '../../shared/components/playful-card/playful-card.component';

const MURAL_PLAYFUL_TONES: PlayfulCardTone[] = ['peladas', 'confrontos', 'times', 'users'];

/** Tons fortes de destaque — não usar surface/muted em rankings. */
export function muralPlayfulToneForSection(key: string, index = 0): PlayfulCardTone {
  const normalized = String(key || 'section').trim().toLowerCase();
  let hash = index;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash + normalized.charCodeAt(i) * (i + 1)) % 997;
  }
  return MURAL_PLAYFUL_TONES[hash % MURAL_PLAYFUL_TONES.length];
}

export function muralPlayfulToneByIndex(index: number): PlayfulCardTone {
  return MURAL_PLAYFUL_TONES[Math.abs(index) % MURAL_PLAYFUL_TONES.length];
}

/** Tom do card filho: sempre distinto do pai (ranking dentro de ranking). */
export function muralPlayfulNestedTone(
  parent: PlayfulCardTone,
  childIndex = 0
): PlayfulCardTone {
  const parentIdx = Math.max(0, MURAL_PLAYFUL_TONES.indexOf(parent));
  const offset = (Math.abs(childIndex) % 3) + 1;
  return MURAL_PLAYFUL_TONES[(parentIdx + offset) % MURAL_PLAYFUL_TONES.length];
}