/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpCircle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { jmapSet, getAccountId } from '@/services/jmap/client';
import { useToast } from '@/hooks/use-toast';
import { isUpdateAvailable, normalizeVersion } from '@/lib/versionCompare';
import type { JmapSetResponse } from '@/types/jmap';

const WEBUI_REPO = 'stalwartlabs/webui';
const GITHUB_LATEST_RE = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/releases\/latest\//;
const LATEST_CACHE_TTL_MS = 5 * 60 * 1000;

// The GitHub API is rate-limited per IP, so latest-release lookups are shared
// and deduplicated across rows and remounts.
const latestReleaseCache = new Map<string, Promise<string | null>>();

function fetchLatestTag(repo: string): Promise<string | null> {
  const cached = latestReleaseCache.get(repo);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { tag_name?: unknown };
      return typeof data.tag_name === 'string' ? data.tag_name : null;
    } catch {
      return null;
    } finally {
      setTimeout(() => latestReleaseCache.delete(repo), LATEST_CACHE_TTL_MS);
    }
  })();
  latestReleaseCache.set(repo, promise);
  return promise;
}

interface WebAppVersionCellProps {
  resourceUrl: unknown;
}

export function WebAppVersionCell({ resourceUrl }: WebAppVersionCellProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const repo = typeof resourceUrl === 'string' ? GITHUB_LATEST_RE.exec(resourceUrl)?.[1] : undefined;
  // The running bundle's version is only meaningful for the WebUI application
  // itself; other apps do not expose their installed version.
  const currentVersion = repo === WEBUI_REPO ? __APP_VERSION__ : null;
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    fetchLatestTag(repo).then((tag) => {
      if (!cancelled && tag) setLatestVersion(tag);
    });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  if (!repo || !currentVersion) {
    return <span className="text-muted-foreground">—</span>;
  }

  const updateAvailable = latestVersion !== null && isUpdateAvailable(latestVersion, currentVersion);

  async function handleUpdate() {
    setUpdating(true);
    try {
      const accountId = getAccountId('x:Action');
      const responses = await jmapSet('x:Action', accountId, {
        create: { 'action-0': { '@type': 'UpdateApps' } },
      });
      const result = responses[responses.length - 1][1] as unknown as JmapSetResponse;
      if (result.created?.['action-0']) {
        toast({
          title: t('webApps.updateStarted', 'Update started'),
          description: t(
            'webApps.updateStartedBody',
            'The server is downloading the latest version. Reload the page in a few seconds to use it.',
          ),
        });
      } else {
        const err = result.notCreated?.['action-0'];
        throw new Error(err?.description ?? err?.type ?? t('webApps.updateRejected', 'The server rejected the update.'));
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('webApps.updateFailed', 'Update failed'),
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <span>v{normalizeVersion(currentVersion)}</span>
      {latestVersion && !updateAvailable && (
        <span className="text-xs text-muted-foreground">{t('webApps.upToDate', 'Up to date')}</span>
      )}
      {updateAvailable && latestVersion && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={updating}
            onClick={() => setConfirmOpen(true)}
          >
            {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
            {t('webApps.updateTo', 'Update to v{{version}}', { version: normalizeVersion(latestVersion) })}
          </Button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('webApps.confirmTitle', 'Update application?')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t(
                    'webApps.confirmBody',
                    'The application will be updated from v{{from}} to v{{to}}. The server downloads the new package and starts serving it immediately.',
                    { from: normalizeVersion(currentVersion), to: normalizeVersion(latestVersion) },
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleUpdate}>{t('webApps.confirm', 'Update')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
