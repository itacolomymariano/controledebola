import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { AppStorageService } from '../../core/services/app-storage.service';
import { BiometricUnlockService } from '../../core/services/biometric-unlock.service';
import { PostAuthNavigationService } from '../../core/services/post-auth-navigation.service';
import { I18nService } from '../../core/services/i18n.service';
import { SharedModule } from '../../shared/shared.module';
import { RegisterPage } from './register.page';

describe('RegisterPage', () => {
  let component: RegisterPage;
  let fixture: ComponentFixture<RegisterPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RegisterPage],
      imports: [IonicModule.forRoot(), ReactiveFormsModule, SharedModule],
      providers: [
        { provide: Router, useValue: { navigateByUrl: jasmine.createSpy('navigateByUrl') } },
        { provide: AuthService, useValue: {} },
        {
          provide: AppStorageService,
          useValue: {
            getRegisterDraft: jasmine.createSpy('getRegisterDraft').and.resolveTo(null),
            setRegisterDraft: jasmine.createSpy('setRegisterDraft').and.resolveTo(undefined),
            getWizardPath: jasmine.createSpy('getWizardPath').and.resolveTo(null),
          },
        },
        { provide: BiometricUnlockService, useValue: {} },
        { provide: PostAuthNavigationService, useValue: {} },
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => key,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts on identity step', () => {
    expect(component.currentStep).toBe('identity');
  });

  it('advances to contact when identity is valid', () => {
    component.form.patchValue({ name: 'Maria Silva', apelido: 'Mari' });
    expect(component.validateCurrentStep()).toBeTrue();
    component.goNext();
    expect(component.currentStep).toBe('contact');
  });
});
