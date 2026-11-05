import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Address, emptyAddress } from '../../../core/models/address.model';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-home-hub-hero',
  templateUrl: './home-hub-hero.component.html',
  styleUrls: ['./home-hub-hero.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class HomeHubHeroComponent implements OnInit, OnDestroy {
  apelido = '';
  avatarUrl: string | null = null;
  locationChips: string[] = [];

  private profileSub?: Subscription;
  private localeSub?: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.applyProfile();
    this.profileSub = this.auth.onProfileChanged.subscribe(() => {
      this.applyProfile();
      this.cdr.markForCheck();
    });
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
    this.localeSub?.unsubscribe();
  }

  private applyProfile(): void {
    this.apelido = this.auth.getApelido() || this.auth.getDisplayName();
    this.avatarUrl = this.auth.getAvatarUrl();
    this.locationChips = this.buildLocationChips(this.readAddress());
  }

  private readAddress(): Address {
    const raw = this.auth.getCurrentUser()?.get('address') as Partial<Address> | undefined;
    if (!raw || typeof raw !== 'object') {
      return emptyAddress();
    }
    return { ...emptyAddress(), ...raw };
  }

  private buildLocationChips(address: Address): string[] {
    const chips: string[] = [];
    const state = address.state?.trim();
    const city = address.city?.trim();
    const neighborhood = address.neighborhood?.trim();
    if (state) chips.push(state);
    if (city) chips.push(city);
    if (neighborhood) chips.push(neighborhood);
    return chips;
  }
}
