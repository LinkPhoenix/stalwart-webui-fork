/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({
  className,
  variant = 'field',
  ...props
}: React.ComponentProps<'textarea'> & { variant?: 'field' | 'bare' }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-[60px] w-full px-3 py-2 text-base placeholder:text-dim focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        variant === 'field' ? 'field-surface rounded-lg' : 'border-0 bg-transparent',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
