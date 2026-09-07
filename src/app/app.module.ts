import { APP_INITIALIZER, NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SharedModule } from './shared/shared.module';
import { I18nService } from './core/services/i18n.service';
import { ThemePaletteService } from './core/services/theme-palette.service';

export function initAppUi(i18n: I18nService, theme: ThemePaletteService) {
  return () => Promise.all([i18n.init(), theme.init()]);
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    IonicModule.forRoot(),
    IonicStorageModule.forRoot(),
    AppRoutingModule,
    SharedModule,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    {
      provide: APP_INITIALIZER,
      useFactory: initAppUi,
      deps: [I18nService, ThemePaletteService],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
