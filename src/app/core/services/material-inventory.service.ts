import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  EventMaterialDivergence,
  EventMaterialLine,
  EventMaterialSession,
  EventMaterialSource,
  EventMaterialStatus,
  MaterialInventoryItem,
  MaterialItemType,
  MaterialOwnerType,
  UpsertMaterialInventoryPayload,
  computeMaterialDivergences,
  materialLineDisplayLabel,
} from '../models/material-inventory.model';
import { parseErrorMessage } from '../utils/parse-error.util';
import { ParseService } from './parse.service';

@Injectable({ providedIn: 'root' })
export class MaterialInventoryService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async listInventory(params: {
    ownerType: MaterialOwnerType;
    peladaId?: string;
  }): Promise<MaterialInventoryItem[]> {
    try {
      const rows = await Parse.Cloud.run('listMaterialInventory', {
        ownerType: params.ownerType,
        peladaId: params.peladaId,
      });
      if (!Array.isArray(rows)) return [];
      return rows.map((row) => this.toInventoryItem(row as Record<string, unknown>));
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async upsertItem(payload: UpsertMaterialInventoryPayload): Promise<MaterialInventoryItem> {
    try {
      const row = await Parse.Cloud.run('upsertMaterialInventoryItem', {
        objectId: payload.objectId,
        ownerType: payload.ownerType,
        peladaId: payload.peladaId,
        itemType: payload.itemType,
        color: (payload.color || '').trim(),
        quantity: Math.max(0, Number(payload.quantity) || 0),
        damagedQuantity: Math.max(0, Number(payload.damagedQuantity) || 0),
      });
      return this.toInventoryItem(row as Record<string, unknown>);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async deleteItem(objectId: string): Promise<void> {
    try {
      await Parse.Cloud.run('deleteMaterialInventoryItem', { objectId });
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async getEventSession(eventId: string): Promise<EventMaterialSession | null> {
    try {
      const row = await Parse.Cloud.run('getEventMaterialSession', { eventId });
      if (!row || typeof row !== 'object') return null;
      return this.toSession(row as Record<string, unknown>);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async setEventSource(
    eventId: string,
    materialSource: EventMaterialSource,
    counterpartyUserId?: string
  ): Promise<EventMaterialSession> {
    try {
      const row = await Parse.Cloud.run('setEventMaterialSource', {
        eventId,
        materialSource,
        counterpartyUserId,
      });
      return this.toSession(row as Record<string, unknown>);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async loadEventMaterial(
    eventId: string,
    mode: 'all' | 'partial',
    lines?: Array<{ inventoryItemId: string; quantity: number }>
  ): Promise<EventMaterialSession> {
    try {
      const row = await Parse.Cloud.run('loadEventMaterial', {
        eventId,
        mode,
        lines,
      });
      return this.toSession(row as Record<string, unknown>);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async sendEventMaterial(eventId: string): Promise<EventMaterialSession> {
    try {
      const row = await Parse.Cloud.run('sendEventMaterial', { eventId });
      return this.toSession(row as Record<string, unknown>);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async submitBlindCount(
    eventId: string,
    counts: Array<{
      itemType: MaterialItemType;
      color: string;
      quantity: number;
      damagedQuantity?: number;
    }>
  ): Promise<EventMaterialSession> {
    try {
      const row = await Parse.Cloud.run('submitEventMaterialBlindCount', {
        eventId,
        counts,
      });
      return this.toSession(row as Record<string, unknown>);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async receiveEventMaterialReturn(
    eventId: string,
    counts: Array<{
      itemType: MaterialItemType;
      color: string;
      quantity: number;
      damagedQuantity?: number;
    }>
  ): Promise<EventMaterialSession> {
    try {
      const row = await Parse.Cloud.run('receiveEventMaterialReturn', {
        eventId,
        counts,
      });
      return this.toSession(row as Record<string, unknown>);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async applyMaterialLosses(eventId: string): Promise<EventMaterialSession> {
    try {
      const row = await Parse.Cloud.run('applyEventMaterialLosses', { eventId });
      return this.toSession(row as Record<string, unknown>);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  formatDivergence(row: EventMaterialDivergence): string {
    const signal = row.delta > 0 ? '+' : '';
    return `${row.label}: esperado ${row.expected}, contado ${row.counted} (${signal}${row.delta})`;
  }

  private toInventoryItem(row: Record<string, unknown>): MaterialInventoryItem {
    const quantity = Math.max(0, Number(row['quantity'] || 0));
    const damagedQuantity = Math.max(0, Number(row['damagedQuantity'] || 0));
    return {
      objectId: String(row['objectId'] || ''),
      ownerType: (row['ownerType'] as MaterialOwnerType) || 'pelada',
      peladaId: row['peladaId'] ? String(row['peladaId']) : undefined,
      userId: row['userId'] ? String(row['userId']) : undefined,
      itemType: (row['itemType'] as MaterialItemType) || 'ball',
      color: String(row['color'] || ''),
      quantity,
      damagedQuantity,
      // Avaria nao reduz disponibilidade para uso no evento.
      availableQuantity: quantity,
    };
  }

  private toSession(row: Record<string, unknown>): EventMaterialSession {
    const lines = Array.isArray(row['lines'])
      ? (row['lines'] as Record<string, unknown>[]).map((line) => this.toLine(line))
      : [];
    const materialSource = (row['materialSource'] as EventMaterialSource) || 'none';
    const status = (row['status'] as EventMaterialStatus) || 'idle';
    const divergences = Array.isArray(row['divergences'])
      ? (row['divergences'] as Record<string, unknown>[]).map((d) => ({
          itemType: (d['itemType'] as MaterialItemType) || 'ball',
          color: String(d['color'] || ''),
          label:
            String(d['label'] || '') ||
            materialLineDisplayLabel(
              (d['itemType'] as MaterialItemType) || 'ball',
              String(d['color'] || '')
            ),
          expected: Number(d['expected'] || 0),
          counted: Number(d['counted'] || 0),
          delta: Number(d['delta'] || 0),
        }))
      : computeMaterialDivergences(
          lines,
          materialSource === 'pelada' ? 'return' : 'receive'
        );

    return {
      objectId: String(row['objectId'] || ''),
      eventId: String(row['eventId'] || ''),
      materialSource,
      counterpartyUserId: row['counterpartyUserId']
        ? String(row['counterpartyUserId'])
        : undefined,
      counterpartyName: row['counterpartyName']
        ? String(row['counterpartyName'])
        : undefined,
      status,
      lines,
      divergences,
      lossesApplied: !!row['lossesApplied'],
      updatedAt: row['updatedAt'] ? new Date(String(row['updatedAt'])) : undefined,
    };
  }

  private toLine(row: Record<string, unknown>): EventMaterialLine {
    const blind = row['quantityBlindCounted'];
    const damaged = row['quantityDamagedCounted'];
    return {
      inventoryItemId: row['inventoryItemId'] ? String(row['inventoryItemId']) : undefined,
      itemType: (row['itemType'] as MaterialItemType) || 'ball',
      color: String(row['color'] || ''),
      quantityLoaded: Math.max(0, Number(row['quantityLoaded'] || 0)),
      quantitySent: Math.max(0, Number(row['quantitySent'] || 0)),
      quantityReturned: Math.max(0, Number(row['quantityReturned'] || 0)),
      quantityBlindCounted: blind == null ? null : Math.max(0, Number(blind) || 0),
      quantityDamagedCounted: damaged == null ? null : Math.max(0, Number(damaged) || 0),
    };
  }
}
