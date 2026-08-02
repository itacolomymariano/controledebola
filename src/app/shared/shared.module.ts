import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EventDetailOverviewComponent } from './components/event-detail-overview/event-detail-overview.component';
import { EventDetailVotingPanelComponent } from './components/event-detail-voting-panel/event-detail-voting-panel.component';
import { EventDetailGatePanelComponent } from './components/event-detail-gate-panel/event-detail-gate-panel.component';
import { EventDetailAdminSettingsPanelComponent } from './components/event-detail-admin-settings-panel/event-detail-admin-settings-panel.component';
import { EventDetailParticipantsPanelComponent } from './components/event-detail-participants-panel/event-detail-participants-panel.component';
import { EventDetailMaterialPanelComponent } from './components/event-detail-material-panel/event-detail-material-panel.component';
import { BirthDatePickerComponent } from './components/birth-date-picker/birth-date-picker.component';
import { AddressFormComponent } from './components/address-form/address-form.component';
import { AthleteProfileFieldsComponent } from './components/athlete-profile-fields/athlete-profile-fields.component';
import { RoleProfileFieldsComponent } from './components/role-profile-fields/role-profile-fields.component';
import { ImagePickerComponent } from './components/image-picker/image-picker.component';
import { JerseyPreviewComponent } from './components/jersey-preview/jersey-preview.component';
import { TeamPickerComponent } from './components/team-picker/team-picker.component';
import { TeamShieldComponent } from './components/team-shield/team-shield.component';
import { UniformPickerComponent } from './components/uniform-picker/uniform-picker.component';
import { UserAvatarComponent } from './components/user-avatar/user-avatar.component';
import { UserBarComponent } from './components/user-bar/user-bar.component';
import { LegendSuggestInputComponent } from './components/legend-suggest-input/legend-suggest-input.component';
import { MuralHighlightsPanelComponent } from './components/mural-highlights-panel/mural-highlights-panel.component';
import { MuralShowcaseEntryComponent } from './components/mural-showcase-entry/mural-showcase-entry.component';
import { EventRoleHiringPanelComponent } from './components/event-role-hiring-panel/event-role-hiring-panel.component';
import { MuralParticipantStatsComponent } from './components/mural-participant-stats/mural-participant-stats.component';
import { MuralLocationTopRankingsComponent } from './components/mural-location-top-rankings/mural-location-top-rankings.component';
import { MuralPredictionRankingsComponent } from './components/mural-prediction-rankings/mural-prediction-rankings.component';
import { MuralFanHighlightsComponent } from './components/mural-fan-highlights/mural-fan-highlights.component';
import { MuralSupportOpsCardComponent } from './components/mural-support-ops-card/mural-support-ops-card.component';
import { ScoutAthleteStripComponent } from './components/scout-athlete-strip/scout-athlete-strip.component';
import { ScoutStatCounterComponent } from './components/scout-stat-counter/scout-stat-counter.component';
import { AthletePerformancePanelComponent } from './components/athlete-performance-panel/athlete-performance-panel.component';
import { MuralPerformanceAnalyticsComponent } from './components/mural-performance-analytics/mural-performance-analytics.component';
import { EventGateTicketCardComponent } from './components/event-gate-ticket-card/event-gate-ticket-card.component';
import { PixCopyButtonComponent } from './components/pix-copy-button/pix-copy-button.component';
import { EventMediaEngagementComponent } from './components/event-media-engagement/event-media-engagement.component';
import { MuralMediaTopCardComponent } from './components/mural-media-top-card/mural-media-top-card.component';
import { MuralShareButtonComponent } from './components/mural-share-button/mural-share-button.component';

@NgModule({
  declarations: [
    EventDetailOverviewComponent,
    EventDetailVotingPanelComponent,
    EventDetailGatePanelComponent,
    EventDetailAdminSettingsPanelComponent,
    EventDetailParticipantsPanelComponent,
    EventDetailMaterialPanelComponent,
    BirthDatePickerComponent,
    AddressFormComponent,
    AthleteProfileFieldsComponent,
    RoleProfileFieldsComponent,
    ImagePickerComponent,
    JerseyPreviewComponent,
    TeamPickerComponent,
    TeamShieldComponent,
    UniformPickerComponent,
    UserAvatarComponent,
    UserBarComponent,
    LegendSuggestInputComponent,
    MuralHighlightsPanelComponent,
    MuralShowcaseEntryComponent,
    EventRoleHiringPanelComponent,
    MuralParticipantStatsComponent,
    MuralLocationTopRankingsComponent,
    MuralPredictionRankingsComponent,
    MuralFanHighlightsComponent,
    MuralSupportOpsCardComponent,
    ScoutAthleteStripComponent,
    ScoutStatCounterComponent,
    AthletePerformancePanelComponent,
    MuralPerformanceAnalyticsComponent,
    EventGateTicketCardComponent,
    PixCopyButtonComponent,
    EventMediaEngagementComponent,
    MuralMediaTopCardComponent,
    MuralShareButtonComponent,
  ],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule],
  exports: [
    EventDetailOverviewComponent,
    EventDetailVotingPanelComponent,
    EventDetailGatePanelComponent,
    EventDetailAdminSettingsPanelComponent,
    EventDetailParticipantsPanelComponent,
    EventDetailMaterialPanelComponent,
    BirthDatePickerComponent,
    AddressFormComponent,
    AthleteProfileFieldsComponent,
    RoleProfileFieldsComponent,
    ImagePickerComponent,
    JerseyPreviewComponent,
    TeamPickerComponent,
    TeamShieldComponent,
    UniformPickerComponent,
    UserAvatarComponent,
    UserBarComponent,
    LegendSuggestInputComponent,
    MuralHighlightsPanelComponent,
    MuralShowcaseEntryComponent,
    EventRoleHiringPanelComponent,
    MuralParticipantStatsComponent,
    MuralLocationTopRankingsComponent,
    MuralPredictionRankingsComponent,
    MuralFanHighlightsComponent,
    MuralSupportOpsCardComponent,
    ScoutAthleteStripComponent,
    ScoutStatCounterComponent,
    AthletePerformancePanelComponent,
    MuralPerformanceAnalyticsComponent,
    EventGateTicketCardComponent,
    PixCopyButtonComponent,
    EventMediaEngagementComponent,
    MuralMediaTopCardComponent,
    MuralShareButtonComponent,
  ],
})
export class SharedModule {}
