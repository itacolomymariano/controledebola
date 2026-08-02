import { NgModule } from '@angular/core';
import { NoPreloading, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'splash', pathMatch: 'full' },
  { path: 'splash', loadChildren: () => import('./pages/splash/splash.module').then(m => m.SplashPageModule) },
  { path: 'onboarding', loadChildren: () => import('./pages/onboarding/onboarding.module').then(m => m.OnboardingPageModule) },
  { path: 'login', loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule) },
  { path: 'register', loadChildren: () => import('./pages/register/register.module').then(m => m.RegisterPageModule) },
  {
    path: 'profile-setup',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/profile-setup/profile-setup.module').then(m => m.ProfileSetupPageModule),
  },
  {
    path: 'tabs',
    canMatch: [AuthGuard],
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule),
  },
  {
    path: 'about',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/about/about.module').then(m => m.AboutPageModule),
  },
  {
    path: 'pelada-create',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/pelada-form/pelada-form.module').then(m => m.PeladaFormPageModule),
  },
  {
    path: 'pelada/:id/edit',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/pelada-form/pelada-form.module').then(m => m.PeladaFormPageModule),
  },
  {
    path: 'pelada/:id',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/pelada-detail/pelada-detail.module').then(m => m.PeladaDetailPageModule),
  },
  {
    path: 'event-create',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/event-create/event-create.module').then(m => m.EventCreatePageModule),
  },
  {
    path: 'event/:id/gate-scan',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-gate-scan/event-gate-scan.module').then(m => m.EventGateScanPageModule),
  },
  {
    path: 'event/:id/gate-entries',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-gate-entries/event-gate-entries.module').then(
        m => m.EventGateEntriesPageModule
      ),
  },
  {
    path: 'event/:id/mural',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/event-mural/event-mural.module').then(m => m.EventMuralPageModule),
  },
  {
    path: 'event/:id/narrator-radio',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-narrator-radio/event-narrator-radio.module').then(
        (m) => m.EventNarratorRadioPageModule
      ),
  },
  {
    path: 'event/:id/journalist-journal',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-journalist-journal/event-journalist-journal.module').then(
        (m) => m.EventJournalistJournalPageModule
      ),
  },
  {
    path: 'event/:id/cameraman-coverage',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-cameraman-coverage/event-cameraman-coverage.module').then(
        (m) => m.EventCameramanCoveragePageModule
      ),
  },
  {
    path: 'event/:id/scout',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-scout-apontamento/event-scout-apontamento.module').then(
        m => m.EventScoutApontamentoPageModule
      ),
  },
  {
    path: 'event/:id/sumula',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-sumula/event-sumula.module').then(m => m.EventSumulaPageModule),
  },
  {
    path: 'event/:id/supplementary-hiring',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-supplementary-hiring/event-supplementary-hiring.module').then(
        m => m.EventSupplementaryHiringPageModule
      ),
  },
  {
    path: 'event/:id',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/event-detail/event-detail.module').then(m => m.EventDetailPageModule),
  },
  {
    path: 'event/:id/register',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/event-register/event-register.module').then(m => m.EventRegisterPageModule),
  },
  {
    path: 'athlete-profile/form',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/athlete-profile-form/athlete-profile-form.module').then(m => m.AthleteProfileFormPageModule),
  },
  {
    path: 'athlete-profile/hiring',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/athlete-profile-hiring/athlete-profile-hiring.module').then(
        m => m.AthleteProfileHiringPageModule
      ),
  },
  {
    path: 'role-profile/form',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/role-profile-form/role-profile-form.module').then(m => m.RoleProfileFormPageModule),
  },
  {
    path: 'fan-profile/form',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/fan-profile-form/fan-profile-form.module').then(m => m.FanProfileFormPageModule),
  },
  {
    path: 'event/:id/team-split',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-team-split/event-team-split.module').then(m => m.EventTeamSplitPageModule),
  },
  {
    path: 'event/:id/predictions',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/event-predictions/event-predictions.module').then(m => m.EventPredictionsPageModule),
  },
  {
    path: 'event/:id/fan-checkin',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-fan-checkin/event-fan-checkin.module').then(
        (m) => m.EventFanCheckInPageModule
      ),
  },
  {
    path: 'event/:id/coach-board',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-coach-board/event-coach-board.module').then(
        (m) => m.EventCoachBoardPageModule
      ),
  },
  {
    path: 'event/:id/masseur-treatments',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-masseur-treatments/event-masseur-treatments.module').then(
        (m) => m.EventMasseurTreatmentsPageModule
      ),
  },
  {
    path: 'event/:id/physical-trainer',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/event-physical-trainer/event-physical-trainer.module').then(
        (m) => m.EventPhysicalTrainerPageModule
      ),
  },
  {
    path: 'inbox',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/inbox/inbox.module').then(m => m.InboxPageModule),
  },
  {
    path: 'team/form',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/team-form/team-form.module').then(m => m.TeamFormPageModule),
  },
  {
    path: 'legends',
    canMatch: [AuthGuard],
    loadChildren: () => import('./pages/legends-hub/legends-hub.module').then(m => m.LegendsHubPageModule),
  },
  {
    path: 'legends/athlete/new',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/legend-athlete-form/legend-athlete-form.module').then(m => m.LegendAthleteFormPageModule),
  },
  {
    path: 'legends/pro-athlete/new',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/legend-pro-athlete-form/legend-pro-athlete-form.module').then(
        m => m.LegendProAthleteFormPageModule
      ),
  },
  {
    path: 'legends/athlete/:id',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/legend-athlete-view/legend-athlete-view.module').then(m => m.LegendAthleteViewPageModule),
  },
  {
    path: 'legends/team/new',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/legend-team-form/legend-team-form.module').then(m => m.LegendTeamFormPageModule),
  },
  {
    path: 'account/edit',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/account-edit/account-edit.module').then(m => m.AccountEditPageModule),
  },
  {
    path: 'athlete/:userId',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/athlete-profile-view/athlete-profile-view.module').then(
        m => m.AthleteProfileViewPageModule
      ),
  },
  {
    path: 'profile/:role/:userId',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/profile-view/profile-view.module').then(m => m.ProfileViewPageModule),
  },
  {
    path: 'material-inventory',
    canMatch: [AuthGuard],
    loadChildren: () =>
      import('./pages/material-inventory/material-inventory.module').then(
        (m) => m.MaterialInventoryPageModule
      ),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: NoPreloading })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
