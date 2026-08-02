import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  AmateurLegendAthlete,
  AmateurLegendTeam,
  CreateLegendAthletePayload,
  CreateLegendTeamPayload,
  CreateProLegendAthletePayload,
  LegendSuggestion,
  ProLegendAthlete,
} from '../models/amateur-legend.model';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

@Injectable({ providedIn: 'root' })
export class AmateurLegendService {
  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async listAthletes(search = ''): Promise<AmateurLegendAthlete[]> {
    const rows = await Parse.Cloud.run('listAmateurLegendAthletes', { search: search.trim() });
    return Array.isArray(rows) ? rows.map((row) => this.mapAthlete(row)) : [];
  }

  async listTeams(search = ''): Promise<AmateurLegendTeam[]> {
    const rows = await Parse.Cloud.run('listAmateurLegendTeams', { search: search.trim() });
    return Array.isArray(rows) ? rows.map((row) => this.mapTeam(row)) : [];
  }

  async getAthlete(id: string): Promise<AmateurLegendAthlete | null> {
    const row = await Parse.Cloud.run('getAmateurLegendAthlete', { id });
    return row ? this.mapAthlete(row) : null;
  }

  async getTeam(id: string): Promise<AmateurLegendTeam | null> {
    const row = await Parse.Cloud.run('getAmateurLegendTeam', { id });
    return row ? this.mapTeam(row) : null;
  }

  async createAthlete(payload: CreateLegendAthletePayload): Promise<AmateurLegendAthlete> {
    let imageUrl: string | undefined;
    if (payload.imageFile) {
      const file = await this.parseFileService.uploadImage(
        payload.imageFile,
        `legend-athlete-${Date.now()}`
      );
      imageUrl = this.parseFileService.getFileUrl(file) ?? undefined;
    }

    const result = await Parse.Cloud.run('createAmateurLegendAthlete', {
      name: payload.name,
      apelido: payload.apelido,
      address: payload.address,
      birthDate: payload.birthDate,
      careerEndYear: payload.careerEndYear,
      amateurTeams: payload.amateurTeams,
      position: payload.position,
      inMemoriam: payload.inMemoriam,
      memorialDate: payload.memorialDate,
      relationship: payload.relationship,
      imageUrl,
    });
    return this.mapAthlete(result);
  }

  async createProAthlete(payload: CreateProLegendAthletePayload): Promise<ProLegendAthlete> {
    let imageUrl: string | undefined;
    if (payload.imageFile) {
      const file = await this.parseFileService.uploadImage(
        payload.imageFile,
        `legend-pro-athlete-${Date.now()}`
      );
      imageUrl = this.parseFileService.getFileUrl(file) ?? undefined;
    }

    const result = await Parse.Cloud.run('createProLegendAthlete', {
      name: payload.name,
      apelido: payload.apelido,
      address: payload.address,
      birthDate: payload.birthDate,
      careerEndYear: payload.careerEndYear,
      proTeams: payload.proTeams,
      position: payload.position,
      inMemoriam: payload.inMemoriam,
      memorialDate: payload.memorialDate,
      relationship: payload.relationship,
      imageUrl,
    });
    return this.mapProAthlete(result);
  }

  async createTeam(payload: CreateLegendTeamPayload): Promise<AmateurLegendTeam> {
    let imageUrl: string | undefined;
    if (payload.imageFile) {
      const file = await this.parseFileService.uploadImage(
        payload.imageFile,
        `legend-team-${Date.now()}`
      );
      imageUrl = this.parseFileService.getFileUrl(file) ?? undefined;
    }

    const result = await Parse.Cloud.run('createAmateurLegendTeam', {
      name: payload.name,
      apelido: payload.apelido,
      location: payload.location,
      foundedDate: payload.foundedDate,
      endedDate: payload.endedDate,
      description: payload.description,
      relationship: payload.relationship,
      athleteRefs: payload.athleteRefs,
      imageUrl,
    });
    return this.mapTeam(result);
  }

  async suggestAmateurIdols(search = '', limit = 20): Promise<LegendSuggestion[]> {
    const rows = await Parse.Cloud.run('suggestAmateurFootballIdols', {
      search: search.trim(),
      limit,
    });
    return Array.isArray(rows) ? rows.map((row) => this.mapSuggestion(row)) : [];
  }

  async suggestProIdols(search = '', limit = 20): Promise<LegendSuggestion[]> {
    const rows = await Parse.Cloud.run('suggestProFootballIdols', {
      search: search.trim(),
      limit,
    });
    return Array.isArray(rows) ? rows.map((row) => this.mapSuggestion(row)) : [];
  }

  async suggestPeladaTeams(search = '', limit = 20): Promise<LegendSuggestion[]> {
    const rows = await Parse.Cloud.run('suggestFavoritePeladaTeams', {
      search: search.trim(),
      limit,
    });
    return Array.isArray(rows) ? rows.map((row) => this.mapSuggestion(row)) : [];
  }

