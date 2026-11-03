import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStorageService } from '../../core/services/app-storage.service';
import { AthleteProfileService } from '../../core/services/athlete-profile.service';
import { AuthService } from '../../core/services/auth.service';
import { FanProfileService } from '../../core/services/fan-profile.service';
import { I18nService } from '../../core/services/i18n.service';
import { RoleProfileService } from '../../core/services/role-profile.service';
import { SharedModule } from '../../shared/shared.module';
import { ProfileSetupPage } from './profile-setup.page';

describe('ProfileSetupPage', () => {
  let component: ProfileSetupPage;
  let fixture: ComponentFixture<ProfileSetupPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProfileSetupPage],
      imports: [IonicModule.forRoot(), ReactiveFormsModule, SharedModule],
      providers: [
        { provide: Router, useValue: { navigateByUrl: jasmine.createSpy('navigateByUrl') } },
        { provide: AuthService, useValue: { setPrimaryRole: jasmine.createSpy('setPrimaryRole') } },
        { provide: AthleteProfileService, useValue: { create: jasmine.createSpy('create') } },
        { provide: FanProfileService, useValue: {} },
        { provide: RoleProfileService, useValue: {} },
        {
          provide: AppStorageService,
          useValue: {
            getWizardPath: jasmine.createSpy('getWizardPath').and.resolveTo('athlete'),
            getProfileSetupDraft: jasmine.createSpy('getProfileSetupDraft').and.resolveTo(null),
            setProfileSetupDraft: jasmine.createSpy('setProfileSetupDraft').and.resolveTo(undefined),
            clearProfileSetupDraft: jasmine.createSpy('clearProfileSetupDraft').and.resolveTo(undefined),
            setProfileWizardComplete: jasmine.createSpy('setProfileWizardComplete').and.resolveTo(undefined),
            clearWizardPath: jasmine.createSpy('clearWizardPath').and.resolveTo(undefined),
          },
        },
        {
          provide: I18nService,
          useValue: { t: (key: string) => key },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileSetupPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await component.ionViewWillEnter();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('advances athlete wizard from positions to measures', () => {
    expect(component.currentAthleteStep).toBe('positions');
    component.athleteForm.patchValue({
      primaryPosition: 'Goleiro',
      shoeSize: 42,
      heightMeter: 1,
      heightCm: 75,
      weight: 80,
    });
    expect(component.validateCurrentWizardStep()).toBeTrue();
    component.goWizardNext();
    expect(component.currentAthleteStep).toBe('measures');
  });
});
