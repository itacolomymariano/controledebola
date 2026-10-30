import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { DirectoryTeamPickerRow, TeamDirectoryKind } from '../../../core/models/team.model';
import { AmateurLegendService } from '../../../core/services/amateur-legend.service';

@Component({
  selector: 'app-amateur-team-search-modal',
  templateUrl: './amateur-team-search-modal.component.html',
  styleUrls: ['./amateur-team-search-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AmateurTeamSearchModalComponent {
  @Input({ required: true }) isOpen = false;
  @Input() titleKey = 'athleteProfile.addPlayedTeam';
  @Input() allowFreeText = true;
  @Input() showCreateLegendTeam = false;

  @Output() readonly picked = new EventEmitter<string>();
  @Output() readonly createLegendTeam = new EventEmitter<string>();
  @Output() readonly dismissed = new EventEmitter<void>();

  teamKind: TeamDirectoryKind = 'active';
  search = '';
  loading = false;
  rows: DirectoryTeamPickerRow[] = [];
  private loadSeq = 0;

  constructor(
    private readonly legendService: AmateurLegendService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get filteredRows(): DirectoryTeamPickerRow[] {
    return this.rows;
  }

  get showCreateLegendPrompt(): boolean {
    return (
      this.showCreateLegendTeam &&
      this.teamKind === 'legend' &&
      this.search.trim().length >= 2 &&
      !this.loading &&
      !this.filteredRows.length
    );
  }

  get showUseTypedName(): boolean {
    return (
      this.allowFreeText &&
      this.search.trim().length >= 2 &&
      !this.loading &&
      (this.filteredRows.length > 0 || !this.showCreateLegendPrompt)
    );
  }

  onDidDismiss(): void {
    this.dismissed.emit();
    this.resetState();
  }

  onTeamKindChange(value: TeamDirectoryKind): void {
    if (this.teamKind === value) return;
    this.teamKind = value;
    void this.loadRows();
  }

  onSearchChange(value: string | null | undefined): void {
    this.search = value ?? '';
    void this.loadRows();
  }

  selectRow(row: DirectoryTeamPickerRow): void {
    this.picked.emit(row.name);
    this.resetState();
  }

  useTypedName(): void {
    const term = this.search.trim();
    if (!term) return;
    this.picked.emit(term);
    this.resetState();
  }

  emitCreateLegendTeam(): void {
    const term = this.search.trim();
    if (!term) return;
    this.createLegendTeam.emit(term);
  }

  private resetState(): void {
    this.search = '';
    this.rows = [];
    this.teamKind = 'active';
    this.cdr.markForCheck();
  }

  private async loadRows(): Promise<void> {
    const seq = ++this.loadSeq;
    const term = this.search.trim();
    if (term.length < 2) {
      this.rows = [];
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    try {
      const rows = await this.legendService.searchDirectoryTeamsForPicker(this.teamKind, term);
      if (seq !== this.loadSeq) return;
      this.rows = rows;
    } catch {
      if (seq !== this.loadSeq) return;
      this.rows = [];
    } finally {
      if (seq === this.loadSeq) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }
}
