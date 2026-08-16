export interface User {
  id: string;
  name: string;
  email: string;
  address: string;
  isAdmin: boolean;
  /** JWT. Sent back on every request by authInterceptor. */
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  address: string;
}
