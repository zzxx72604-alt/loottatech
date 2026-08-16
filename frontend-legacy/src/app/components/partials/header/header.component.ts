import { Component, OnInit } from '@angular/core';
import { CartService } from 'src/app/services/cart.service';
import { ConfirmService } from 'src/app/services/confirm.service';
import { NotificationService, NotifItem } from 'src/app/services/notification.service';
import { ThemeService } from 'src/app/services/theme.service';
import { UserService } from 'src/app/services/user.service';
import { User } from 'src/app/shared/models/User';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {

  cartQuantity=0;
  user!:User;
  isDark=false;
  scanOpen=false;
  scanImgError=false;
  scanSrc='assets/scan-qr.jpg';

  notifOpen=false;
  notifCount=0;
  notifItems:NotifItem[]=[];

  constructor(cartService:CartService,private userService:UserService,
    private themeService:ThemeService, private confirmService:ConfirmService,
    private notificationService:NotificationService) {
    cartService.getCartObservable().subscribe((newCart) => {
      this.cartQuantity = newCart.totalCount;
    })

    userService.userObservable.subscribe((newUser) => {
      this.user = newUser;
    })

    this.themeService.isDark$.subscribe((dark) => {
      this.isDark = dark;
    })

    this.notificationService.count$.subscribe((c) => this.notifCount = c);
    this.notificationService.items$.subscribe((items) => this.notifItems = items);
   }

  ngOnInit(): void {
  }

  get siteUrl(): string {
    return window.location.host;   // e.g. 192.168.1.20:4200 or the ngrok domain
  }

  scrollTop(){
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleNotif(){
    this.notifOpen = !this.notifOpen;
    if (this.notifOpen) this.notificationService.markSeen();
  }
  closeNotif(){ this.notifOpen = false; }

  openScan(){ this.scanOpen = true; }
  closeScan(){ this.scanOpen = false; }
  onScanError(){
    if (this.scanSrc.endsWith('.jpg')) this.scanSrc = 'assets/scan-qr.png';
    else this.scanImgError = true;
  }

  async logout(){
    const ok = await this.confirmService.ask(
      'You will be signed out of your account.',
      { title: 'Log out?', confirmText: 'Log out', danger: true }
    );
    if (ok) this.userService.logout();
  }

  toggleTheme(){
    this.themeService.toggle();
  }

  get isAuth(){
    return this.user.token;
  }
}
