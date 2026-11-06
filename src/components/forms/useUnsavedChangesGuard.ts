/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useRef } from 'react';
import { useBlocker, type Blocker } from 'react-router-dom';

export interface UnsavedChangesGuard {
  blocker: Blocker;
  allowNextNavigation: () => void;
}

export function useUnsavedChangesGuard(when: boolean): UnsavedChangesGuard {
  const bypass = useRef(false);

  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);

  const blocker = useBlocker(() => when && !bypass.current);

  return {
    blocker,
    allowNextNavigation: () => {
      bypass.current = true;
    },
  };
}
