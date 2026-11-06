/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ResolvedItemAction } from './listActions';

type NavigateAction = Extract<ResolvedItemAction, { kind: 'navigate' }>;
type MutationAction = Extract<ResolvedItemAction, { kind: 'mutation' }>;

interface RowActionsProps {
  actions: ResolvedItemAction[];
  label: string;
  hrefFor: (action: NavigateAction) => string | null;
  onMutation: (action: MutationAction) => void;
  onLocked: () => void;
  disabled?: boolean;
}

export function RowActions({ actions, label, hrefFor, onMutation, onLocked, disabled = false }: RowActionsProps) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-label={t('list.actionsFor', 'Actions for {{label}}', { label })}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((entry) => {
          if (entry.kind === 'separator') return <DropdownMenuSeparator key={entry.key} />;
          if (entry.kind === 'mutation') {
            return (
              <DropdownMenuItem
                key={entry.key}
                className={
                  entry.action.type === 'delete'
                    ? 'text-destructive focus:bg-destructive-soft focus:text-destructive'
                    : undefined
                }
                onSelect={() => onMutation(entry)}
              >
                {entry.action.label}
              </DropdownMenuItem>
            );
          }
          if (entry.locked) {
            return (
              <DropdownMenuItem key={entry.key} onSelect={onLocked}>
                {entry.label}
                <Lock className="ml-auto h-3 w-3 text-dim" aria-hidden />
                <span className="sr-only">
                  {t('enterprise.featureDisabled', 'This feature requires an Enterprise license.')}
                </span>
              </DropdownMenuItem>
            );
          }
          const href = hrefFor(entry);
          if (!href) return null;
          return (
            <DropdownMenuItem key={entry.key} asChild>
              <Link to={href}>{entry.label}</Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
