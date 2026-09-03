export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: string;
  locale: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  plan: string;
  locale: string;
  tokenType: 'access' | 'refresh';
}
