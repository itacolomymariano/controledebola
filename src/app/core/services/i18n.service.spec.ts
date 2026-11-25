import { ApplicationRef, NgZone } from '@angular/core';
import { of } from 'rxjs';
import { AppStorageService } from './app-storage.service';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  const pt = { 'tabs.home': 'Início' };
  const en = { 'tabs.home': 'Home' };
  const es = { 'tabs.home': 'Inicio' };

  function createService(): {
    service: I18nService;
    setLocaleSpy: jasmine.Spy;
    tickSpy: jasmine.Spy;
    httpGetSpy: jasmine.Spy;
  } {
    const storage: Pick<AppStorageService, 'getLocale' | 'setLocale'> = {
      getLocale: async () => null,
      setLocale: async () => undefined,
    };
    const httpGetSpy = jasmine.createSpy('get').and.callFake((url: string) => {
      if (url.includes('en-GB')) return of(en);
      if (url.includes('es-ES')) return of(es);
      return of(pt);
    });
    const http = { get: httpGetSpy };
    const appRef = { tick: () => undefined } as ApplicationRef;
    const tickSpy = spyOn(appRef, 'tick');
    const ngZone = { run: (fn: () => void) => fn() } as NgZone;
    const service = new I18nService(
      http as never,
      storage as AppStorageService,
      appRef,
      ngZone
    );
    return { service, setLocaleSpy: jasmine.createSpy(), tickSpy, httpGetSpy };
  }

  it('isAppLocale accepts only configured locales', async () => {
    const { service } = createService();
    expect(service.isAppLocale('en-GB')).toBe(true);
    expect(service.isAppLocale('fr-FR')).toBe(false);
  });

  it('applyAppLocale updates locale and t()', async () => {
    const { service } = createService();
    await service.init();
    await service.applyAppLocale('en-GB');
    expect(service.locale).toBe('en-GB');
    expect(service.t('tabs.home')).toBe('Home');
    await service.applyAppLocale('es-ES');
    expect(service.t('tabs.home')).toBe('Inicio');
  });

  it('applyAppLocale is noop when locale unchanged', async () => {
    const { service, tickSpy } = createService();
    await service.init();
    tickSpy.calls.reset();
    await service.applyAppLocale('pt-BR');
    expect(tickSpy).not.toHaveBeenCalled();
  });

  it('setLocale uses precached dict without extra HTTP after init', async () => {
    const { service, httpGetSpy } = createService();
    await service.init();
    const callsAfterInit = httpGetSpy.calls.count();
    await service.applyAppLocale('en-GB');
    await service.applyAppLocale('es-ES');
    await service.applyAppLocale('pt-BR');
    expect(httpGetSpy.calls.count()).toBe(callsAfterInit);
  });
});