import { Injectable } from '@angular/core';
import Parse from 'parse';
import { Address } from '../models/address.model';
import { PeladaParticipant } from '../models/pelada-participant.model';
import {
  emptyMuralParticipantLocationStats,
  MuralParticipantLocationStats,
} from '../models/mural-participant-stats.model';
import { MuralScope } from '../models/mural.model';
import { ParseService } from './parse.service';

@Injectable({ providedIn: 'root' })
export class MuralParticipantStatsService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async getLocationStats(
    scope: MuralScope,
    scopeId?: string,
    userIds?: string[],
    participants?: PeladaParticipant[]
  ): Promise<MuralParticipantLocationStats> {
    try {
      const result = await Parse.Cloud.run('getMuralParticipantLocationStats', {
        scope,
        scopeId,
        userIds: userIds ?? [],
      });
      if (result && typeof result === 'object') {
        const normalized = this.normalizeStats(result as MuralParticipantLocationStats);
        if (normalized.total > 0) {
          return normalized;
        }
      }
    } catch {
      // Cloud Code pode ainda nao estar publicado.
    }

    if (participants?.length) {
      return this.buildFromParticipants(participants, scope === 'app');
    }

    return emptyMuralParticipantLocationStats();
  }

  private buildFromParticipants(
    participants: PeladaParticipant[],
    includeState: boolean
  ): MuralParticipantLocationStats {
    const byState = new Map<string, number>();
    const byCity = new Map<string, number>();
    const byNeighborhood = new Map<string, number>();
    let total = 0;

    for (const participant of participants) {
      const stats = this.addressCounts(participant.address, includeState);
      if (!stats) continue;
      total += 1;
      if (stats.state) {
        byState.set(stats.state, (byState.get(stats.state) ?? 0) + 1);
      }
      if (stats.city) {
        byCity.set(stats.city, (byCity.get(stats.city) ?? 0) + 1);
      }
      if (stats.neighborhood) {
        byNeighborhood.set(stats.neighborhood, (byNeighborhood.get(stats.neighborhood) ?? 0) + 1);
      }
    }

    const sortList = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));

    return {
      total,
      byState: includeState ? sortList(byState) : [],
      byCity: sortList(byCity),
      byNeighborhood: sortList(byNeighborhood),
    };
  }

  private addressCounts(
    address: Address | undefined,
    includeState: boolean
  ): { state?: string; city?: string; neighborhood?: string } | null {
    if (!address) return null;
    const state = this.normalizeLabel(address.state).toUpperCase();
    const city = this.normalizeLabel(address.city);
    const neighborhood = this.normalizeLabel(address.neighborhood);
    if (!state && !city && !neighborhood) return null;

    return {
      state: includeState && state ? state : undefined,
      city: city ? (includeState && state ? `${city} - ${state}` : city) : undefined,
      neighborhood: neighborhood
        ? [neighborhood, city, includeState ? state : ''].filter(Boolean).join(' · ')
        : undefined,
    };
  }

  private normalizeLabel(value: string | undefined): string {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private normalizeStats(raw: MuralParticipantLocationStats): MuralParticipantLocationStats {
    const normalizeList = (items?: MuralParticipantLocationStats['byCity']) =>
      Array.isArray(items)
        ? items
            .filter((item) => item?.label && item.count > 0)
            .map((item) => ({ label: String(item.label), count: Number(item.count) || 0 }))
        : [];

    return {
      total: Number(raw.total) || 0,
      byState: normalizeList(raw.byState),
      byCity: normalizeList(raw.byCity),
      byNeighborhood: normalizeList(raw.byNeighborhood),
    };
  }
}
