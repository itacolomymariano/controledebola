import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import Parse from 'parse';
import { getUniformById } from '../data/team-uniforms.data';
import { Address } from '../models/address.model';
import {
  AmateurTeam,
  AmateurTeamMember,
  CreateTeamPayload,
  TeamPickerRow,
  UpdateTeamPayload,
} from '../models/team.model';
import { parseErrorMessage } from '../utils/parse-error.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

const CLASS = 'AmateurTeam';
const MAX_TEAMS_PER_PRESIDENT = 5;

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly teamChanged$ = new Subject<void>();

  readonly onTeamChanged = this.teamChanged$.asObservable();

  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async listForPicker(search = ''): Promise<TeamPickerRow[]> {
    const rows = await Parse.Cloud.run('listAmateurTeamsForLegend', {
      search: search.trim(),
      limit: 80,
    });
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => ({
        id: String((row as { id?: string }).id || ''),
        name: String((row as { name?: string }).name || ''),
        imageUrl: (row as { imageUrl?: string }).imageUrl
          ? String((row as { imageUrl?: string }).imageUrl)
          : undefined,
        averageAge:
          typeof (row as { averageAge?: number }).averageAge === 'number'
            ? Number((row as { averageAge?: number }).averageAge)
            : null,
      }))
      .filter((row) => row.id && row.name);
  }

  async listMine(): Promise<AmateurTeam[]> {
    const rows = await Parse.Cloud.run('listMyAmateurTeams');
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => this.cloudRowToTeam(row as Record<string, unknown>))
      .filter((team) => !!team.objectId);
  }

  async getOwnedById(teamId: string): Promise<AmateurTeam | null> {
    const user = Parse.User.current();
    if (!user || !teamId.trim()) return null;
    const query = new Parse.Query(CLASS);
    query.include('president');
    try {
      const result = await query.get(teamId.trim());
      const president = result.get('president') as Parse.User | undefined;
      if (president?.id !== user.id) return null;
      return this.toTeam(result);
    } catch {
      return null;
    }
  }

  async getForCurrentUser(): Promise<AmateurTeam | null> {
    const mine = await this.listMine();
    if (!mine.length) return null;
    return this.getOwnedById(mine[0].objectId);
  }

  async getPublicProfile(teamId: string): Promise<Record<string, unknown>> {
    return (await Parse.Cloud.run('getAmateurTeamPublicProfile', { teamId })) as Record<
      string,
      unknown
    >;
  }

  async listMatchHistory(
    teamId: string,
    limit = 8
  ): Promise<
    Array<{
      eventId: string;
      name: string;
      startTime: string | null;
      homeTeamName: string;
      awayTeamName: string;
      homeScore: number;
      awayScore: number;
      isFinished: boolean;
      result: string;
    }>
  > {
    const rows = await Parse.Cloud.run('listAmateurTeamMatchHistory', { teamId, limit });
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        eventId: String(item['eventId'] || ''),
        name: String(item['name'] || ''),
        startTime: item['startTime'] ? String(item['startTime']) : null,
        homeTeamName: String(item['homeTeamName'] || ''),
        awayTeamName: String(item['awayTeamName'] || ''),
        homeScore: Number(item['homeScore'] || 0),
        awayScore: Number(item['awayScore'] || 0),
        isFinished: !!item['isFinished'],
        result: String(item['result'] || 'D'),
      };
    });
  }

  async listRoster(teamId: string): Promise<AmateurTeamMember[]> {
    const rows = await Parse.Cloud.run('listTeamRoster', { teamId });
    return Array.isArray(rows) ? rows.map((row) => this.toMember(row)) : [];
  }

  async addMember(payload: {
    teamId: string;
    athleteUserId?: string;
    legendAthleteId?: string;
  }): Promise<AmateurTeamMember> {
    const row = await Parse.Cloud.run('addTeamMember', payload);
    this.teamChanged$.next();
    return this.toMember(row);
  }

  async removeMember(membershipId: string): Promise<void> {
    await Parse.Cloud.run('removeTeamMember', { membershipId });
    this.teamChanged$.next();
  }

  async create(payload: CreateTeamPayload): Promise<AmateurTeam> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para cadastrar um time.');

    const mine = await this.listMine();
    if (mine.length >= MAX_TEAMS_PER_PRESIDENT) {
      throw new Error(`Voce pode cadastrar no maximo ${MAX_TEAMS_PER_PRESIDENT} times.`);
    }

    const name = payload.name.trim();
    if (name.length < 2) {
      throw new Error('Informe o nome do time (minimo 2 caracteres).');
    }

    const uniform = getUniformById(payload.uniformId);
    if (!uniform) {
      throw new Error('Selecione um uniforme na lista.');
    }

    const teamImage = await this.parseFileService.uploadImage(
      payload.teamImage,
      `team-${user.id}-logo`
    );
    const presidentImage = await this.parseFileService.uploadImage(
      payload.presidentImage,
      `team-${user.id}-president`
    );

    const team = new Parse.Object(CLASS);
    team.set('name', name);
    team.set('president', user);
    team.set('teamImage', teamImage);
    team.set('presidentImage', presidentImage);
    team.set('uniformId', uniform.id);
    team.set('uniformColors', uniform.colors);
    this.applyOptionalFields(team, payload);

    if (payload.shieldImage) {
      team.set(
        'shieldImage',
        await this.parseFileService.uploadImage(payload.shieldImage, `team-${user.id}-shield`)
      );
    }
    if (payload.headquartersImage) {
      team.set(
        'headquartersImage',
        await this.parseFileService.uploadImage(
          payload.headquartersImage,
          `team-${user.id}-hq`
        )
      );
    }

    try {
      const saved = await team.save();
      this.teamChanged$.next();
      return this.toTeam(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async update(teamId: string, payload: UpdateTeamPayload): Promise<AmateurTeam> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para atualizar o time.');

    const query = new Parse.Query(CLASS);
    const team = await query.get(teamId);
    const president = team.get('president') as Parse.User | undefined;
    if (president?.id !== user.id) {
      throw new Error('Apenas o presidente pode editar o time.');
    }

    if (payload.name?.trim()) team.set('name', payload.name.trim());
    if (payload.uniformId) {
      const uniform = getUniformById(payload.uniformId);
      if (!uniform) throw new Error('Selecione um uniforme na lista.');
      team.set('uniformId', uniform.id);
      team.set('uniformColors', uniform.colors);
    }
    this.applyOptionalFields(team, payload);

    if (payload.teamImage) {
      team.set(
        'teamImage',
        await this.parseFileService.uploadImage(payload.teamImage, `team-${user.id}-logo`)
      );
    }
    if (payload.presidentImage) {
      team.set(
        'presidentImage',
        await this.parseFileService.uploadImage(
          payload.presidentImage,
          `team-${user.id}-president`
        )
      );
    }
    if (payload.shieldImage) {
      team.set(
        'shieldImage',
        await this.parseFileService.uploadImage(payload.shieldImage, `team-${user.id}-shield`)
      );
    }
    if (payload.headquartersImage) {
      team.set(
        'headquartersImage',
        await this.parseFileService.uploadImage(
          payload.headquartersImage,
          `team-${user.id}-hq`
        )
      );
    }

    try {
      const saved = await team.save();
      this.teamChanged$.next();
      return this.toTeam(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  private applyOptionalFields(
    team: Parse.Object,
    payload: CreateTeamPayload | UpdateTeamPayload
  ): void {
    if (payload.foundedAt !== undefined) {
      if (payload.foundedAt) team.set('foundedAt', payload.foundedAt);
      else team.unset('foundedAt');
    }
    if (payload.homeVenue !== undefined) {
      team.set('homeVenue', String(payload.homeVenue || '').trim());
    }
    if (payload.homeVenueAddress !== undefined) {
      if (payload.homeVenueAddress) team.set('homeVenueAddress', payload.homeVenueAddress);
      else team.unset('homeVenueAddress');
    }
    if (payload.description !== undefined) {
      team.set('description', String(payload.description || '').trim().slice(0, 2000));
    }
  }

  private cloudRowToTeam(row: Record<string, unknown>): AmateurTeam {
    return {
      objectId: String(row['objectId'] || ''),
      name: String(row['name'] || ''),
      presidentId: String(row['presidentId'] || ''),
      teamImageUrl: row['imageUrl'] ? String(row['imageUrl']) : null,
      presidentImageUrl: null,
      shieldImageUrl: row['shieldImageUrl'] ? String(row['shieldImageUrl']) : null,
      headquartersImageUrl: null,
      uniformId: String(row['uniformId'] || ''),
      uniformColors: ['#000000', '#FFFFFF', '#A7A9AC'],
      foundedAt: row['foundedAt'] ? new Date(String(row['foundedAt'])) : null,
      homeVenue: String(row['homeVenue'] || ''),
      description: '',
    };
  }

  private toTeam(obj: Parse.Object): AmateurTeam {
    const president = obj.get('president') as Parse.User | undefined;
    const teamImage = obj.get('teamImage') as Parse.File | undefined;
    const presidentImage = obj.get('presidentImage') as Parse.File | undefined;
    const shieldImage = obj.get('shieldImage') as Parse.File | undefined;
    const headquartersImage = obj.get('headquartersImage') as Parse.File | undefined;
    const colors = (obj.get('uniformColors') as string[]) ?? ['#000000', '#FFFFFF', '#A7A9AC'];
    const foundedAt = obj.get('foundedAt') as Date | undefined;

    return {
      objectId: obj.id!,
      name: obj.get('name') as string,
      presidentId: president?.id ?? '',
      teamImageUrl: this.parseFileService.getFileUrl(teamImage),
      presidentImageUrl: this.parseFileService.getFileUrl(presidentImage),
      shieldImageUrl: this.parseFileService.getFileUrl(shieldImage),
      headquartersImageUrl: this.parseFileService.getFileUrl(headquartersImage),
      uniformId: (obj.get('uniformId') as string) ?? '',
      uniformColors: [colors[0], colors[1], colors[2]],
      foundedAt: foundedAt ?? null,
      homeVenue: String(obj.get('homeVenue') || ''),
      homeVenueAddress: (obj.get('homeVenueAddress') as Address | undefined) ?? null,
      description: String(obj.get('description') || ''),
    };
  }

  private toMember(row: Record<string, unknown>): AmateurTeamMember {
    return {
      objectId: String(row['objectId'] || ''),
      teamId: String(row['teamId'] || ''),
      userId: row['userId'] ? String(row['userId']) : undefined,
      legendAthleteId: row['legendAthleteId'] ? String(row['legendAthleteId']) : undefined,
      source: row['source'] === 'legend' ? 'legend' : 'athlete',
      apelido: String(row['apelido'] || 'Atleta'),
      avatarUrl: row['avatarUrl'] ? String(row['avatarUrl']) : undefined,
      position: row['position'] ? String(row['position']) : undefined,
      age: typeof row['age'] === 'number' ? Number(row['age']) : null,
      birthDate: row['birthDate'] ? String(row['birthDate']) : null,
    };
  }
}
