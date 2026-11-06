/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { HelpCircle, type LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Markdown } from '@/components/common/Markdown';
import { cn } from '@/lib/utils';

export interface HelpTooltipProps {
  content: string;
  label?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  icon?: LucideIcon;
  className?: string;
}

export function HelpTooltip({ content, label, side = 'top', icon: Icon = HelpCircle, className }: HelpTooltipProps) {
  const { t } = useTranslation();
  const ariaLabel = label
    ? t('common.helpFor', 'Help: {{name}}', { name: label })
    : t('common.moreInfo', 'More information');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'inline-flex shrink-0 cursor-help items-center rounded-full text-dim transition-colors hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
          onClick={(e) => e.preventDefault()}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs">
        <Markdown source={content} className="text-xs" />
      </TooltipContent>
    </Tooltip>
  );
}
