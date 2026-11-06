/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { type FormEvent, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2 } from 'lucide-react';

import Logo from '@/components/common/Logo';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { startAuthFlow } from '@/services/auth/oauth';
import { errorMessage } from '@/lib/jmapErrors';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const originalPath = (location.state as { from?: string } | null)?.from ?? null;
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);

  useDocumentTitle(t('login.title', 'Sign in'));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;

    setError(null);
    setLoading(true);

    try {
      await startAuthFlow(trimmed, originalPath);
    } catch (err) {
      setError(errorMessage(err, t('login.error', 'An unexpected error occurred')));
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(48rem_22rem_at_50%_-4rem,var(--highlight),transparent_72%)]"
        aria-hidden="true"
      />
      <div className="tile relative w-full max-w-[400px] px-7 pb-8 pt-9 sm:px-9">
        <div className="flex justify-center text-foreground">
          <Logo />
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-1.5 text-center">
            <h1 className="page-title">{t('login.title', 'Sign in')}</h1>
            <p className="text-sm text-muted-foreground">{t('login.prompt', 'Enter your account name to continue')}</p>
          </div>

          <Input
            id="username"
            type="text"
            autoComplete="username"
            autoFocus
            placeholder={t('login.usernamePlaceholder', 'user@example.com')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            aria-label={t('login.prompt', 'Enter your account name to continue')}
            className="h-11 rounded-full px-5"
          />

          {error && (
            <p className="rounded-xl bg-destructive-soft px-4 py-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {!error && sessionExpired && (
            <p className="rounded-xl bg-info-soft px-4 py-3 text-center text-sm text-info" role="status">
              {t('errors.sessionExpired', 'Your session has expired. Please sign in again.')}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading || !username.trim()}>
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                {t('login.continue', 'Continue')}
                <ArrowRight />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
