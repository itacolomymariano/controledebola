import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      { path: 'peladas', loadChildren: () => import('../pages/peladas/peladas.module').then(m => m.PeladasPageModule) },
      { path: 'events', loadChildren: () => import('../pages/events/events.module').then(m => m.EventsPageModule) },
      { path: 'search', loadChildren: () => import('../pages/search/search.module').then(m => m.SearchPageModule) },
      { path: 'mural', loadChildren: () => import('../pages/mural/mural.module').then(m => m.MuralPageModule) },
      { path: 'profile', loadChildren: () => import('../pages/profile/profile.module').then(m => m.ProfilePageModule) },
      { path: '', redirectTo: 'peladas', pathMatch: 'full' },
    ],
  },
];

@NgModule({ imports: [RouterModule.forChild(routes)] })
export class TabsPageRoutingModule {}