  async searchAthleteRefs(search = '', limit = 20): Promise<LegendSuggestion[]> {
    const rows = await Parse.Cloud.run('searchLegendAthleteRefs', {
      search: search.trim(),
      limit,
    });
    return Array.isArray(rows) ? rows.map((row) => this.mapSuggestion(row)) : [];
  }

  async listAmateurTeamsForLegend(
    address?: AmateurLegendAthlete['address'],
    search = '',
    limit = 50
  ): Promise<Array<{ id: string; name: string; imageUrl?: string }>> {
    const rows = await Parse.Cloud.run('listAmateurTeamsForLegend', {
      address: address ?? {},
      search: search.trim(),
      limit,
    });
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({
      id: String(row['id'] || ''),
      name: String(row['name'] || ''),
      imageUrl: row['imageUrl'] ? String(row['imageUrl']) : undefined,
    }));
  }

  private mapAthlete(row: Record<string, unknown>): AmateurLegendAthlete {
    return {
      id: String(row['id'] || ''),
      name: String(row['name'] || ''),
      apelido: String(row['apelido'] || ''),
      imageUrl: row['imageUrl'] ? String(row['imageUrl']) : undefined,
      address: row['address'] as AmateurLegendAthlete['address'],
      birthDate: row['birthDate'] ? String(row['birthDate']) : undefined,
      careerEndYear: row['careerEndYear'] != null ? Number(row['careerEndYear']) : undefined,
      amateurTeams: Array.isArray(row['amateurTeams']) ? row['amateurTeams'].map(String) : [],
      position: row['position'] ? String(row['position']) : undefined,
      inMemoriam: !!row['inMemoriam'],
      memorialDate: row['memorialDate'] ? String(row['memorialDate']) : undefined,
      relationship: row['relationship'] as AmateurLegendAthlete['relationship'],
      registeredByUserId: row['registeredByUserId'] ? String(row['registeredByUserId']) : undefined,
      registeredByName: row['registeredByName'] ? String(row['registeredByName']) : undefined,
      registeredAt: row['registeredAt'] ? String(row['registeredAt']) : undefined,
    };
  }

  private mapTeam(row: Record<string, unknown>): AmateurLegendTeam {
    return {
      id: String(row['id'] || ''),
      name: String(row['name'] || ''),
      apelido: String(row['apelido'] ? row['apelido'] : ''),
      imageUrl: row['imageUrl'] ? String(row['imageUrl']) : undefined,
      location: row['location'] as AmateurLegendTeam['location'],
      foundedDate: row['foundedDate'] ? String(row['foundedDate']) : undefined,
      endedDate: row['endedDate'] ? String(row['endedDate']) : undefined,
      description: row['description'] ? String(row['description']) : undefined,
      relationship: row['relationship'] as AmateurLegendTeam['relationship'],
      athleteRefs: Array.isArray(row['athleteRefs']) ? (row['athleteRefs'] as AmateurLegendTeam['athleteRefs']) : [],
      registeredByUserId: row['registeredByUserId'] ? String(row['registeredByUserId']) : undefined,
      registeredByName: row['registeredByName'] ? String(row['registeredByName']) : undefined,
      registeredAt: row['registeredAt'] ? String(row['registeredAt']) : undefined,
    };
  }

  private mapProAthlete(row: Record<string, unknown>): ProLegendAthlete {
    return {
      id: String(row['id'] || ''),
      name: String(row['name'] || ''),
      apelido: String(row['apelido'] || ''),
      imageUrl: row['imageUrl'] ? String(row['imageUrl']) : undefined,
      address: row['address'] as ProLegendAthlete['address'],
      birthDate: row['birthDate'] ? String(row['birthDate']) : undefined,
      careerEndYear: row['careerEndYear'] != null ? Number(row['careerEndYear']) : undefined,
      proTeams: Array.isArray(row['proTeams']) ? row['proTeams'].map(String) : [],
      position: row['position'] ? String(row['position']) : undefined,
      inMemoriam: !!row['inMemoriam'],
      memorialDate: row['memorialDate'] ? String(row['memorialDate']) : undefined,
      relationship: row['relationship'] as ProLegendAthlete['relationship'],
      registeredByUserId: row['registeredByUserId'] ? String(row['registeredByUserId']) : undefined,
      registeredByName: row['registeredByName'] ? String(row['registeredByName']) : undefined,
      registeredAt: row['registeredAt'] ? String(row['registeredAt']) : undefined,
    };
  }

  private mapSuggestion(row: Record<string, unknown>): LegendSuggestion {
    return {
      id: String(row['id'] || ''),
      label: String(row['label'] || ''),
      subtitle: row['subtitle'] ? String(row['subtitle']) : undefined,
      source: row['source'] as LegendSuggestion['source'],
      imageUrl: row['imageUrl'] ? String(row['imageUrl']) : undefined,
    };
  }
}
