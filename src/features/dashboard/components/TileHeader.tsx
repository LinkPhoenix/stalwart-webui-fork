/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { HelpCircle, Info } from 'lucide-react';
import { DynamicIcon } from '@/components/common/DynamicIcon';
import { HelpTooltip } from '@/components/common/HelpTooltip';
import { cn } from '@/lib/utils';

export function TileHeader({
  icon,
  title,
  description,
  badgeClass,
}: {
  icon?: string;
  title: string;
  description?: string;
  badgeClass: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {icon && (
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-[11px]', badgeClass)}>
          <DynamicIcon name={icon} fallback={HelpCircle} className="size-[17px]" />
        </span>
      )}
      <h2 className="section-title truncate">{title}</h2>
      {description && <HelpTooltip content={description} label={title} icon={Info} />}
    </div>
  );
}
