export type OAuthProviderName = 'google' | 'microsoft';

export type OAuthProviderConfig = {
  provider: OAuthProviderName;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
};

export type OAuthUserProfile = {
  provider: OAuthProviderName;
  providerAccountId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
};
