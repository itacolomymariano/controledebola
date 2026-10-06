import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { WizardTourStep } from '../../../core/models/wizard-tour.model';
import { AuthService } from '../../../core/services/auth.service';
import { WizardTourService } from '../../../core/services/wizard-tour.service';

@Component({
  selector: 'app-wizard-tour',
  templateUrl: './wizard-tour.component.html',
  styleUrls: ['./wizard-tour.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class WizardTourComponent implements OnInit, OnDestroy {
  current: WizardTourStep | null = null;
  stepIndex = 0;
  total = 0;
  visible = false;
  private keyboardOpen = false;

  private subs: Subscription[] = [];
  private readonly onFocusIn = (event: FocusEvent): void => {
    if (!this.isTextField(event.target)) return;
    this.keyboardOpen = true;
    this.sync();
    const field = event.target as HTMLElement;
    window.setTimeout(() => field.scrollIntoView({ block: 'center', inline: 'nearest' }), 280);
  };
  private readonly onFocusOut = (): void => {
    window.setTimeout(() => {
      this.keyboardOpen = this.isTextField(document.activeElement);
      this.sync();
    }, 180);
  };

  constructor(
    private readonly tour: WizardTourService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.total = this.tour.total;
    this.subs.push(
      this.tour.active$.subscribe(() => this.sync()),
      this.tour.stepIndex$.subscribe(() => this.sync()),
      this.tour.pendingCompletionStepId$.subscribe(() => this.sync()),
      this.auth.onProfileChanged.subscribe(() => {
        void this.tour.maybeAutoStart(this.router.url);
        this.sync();
      }),
      this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
        void this.tour.maybeAutoStart((event as NavigationEnd).urlAfterRedirects);
        this.sync();
      })
    );
    void this.tour.maybeAutoStart(this.router.url);
    document.addEventListener('focusin', this.onFocusIn, true);
    document.addEventListener('focusout', this.onFocusOut, true);
    this.sync();
  }

  ngOnDestroy(): void {
    document.removeEventListener('focusin', this.onFocusIn, true);
    document.removeEventListener('focusout', this.onFocusOut, true);
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }

  follow(): void {
    const route = this.tour.followRoute();
    this.sync();
    if (route) {
      void this.router.navigateByUrl(route);
    }
  }

  skip(): void {
    this.tour.skip();
    this.sync();
  }

  close(): void {
    void this.tour.close();
    this.sync();
  }

  private sync(): void {
    const onAuth = this.tour.isAuthRoute(this.router.url);
    const paused = this.tour.isPausedOnRoute(this.router.url);
    this.current = this.tour.current;
    this.stepIndex = this.tour.stepIndex;
    this.visible = !!this.current && !onAuth && !paused && !this.keyboardOpen && this.auth.isLoggedIn();
    this.cdr.markForCheck();
  }

  private isTextField(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    return !!target.closest('ion-searchbar, ion-input, ion-textarea');
  }
}
