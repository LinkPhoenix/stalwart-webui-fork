/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  variant?: 'default' | 'destructive';
  onConfirm: () => unknown;
  onCancel?: () => void;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);

  const dismiss = () => {
    if (pending) return;
    onCancel?.();
    onOpenChange?.(false);
  };

  const confirm = async () => {
    if (pending) return;
    let result: unknown;
    try {
      result = onConfirm();
    } catch (err) {
      console.error(err);
      return;
    }
    if (!isPromiseLike(result)) {
      onOpenChange?.(false);
      return;
    }
    setPending(true);
    try {
      await result;
      onOpenChange?.(false);
    } catch (err) {
      console.error(err);
      return;
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <AlertDialogContent onEscapeKeyDown={(e) => pending && e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description !== undefined && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel ?? t('common.cancel', 'Cancel')}</AlertDialogCancel>
          <Button
            type="button"
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={() => void confirm()}
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel ??
              (variant === 'destructive' ? t('common.delete', 'Delete') : t('common.confirm', 'Confirm'))}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
