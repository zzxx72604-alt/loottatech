export type Role = 'Customer' | 'Admin';

/** What POST /api/auth/login returns. Never contains a password. */
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
