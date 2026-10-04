import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeDirectoryPage } from './home-directory.page';
import { HomeUsuarioPage } from './home-usuario.page';
import { PeladasListPage } from './peladas-list.page';
import { PeladasPage } from './peladas.page';

const routes: Routes = [
  { path: '', component: PeladasPage },
  { path: 'lista', component: PeladasListPage },
  { path: 'confrontos', component: HomeDirectoryPage, data: { door: 'confrontos' } },
  { path: 'times', component: HomeDirectoryPage, data: { door: 'times' } },
  { path: 'usuarios', component: HomeDirectoryPage, data: { door: 'usuarios' } },
  { path: 'usuarios/:userId', component: HomeUsuarioPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PeladasPageRoutingModule {}
