import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import Parse from 'parse';
import { getUniformById } from '../data/team-uniforms.data';
import { AmateurTeam, CreateTeamPayload } from '../models/team.model';
import { parseErrorMessage } from '../utils/parse-error.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

const CLASS = 'AmateurTeam';

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

  async getForCurrentUser(): Promise<AmateurTeam | null> {
    const user = Parse.User.current();
    if (!user) return null;

    const query = new Parse.Query(CLASS);
    query.equalTo('president', user);
    const result = await query.first();
    return result ? this.toTeam(result) : null;
  }

  async create(payload: CreateTeamPayload): Promise<AmateurTeam> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para cadastrar um time.');

    const existing = await this.getForCurrentUser();
    if (existing) {
      throw new Error('Voce ja possui um time cadastrado.');
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

    try {
      const saved = await team.save();
      this.teamChanged$.next();
      return this.toTeam(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  private toTeam(obj: Parse.Object): AmateurTeam {
    const president = obj.get('president') as Parse.User | undefined;
    const teamImage = obj.get('teamImage') as Parse.File | undefined;
    const presidentImage = obj.get('presidentImage') as Parse.File | undefined;
    const colors = (obj.get('uniformColors') as string[]) ?? ['#000000', '#FFFFFF', '#A7A9AC'];

    return {
      objectId: obj.id!,
      name: obj.get('name') as string,
      presidentId: president?.id ?? '',
      teamImageUrl: this.parseFileService.getFileUrl(teamImage),
      presidentImageUrl: this.parseFileService.getFileUrl(presidentImage),
      uniformId: (obj.get('uniformId') as string) ?? '',
      uniformColors: [colors[0], colors[1], colors[2]],
    };
  }
}
