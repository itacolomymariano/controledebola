import { Injectable } from '@angular/core';
import Parse from 'parse';
import { MuralTargetRole } from '../models/event-performance.model';
import {
  emptyMuralLocationTopRankings,
  MuralLocationTopGroup,
  MuralLocationTopRankings,
} from '../models/mural-location-top.model';
import { MuralRankingEntry, MuralScope } from '../models/mural.model';
import { ParseService } from './parse.service';

@Injectable({ providedIn: 'root' })
export class MuralLocationTopService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async getTopRankings(scope: MuralScope): Promise<MuralLocationTopRankings> {
    if (scope !== 'app') {
      return emptyMuralLocationTopRankings();
    }

    try {
      const result = await Parse.Cloud.run('getMuralLocationTopRankings', { scope });
      if (result && typeof result === 'object') {
        return this.normalize(result as MuralLocationTopRankings);
      }
    } catch {
      // Cloud Code pode ainda nao estar publicado.
    }

    return emptyMuralLocationTopRankings();
  }

  private normalize(raw: MuralLocationTopRankings): MuralLocationTopRankings {
    return {
      byState: this.normalizeGroups(raw.byState),
      byCity: this.normalizeGroups(raw.byCity),
      byNeighborhood: this.normalizeGroups(raw.byNeighborhood),
    };
  }

  private normalizeGroups(groups?: MuralLocationTopGroup[]): MuralLocationTopGroup[] {
    if (!Array.isArray(groups)) return [];

    return groups
      .filter((group) => group?.label && Number(group.participantCount) >= 3)
      .map((group) => ({
        label: String(group.label),
        participantCount: Number(group.participantCount) || 0,
        rankings: this.normalizeRankings(group.rankings),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }

  private normalizeRankings(
    rankings?: Record<MuralTargetRole, MuralRankingEntry[]>
  ): Record<MuralTargetRole, MuralRankingEntry[]> {
    const result = {} as Record<MuralTargetRole, MuralRankingEntry[]>;
    if (!rankings || typeof rankings !== 'object') {
      return result;
    }

    for (const [role, entries] of Object.entries(rankings)) {
      if (!Array.isArray(entries)) continue;
      result[role as MuralTargetRole] = entries
        .filter((entry) => entry?.userId)
        .slice(0, 3)
        .map((entry) => ({
          userId: String(entry.userId),
          userName: String(entry.userName || 'Participante'),
          role: (entry.role as MuralTargetRole) || (role as MuralTargetRole),
          totalScore: Number(entry.totalScore) || 0,
          voteCount: Number(entry.voteCount) || 0,
          averageScore: Number(entry.averageScore) || 0,
          performanceScore: Number(entry.performanceScore) || 0,
          combinedScore: Number(entry.combinedScore) || 0,
          avatarUrl: entry.avatarUrl ? String(entry.avatarUrl) : undefined,
        }));
    }

    return result;
  }
}
