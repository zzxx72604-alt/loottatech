import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { UserService } from '../../../core/services/user.service';

/**
 * TEMPLATE-DRIVEN form.
 *
 * Two fields, no cross-field rules — so `ngModel` plus template validators is
 * the right tool. Compare with register.ts, which uses a reactive form because
 * it needs a custom validator.
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
        this.error.set(
          typeof err?.error === 'string' ? err.error : 'Email or password is incorrect.',
        );
        this.submitting.set(false);
      },
    });
  }
}
