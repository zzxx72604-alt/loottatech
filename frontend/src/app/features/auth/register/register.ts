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
 * Custom validator — a password must mix letters and numbers.
 *
 * Returns `null` when valid, or an error object when not. That object key
 * (`weakPassword`) is what the template checks to decide which message to show.
 */
export function passwordStrength(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  if (!value) return null;

  const hasLetter = /[a-zA-Z]/.test(value);
  const hasNumber = /\d/.test(value);

  return hasLetter && hasNumber ? null : { weakPassword: true };
}

/**
 * Cross-field validator, applied to the whole group rather than one control,
 * because it needs to see two values at once.
 */
export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

/**
 * REACTIVE form.
 *
 * Chosen over template-driven here because of the two validators above —
 * custom rules live in TypeScript, where they can be read and tested.
 */
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
      address: ['', [Validators.required, Validators.minLength(5)]],
      password: ['', [Validators.required, Validators.minLength(5), passwordStrength]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected control(name: string): AbstractControl | null {
    return this.form.get(name);
  }

  protected showError(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && c.touched;
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    const { name, email, address, password } = this.form.getRawValue();

    this.users.register({ name, email, address, password }).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err) => {
        this.error.set(
          typeof err?.error === 'string' ? err.error : 'Could not create the account.',
        );
        this.submitting.set(false);
      },
    });
  }
}
