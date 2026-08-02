/** Inventario de material da pelada ou do ropeiro (kitman). */

export type MaterialOwnerType = 'pelada' | 'kitman';

export type MaterialItemType =
  | 'shirt'
  | 'bib'
  | 'shorts'
  | 'socks'
  | 'shin_guards'
  | 'gloves'
  | 'captain_armband'
  | 'ball'
  | 'goal_net'
  | 'water_bottle'
  | 'water_gallon'
  | 'goal_post';

export interface MaterialItemDefinition {
  type: MaterialItemType;
  label: string;
  category: 'uniforme' | 'equipamento';
  hasColor: boolean;
}

export const MATERIAL_ITEM_DEFINITIONS: MaterialItemDefinition[] = [
  { type: 'shirt', label: 'Camisas', category: 'uniforme', hasColor: true },
  { type: 'bib', label: 'Coletes', category: 'uniforme', hasColor: true },
  { type: 'shorts', label: 'Calcoes', category: 'uniforme', hasColor: true },
  { type: 'socks', label: 'Pares de Meioes', category: 'uniforme', hasColor: true },
  { type: 'shin_guards', label: 'Pares de Caneleiras', category: 'uniforme', hasColor: false },
  { type: 'gloves', label: 'Pares de Luvas', category: 'uniforme', hasColor: false },
  { type: 'captain_armband', label: 'Faixa de capitao', category: 'uniforme', hasColor: false },
  { type: 'ball', label: 'Bolas', category: 'equipamento', hasColor: false },
  { type: 'goal_net', label: 'Pares Redes de Barras', category: 'equipamento', hasColor: false },
  { type: 'water_bottle', label: "Garrafas d'agua", category: 'equipamento', hasColor: false },
  { type: 'water_gallon', label: "Garrafoes d'agua", category: 'equipamento', hasColor: false },
  { type: 'goal_post', label: 'Pares de Barras', category: 'equipamento', hasColor: false },
];

export const MATERIAL_ITEM_LABELS: Record<MaterialItemType, string> = Object.fromEntries(
  MATERIAL_ITEM_DEFINITIONS.map((def) => [def.type, def.label])
) as Record<MaterialItemType, string>;

/** Cores padrao para cadastro de uniforme (camisas, coletes, calcoes, meioes). */
export const MATERIAL_UNIFORM_COLORS: readonly string[] = [
  'Amarelo',
  'Azul',
  'Azul claro',
  'Azul marinho',
  'Branco',
  'Cinza',
  'Laranja',
  'Marrom',
  'Preto',
  'Rosa',
  'Roxo',
  'Verde',
  'Verde limao',
  'Vermelho',
  'Vinho',
];

export interface MaterialInventoryItem {
  objectId: string;
  ownerType: MaterialOwnerType;
  peladaId?: string;
  userId?: string;
  itemType: MaterialItemType;
  color: string;
  quantity: number;
  damagedQuantity: number;
  availableQuantity: number;
}

export interface UpsertMaterialInventoryPayload {
  ownerType: MaterialOwnerType;
  peladaId?: string;
  itemType: MaterialItemType;
  color?: string;
  quantity: number;
  damagedQuantity: number;
  objectId?: string;
}

export type EventMaterialSource = 'pelada' | 'kitman' | 'none';

export type EventMaterialStatus =
  | 'idle'
  | 'loaded'
  | 'sent'
  | 'received'
  | 'reconciled';

export interface EventMaterialLine {
  inventoryItemId?: string;
  itemType: MaterialItemType;
  color: string;
  quantityLoaded: number;
  quantitySent: number;
  quantityReturned: number;
  quantityBlindCounted: number | null;
  /** Avarias identificadas na conferencia (qualificativas; item continua utilizavel). */
  quantityDamagedCounted: number | null;
}

export interface EventMaterialDivergence {
  itemType: MaterialItemType;
  color: string;
  label: string;
  expected: number;
  counted: number;
  delta: number;
}

export interface EventMaterialSession {
  objectId: string;
  eventId: string;
  materialSource: EventMaterialSource;
  counterpartyUserId?: string;
  counterpartyName?: string;
  status: EventMaterialStatus;
  lines: EventMaterialLine[];
  divergences: EventMaterialDivergence[];
  lossesApplied: boolean;
  updatedAt?: Date;
}

export function materialLineKey(itemType: MaterialItemType, color: string): string {
  return `${itemType}::${(color || '').trim().toLowerCase()}`;
}

export function computeMaterialDivergences(
  lines: EventMaterialLine[],
  mode: 'return' | 'receive'
): EventMaterialDivergence[] {
  const rows: EventMaterialDivergence[] = [];
  for (const line of lines) {
    if (line.quantityBlindCounted == null) continue;
    const expected = mode === 'return' ? line.quantitySent : line.quantitySent || line.quantityLoaded;
    const counted = Number(line.quantityBlindCounted) || 0;
    const delta = counted - expected;
    if (delta === 0) continue;
    rows.push({
      itemType: line.itemType,
      color: line.color || '',
      label: materialLineDisplayLabel(line.itemType, line.color),
      expected,
      counted,
      delta,
    });
  }
  return rows;
}

export function materialLineDisplayLabel(itemType: MaterialItemType, color?: string): string {
  const base = MATERIAL_ITEM_LABELS[itemType] || itemType;
  const normalized = (color || '').trim();
  return normalized ? `${base} (${normalized})` : base;
}
