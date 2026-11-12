import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { MuralExploreCuriosities } from '../../../core/models/mural-explore-curiosities.model';
import { MuralShowcaseEntry } from '../../../core/models/mural-highlights.model';
import { MuralLocationFilter, MuralScope } from '../../../core/models/mural.model';
import { MuralShareContext } from '../../../core/models/mural-share.model';
import { MuralService } from '../../../core/services/mural.service';
import { muralLocationFiltersEqual } from '../../../core/utils/mural-location-filter.util';

export interface MuralExploreCardDef {
  titleKey: string;
  ruleKey: string;
  getEntry: (data: MuralExploreCuriosities) => MuralShowcaseEntry | null;
}

@Component({
  selector: 'app-mural-explore-curiosities',
  templateUrl: './mural-explore-curiosities.component.html',
  styleUrls: ['./mural-explore-curiosities.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MuralExploreCuriositiesComponent implements OnInit, OnChanges {
  @Input({ required: true }) scope!: MuralScope;
  @Input() scopeId?: string;
  @Input() shareContext: MuralShareContext | null = null;
  @Input() filterCaption = '';
  @Input() locationFilter?: MuralLocationFilter;
  @Input() playfulChrome = false;

  loading = false;
  data: MuralExploreCuriosities | null = null;

  readonly goalCards: MuralExploreCardDef[] = [
    {
      titleKey: 'mural.explore.goalRightFoot',
      ruleKey: 'mural.rule.explore.goalRightFoot',
      getEntry: (d) => d.goalDetails.rightFoot,
    },
    {
      titleKey: 'mural.explore.goalLeftFoot',
      ruleKey: 'mural.rule.explore.goalLeftFoot',
      getEntry: (d) => d.goalDetails.leftFoot,
    },
    {
      titleKey: 'mural.explore.goalHeader',
      ruleKey: 'mural.rule.explore.goalHeader',
      getEntry: (d) => d.goalDetails.header,
    },
    {
      titleKey: 'mural.explore.goalFreeKick',
      ruleKey: 'mural.rule.explore.goalFreeKick',
      getEntry: (d) => d.goalDetails.freeKick,
    },
    {
      titleKey: 'mural.explore.goalPenalty',
      ruleKey: 'mural.rule.explore.goalPenalty',
      getEntry: (d) => d.goalDetails.penalty,
    },
    {
      titleKey: 'mural.explore.penaltySaver',
      ruleKey: 'mural.rule.explore.penaltySaver',
      getEntry: (d) => d.goalDetails.penaltySaver,
    },
  ];

  readonly voteAgeCards: MuralExploreCardDef[] = [
    {
      titleKey: 'mural.explore.craqueMaster',
      ruleKey: 'mural.rule.explore.craqueMaster',
      getEntry: (d) => d.craqueMaster,
    },
    {
      titleKey: 'mural.explore.craquePromessa',
      ruleKey: 'mural.rule.explore.craquePromessa',
      getEntry: (d) => d.craquePromessa,
    },
    {
      titleKey: 'mural.explore.goleiroMaster',
      ruleKey: 'mural.rule.explore.goleiroMaster',
      getEntry: (d) => d.goleiroMaster,
    },
    {
      titleKey: 'mural.explore.goleiroPromessa',
      ruleKey: 'mural.rule.explore.goleiroPromessa',
      getEntry: (d) => d.goleiroPromessa,
    },
  ];

  readonly heightCards: MuralExploreCardDef[] = [
    {
      titleKey: 'mural.explore.tallest',
      ruleKey: 'mural.rule.explore.tallest',
      getEntry: (d) => d.tallest,
    },
    {
      titleKey: 'mural.explore.shortest',
      ruleKey: 'mural.rule.explore.shortest',
      getEntry: (d) => d.shortest,
    },
  ];

  constructor(
    private readonly muralService: MuralService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    void this.reload();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['scope']?.firstChange) return;
    const scopeChanged = !!(changes['scope'] && !changes['scope'].firstChange);
    const scopeIdChanged = !!(changes['scopeId'] && !changes['scopeId'].firstChange);
    const filterChange = changes['locationFilter'];
    const filterChanged =
      !!filterChange &&
      !filterChange.firstChange &&
      !muralLocationFiltersEqual(
        filterChange.previousValue as MuralLocationFilter | undefined,
        filterChange.currentValue as MuralLocationFilter | undefined
      );
    if (scopeChanged || scopeIdChanged || filterChanged) {
      void this.reload();
    }
  }

  private async reload(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      this.data = await this.muralService.loadExploreCuriosities(
        this.scope,
        this.scopeId,
        this.locationFilter
      );
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
