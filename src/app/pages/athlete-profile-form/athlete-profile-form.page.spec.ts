import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AthleteProfileFormPage } from './athlete-profile-form.page';

describe('AthleteProfileFormPage', () => {
  let component: AthleteProfileFormPage;
  let fixture: ComponentFixture<AthleteProfileFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AthleteProfileFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
