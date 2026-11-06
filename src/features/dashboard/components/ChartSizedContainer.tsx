/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function ChartSizedContainer({
  fill = false,
  children,
}: {
  fill?: boolean;
  children: (width: number, height: number) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (rawWidth: number, rawHeight: number) => {
      const width = Math.round(rawWidth);
      const height = Math.round(rawHeight);
      if (width <= 0 || height <= 0) return;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) update(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    update(rect.width, rect.height);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn('relative', fill ? 'min-h-[280px] flex-1' : 'h-[280px]')}>
      {size.width > 0 && <div className="absolute inset-0">{children(size.width, size.height)}</div>}
    </div>
  );
}
