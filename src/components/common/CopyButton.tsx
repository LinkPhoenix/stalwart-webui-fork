/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { cn } from '@/lib/utils';

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children' | 'value'> {
  value: string;
  label?: string;
  showText?: boolean;
}

export function CopyButton({
  value,
  label,
  showText = false,
  variant = 'outline',
  size,
  className,
  ...props
}: CopyButtonProps) {
  const { t } = useTranslation();
  const { copy, isCopied } = useCopyToClipboard();
  const copied = isCopied();
  const actionLabel = label ? t('common.copyValue', 'Copy {{name}}', { name: label }) : t('common.copy', 'Copy');
  const text = copied ? t('common.copied', 'Copied') : actionLabel;

  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (showText ? 'sm' : 'icon')}
      className={cn('shrink-0', className)}
      onClick={() => void copy(value)}
      aria-label={showText ? undefined : text}
      title={showText ? undefined : actionLabel}
      {...props}
    >
      {copied ? <Check /> : <Copy />}
      {showText && <span>{text}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? t('common.copied', 'Copied') : ''}
      </span>
    </Button>
  );
}
