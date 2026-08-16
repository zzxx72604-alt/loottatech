import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="wrap">
      <h1>404</h1>
      <p>That page isn't here. It may have sold.</p>
      <a routerLink="/">Back to the shop</a>
    </section>
  `,
  styles: `
    .wrap {
      text-align: center;
      padding: var(--sp-8) var(--sp-4);
    }
    h1 {
      font-size: 56px;
      margin: 0;
      color: var(--text-3);
    }
    p {
      color: var(--text-2);
      margin: var(--sp-2) 0 var(--sp-5);
    }
    a {
      display: inline-block;
      padding: 9px var(--sp-5);
      border-radius: var(--radius-pill);
      background: var(--brand);
      color: var(--brand-ink);
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {}
