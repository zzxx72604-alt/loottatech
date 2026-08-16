import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user.service';

/**
 * TEMPLATE-DRIVEN form.
 *
 * Two fields and no cross-field rules, so `ngModel` with template validators
 * is the right tool. Compare with register.ts, which uses a reactive form
 * because it needs custom validators.
 */
@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly users = inject(UserService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected credentials = { email: '', password: '' };
  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  protected onSubmit(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    this.users.login(this.credentials).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        const e = err as { status?: number; error?: unknown };
        this.error.set(
          e.status === 0
            ? "Can't reach the shop. Is the API running?"
            : e.status === 429
              ? 'Too many attempts. Please wait a few minutes.'
              : typeof e.error === 'string'
                ? e.error
                : 'Email or password is incorrect.',
        );
        this.submitting.set(false);
      },
    });
  }
}
