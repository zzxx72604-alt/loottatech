import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
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

    this.auth.login(this.credentials).subscribe({
      next: (user) => {
        // A customer account must not reach the admin panel.
        if (user.role !== 'Admin') {
          this.auth.logout();
          this.error.set('That account is not an administrator.');
          this.submitting.set(false);
          return;
        }

        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        const e = err as { status?: number; error?: unknown };
        this.error.set(
          e.status === 0
            ? 'Cannot reach the API. Is it running on http://localhost:5197 ?'
            : e.status === 429
              ? 'Too many attempts. Wait a few minutes and try again.'
              : typeof e.error === 'string'
                ? e.error
                : 'Email or password is incorrect.',
        );
        this.submitting.set(false);
      },
    });
  }
}
