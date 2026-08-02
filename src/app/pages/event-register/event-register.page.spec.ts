import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventRegisterPage } from './event-register.page';

describe('EventRegisterPage', () => {
  let component: EventRegisterPage;
  let fixture: ComponentFixture<EventRegisterPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EventRegisterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
