import { ChangeDetectorRef, Directive, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { I18nService } from '../../core/services/i18n.service';

/**
 * Marca o host OnPush para checagem quando o idioma muda (use via hostDirectives no @Component).
 */
@Directive({
  standalone: true,
})
export class LocaleRefreshDirective implements OnInit, OnDestroy {
  private localeSub?: Subscription;

  constructor(
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }
}