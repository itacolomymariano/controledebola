import { Injectable } from '@angular/core';
import { CanMatch, Route, Router, UrlSegment, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanMatch {
  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  canMatch(_route: Route, _segments: UrlSegment[]): Promise<boolean | UrlTree> {
    return this.authService.validateSession().then(
      (valid) => (valid ? true : this.router.parseUrl('/login')),
      () => this.router.parseUrl('/login')
    );
  }
}
