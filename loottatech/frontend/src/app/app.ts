import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHost } from './shared/components/toast/toast';
import { Header } from './layout/header/header';
import { Footer } from './layout/footer/footer';
import { SideRail } from './layout/side-rail/side-rail';

@Component({
  selector: 'app-root',
  imports: [ToastHost, RouterOutlet, Header, Footer, SideRail],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
