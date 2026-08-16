import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { UserService } from 'src/app/services/user.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(private userService: UserService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    const user = this.userService.currentUser;
    if (user.token && user.isAdmin) return true;
    return this.router.parseUrl(user.token ? '/' : '/login');
  }
}
