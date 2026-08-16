import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService } from 'src/app/services/user.service';
import { PasswordsMatchValidator } from 'src/app/shared/validators/password_match_validator';

@Component({
  selector: 'app-profile-page',
  templateUrl: './profile-page.component.html',
  styleUrls: ['./profile-page.component.css'],
})
export class ProfilePageComponent implements OnInit {
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  profileSubmitted = false;
  passwordSubmitted = false;

  constructor(private formBuilder: FormBuilder, private userService: UserService) {}

  ngOnInit(): void {
    const user = this.userService.currentUser;

    this.profileForm = this.formBuilder.group({
      name: [user.name, [Validators.required, Validators.minLength(5)]],
      email: [user.email, [Validators.required, Validators.email]],
    });

    this.passwordForm = this.formBuilder.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(5)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: PasswordsMatchValidator('newPassword', 'confirmPassword') }
    );
  }

  get pf() {
    return this.profileForm.controls;
  }

  get pwf() {
    return this.passwordForm.controls;
  }

  submitProfile() {
    this.profileSubmitted = true;
    if (this.profileForm.invalid) return;
    this.userService
      .updateProfile(this.pf.name.value, this.pf.email.value)
      .subscribe();
  }

  submitPassword() {
    this.passwordSubmitted = true;
    if (this.passwordForm.invalid) return;
    this.userService
      .changePassword(this.pwf.currentPassword.value, this.pwf.newPassword.value)
      .subscribe(() => {
        this.passwordForm.reset();
        this.passwordSubmitted = false;
      });
  }
}
