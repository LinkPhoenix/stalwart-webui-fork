/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ReactNode } from 'react';

export function FloatingActionBar({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="pointer-events-none sticky bottom-4 z-20 flex justify-center pt-2">
      <div
        role={label ? 'group' : undefined}
        aria-label={label}
        className="pointer-events-auto flex max-w-full items-center gap-1.5 rounded-full bg-ink p-1.5 text-ink-foreground shadow-ink"
      >
        {children}
      </div>
    </div>
  );
}

export function FloatingActionDivider() {
  return <span className="mx-0.5 h-5 w-px bg-ink-foreground/15" aria-hidden="true" />;
}

export function FloatingActionDot() {
  return <span className="h-2 w-2 shrink-0 rounded-full bg-ink-accent" aria-hidden="true" />;
}
