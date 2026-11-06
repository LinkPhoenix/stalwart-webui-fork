/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useId } from 'react';
import { ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ObjectVariant } from '@/types/schema';
import type { ActionGroup } from '../actionModel';

interface ActionPickerProps {
  title: string;
  subtitle?: string;
  groups: ActionGroup[];
  disabled: boolean;
  onPick: (variant: ObjectVariant) => void;
}

function ActionGroupSection({
  group,
  disabled,
  onPick,
}: { group: ActionGroup } & Pick<ActionPickerProps, 'disabled' | 'onPick'>) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-dim">
        {group.label}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {group.actions.map(({ variant, name }) => (
          <Button
            key={variant.name}
            variant="outline"
            className="group h-auto justify-between gap-3 whitespace-normal rounded-2xl px-4 py-3 text-left font-medium"
            disabled={disabled}
            onClick={() => onPick(variant)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-highlight text-highlight-foreground">
                <Zap aria-hidden="true" />
              </span>
              <span className="min-w-0">{name}</span>
            </span>
            <ChevronRight
              aria-hidden="true"
              className="text-dim transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Button>
        ))}
      </div>
    </section>
  );
}

export function ActionPicker({ title, subtitle, groups, disabled, onPick }: ActionPickerProps) {
  return (
    <div className="space-y-3.5">
      <div className="px-1 pb-1 pt-3">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="space-y-6">
        {groups.map((group) => (
          <ActionGroupSection key={group.label} group={group} disabled={disabled} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}
