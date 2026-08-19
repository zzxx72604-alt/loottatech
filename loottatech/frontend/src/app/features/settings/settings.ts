import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { UserService } from '../../core/services/user.service';
import { TOAST_CORNERS, ToastCorner, ToastService } from '../../core/services/toast.service';
import { ApiService } from '../../core/services/api.service';
import { EditableProfile } from '../../shared/models/profile';

type Section = 'preference' | 'security';

/**
 * Account settings.
 *
 * The profile page links here rather than editing anything itself — one place
 * that owns account changes, and shortcuts everywhere else. Two systems for
 * changing a name is how they end up disagreeing.
 */
@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly fb = inject(FormBuilder);
  private readonly profiles = inject(ProfileService);
  private readonly api = inject(ApiService);
  protected readonly toasts = inject(ToastService);

  protected readonly users = inject(UserService);

  @ViewChild('picker') private picker?: ElementRef<HTMLInputElement>;

  protected readonly section = signal<Section>('preference');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly avatarUrl = signal('');
  protected readonly uploading = signal(false);

  protected readonly genders = ['', 'Female', 'Male', 'Other', 'Prefer not to say'];

  protected readonly corners = TOAST_CORNERS;

  protected chooseCorner(corner: ToastCorner): void {
    this.toasts.setPosition(corner);
    // Show one immediately, so the choice is visible where it will appear.
    this.toasts.success('Notifications will appear here');
  }

  protected get currentCorner(): ToastCorner {
    return this.toasts.position();
  }

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.pattern(/^[0-9+\s-]{0,20}$/)]],
    address: [''],
    gender: [''],
  });

  /**
   * Changing a password asks for the current one.
   *
   * Being signed in is not proof of identity — a borrowed laptop is signed in
   * too. The old password is what stops an account being taken permanently.
   */
  protected readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmNewPassword: ['', [Validators.required]],
  });

  protected readonly passwordSaving = signal(false);
  protected readonly passwordError = signal('');

  constructor() {
    this.profiles.editable().subscribe({
      next: (profile) => {
        this.form.patchValue(profile);
        this.avatarUrl.set(profile.avatarUrl);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load your details.');
        this.loading.set(false);
      },
    });
  }

  protected setSection(section: Section): void {
    this.section.set(section);
    this.error.set('');
    this.passwordError.set('');
  }

  /* ------------------------------------------------------- preference */

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.profiles.update(this.form.getRawValue()).subscribe({
      next: (profile: EditableProfile) => {
        this.saving.set(false);
        this.users.setName(profile.name);
        this.toasts.success('Your details are saved');
      },
      error: (err) => {
        const e = err as { error?: unknown };
        this.error.set(typeof e.error === 'string' ? e.error : 'Could not save your details.');
        this.saving.set(false);
      },
    });
  }

  protected pickAvatar(): void {
    this.picker?.nativeElement.click();
  }

  protected onAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploading.set(true);

    this.profiles.uploadAvatar(file).subscribe({
      next: (profile) => {
        this.avatarUrl.set(profile.avatarUrl);
        this.uploading.set(false);
        this.toasts.success('Profile picture updated');
      },
      error: (err) => {
        const e = err as { error?: unknown };
        this.toasts.error(typeof e.error === 'string' ? e.error : 'Could not upload that image.');
        this.uploading.set(false);
      },
    });
  }

  protected avatarSrc(): string {
    const url = this.avatarUrl();
    return url ? `${url}-480.webp` : '';
  }

  /* ---------------------------------------------------------- security */

  protected changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { newPassword, confirmNewPassword } = this.passwordForm.getRawValue();
    if (newPassword !== confirmNewPassword) {
      this.passwordError.set("The two new passwords don't match.");
      return;
    }

    this.passwordSaving.set(true);
    this.passwordError.set('');

    this.api.put<void>('auth/password', this.passwordForm.getRawValue()).subscribe({
      next: () => {
        this.passwordSaving.set(false);
        this.passwordForm.reset();
        this.toasts.success('Password changed');
      },
      error: (err) => {
        const e = err as { error?: unknown };
        this.passwordError.set(
          typeof e.error === 'string' ? e.error : 'Could not change your password.',
        );
        this.passwordSaving.set(false);
      },
    });
  }
}
