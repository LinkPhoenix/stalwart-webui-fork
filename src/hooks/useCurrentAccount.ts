/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useState } from 'react';

import { useAuthStore } from '@/stores/authStore';
import { jmapGetBatched } from '@/services/jmap/client';

export interface CurrentAccountDetails {
  username: string | null;
  email: string | null;
  fullName: string | null;
}

// Fetches the current user's x:Account record to expose the login name,
// email address and full name independently from the JMAP session account name.
export function useCurrentAccountDetails(): CurrentAccountDetails {
  const { primaryAccountId } = useAuthStore();
  const [details, setDetails] = useState<CurrentAccountDetails>({
    username: null,
    email: null,
    fullName: null,
  });

  useEffect(() => {
    if (!primaryAccountId) return;

    let cancelled = false;

    void (async () => {
      try {
        const list = await jmapGetBatched(
          'x:Account',
          primaryAccountId,
          [primaryAccountId],
          ['id', 'name', 'emailAddress', 'description'],
        );
        const record = list[0];
        if (!record || cancelled) return;
        setDetails({
          username: (record.name as string | undefined) ?? null,
          email: (record.emailAddress as string | undefined) ?? null,
          fullName: (record.description as string | undefined) ?? null,
        });
      } catch (err) {
        console.error('Failed to fetch current account details:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [primaryAccountId]);

  return details;
}