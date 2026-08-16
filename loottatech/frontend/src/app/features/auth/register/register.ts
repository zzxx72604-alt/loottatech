import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user.service';

/**
 * A password must mix letters and numbers.
 *
 * Returns null when valid, or an error object when not. The key name
 * (`weakPassword`) is what the template checks to pick a message.
 */
export function passwordStrength(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  if (!value) return null;

  const hasLetter = /[a-zA-Z]/.test(value);
  const hasNumber = /\d/.test(value);

  return hasLetter && hasNumber ? null : { weakPassword: true };
}

/**
 * Cross-field validators, applied to the GROUP rather than one control,
 * because they need to see two values at once. A single control can never
 * see its sibling.
 */
export function fieldsMatch(a: string, b: string, errorKey: string) {
  return (group: AbstractControl): ValidationErrors | null =>
    group.get(a)?.value === group.get(b)?.value ? null : { [errorKey]: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: '../login/login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly users = inject(UserService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  protected readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      confirmEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6), passwordStrength]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: [
        fieldsMatch('email', 'confirmEmail', 'emailMismatch'),
        fieldsMatch('password', 'confirmPassword', 'passwordMismatch'),
      ],
    },
  );

  protected control(name: string): AbstractControl | null {
    return this.form.get(name);
  }

  protected showError(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  protected groupError(key: string, touchedField: string): boolean {
    return !!this.form.errors?.[key] && !!this.form.get(touchedField)?.touched;
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    this.users.register(this.form.getRawValue()).subscribe({
      next: () => this.router.navigateByUrl('/arcade'),
      error: (err) => {
        const e = err as { status?: number; error?: unknown };
        this.error.set(
          e.status === 0
            ? "Can't reach the shop. Is the API running?"
            : typeof e.error === 'string'
              ? e.error
              : 'Could not create the account.',
        );
        this.submitting.set(false);
      },
    });
  }
}
