/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

function ToastViewport({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="toast-viewport"
      className={cn(
        'pointer-events-none fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]',
        className,
      )}
      {...props}
    />
  );
}

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-2xl p-4 pr-7 shadow-pop ring-1 transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'bg-popover text-popover-foreground ring-border',
        destructive: 'destructive group bg-destructive-soft text-foreground ring-destructive/40',
        success: 'bg-success-soft text-foreground ring-success/40',
        warning: 'bg-warning-soft text-foreground ring-warning/40',
        info: 'bg-info-soft text-foreground ring-info/40',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Toast({
  className,
  variant,
  open,
  onOpenChange,
  ...props
}: React.ComponentProps<'li'> &
  VariantProps<typeof toastVariants> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) {
  void onOpenChange;
  return (
    <li
      data-slot="toast"
      role={variant === 'destructive' ? 'alert' : 'status'}
      aria-atomic="true"
      className={cn(toastVariants({ variant }), className)}
      data-state={open ? 'open' : 'closed'}
      {...props}
    />
  );
}

function ToastClose({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      data-slot="toast-close"
      aria-label="Close"
      className={cn(
        'absolute right-1.5 top-1.5 rounded-full p-1 text-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring',
        className,
      )}
      type="button"
      {...props}
    >
      <X className="h-4 w-4" />
    </button>
  );
}

function ToastTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="toast-title" className={cn('text-sm font-semibold [&+div]:text-xs', className)} {...props} />;
}

function ToastDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="toast-description" className={cn('text-sm opacity-90', className)} {...props} />;
}

export { ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, toastVariants };
export type { VariantProps };
