import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { LegendSuggestion } from '../../../core/models/amateur-legend.model';
import { AmateurLegendService } from '../../../core/services/amateur-legend.service';
import {
  LegendFormReturnField,
  persistLegendFormReturnState,
} from '../../../core/utils/legend-form-navigation.util';

type LegendSuggestFilter = 'all' | 'legend' | 'app';

@Component({
  selector: 'app-legend-suggest-input',
  templateUrl: './legend-suggest-input.component.html',
  styleUrls: ['./legend-suggest-input.component.scss'],
  standalone: false,
})
export class LegendSuggestInputComponent implements OnInit, OnDestroy {
  @Input({ required: true }) control!: FormControl<string | null>;
  @Input({ required: true }) label!: string;
  @Input() placeholder = '';
  @Input() suggestType: 'idol' | 'pro_idol' | 'pelada_team' = 'idol';
  @Input() disabled = false;
  /** Busca enquanto digita, sem modal (ex.: Criar conta). */
  @Input() inlineSearch = false;
  /** URL para voltar apos cadastrar lenda (ex.: /account/edit). */
  @Input() returnUrl = '';
  /** Campo de destino ao retornar (ex.: proFootballIdol). */
  @Input() returnField: LegendFormReturnField | '' = '';

  modalOpen = false;
  inlinePanelOpen = false;
  search = '';
  loading = false;
  sourceFilter: LegendSuggestFilter = 'all';
  suggestions: LegendSuggestion[] = [];
  private readonly search$ = new Subject<string>();
  private searchSub?: Subscription;
  private controlSub?: Subscription;
  private blurTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly legendService: AmateurLegendService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.searchSub = this.search$
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((term) => void this.loadSuggestions(term));

    if (this.inlineSearch) {
      this.search = this.control.value || '';
      this.controlSub = this.control.valueChanges.subscribe((value) => {
        this.search = value || '';
      });
    }
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.controlSub?.unsubscribe();
    if (this.blurTimer) clearTimeout(this.blurTimer);
  }

  get filteredSuggestions(): LegendSuggestion[] {
    if (this.sourceFilter === 'all') {
      return this.suggestions;
    }
    if (this.sourceFilter === 'legend') {
      return this.suggestions.filter((item) => {
        if (this.suggestType === 'pelada_team') {
          return item.source === 'legend_team';
        }
        if (this.suggestType === 'pro_idol') {
          return item.source === 'legend_pro_athlete';
        }
        return item.source === 'legend_athlete';
      });
    }
    return this.suggestions.filter((item) => {
      if (this.suggestType === 'pelada_team') {
        return item.source === 'app_team' || item.source === 'pelada_team_text';
      }
      return item.source === 'app_athlete';
    });
  }

  get legendFilterLabel(): string {
    if (this.suggestType === 'pelada_team') {
      return 'Times Lendas';
    }
    return 'Atletas Lendas';
  }

  get appFilterLabel(): string {
    if (this.suggestType === 'pelada_team') {
      return 'Times do app';
    }
    return 'Atletas do app';
  }

  get inlineNotFoundMessage(): string {
    if (this.suggestType === 'pelada_team') {
      return `Nenhum time encontrado para "${this.search.trim()}".`;
    }
    return `Nenhum atleta encontrado para "${this.search.trim()}".`;
  }

  get inlineCreateButtonLabel(): string {
    if (this.suggestType === 'pelada_team') {
      return `Cadastrar time amador "${this.search.trim()}"`;
    }
    return `Cadastrar lenda "${this.search.trim()}"`;
  }

  get showCreateLegendPrompt(): boolean {
    if (this.inlineSearch) {
      return this.showInlineCreatePrompt;
    }
    return (
      this.sourceFilter === 'legend' &&
      !!this.search.trim() &&
      !this.loading &&
      this.filteredSuggestions.length === 0
    );
  }

  get showInlineCreatePrompt(): boolean {
    return (
      this.inlineSearch &&
      this.search.trim().length >= 2 &&
      !this.loading &&
      this.suggestions.length === 0
    );
  }

  get showInlinePanel(): boolean {
    if (!this.inlineSearch || !this.inlinePanelOpen) return false;
    const term = this.search.trim();
    if (term.length < 2) return false;
    return this.loading || this.suggestions.length > 0 || this.showInlineCreatePrompt;
  }

  openModal(): void {
    if (this.disabled) return;
    this.search = this.control.value || '';
    this.sourceFilter = 'all';
    this.modalOpen = true;
    void this.loadSuggestions(this.search);
  }

  closeModal(): void {
    this.modalOpen = false;
  }

  onFilterChange(value: LegendSuggestFilter): void {
    this.sourceFilter = value;
  }

  onSearchInput(value: string): void {
    this.search = value;
    this.search$.next(value);
  }

  onInlineInput(value: string): void {
    if (this.disabled) return;
    this.search = value;
    this.inlinePanelOpen = true;
    if (value.trim().length >= 2) {
      this.search$.next(value);
    } else {
      this.suggestions = [];
    }
  }

  onInlineFocus(): void {
    if (this.disabled) return;
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.inlinePanelOpen = true;
    const term = this.search.trim();
    if (term.length >= 2) {
      this.search$.next(term);
    }
  }

  onInlineBlur(): void {
    this.blurTimer = setTimeout(() => {
      this.inlinePanelOpen = false;
    }, 200);
  }

  selectSuggestion(item: LegendSuggestion): void {
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.control.setValue(item.label);
    this.control.markAsDirty();
    this.inlinePanelOpen = false;
    this.closeModal();
  }

  useTypedValue(): void {
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.control.setValue(this.search.trim());
    this.control.markAsDirty();
    this.inlinePanelOpen = false;
    this.closeModal();
  }

  goCreateLegend(): void {
    const term = this.search.trim();
    if (!term) return;
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.inlinePanelOpen = false;

    const route =
      this.suggestType === 'pelada_team'
        ? '/legends/team/new'
        : this.suggestType === 'pro_idol'
          ? '/legends/pro-athlete/new'
          : '/legends/athlete/new';

    const returnUrl = this.returnUrl.trim();
    const queryParams: Record<string, string> = { name: term, apelido: term };
    if (returnUrl) {
      queryParams['returnUrl'] = returnUrl;
      if (this.returnField) {
        queryParams['returnField'] = this.returnField;
      }
      persistLegendFormReturnState({
        returnUrl,
        returnField: this.returnField || undefined,
      });
    }

    void this.router.navigate([route], { queryParams });
    this.closeModal();
  }

  private async loadSuggestions(term: string): Promise<void> {
    this.loading = true;
    try {
      this.suggestions =
        this.suggestType === 'pelada_team'
          ? await this.legendService.suggestPeladaTeams(term)
          : this.suggestType === 'pro_idol'
            ? await this.legendService.suggestProIdols(term)
            : await this.legendService.suggestAmateurIdols(term);
    } finally {
      this.loading = false;
    }
  }
}
