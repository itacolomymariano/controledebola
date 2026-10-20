import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

import { TabsPage } from './tabs.page';

describe('TabsPage', () => {
  let component: TabsPage;
  let fixture: ComponentFixture<TabsPage>;
  let routerEvents: Subject<unknown>;
  let router: { url: string; events: Subject<unknown>; navigateByUrl: jasmine.Spy };

  beforeEach(async () => {
    routerEvents = new Subject();
    router = {
      url: '/tabs/home',
      events: routerEvents,
      navigateByUrl: jasmine.createSpy('navigateByUrl').and.returnValue(Promise.resolve(true)),
    };

    await TestBed.configureTestingModule({
      declarations: [TabsPage],
      providers: [{ provide: Router, useValue: router }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TabsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('isFooterTabActive reflects router url', () => {
    expect(component.isFooterTabActive('peladas')).toBe(false);
    router.url = '/tabs/peladas/lista';
    expect(component.isFooterTabActive('peladas')).toBe(true);
  });
});
