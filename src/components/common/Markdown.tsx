/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';

const MarkdownRenderer = lazy(() => import('@/components/common/MarkdownRenderer'));

export interface MarkdownProps {
  source: string;
  className?: string;
}

export function Markdown({ source, className }: MarkdownProps) {
  const text = source.replace(/\\n/g, '\n');
  return (
    <div
      className={cn(
        '[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-current/10 [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.92em] [&_ol]:list-decimal [&_ol]:pl-4 [&_p+p]:mt-1 [&_ul]:list-disc [&_ul]:pl-4',
        className,
      )}
    >
      <Suspense fallback={<p className="whitespace-pre-line">{text}</p>}>
        <MarkdownRenderer source={text} />
      </Suspense>
    </div>
  );
}
