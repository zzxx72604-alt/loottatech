export type Role = 'Customer' | 'Admin';

/** Matches AuthResultDto in the ASP.NET Core API. Never contains a password. */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  coins: number;
  token: string;
  expiresAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  confirmEmail: string;
  password: string;
  confirmPassword: string;
}
