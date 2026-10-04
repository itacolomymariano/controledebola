/** Caixa de mensagens do app (classe Parse `AppMessage`). */

/** Entrada = recebidas; Saida = enviadas pelo usuario atual. */
export type AppMessageBox = 'in' | 'out';

export interface AppMessage {
  objectId: string;
  box: AppMessageBox;
  /** Origem do aviso (ex.: `match_challenge`, `hiring_invite`, `team_match_created`). */
  kind: string;
  title: string;
  body: string;
  /** Entrada: quando chegou. Saida: quando foi enviada. */
  sentAt: Date | null;
  readAt: Date | null;
  unread: boolean;
  relatedClass: string;
  relatedId: string;
  /** Rota do app para abrir ao tocar (ex.: `/event/abc`, `/inbox`). Vazio = sem destino. */
  actionRoute: string;
  /** Outro lado da conversa: remetente na Entrada, destinatario na Saida. */
  counterpartUserId: string;
  /** Apelido ou nome resumido (fallback de exibicao). */
  counterpartName: string;
  /** `_User.apelido` do outro lado. Vazio se nao houver. */
  counterpartApelido: string;
  /** `_User.name` do outro lado. Vazio se nao houver. */
  counterpartFullName: string;
  counterpartAvatarUrl: string;
}

export interface AppMessageListOptions {
  search?: string;
  limit?: number;
  skip?: number;
}

export function toAppMessage(row: Record<string, unknown>, box: AppMessageBox): AppMessage {
  const sentAt = row['sentAt'] ? new Date(String(row['sentAt'])) : null;
  const readAt = row['readAt'] ? new Date(String(row['readAt'])) : null;
  return {
    objectId: String(row['objectId'] || ''),
    box: row['box'] === 'out' ? 'out' : row['box'] === 'in' ? 'in' : box,
    kind: String(row['kind'] || ''),
    title: String(row['title'] || ''),
    body: String(row['body'] || ''),
    sentAt: sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : null,
    readAt: readAt && !Number.isNaN(readAt.getTime()) ? readAt : null,
    unread: row['unread'] === undefined ? !readAt : !!row['unread'],
    relatedClass: String(row['relatedClass'] || ''),
    relatedId: String(row['relatedId'] || ''),
    actionRoute: String(row['actionRoute'] || ''),
    counterpartUserId: String(row['counterpartUserId'] || ''),
    counterpartName: String(row['counterpartName'] || ''),
    counterpartApelido: String(row['counterpartApelido'] || ''),
    counterpartFullName: String(row['counterpartFullName'] || ''),
    counterpartAvatarUrl: String(row['counterpartAvatarUrl'] || ''),
  };
}
