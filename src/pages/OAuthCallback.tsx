/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

import { useAuthStore } from '@/stores/authStore';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getBasePath } from '@/lib/basePath';
import { exchangeCode, getStoredOAuthData, clearStoredOAuthData, getOAuthRedirectUri } from '@/services/auth/oauth';

export default function OAuthCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useDocumentTitle(t('oauth.title', 'Signing in'));

  useEffect(() => {
    async function handleCallback() {
      try {
        const code = searchParams.get('code');
        const stateParam = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          throw new Error(errorDescription || errorParam);
        }

        if (!code || !stateParam) {
          throw new Error(t('oauth.missingParams', 'Missing authorization code or state parameter'));
        }

        const { codeVerifier, tokenEndpoint, state, returnUrl, endSessionEndpoint } = getStoredOAuthData();

        if (!state || state !== stateParam) {
          throw new Error(t('oauth.stateMismatch', 'State parameter mismatch. Please try logging in again.'));
        }

        if (!codeVerifier || !tokenEndpoint) {
          throw new Error(t('oauth.missingData', 'Missing OAuth session data. Please try logging in again.'));
        }

        const redirectUri = getOAuthRedirectUri();
        const tokenResponse = await exchangeCode(code, codeVerifier, tokenEndpoint, redirectUri);

        useAuthStore
          .getState()
          .setTokens(
            tokenResponse.access_token,
            tokenResponse.refresh_token,
            tokenResponse.expires_in,
            tokenEndpoint,
            endSessionEndpoint,
          );

        clearStoredOAuthData();

        const basePath = getBasePath();
        const stripBase = (p: string) => (basePath && p.startsWith(basePath) ? p.slice(basePath.length) || '/' : p);
        const candidate = returnUrl ? stripBase(returnUrl) : '/';
        const isAuthPath =
          candidate === '/login' ||
          candidate.startsWith('/login?') ||
          candidate === '/oauth/callback' ||
          candidate.startsWith('/oauth/callback?');
        const destination = isAuthPath ? '/' : candidate;
        navigate(destination, { replace: true });
      } catch (err) {
        clearStoredOAuthData();
        setError(err instanceof Error ? err.message : t('oauth.error', 'Authentication failed'));
      }
    }

    handleCallback();
  }, [navigate, searchParams, t]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="fixed right-4 top-4 z-50">
          <ThemeSwitcher />
        </div>
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <a href={`${getBasePath()}/login`} className="text-sm text-primary underline-offset-4 hover:underline">
            {t('oauth.backToLogin', 'Back to login')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="fixed right-4 top-4 z-50">
        <ThemeSwitcher />
      </div>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('oauth.processing', 'Completing sign in...')}</p>
      </div>
    </div>
  );
}
