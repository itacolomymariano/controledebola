import { Component, Input, OnChanges, ChangeDetectorRef } from '@angular/core';
import Parse from 'parse';
import { BrazilianTeamOption } from '../../../core/data/brazilian-teams.data';
import { resolveTeamShieldFromCommons } from '../../../core/utils/team-shield-commons.util';
import { resolveTeamShieldFromSportsDb } from '../../../core/utils/team-shield-remote.util';
import {
  getTeamShieldCandidates,
  teamInitials,
  teamSlug,
} from '../../../core/utils/team-shield.util';

@Component({
  selector: 'app-team-shield',
  templateUrl: './team-shield.component.html',
  styleUrls: ['./team-shield.component.scss'],
  standalone: false,
})
export class TeamShieldComponent implements OnChanges {
  @Input() teamName = '';
  @Input() team?: Pick<BrazilianTeamOption, 'name' | 'slug'>;
  @Input() size: 'sm' | 'md' = 'md';

  candidateIndex = 0;
  candidates: string[] = [];
  imageFailed = false;
  remoteLookupDone = false;
  private remoteLookupToken = 0;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnChanges(): void {
    this.resetCandidates();
    void this.enrichWithRemoteShields();
  }

  get shieldUrl(): string | undefined {
    if (this.imageFailed || !this.candidates.length) {
      return undefined;
    }
    return this.candidates[this.candidateIndex];
  }

  get initials(): string {
    return teamInitials(this.team?.name || this.teamName);
  }

  onImageError(): void {
    if (this.candidateIndex < this.candidates.length - 1) {
      this.candidateIndex += 1;
      return;
    }

    if (!this.remoteLookupDone) {
      return;
    }

    this.imageFailed = true;
  }

  private getSource(): Pick<BrazilianTeamOption, 'name' | 'slug'> {
    return (
      this.team ?? {
        name: this.teamName,
        slug: teamSlug(this.teamName),
      }
    );
  }

  private async enrichWithRemoteShields(): Promise<void> {
    const token = ++this.remoteLookupToken;
    const source = this.getSource();

    let remoteUrl: string | null = null;

    try {
      const result = (await Parse.Cloud.run('resolveTeamShieldUrl', {
        teamName: source.name,
        slug: source.slug,
      })) as { url?: string | null };
      remoteUrl = result?.url ?? null;
    } catch {
      // Cloud indisponível: segue para fallback no cliente.
    }

    if (!remoteUrl) {
      remoteUrl = await resolveTeamShieldFromSportsDb(source.name, source.slug);
    }

    if (!remoteUrl) {
      remoteUrl = await resolveTeamShieldFromCommons(source.name, source.slug);
    }

    if (token !== this.remoteLookupToken) {
      return;
    }

    this.remoteLookupDone = true;

    if (remoteUrl && !this.candidates.includes(remoteUrl)) {
      this.candidates.push(remoteUrl);
      if (this.imageFailed || this.candidateIndex >= this.candidates.length - 1) {
        this.candidateIndex = this.candidates.length - 1;
        this.imageFailed = false;
      }
      this.cdr.markForCheck();
      return;
    }

    if (this.candidateIndex >= this.candidates.length - 1) {
      this.imageFailed = true;
      this.cdr.markForCheck();
    }
  }

  private resetCandidates(): void {
    this.candidateIndex = 0;
    this.imageFailed = false;
    this.remoteLookupDone = false;
    this.remoteLookupToken += 1;
    this.candidates = getTeamShieldCandidates(this.getSource());
  }
}
