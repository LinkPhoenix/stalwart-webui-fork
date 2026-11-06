/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { copyText } from '@/lib/clipboard';

export interface UseCopyToClipboardOptions {
  resetMs?: number;
  notifyOnError?: boolean;
}

export interface CopyToClipboard {
  copy: (text: string, key?: string) => Promise<boolean>;
  copiedKey: string | null;
  isCopied: (key?: string) => boolean;
}

const DEFAULT_KEY = '';

export function useCopyToClipboard({
  resetMs = 1500,
  notifyOnError = true,
}: UseCopyToClipboardOptions = {}): CopyToClipboard {
  const { t } = useTranslation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string, key: string = DEFAULT_KEY) => {
      const ok = await copyText(text);
      if (timer.current) clearTimeout(timer.current);
      if (ok) {
        setCopiedKey(key);
        timer.current = setTimeout(() => setCopiedKey(null), resetMs);
      } else {
        setCopiedKey(null);
        if (notifyOnError) {
          toast({
            title: t('common.copyFailed', 'Copy failed'),
            description: t(
              'common.clipboardBlocked',
              'Your browser blocked clipboard access. Select the value and copy it manually.',
            ),
            variant: 'destructive',
          });
        }
      }
      return ok;
    },
    [resetMs, notifyOnError, t],
  );

  const isCopied = useCallback((key: string = DEFAULT_KEY) => copiedKey === key, [copiedKey]);

  return { copy, copiedKey, isCopied };
}
